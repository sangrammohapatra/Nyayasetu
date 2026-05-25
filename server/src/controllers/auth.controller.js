const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("../models/User.model");
const LawyerProfile = require("../models/LawyerProfile.model");
const AuditLog = require("../models/AuditLog.model");
const redisConfig = require("../config/redis");
const { sendOTP } = require("../services/notification/smsService");
const { createError } = require("../middleware/error.middleware");
const asyncHandler = require("../utils/asyncHandler");
const logger = require("../utils/logger");
const {
  INDIAN_PHONE_REGEX,
  DEV_PHONE: CONFIG_DEV_PHONE,
  DEV_OTP,
  PERSONAS,
  MAX_REFRESH_TOKENS,
  SUPPORTED_LANGUAGES,
} = require("../config/constants");

const DEV_PHONE = CONFIG_DEV_PHONE || "+919999999999";
const DEFAULT_DEV_OTP = DEV_OTP || "123456";
const PERSONA_MAP = PERSONAS || {
  CITIZEN: "citizen",
  LAWYER: "lawyer",
  PARALEGAL: "paralegal",
  ADMIN: "admin",
};
const LANGUAGE_LIST = SUPPORTED_LANGUAGES || [
  "en",
  "hi",
  "bn",
  "mr",
  "ta",
  "te",
  "gu",
  "kn",
  "ml",
  "pa",
  "ur",
];

const OTP_TTL_SECONDS = 300; // 5 minutes
const OTP_ATTEMPT_TTL_SECONDS = 900; // 15 minutes

// ── In-memory fallback store (used when Redis is unavailable) ──────────────────
// Entries: { value, expiresAt: timestamp }
const memoryOtpStore = new Map();
const memoryOtpAttemptStore = new Map();

// ─── Helpers ───────────────────────────────────────────────────────────────────

