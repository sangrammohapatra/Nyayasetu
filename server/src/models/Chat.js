/**
 * Chat Model — persists chat sessions, messages, and usage quota
 * Features:
 * - Multi-turn conversations per user
 * - Message quota tracking (daily reset)
 * - Context awareness (documents, cases, lawyer profiles)
 * - Field encryption for sensitive legal content
 * - TTL auto-deletion for inactive chats (90 days)
 */

const mongoose = require('mongoose');
const mongooseEncryption = require('mongoose-field-encryption');

const ChatMessageSchema = new mongoose.Schema({
  role: { type: String, enum: ['user', 'assistant'], required: true },
  content: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  tokenCount: { type: Number, default: 0 }, // for quota tracking
  audioUrl: String, // if message came from voice input
  audioTranscript: String, // Whisper transcription
  relatedDocuments: [mongoose.Schema.Types.ObjectId], // linked Document IDs
  relatedCases: [mongoose.Schema.Types.ObjectId], // linked CaseTracker IDs
});

const ChatSessionSchema = new mongoose.Schema(
  {
    // Owner & Context
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

    // Chat metadata
    title: {
      type: String,
      default: function () {
        return `Chat #${this._id.toString().slice(-6).toUpperCase()}`;
      },
    },
    description: String, // User-provided summary of chat topic

    // Messages
    messages: [ChatMessageSchema],

    // Context enrichment
    jurisdiction: String, // user's state (from User.jurisdiction or inferred)
    language: {
      type: String,
      enum: ['en', 'hi', 'bn', 'mr', 'ta', 'te', 'gu', 'kn', 'ml', 'pa', 'ur'],
      default: 'en',
    },

    // Document & case context
    linkedDocuments: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Document',
      },
    ],
    linkedCases: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'CaseTracker',
      },
    ],

    // Quota tracking (daily message count)
    dailyMessageCount: {
      type: Number,
      default: 0,
    },
    lastMessageResetDate: {
      type: Date,
      default: function () {
        const now = new Date();
        // Midnight IST = -05:30
        const istMidnight = new Date(now);
        istMidnight.setUTCHours(18, 30, 0, 0); // 18:30 UTC = 00:00 IST next day
        if (istMidnight <= now) {
          istMidnight.setDate(istMidnight.getDate() + 1);
        }
        return istMidnight;
      },
    },

    // Sharing
    sharedWithLawyer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    shareToken: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
    shareTokenExpiry: Date,

    // Chat state
    status: {
      type: String,
      enum: ['active', 'archived', 'reported'],
      default: 'active',
    },
    isArchived: { type: Boolean, default: false },

    // Ratings & feedback
    userRating: { type: Number, min: 1, max: 5 },
    userFeedback: String,

    // Metadata
    source: {
      type: String,
      enum: ['web', 'mobile', 'whatsapp'],
      default: 'web',
    },
    ipAddress: String,
    userAgent: String,

    // For lawyer-citizen consultation chats
    consultationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Consultation',
    },

    createdAt: { type: Date, default: Date.now, index: true },
    updatedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  }
);

// TTL Index: auto-delete archived chats after 90 days
ChatSessionSchema.index(
  { updatedAt: 1 },
  {
    expireAfterSeconds: 7776000, // 90 days
    partialFilterExpression: { isArchived: true },
  }
);

// Compound index for efficient querying
ChatSessionSchema.index({ user: 1, createdAt: -1 });
ChatSessionSchema.index({ sharedWithLawyer: 1, createdAt: -1 });

// Encrypt sensitive message content at rest
const encryptionKey = process.env.FIELD_ENCRYPTION_KEY;
if (encryptionKey && encryptionKey.length === 32) {
  mongooseEncryption.encryptField(ChatSessionSchema, ['messages.*.content'], {
    secret: encryptionKey,
  });
}

// Middleware: auto-reset daily message count
ChatSessionSchema.methods.checkAndResetDailyQuota = function () {
  const now = new Date();
  if (now >= this.lastMessageResetDate) {
    this.dailyMessageCount = 0;
    const istMidnight = new Date(now);
    istMidnight.setUTCHours(18, 30, 0, 0); // Next day midnight IST
    this.lastMessageResetDate = new Date(istMidnight.getTime() + 24 * 60 * 60 * 1000);
    return true; // quota was reset
  }
  return false; // quota still active
};

// Helper: add message to chat
ChatSessionSchema.methods.addMessage = async function (role, content, metadata = {}) {
  const message = new mongoose.Document(
    {
      role,
      content,
      timestamp: new Date(),
      ...metadata,
    },
    ChatMessageSchema
  );

  this.messages.push(message);
  if (role === 'user') {
    this.dailyMessageCount++;
  }
  this.updatedAt = new Date();

  return this.save();
};

// Helper: get remaining daily messages for user
ChatSessionSchema.statics.getDailyQuota = async function (userId, userPlan) {
  const quotaMap = {
    free: 5,
    basic: 15,
    pro: Infinity,
  };

  const session = await this.findOne({ user: userId }).sort({ createdAt: -1 });

  if (!session) {
    return quotaMap[userPlan] || 5;
  }

  session.checkAndResetDailyQuota();
  const remaining = quotaMap[userPlan] - session.dailyMessageCount;
  return Math.max(0, remaining);
};

// Helper: generate share token
ChatSessionSchema.methods.generateShareToken = function () {
  const crypto = require('crypto');
  this.shareToken = crypto.randomBytes(16).toString('hex');
  this.shareTokenExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
  return this.shareToken;
};

module.exports = mongoose.model('Chat', ChatSessionSchema);
