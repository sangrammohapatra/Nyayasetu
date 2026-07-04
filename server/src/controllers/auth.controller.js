const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { isEmail } = require("validator");
const User = require("../models/User.model");
const LawyerProfile = require("../models/LawyerProfile.model");
const NotaryProfile = require("../models/NotaryProfile.model");
const AuditLog = require("../models/AuditLog.model");
const redisConfig = require("../config/redis");
const { sendOTP } = require("../services/notification/smsService");
const {
  sendEmail,
  otpEmail: otpEmailTemplate,
} = require("../services/notification/emailService");
const { createError } = require("../middleware/error.middleware");
const asyncHandler = require("../utils/asyncHandler");
const logger = require("../utils/logger");
const { signTokenPair } = require("../utils/token");
const {
  INDIAN_PHONE_REGEX,
  PERSONAS,
  MAX_REFRESH_TOKENS,
  SUPPORTED_LANGUAGES,
  INDIAN_STATES,
  OTP,
} = require("../config/constants");

const PERSONA_MAP = PERSONAS || {
  CITIZEN: "citizen",
  LAWYER: "lawyer",
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

const OTP_TTL_SECONDS         = OTP.TTL_SECONDS;
const OTP_ATTEMPT_TTL_SECONDS = OTP.ATTEMPT_TTL_SECONDS;

// ── In-memory fallback store (used when Redis is unavailable) ──────────────────
// Entries: { value, expiresAt: timestamp }
const memoryOtpStore = new Map();
const memoryOtpAttemptStore = new Map();

// Proactive sweep so expired entries don't accumulate during Redis downtime
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of memoryOtpStore) {
    if (entry.expiresAt <= now) memoryOtpStore.delete(key);
  }
  for (const [key, entry] of memoryOtpAttemptStore) {
    if (entry.expiresAt <= now) memoryOtpAttemptStore.delete(key);
  }
}, 5 * 60 * 1000).unref();

// ─── Helpers ───────────────────────────────────────────────────────────────────

function isEmailIdentifier(value) {
  return typeof value === "string" && isEmail(value.trim());
}

function maskEmail(email) {
  const [local, domain] = email.split("@");
  const masked = local.length <= 3 ? `${local[0]}***` : `${local.slice(0, 3)}***`;
  return `${masked}@${domain}`;
}