function normalizePhone(raw) {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, "");
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 11 && digits.startsWith("0"))
    return `+91${digits.slice(1)}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  if (digits.length === 13 && digits.startsWith("091"))
    return `+91${digits.slice(3)}`;
  return raw;
}

function generateOTP() {
  return String(crypto.randomInt(100000, 999999));
}

function getRedisClient() {
  return redisConfig.getRedisClient
    ? redisConfig.getRedisClient()
    : redisConfig.redisClient;
}

function isExpired(entry) {
  return !entry || entry.expiresAt <= Date.now();
}

function getMemoryValue(store, key) {
  const entry = store.get(key);
  if (isExpired(entry)) {
    store.delete(key);
    return null;
  }
  return entry.value;
}

function setMemoryValue(store, key, value, ttlSeconds) {
  store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}

function deleteMemoryValue(store, key) {
  store.delete(key);
}

const otpKey = (phone) => `otp:${phone}`;
const otpAttemptKey = (phone) => `otp_attempts:${phone}`;

async function getOtpValue(phone) {
  const rc = getRedisClient();
  if (rc) return rc.get(otpKey(phone));
  return getMemoryValue(memoryOtpStore, otpKey(phone));
}

async function setOtpValue(phone, otp) {
  const rc = getRedisClient();
  if (rc) {
    // ioredis: setEx | node-redis v3: setex | node-redis v4: set with EX
    if (typeof rc.setEx === "function")
      await rc.setEx(otpKey(phone), OTP_TTL_SECONDS, otp);
    else if (typeof rc.setex === "function")
      await rc.setex(otpKey(phone), OTP_TTL_SECONDS, otp);
    else await rc.set(otpKey(phone), otp, "EX", OTP_TTL_SECONDS);
    return "redis";
  }
  setMemoryValue(memoryOtpStore, otpKey(phone), otp, OTP_TTL_SECONDS);
  return "memory";
}

async function deleteOtpValue(phone) {
  const rc = getRedisClient();
  if (rc) {
    await rc.del(otpKey(phone));
    return;
  }
  deleteMemoryValue(memoryOtpStore, otpKey(phone));
}

async function getOtpAttempts(phone) {
  const rc = getRedisClient();
  if (rc) {
    const val = await rc.get(otpAttemptKey(phone));
    return val ? parseInt(val, 10) : 0;
  }
  return getMemoryValue(memoryOtpAttemptStore, otpAttemptKey(phone)) || 0;
}

async function incrementOtpAttemptsValue(phone) {
  const rc = getRedisClient();
  const key = otpAttemptKey(phone);
  if (rc) {
    await rc.incr(key);
    await rc.expire(key, OTP_ATTEMPT_TTL_SECONDS);
    return;
  }
  const cur = getMemoryValue(memoryOtpAttemptStore, key) || 0;
  setMemoryValue(memoryOtpAttemptStore, key, cur + 1, OTP_ATTEMPT_TTL_SECONDS);
}

async function clearOtpAttemptsValue(phone) {
  const rc = getRedisClient();
  if (rc) {
    await rc.del(otpAttemptKey(phone));
    return;
  }
  deleteMemoryValue(memoryOtpAttemptStore, otpAttemptKey(phone));
}

function signTokenPair(user) {
  const payload = {
    userId: user._id.toString(),
    persona: user.persona,
    plan: user.subscription?.plan || "free",
  };
  const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "15m",
  });
  const refreshToken = jwt.sign(
    { userId: user._id.toString(), type: "refresh" },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "30d" },
  );
  return { accessToken, refreshToken };
}

function safeUserResponse(user) {
  const obj = user.toObject ? user.toObject() : { ...user };
  delete obj.refreshTokens;
  delete obj.whatsappSessionData;
  delete obj.__v;
  return obj;
}

const MAX_OTP_ATTEMPTS = 5;

async function checkOTPAttempts(phone) {
  const attempts = await getOtpAttempts(phone);
  if (attempts >= MAX_OTP_ATTEMPTS) {
    throw createError(
      429,
      "TOO_MANY_OTP_ATTEMPTS",
      "Too many incorrect OTP attempts. Please request a new OTP after 15 minutes.",
    );
  }
}

// ─── sendOTPHandler ────────────────────────────────────────────────────────────

const sendOTPHandler = asyncHandler(async (req, res) => {
  const rawPhone = req.body?.phone;
  if (!rawPhone)
    throw createError(400, "PHONE_REQUIRED", "Phone number is required");

  const phone = normalizePhone(rawPhone);
  if (!INDIAN_PHONE_REGEX.test(phone)) {
    throw createError(
      400,
      "INVALID_PHONE",
      "Please provide a valid Indian mobile number (10 digits, starting with 6-9)",
    );
  }

  await checkOTPAttempts(phone);

  const isDev = process.env.NODE_ENV === "development";
  const isTestPhone = phone === DEV_PHONE;
  const otp = isDev && isTestPhone ? DEFAULT_DEV_OTP : generateOTP();

  // Always store OTP (including for dev test phone) so verifyOTP can find it
  const otpStore = await setOtpValue(phone, otp);
  if (otpStore === "memory") {
    logger.warn(
      `[sendOTP] Redis unavailable — using in-memory OTP store for ${phone}`,
    );
  }

  // Skip actual SMS for dev test phone
  if (!(isDev && isTestPhone)) {
    try {
      await sendOTP(phone, otp);
    } catch (err) {
      await deleteOtpValue(phone);
      logger.error(
        `[sendOTP] SMS dispatch failed for ${phone}: ${err.message}`,
      );
      throw createError(
        503,
        "SMS_FAILED",
        "Unable to send OTP. Please check your phone number and try again.",
      );
    }
  }

  await User.findOneAndUpdate(
    { phone },
    { $set: { lastOtpSentAt: new Date() } },
  );

  const existingUser = await User.findOne({ phone }).select("_id").lean();
  await AuditLog.log(req, "otp.requested", "User", null, {
    phone,
    isNewUser: !existingUser,
  });

  logger.info(
    `[sendOTP] OTP dispatched to ${phone}${isDev && isTestPhone ? " [DEV TEST]" : ""}`,
  );

  res.status(200).json({
    message: `OTP sent to ${phone.slice(0, 6)}XXXX${phone.slice(-2)}`,
    expiresIn: 300,
    isNewUser: !existingUser,
    ...(isDev && { _devOtp: otp }),
  });
});

// ─── verifyOTPHandler ─────────────────────────────────────────────────────────

const verifyOTPHandler = asyncHandler(async (req, res) => {
  const { otp: rawOtp } = req.body;
  const rawPhone = req.body?.phone;

  if (!rawPhone || !rawOtp) {
    throw createError(400, "MISSING_FIELDS", "Phone and OTP are required");
  }

  const phone = normalizePhone(rawPhone);
  const otp = String(rawOtp).trim();

  if (!INDIAN_PHONE_REGEX.test(phone)) {
    throw createError(400, "INVALID_PHONE", "Invalid phone number");
  }

  await checkOTPAttempts(phone);

  const isDev = process.env.NODE_ENV === "development";
  const isTestPhone = phone === DEV_PHONE;

  // Retrieve stored OTP (from Redis or in-memory fallback)
  const storedOTP = await getOtpValue(phone);

  // Allow the request if:
  //   (a) a stored OTP exists (normal flow), OR
  //   (b) dev mode + test phone + correct hardcoded OTP (belt-and-suspenders)
  const isDevBypass = isDev && isTestPhone && otp === DEFAULT_DEV_OTP;

  if (!storedOTP && !isDevBypass) {
    throw createError(
      400,
      "OTP_EXPIRED",
      "OTP has expired or was not requested. Please request a new OTP.",
    );
  }

  // Timing-safe comparison. For dev bypass use the hardcoded OTP as the expected value.
  const expectedOtp = storedOTP ? String(storedOTP) : DEFAULT_DEV_OTP;
  const otpBuf = Buffer.from(otp.padEnd(10));
  const expectedBuf = Buffer.from(expectedOtp.padEnd(10));
  const isMatch =
    otpBuf.length === expectedBuf.length &&
    crypto.timingSafeEqual(otpBuf, expectedBuf);

  if (!isMatch) {
    await incrementOtpAttemptsValue(phone);
    await AuditLog.log(req, "otp.failed", "User", null, { phone }, false);
    throw createError(400, "INVALID_OTP", "Incorrect OTP. Please try again.");
  }

  // Single-use: delete OTP and clear attempt counter
  await deleteOtpValue(phone);
  await clearOtpAttemptsValue(phone);

  // Find or create user
  let user = await User.findOne({ phone });
  const isNewUser = !user;

  if (isNewUser) {
    user = await User.create({
      phone,
      isPhoneVerified: true,
      registrationSource: req.body.source || "web",
      lastActive: new Date(),
    });
    logger.info(`[verifyOTP] New user created for ${phone}, _id: ${user._id}`);
  } else {
    user.isPhoneVerified = true;
    user.lastActive = new Date();
    await user.save();
  }

  const { accessToken, refreshToken } = signTokenPair(user);
  await user.addRefreshToken(refreshToken);

  await AuditLog.log(req, "user.login", "User", user._id, { phone, isNewUser });

  res.status(200).json({
    accessToken,
    refreshToken,
    user: safeUserResponse(user),
    isNewUser,
  });
});

// ─── register ─────────────────────────────────────────────────────────────────

const register = asyncHandler(async (req, res) => {
  const { userId } = req.user;
  const { name, state, district, persona, preferredLanguage, email, pincode } =
    req.body;

  if (!name || !name.trim())
    throw createError(400, "NAME_REQUIRED", "Name is required");

  const validPersonas = Object.values(PERSONA_MAP).filter(
    (p) => p !== PERSONA_MAP.ADMIN,
  );
  const selectedPersona = persona || PERSONA_MAP.CITIZEN;

  if (!validPersonas.includes(selectedPersona)) {
    throw createError(
      400,
      "INVALID_PERSONA",
      `Persona must be one of: ${validPersonas.join(", ")}`,
    );
  }
  if (preferredLanguage && !LANGUAGE_LIST.includes(preferredLanguage)) {
    throw createError(
      400,
      "INVALID_LANGUAGE",
      `Language must be one of: ${LANGUAGE_LIST.join(", ")}`,
    );
  }
  if (email) {
    const emailExists = await User.findOne({
      email: email.toLowerCase(),
      _id: { $ne: userId },
    });
    if (emailExists)
      throw createError(
        409,
        "EMAIL_TAKEN",
        "Email is already associated with another account",
      );
  }

  const updates = {
    name: name.trim(),
    persona: selectedPersona,
    ...(state && { state: state.trim() }),
    ...(district && { district: district.trim() }),
    ...(pincode && { pincode: pincode.trim() }),
    ...(email && { email: email.toLowerCase().trim() }),
    ...(preferredLanguage && { preferredLanguage }),
    lastActive: new Date(),
  };

  const user = await User.findByIdAndUpdate(
    userId,
    { $set: updates },
    { new: true, runValidators: true },
  );
  if (!user) throw createError(404, "USER_NOT_FOUND", "User not found");

  if (selectedPersona === PERSONA_MAP.LAWYER) {
    const existing = await LawyerProfile.findOne({ user: userId });
    if (!existing) {
      await LawyerProfile.create({
        user: userId,
        experience: 0,
        barCouncilNumber: `PENDING-${userId}`,
        barCouncilState: state || "Pending",
      });
    }
  }

  const { accessToken, refreshToken } = signTokenPair(user);
  await user.addRefreshToken(refreshToken);
  await AuditLog.log(req, "user.register", "User", user._id, {
    persona: selectedPersona,
    state,
  });

  res.status(200).json({
    message: "Profile updated successfully",
    accessToken,
    refreshToken,
    user: safeUserResponse(user),
  });
});

// ─── getMe ────────────────────────────────────────────────────────────────────

const getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.userId)
    .select("-refreshTokens -whatsappSessionData")
    .lean();

  if (!user) throw createError(404, "USER_NOT_FOUND", "User not found");

  const isSubscribed =
    user.subscription?.plan !== "free" &&
    user.subscription?.validUntil &&
    new Date() < new Date(user.subscription.validUntil);

  let lawyerProfile = null;
  if (
    user.persona === PERSONA_MAP.LAWYER ||
    user.persona === PERSONA_MAP.PARALEGAL
  ) {
    lawyerProfile = await LawyerProfile.findOne({ user: user._id })
      .select(
        "isVerified verificationStatus lawyerPlan averageRating totalConsultations barCouncilNumber specialisations",
      )
      .lean();
  }

  res.status(200).json({ user: { ...user, isSubscribed }, lawyerProfile });
});

// ─── updateMe ────────────────────────────────────────────────────────────────

const updateMe = asyncHandler(async (req, res) => {
  const { userId } = req.user;
  const ALLOWED = [
    "name",
    "state",
    "district",
    "pincode",
    "preferredLanguage",
    "preferredTheme",
    "whatsappOptIn",
    "whatsappNumber",
    "email",
    "avatar",
  ];

  const updates = {};
  ALLOWED.forEach((f) => {
    if (req.body[f] !== undefined) updates[f] = req.body[f];
  });

  if (!Object.keys(updates).length)
    throw createError(400, "NO_CHANGES", "No valid fields provided");

  if (
    updates.preferredLanguage &&
    !LANGUAGE_LIST.includes(updates.preferredLanguage)
  ) {
    throw createError(
      400,
      "INVALID_LANGUAGE",
      `Language must be one of: ${LANGUAGE_LIST.join(", ")}`,
    );
  }
  const validThemes = ["default", "saffron", "dark", "highContrast", "emerald"];
  if (updates.preferredTheme && !validThemes.includes(updates.preferredTheme)) {
    throw createError(
      400,
      "INVALID_THEME",
      `Theme must be one of: ${validThemes.join(", ")}`,
    );
  }
  if (updates.email) {
    updates.email = updates.email.toLowerCase().trim();
    const conflict = await User.findOne({
      email: updates.email,
      _id: { $ne: userId },
    });
    if (conflict)
      throw createError(409, "EMAIL_TAKEN", "Email is already in use");
  }
  if (updates.name) updates.name = updates.name.trim();
  updates.lastActive = new Date();

  const user = await User.findByIdAndUpdate(
    userId,
    { $set: updates },
    {
      new: true,
      runValidators: true,
      select: "-refreshTokens -whatsappSessionData",
    },
  );
  if (!user) throw createError(404, "USER_NOT_FOUND", "User not found");

  await AuditLog.log(req, "user.updated", "User", user._id, {
    fields: Object.keys(updates),
  });
  res.status(200).json({ user: safeUserResponse(user) });
});

// ─── refresh ──────────────────────────────────────────────────────────────────

const refresh = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken)
    throw createError(
      400,
      "REFRESH_TOKEN_REQUIRED",
      "Refresh token is required",
    );

  let decoded;
  try {
    decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
  } catch {
    throw createError(
      401,
      "INVALID_REFRESH_TOKEN",
      "Refresh token is invalid or has expired",
    );
  }
  if (decoded.type !== "refresh")
    throw createError(
      401,
      "INVALID_REFRESH_TOKEN",
      "Token is not a refresh token",
    );

  const user = await User.findById(decoded.userId);
  if (!user) throw createError(401, "USER_NOT_FOUND", "User no longer exists");

  if (!user.refreshTokens.includes(refreshToken)) {
    logger.warn(
      `[refresh] Token reuse detected for user ${user._id}. Revoking all tokens.`,
    );
    user.refreshTokens = [];
    await user.save();
    await AuditLog.log(
      req,
      "auth.token_reuse_detected",
      "User",
      user._id,
      {},
      false,
    );
    throw createError(
      401,
      "TOKEN_REUSE",
      "Refresh token already used. Please log in again.",
    );
  }

  user.refreshTokens = user.refreshTokens.filter((t) => t !== refreshToken);
  user.lastActive = new Date();
  await user.save();

  const { accessToken: newAccessToken, refreshToken: newRefreshToken } =
    signTokenPair(user);
  await user.addRefreshToken(newRefreshToken);

  res
    .status(200)
    .json({ accessToken: newAccessToken, refreshToken: newRefreshToken });
});

// ─── logout ───────────────────────────────────────────────────────────────────

const logout = asyncHandler(async (req, res) => {
  const { userId } = req.user;
  const { refreshToken } = req.body;

  const user = await User.findById(userId);
  if (!user) throw createError(404, "USER_NOT_FOUND", "User not found");

  user.refreshTokens = refreshToken
    ? user.refreshTokens.filter((t) => t !== refreshToken)
    : [];

  await user.save();
  await AuditLog.log(req, "user.logout", "User", user._id, {
    type: refreshToken ? "single_device" : "all_devices",
  });

  res.status(200).json({ message: "Logged out successfully" });
});

// ─── whatsappEntry ────────────────────────────────────────────────────────────

const whatsappEntry = asyncHandler(async (req, res) => {
  const rawPhone = req.query.phone || req.body.phone;
  const waToken = req.query.wa_token || req.body.wa_token;

  if (!rawPhone || !waToken)
    throw createError(400, "MISSING_PARAMS", "phone and wa_token are required");

  const phone = normalizePhone(rawPhone);
  if (!INDIAN_PHONE_REGEX.test(phone))
    throw createError(400, "INVALID_PHONE", "Invalid phone number");

  const rc = getRedisClient();
  const redisWaKey = `wa_entry:${phone}`;
  let storedToken = null;

  if (rc) storedToken = await rc.get(redisWaKey);

  if (!storedToken || storedToken !== waToken) {
    throw createError(
      401,
      "INVALID_WA_TOKEN",
      "WhatsApp entry token is invalid or has expired. Please use the link from WhatsApp.",
    );
  }

  await rc.del(redisWaKey);

  let user = await User.findOne({ phone });
  const isNewUser = !user;

  if (isNewUser) {
    user = await User.create({
      phone,
      isPhoneVerified: true,
      registrationSource: "whatsapp",
      whatsappOptIn: true,
      whatsappNumber: phone,
      whatsappVerified: true,
      lastActive: new Date(),
    });
  } else {
    user.lastActive = new Date();
    user.whatsappVerified = true;
    await user.save();
  }

  const { accessToken, refreshToken } = signTokenPair(user);
  await user.addRefreshToken(refreshToken);
  await AuditLog.log(req, "user.whatsapp_entry", "User", user._id, {
    phone,
    isNewUser,
  });

  res.status(200).json({
    accessToken,
    refreshToken,
    user: safeUserResponse(user),
    isNewUser,
  });
});

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  sendOTPHandler,
  verifyOTPHandler,
  register,
  getMe,
  updateMe,
  refresh,
  logout,
  whatsappEntry,
  normalizePhone,
  signTokenPair,
};
