/**
 * NyayaBotSession — MongoDB model for NyayaBot conversations
 *
 * Distinct from ChatSession (used for document Q&A flows).
 * NyayaBotSession is the general-purpose legal assistant chatbot
 * accessible via the floating widget or /nyayabot full-page view.
 *
 * Collection: nyayabotsessions
 */

const mongoose = require('mongoose');
const { SHARE_TOKEN_DAYS } = require('../config/constants');

// ─── Sub-schema: individual message ──────────────────────────────────────────
const NyayaBotMessageSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ['user', 'nyayabot'], // 'nyayabot' not 'assistant' for branding
      required: true,
    },
    content: {
      type: String,
      required: true,
      maxlength: 10000,
    },
    // If message came from voice input
    isVoice: { type: Boolean, default: false },
    audioKey: String, // storage key (Cloudinary / S3)
    voiceTranscript: String,

    // Rich response metadata (only on nyayabot messages)
    citations: [
      {
        act: String,
        year: Number,
        fullName: String,
        section: String,
        url: String,
      },
    ],
    suggestedTemplates: [
      {
        slug: String,
        title: String,
        category: String,
        complexity: String,
        pricePayPerDoc: Number,
      },
    ],
    followUpQuestions: [String],
    disclaimer: String, // legal disclaimer appended to response

    // User feedback on this message
    thumbsUp: { type: Boolean, default: null }, // null = no feedback yet

    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

// ─── Main session schema ──────────────────────────────────────────────────────
const NyayaBotSessionSchema = new mongoose.Schema(
  {
    // Owner
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    persona: {
      type: String,
      enum: ['citizen', 'lawyer'],
      required: true,
    },

    // Session metadata
    title: {
      type: String,
      default: 'New Conversation',
      maxlength: 120,
    },
    language: {
      type: String,
      enum: ['en', 'hi', 'bn', 'mr', 'ta', 'te', 'gu', 'kn', 'ml', 'pa', 'ur'],
      default: 'en',
    },
    jurisdiction: {
      type: String, // state code e.g. 'DL', 'MH', 'KA'
      default: null,
    },

    // Messages
    messages: [NyayaBotMessageSchema],

    // Context: what the user was doing when they opened NyayaBot
    contextType: {
      type: String,
      enum: ['general', 'document', 'case', 'lawyer', 'payment', 'unknown'],
      default: 'general',
    },
    contextRefId: {
      // e.g. Document._id or CaseTracker._id
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    // ── Daily quota tracking ─────────────────────────────────────────────────
    // We track per-session per-day. A user may have multiple sessions;
    // quota is enforced at the USER level (see static getDailyUsage).
    dailyUserMessageCount: { type: Number, default: 0 },
    quotaWindowStart: {
      // Start of the current quota window (midnight IST)
      type: Date,
      default: () => NyayaBotSessionSchema.statics.todayMidnightIST(),
    },

    // ── Sharing ──────────────────────────────────────────────────────────────
    shareToken: { type: String, sparse: true, index: true },
    shareTokenExpiry: Date,
    sharedWithLawyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    // ── State ────────────────────────────────────────────────────────────────
    isArchived: { type: Boolean, default: false, index: true },
    isPinned: { type: Boolean, default: false },

    // ── Session ratings ──────────────────────────────────────────────────────
    sessionRating: { type: Number, min: 1, max: 5, default: null },
    sessionFeedback: { type: String, maxlength: 500 },

    // ── Source ───────────────────────────────────────────────────────────────
    source: {
      type: String,
      enum: ['widget', 'page', 'whatsapp', 'mobile'],
      default: 'widget',
    },
  },
  {
    timestamps: true,
    collection: 'nyayabotsessions',
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
NyayaBotSessionSchema.index({ user: 1, updatedAt: -1 });
NyayaBotSessionSchema.index({ user: 1, isArchived: 1, updatedAt: -1 });
NyayaBotSessionSchema.index({ shareToken: 1 }, { sparse: true });

// TTL: permanently delete archived sessions after 90 days
NyayaBotSessionSchema.index(
  { updatedAt: 1 },
  {
    expireAfterSeconds: 60 * 60 * 24 * 90, // 90 days
    partialFilterExpression: { isArchived: true },
  }
);

// ─── Statics ──────────────────────────────────────────────────────────────────

/**
 * Returns today's midnight in IST as a UTC Date.
 * IST = UTC+5:30. Midnight IST = 18:30 UTC previous calendar day.
 */
NyayaBotSessionSchema.statics.todayMidnightIST = function () {
  const now = new Date();
  // Convert to IST: add 5h30m
  const istMs = now.getTime() + 5.5 * 60 * 60 * 1000;
  const istDate = new Date(istMs);
  // Floor to midnight IST
  istDate.setUTCHours(0, 0, 0, 0);
  // Convert back to UTC (subtract 5h30m)
  return new Date(istDate.getTime() - 5.5 * 60 * 60 * 1000);
};

/**
 * Returns total user messages sent today across ALL sessions.
 * Used for quota enforcement.
 */
NyayaBotSessionSchema.statics.getDailyUsage = async function (userId) {
  const windowStart = this.todayMidnightIST();
  const sessions = await this.find({
    user: userId,
    'messages.role': 'user',
    'messages.createdAt': { $gte: windowStart },
  }).select('messages');

  let count = 0;
  for (const session of sessions) {
    count += session.messages.filter(
      (m) => m.role === 'user' && m.createdAt >= windowStart
    ).length;
  }
  return count;
};

/**
 * Returns quota config for a given persona + plan combination.
 */
NyayaBotSessionSchema.statics.getQuotaConfig = function (persona, plan) {
  const configs = {
    citizen: { free: 5, basic: 20, pro: Infinity },
    lawyer: { free: 0, professional: 40, firm: Infinity },
  };
  const personaConfig = configs[persona] || configs.citizen;
  const limit = personaConfig[plan];
  return {
    limit: limit === undefined ? 5 : limit,
    unlimited: limit === Infinity,
  };
};

// ─── Methods ──────────────────────────────────────────────────────────────────

/** Generate a cryptographically random share token */
NyayaBotSessionSchema.methods.generateShareToken = function (expiryDays = SHARE_TOKEN_DAYS) {
  const crypto = require('crypto');
  this.shareToken = crypto.randomBytes(20).toString('hex');
  this.shareTokenExpiry = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000);
  return this.shareToken;
};

/** Auto-generate a session title from the first user message */
NyayaBotSessionSchema.methods.autoTitle = function () {
  const firstUserMsg = this.messages.find((m) => m.role === 'user');
  if (!firstUserMsg) return;
  const words = firstUserMsg.content.trim().split(/\s+/).slice(0, 8).join(' ');
  this.title = words.length > 0 ? words + (firstUserMsg.content.split(/\s+/).length > 8 ? '…' : '') : 'New Conversation';
};

module.exports = mongoose.model('NyayaBotSession', NyayaBotSessionSchema);
