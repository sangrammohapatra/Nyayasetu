const mongoose = require("mongoose");
const { Schema } = mongoose;
const {
  SUPPORTED_LANGUAGES,
  PERSONAS,
  CITIZEN_PLANS,
  LAWYER_PLANS,
  FREE_TIER_LIMITS,
  INDIAN_PHONE_REGEX,
  MAX_REFRESH_TOKENS,
} = require("../config/constants");

const DEFAULT_FREE_LIMITS = FREE_TIER_LIMITS?.citizen?.free || {
  docsLimit: 3,
  casesLimit: 1,
  aiChatsLimit: 5,
};

// ─── Sub-schemas ───────────────────────────────────────────────────────────────

const subscriptionSchema = new Schema(
  {
    plan: {
      type: String,
      enum: ["free", "basic", "pro", "professional", "firm"],
      default: "free",
    },
    validUntil: { type: Date, default: null },
    autoRenew: { type: Boolean, default: false },
    razorpaySubscriptionId: { type: String, default: null },
    billingCycle: {
      type: String,
      enum: ["monthly", "annual"],
      default: "monthly",
    },
  },
  { _id: false },
);

const freeUsageSchema = new Schema(
  {
    docsGenerated: { type: Number, default: 0, min: 0 },
    docsLimit: { type: Number, default: DEFAULT_FREE_LIMITS.docsLimit },
    casesTracked: { type: Number, default: 0, min: 0 },
    casesLimit: { type: Number, default: DEFAULT_FREE_LIMITS.casesLimit },
    aiChatsUsed: { type: Number, default: 0, min: 0 },
    aiChatsLimit: {
      type: Number,
      default: DEFAULT_FREE_LIMITS.aiChatsLimit,
    },
    resetDate: { type: Date, default: null },
  },
  { _id: false },
);

// ─── Main Schema ───────────────────────────────────────────────────────────────

const userSchema = new Schema(
  {
    // ── Identity ────────────────────────────────────────────────────────────
    phone: {
      type: String,
      unique: true,
      sparse: true, // Allows null (WhatsApp-only users may add phone later)
      trim: true,
      validate: {
        validator: (v) => !v || INDIAN_PHONE_REGEX.test(v),
        message:
          "Phone must be a valid Indian mobile number in E.164 format (+91XXXXXXXXXX)",
      },
    },
    email: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
      validate: {
        validator: (v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
        message: "Invalid email address",
      },
    },
    name: {
      type: String,
      trim: true,
      maxlength: [100, "Name cannot exceed 100 characters"],
    },
    avatar: { type: String, default: null }, // URL to Cloudinary/S3

    // ── Persona ─────────────────────────────────────────────────────────────
    persona: {
      type: String,
      enum: Object.values(PERSONAS),
      default: PERSONAS.CITIZEN,
      index: true,
    },

    // ── Location ─────────────────────────────────────────────────────────────
    state: {
      type: String,
      trim: true,
      index: true,
    },
    district: { type: String, trim: true },
    pincode: {
      type: String,
      trim: true,
      validate: {
        validator: (v) => !v || /^\d{6}$/.test(v),
        message: "Pincode must be a 6-digit number",
      },
    },

    // ── Preferences ──────────────────────────────────────────────────────────
    preferredLanguage: {
      type: String,
      enum: SUPPORTED_LANGUAGES,
      default: "en",
    },
    preferredTheme: {
      type: String,
      enum: ["default", "saffron", "dark", "highContrast", "emerald"],
      default: "default",
    },

    // ── Subscription & Usage ─────────────────────────────────────────────────
    subscription: {
      type: subscriptionSchema,
      default: () => ({}),
    },
    freeUsage: {
      type: freeUsageSchema,
      default: () => ({}),
    },

    // ── WhatsApp ─────────────────────────────────────────────────────────────
    whatsappOptIn: { type: Boolean, default: false },
    whatsappNumber: {
      type: String,
      trim: true,
      sparse: true,
      validate: {
        validator: (v) => !v || INDIAN_PHONE_REGEX.test(v),
        message:
          "WhatsApp number must be a valid Indian mobile number in E.164 format",
      },
    },
    whatsappVerified: { type: Boolean, default: false },
    // State machine data for the WhatsApp bot (phase, pending template, etc.)
    whatsappSessionData: { type: Schema.Types.Mixed, default: null },

    // ── Verification ─────────────────────────────────────────────────────────
    isEmailVerified: { type: Boolean, default: false },
    isPhoneVerified: { type: Boolean, default: false },
    lastOtpSentAt: { type: Date, default: null },

    // ── Auth ─────────────────────────────────────────────────────────────────
    // Array of refresh tokens supports multi-device login (max MAX_REFRESH_TOKENS)
    // Rule #13: refresh tokens are an array on User
    refreshTokens: {
      type: [String],
      default: [],
      validate: {
        validator: (arr) => arr.length <= MAX_REFRESH_TOKENS,
        message: `A user may have at most ${MAX_REFRESH_TOKENS} active refresh tokens`,
      },
    },

    // ── Metadata ─────────────────────────────────────────────────────────────
    registrationSource: {
      type: String,
      enum: ["web", "whatsapp", "mobile_app"],
      default: "web",
    },
    isActive: { type: Boolean, default: true, index: true },
    lastActive: { type: Date, default: Date.now },
  },
  {
    timestamps: true, // adds createdAt, updatedAt
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        // Never leak refresh tokens or internal session data in API responses
        delete ret.refreshTokens;
        delete ret.whatsappSessionData;
        delete ret.__v;
        return ret;
      },
    },
    toObject: { virtuals: true },
  },
);