function normalizePhone(raw) {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, "");
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 11 && digits.startsWith("0"))
    return `+91${digits.slice(1)}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  if (digits.length === 13 && digits.startsWith("091"))
    return `+91${digits.slice(3)}`;
  return null; // unrecognised format — callers must check for null / INDIAN_PHONE_REGEX
}

function generateOTP() {
  return String(crypto.randomInt(100000, 999999));
}

// Case-insensitive match against the canonical INDIAN_STATES list.
// Returns the correctly-capitalised state name, or null if unrecognised.
function normalizeState(raw) {
  if (!raw) return null;
  const lower = raw.trim().toLowerCase();
  return INDIAN_STATES.find((s) => s.toLowerCase() === lower) || null;
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
  const rawEmail = req.body?.email;

  if (!rawPhone && !rawEmail) {
    throw createError(400, "IDENTIFIER_REQUIRED", "Phone number or email address is required");
  }

  // ── Email OTP flow ────────────────────────────────────────────────────────
  if (rawEmail) {
    const email = String(rawEmail).trim().toLowerCase();
    if (!isEmailIdentifier(email)) {
      throw createError(400, "INVALID_EMAIL", "Please provide a valid email address");
    }

    await checkOTPAttempts(email);

    const otp = generateOTP();
    const otpStore = await setOtpValue(email, otp);
    if (otpStore === "memory") {
      logger.warn(`[sendOTP] Redis unavailable — using in-memory OTP store for ${email}`);
    }

    try {
      await sendEmail({
        to: email,
        subject: "Your NyayaSetu Login Code",
        html: otpEmailTemplate(otp),
      });
    } catch (err) {
      await deleteOtpValue(email);
      logger.error(`[sendOTP] Email dispatch failed for ${email}: ${err.message}`);
      throw createError(503, "EMAIL_FAILED", "Unable to send OTP email. Please try again.");
    }

    const existingUser = await User.findOne({ email }).select("_id").lean();
    await AuditLog.log(req, "otp.requested", "User", null, { email, isNewUser: !existingUser });
    logger.info(`[sendOTP] OTP emailed to ${maskEmail(email)}`);

    return res.status(200).json({
      message: `OTP sent to ${maskEmail(email)}`,
      expiresIn: OTP_TTL_SECONDS,
      isNewUser: !existingUser,
    });
  }

  // ── Phone OTP flow ────────────────────────────────────────────────────────
  const phone = normalizePhone(rawPhone);
  if (!INDIAN_PHONE_REGEX.test(phone)) {
    throw createError(
      400,
      "INVALID_PHONE",
      "Please provide a valid Indian mobile number (10 digits, starting with 6-9)",
    );
  }

  await checkOTPAttempts(phone);

  const otp = generateOTP();

  const otpStore = await setOtpValue(phone, otp);
  if (otpStore === "memory") {
    logger.warn(`[sendOTP] Redis unavailable — using in-memory OTP store for ${phone}`);
  }

  try {
    await sendOTP(phone, otp);
  } catch (err) {
    await deleteOtpValue(phone);
    logger.error(`[sendOTP] SMS dispatch failed for ${phone}: ${err.message}`);
    throw createError(503, "SMS_FAILED", "Unable to send OTP. Please check your phone number and try again.");
  }

  await User.findOneAndUpdate({ phone }, { $set: { lastOtpSentAt: new Date() } });

  const existingUser = await User.findOne({ phone }).select("_id").lean();
  await AuditLog.log(req, "otp.requested", "User", null, { phone, isNewUser: !existingUser });
  logger.info(`[sendOTP] OTP dispatched to ${phone}`);

  res.status(200).json({
    message: `OTP sent to ${phone.slice(0, 6)}XXXX${phone.slice(-2)}`,
    expiresIn: 300,
    isNewUser: !existingUser,
  });
});

// ─── verifyOTPHandler ─────────────────────────────────────────────────────────

const verifyOTPHandler = asyncHandler(async (req, res) => {
  const { otp: rawOtp } = req.body;
  const rawPhone = req.body?.phone;
  const rawEmail = req.body?.email;

  if (!rawPhone && !rawEmail) {
    throw createError(400, "IDENTIFIER_REQUIRED", "Phone number or email is required");
  }

  if (!rawOtp) {
    throw createError(400, "OTP_REQUIRED", "OTP is required");
  }

  const otp = String(rawOtp).trim();

  // ── Email OTP verify ───────────────────────────────────────────────────────
  if (rawEmail) {
    const email = String(rawEmail).trim().toLowerCase();
    if (!isEmailIdentifier(email)) {
      throw createError(400, "INVALID_EMAIL", "Invalid email address");
    }

    await checkOTPAttempts(email);
    const storedOTP = await getOtpValue(email);
    if (!storedOTP) {
      throw createError(400, "OTP_EXPIRED", "OTP has expired or was not requested. Please request a new OTP.");
    }
    let isMatch = false;
    if (/^\d{6}$/.test(otp)) {
      const otpBuf = Buffer.from(otp.padEnd(10));
      const expectedBuf = Buffer.from(String(storedOTP).padEnd(10));
      isMatch = otpBuf.length === expectedBuf.length && crypto.timingSafeEqual(otpBuf, expectedBuf);
    }
    if (!isMatch) {
      await incrementOtpAttemptsValue(email);
      await AuditLog.log(req, "otp.failed", "User", null, { email }, false);
      throw createError(400, "INVALID_OTP", "Incorrect OTP. Please try again.");
    }
    await deleteOtpValue(email);
    await clearOtpAttemptsValue(email);

    let user = await User.findOne({ email });
    const isNewUser = !user;

    if (isNewUser) {
      user = await User.create({
        email,
        isEmailVerified: true,
        registrationSource: req.body.source || "web",
        lastActive: new Date(),
      });
      logger.info(`[verifyOTP] New user created for ${maskEmail(email)}, _id: ${user._id}`);
    } else {
      user.isEmailVerified = true;
      user.lastActive = new Date();
      await user.save();
    }

    const { accessToken, refreshToken } = signTokenPair(user);
    await user.addRefreshToken(refreshToken);
    await AuditLog.log(req, "user.login", "User", user._id, { email, isNewUser });

    return res.status(200).json({
      accessToken,
      refreshToken,
      user: safeUserResponse(user),
      isNewUser,
    });
  }

  // ── Phone OTP verify ───────────────────────────────────────────────────────
  const phone = normalizePhone(rawPhone);
  if (!INDIAN_PHONE_REGEX.test(phone)) {
    throw createError(400, "INVALID_PHONE", "Invalid phone number");
  }

  await checkOTPAttempts(phone);
  const storedOTP = await getOtpValue(phone);
  if (!storedOTP) {
    throw createError(400, "OTP_EXPIRED", "OTP has expired or was not requested. Please request a new OTP.");
  }
  const expectedOtp = String(storedOTP);
  let isMatch = false;
  if (/^\d{6}$/.test(otp)) {
    const otpBuf = Buffer.from(otp.padEnd(10));
    const expectedBuf = Buffer.from(expectedOtp.padEnd(10));
    isMatch = otpBuf.length === expectedBuf.length && crypto.timingSafeEqual(otpBuf, expectedBuf);
  }
  if (!isMatch) {
    await incrementOtpAttemptsValue(phone);
    await AuditLog.log(req, "otp.failed", "User", null, { phone }, false);
    throw createError(400, "INVALID_OTP", "Incorrect OTP. Please try again.");
  }
  await deleteOtpValue(phone);
  await clearOtpAttemptsValue(phone);

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
  const { name, state, district, persona, preferredLanguage, preferredTheme, whatsappOptIn, email, pincode, password, phone: rawPhone } =
    req.body;

  if (!name || !name.trim())
    throw createError(400, "NAME_REQUIRED", "Name is required");

  if (password !== undefined) {
    if (typeof password !== "string" || password.length < 8) {
      throw createError(400, "WEAK_PASSWORD", "Password must be at least 8 characters");
    }
  }

  // Lawyer/notary personas are granted only via their dedicated, document-
  // verified application flows — direct registration may only self-select 'citizen'.
  const validPersonas = [PERSONA_MAP.CITIZEN];
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
  const VALID_THEMES = ["default", "saffron", "dark", "highContrast", "emerald"];
  if (preferredTheme && !VALID_THEMES.includes(preferredTheme)) {
    throw createError(
      400,
      "INVALID_THEME",
      `Theme must be one of: ${VALID_THEMES.join(", ")}`,
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

  let normalizedPhone;
  if (rawPhone) {
    normalizedPhone = normalizePhone(rawPhone);
    if (!normalizedPhone || !INDIAN_PHONE_REGEX.test(normalizedPhone)) {
      throw createError(
        400,
        "INVALID_PHONE",
        "Please provide a valid Indian mobile number (10 digits, starting with 6-9)",
      );
    }
    const phoneExists = await User.findOne({
      phone: normalizedPhone,
      _id: { $ne: userId },
    });
    if (phoneExists)
      throw createError(
        409,
        "PHONE_TAKEN",
        "Phone number is already associated with another account",
      );
  }

  const passwordHash = password ? await bcrypt.hash(password, 12) : undefined;

  const normalizedState = state ? normalizeState(state) : undefined;
  if (state && !normalizedState) {
    throw createError(
      400,
      "INVALID_STATE",
      `'${state}' is not a recognised Indian state or union territory`,
    );
  }

  const updates = {
    name: name.trim(),
    persona: selectedPersona,
    ...(normalizedState && { state: normalizedState }),
    ...(district && { district: district.trim() }),
    ...(pincode && { pincode: pincode.trim() }),
    ...(email && { email: email.toLowerCase().trim() }),
    ...(preferredLanguage && { preferredLanguage }),
    ...(preferredTheme && { preferredTheme }),
    ...(whatsappOptIn !== undefined && { whatsappOptIn: Boolean(whatsappOptIn) }),
    ...(passwordHash && { passwordHash }),
    ...(normalizedPhone && { phone: normalizedPhone }),
    lastActive: new Date(),
  };

  const user = await User.findByIdAndUpdate(
    userId,
    { $set: updates },
    { new: true, runValidators: true },
  );
  if (!user) throw createError(404, "USER_NOT_FOUND", "User not found");

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
  if (user.persona?.toLowerCase() === PERSONA_MAP.LAWYER) {
    lawyerProfile = await LawyerProfile.findOne({ user: user._id })
      .select("-ratings -verificationDocs -__v")
      .lean();
  }

  let notaryProfile = null;
  if (user.persona?.toLowerCase() === PERSONA_MAP.NOTARY) {
    notaryProfile = await NotaryProfile.findOne({ user: user._id })
      .select("-ratings -verificationDocs -__v")
      .lean();
  }

  res.status(200).json({ user: { ...user, isSubscribed }, lawyerProfile, notaryProfile });
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
  // Route validators (auth.routes.js) check req.body only — prefer it so the
  // value actually used matches the value actually validated. Query params
  // are a fallback for callers that don't have a request body to set.
  const rawPhone = req.body.phone || req.query.phone;
  const waToken = req.body.wa_token || req.query.wa_token;

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

// ─── loginWithPassword ────────────────────────────────────────────────────────

const loginWithPassword = asyncHandler(async (req, res) => {
  const rawPhone = req.body?.phone;
  const rawEmail = req.body?.email;
  const { password } = req.body;

  if (!rawPhone && !rawEmail) {
    throw createError(400, "MISSING_FIELDS", "Phone number or email is required");
  }
  if (!password) {
    throw createError(400, "MISSING_FIELDS", "Password is required");
  }

  let user;
  let logIdentifier;

  if (rawEmail) {
    const email = String(rawEmail).trim().toLowerCase();
    if (!isEmailIdentifier(email)) {
      throw createError(400, "INVALID_EMAIL", "Invalid email address");
    }
    user = await User.findOne({ email }).select("+passwordHash");
    logIdentifier = { email, method: "password" };
  } else {
    const phone = normalizePhone(rawPhone);
    if (!INDIAN_PHONE_REGEX.test(phone)) {
      throw createError(400, "INVALID_PHONE", "Invalid phone number");
    }
    user = await User.findOne({ phone }).select("+passwordHash");
    logIdentifier = { phone, method: "password" };
  }

  if (!user || !user.passwordHash) {
    throw createError(
      401,
      "INVALID_CREDENTIALS",
      "Invalid credentials. Use OTP login if you haven't set a password.",
    );
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    await AuditLog.log(req, "auth.password_failed", "User", user._id, logIdentifier, false);
    throw createError(401, "INVALID_CREDENTIALS", "Invalid credentials.");
  }

  if (user.phone) user.isPhoneVerified = true;
  user.lastActive = new Date();
  await user.save();

  const { accessToken, refreshToken } = signTokenPair(user);
  await user.addRefreshToken(refreshToken);

  await AuditLog.log(req, "user.login", "User", user._id, logIdentifier);

  res.status(200).json({
    accessToken,
    refreshToken,
    user: safeUserResponse(user),
    isNewUser: false,
  });
});

// ─── setPassword ──────────────────────────────────────────────────────────────

const setPassword = asyncHandler(async (req, res) => {
  const { userId } = req.user;
  const { password, currentPassword } = req.body;

  if (!password || password.length < 8) {
    throw createError(400, "WEAK_PASSWORD", "Password must be at least 8 characters");
  }

  const user = await User.findById(userId).select("+passwordHash");
  if (!user) throw createError(404, "USER_NOT_FOUND", "User not found");

  // If a password is already set, verify current password before allowing change
  if (user.passwordHash) {
    if (!currentPassword) {
      throw createError(400, "CURRENT_PASSWORD_REQUIRED", "Current password is required to set a new one");
    }
    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) {
      throw createError(401, "INVALID_CREDENTIALS", "Current password is incorrect");
    }
  }

  user.passwordHash = await bcrypt.hash(password, 12);
  await user.save();

  await AuditLog.log(req, "user.password_set", "User", user._id, {});

  res.status(200).json({ message: "Password set successfully" });
});

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  sendOTPHandler,
  verifyOTPHandler,
  loginWithPassword,
  setPassword,
  register,
  getMe,
  updateMe,
  refresh,
  logout,
  whatsappEntry,
  normalizePhone,
  signTokenPair,
};