// ─── Indexes ───────────────────────────────────────────────────────────────────
userSchema.index({ phone: 1 });
userSchema.index({ email: 1 });
userSchema.index({ "subscription.plan": 1 });
userSchema.index({ state: 1, district: 1 });
userSchema.index({ whatsappNumber: 1 }, { sparse: true });
userSchema.index({ createdAt: -1 });
userSchema.index({ lastActive: -1 });

// ─── Virtuals ─────────────────────────────────────────────────────────────────

/**
 * isSubscribed — true if the user has an active paid plan (not 'free') that
 * hasn't expired. Admins always considered subscribed.
 */
userSchema.virtual("isSubscribed").get(function () {
  if (this.persona === PERSONAS.ADMIN) return true;
  if (this.subscription.plan === "free") return false;
  if (!this.subscription.validUntil) return false;
  return new Date() < new Date(this.subscription.validUntil);
});

/**
 * displayName — falls back to masked phone if name not set
 */
userSchema.virtual("displayName").get(function () {
  if (this.name) return this.name;
  if (this.phone) return `User ${this.phone.slice(-4)}`;
  return "NyayaSetu User";
});

// ─── Pre-save Hooks ────────────────────────────────────────────────────────────

userSchema.pre("save", function (next) {
  // 1. Normalize phone to E.164 (+91XXXXXXXXXX) — Rule #19
  if (this.isModified("phone") && this.phone) {
    const digits = this.phone.replace(/\D/g, "");
    if (digits.length === 10) {
      this.phone = `+91${digits}`;
    } else if (digits.length === 12 && digits.startsWith("91")) {
      this.phone = `+${digits}`;
    }
  }

  // Same normalization for whatsappNumber
  if (this.isModified("whatsappNumber") && this.whatsappNumber) {
    const digits = this.whatsappNumber.replace(/\D/g, "");
    if (digits.length === 10) {
      this.whatsappNumber = `+91${digits}`;
    } else if (digits.length === 12 && digits.startsWith("91")) {
      this.whatsappNumber = `+${digits}`;
    }
  }

  // 2. Set freeUsage.resetDate to 1st of next month if not set
  if (!this.freeUsage.resetDate) {
    const now = new Date();
    const firstOfNextMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      1,
      0,
      0,
      0,
      0,
    );
    this.freeUsage.resetDate = firstOfNextMonth;
  }

  // 3. Cap refresh tokens array to MAX_REFRESH_TOKENS (oldest removed first)
  if (this.refreshTokens.length > MAX_REFRESH_TOKENS) {
    this.refreshTokens = this.refreshTokens.slice(-MAX_REFRESH_TOKENS);
  }

  next();
});

// ─── Instance Methods ──────────────────────────────────────────────────────────

/**
 * isWithinQuota — check if the user can perform one more action of quotaType.
 * @param {'document'|'ai_chat'|'case'} quotaType
 */
userSchema.methods.isWithinQuota = function (quotaType) {
  // Paid (non-expired) subscribers have no quota
  if (this.isSubscribed) return true;

  const map = {
    document: { used: "docsGenerated", limit: "docsLimit" },
    ai_chat: { used: "aiChatsUsed", limit: "aiChatsLimit" },
    case: { used: "casesTracked", limit: "casesLimit" },
  };
  const q = map[quotaType];
  if (!q) return true;
  return (this.freeUsage[q.used] || 0) < (this.freeUsage[q.limit] || 0);
};

/**
 * incrementUsage — atomically bump a usage counter by 1.
 * @param {'document'|'ai_chat'|'case'} quotaType
 */
userSchema.methods.incrementUsage = async function (quotaType) {
  const fieldMap = {
    document: "freeUsage.docsGenerated",
    ai_chat: "freeUsage.aiChatsUsed",
    case: "freeUsage.casesTracked",
  };
  const field = fieldMap[quotaType];
  if (!field) return;
  await this.constructor.findByIdAndUpdate(this._id, { $inc: { [field]: 1 } });
};

/**
 * addRefreshToken — adds a token, evicting the oldest if at capacity.
 * @param {string} token
 */
userSchema.methods.addRefreshToken = async function (token) {
  let tokens = [...this.refreshTokens, token];
  if (tokens.length > MAX_REFRESH_TOKENS) {
    tokens = tokens.slice(-MAX_REFRESH_TOKENS);
  }
  this.refreshTokens = tokens;
  await this.save();
};

/**
 * removeRefreshToken — removes a specific refresh token (logout).
 * @param {string} token
 */
userSchema.methods.removeRefreshToken = async function (token) {
  this.refreshTokens = this.refreshTokens.filter((t) => t !== token);
  await this.save();
};

// ─── Static Methods ────────────────────────────────────────────────────────────

/**
 * findByPhone — find a user by normalized phone number.
 * @param {string} phone — raw phone (will normalize to E.164)
 */
userSchema.statics.findByPhone = function (phone) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  let normalized = phone;
  if (digits.length === 10) normalized = `+91${digits}`;
  else if (digits.length === 12 && digits.startsWith("91"))
    normalized = `+${digits}`;
  return this.findOne({ phone: normalized });
};

/**
 * resetMonthlyQuotas — called by the subscriptions Bull queue on the 1st of each month.
 * Resets free-tier usage counters and advances resetDate.
 */
userSchema.statics.resetMonthlyQuotas = async function () {
  const firstOfNextMonth = new Date();
  firstOfNextMonth.setMonth(firstOfNextMonth.getMonth() + 1);
  firstOfNextMonth.setDate(1);
  firstOfNextMonth.setHours(0, 0, 0, 0);

  return this.updateMany(
    { "subscription.plan": "free" },
    {
      $set: {
        "freeUsage.docsGenerated": 0,
        "freeUsage.aiChatsUsed": 0,
        // casesTracked is NOT reset — tracking is persistent, not monthly
        "freeUsage.resetDate": firstOfNextMonth,
      },
    },
  );
};

module.exports = mongoose.model("User", userSchema);
