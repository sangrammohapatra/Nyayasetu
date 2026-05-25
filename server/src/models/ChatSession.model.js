const mongoose = require('mongoose');
const { Schema } = mongoose;

// ─── Sub-schemas ───────────────────────────────────────────────────────────────

const messageSchema = new Schema(
  {
    role: {
      type: String,
      enum: ['user', 'assistant', 'system'],
      required: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
    },
    // Rich content variants
    contentHtml: { type: String },   // Rendered HTML (for assistant messages with formatting)
    // Metadata for assistant messages
    isQuestion: { type: Boolean, default: false },   // Is this collecting a data field?
    questionKey: { type: String },                   // Which field in collectedData this answers
    isDataComplete: { type: Boolean, default: false }, // AI signals all fields are collected
    // Voice input metadata
    audioUrl: { type: String },         // Temporary URL to raw audio file
    transcribedText: { type: String },  // Whisper transcription
    // Timestamps
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

// ─── Main Schema ───────────────────────────────────────────────────────────────

const chatSessionSchema = new Schema(
  {
    // ── Ownership ─────────────────────────────────────────────────────────────
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    template: {
      type: Schema.Types.ObjectId,
      ref: 'DocumentTemplate',
      required: true,
    },
    templateSlug: {
      type: String,
      required: true,
      trim: true,
      // Denormalized for fast lookups without populating template
    },

    // ── Status State Machine ───────────────────────────────────────────────────
    // active → data_complete → generating → completed
    // active → abandoned / paused
    status: {
      type: String,
      enum: ['active', 'data_complete', 'generating', 'completed', 'abandoned', 'paused'],
      default: 'active',
      index: true,
    },

    // ── Conversation History ───────────────────────────────────────────────────
    messages: {
      type: [messageSchema],
      default: [],
    },

    /**
     * collectedData — a Map of fieldKey → value gathered through the conversation.
     * This is the structured data passed to documentEngine.js for document generation.
     *
     * Rule #10: collectedData is encrypted at rest via mongoose-field-encryption.
     * Encryption is applied at the plugin level in the model initialization.
     */
    collectedData: {
      type: Map,
      of: Schema.Types.Mixed,
      default: () => new Map(),
    },

    // ── Progress ──────────────────────────────────────────────────────────────
    progressPercent: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    totalQuestions: {
      type: Number,
      default: 0,
    },
    answeredQuestions: {
      type: Number,
      default: 0,
    },

    // ── Source & Channel ──────────────────────────────────────────────────────
    source: {
      type: String,
      enum: ['web', 'whatsapp', 'mobile'],
      default: 'web',
      index: true,
    },
    // WhatsApp-specific state (phase within the bot state machine)
    whatsappPhase: {
      type: String,
      enum: ['WELCOME', 'LANGUAGE_SELECT', 'MAIN_MENU', 'SELECT_TEMPLATE', 'CHAT_FLOW', 'GENERATING', 'DOCUMENT_READY', null],
      default: null,
    },

    // ── Generated Document ────────────────────────────────────────────────────
    generatedDocument: {
      type: Schema.Types.ObjectId,
      ref: 'Document',
      default: null,
    },

    // ── Jurisdiction Context ──────────────────────────────────────────────────
    // Captured from the user's state at session creation time
    userState: { type: String },
    userLanguage: { type: String, default: 'en' },

    // ── Timing ───────────────────────────────────────────────────────────────
    lastMessageAt: { type: Date, default: Date.now },
    completedAt: { type: Date },
    abandonedAt: { type: Date },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        // Convert Map to plain object for JSON serialization
        if (ret.collectedData instanceof Map) {
          ret.collectedData = Object.fromEntries(ret.collectedData);
        }
        delete ret.__v;
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

// ─── Indexes ───────────────────────────────────────────────────────────────────
chatSessionSchema.index({ user: 1, status: 1 });
chatSessionSchema.index({ user: 1, createdAt: -1 });
chatSessionSchema.index({ templateSlug: 1 });
chatSessionSchema.index({ lastMessageAt: -1 });

/**
 * TTL Index — auto-delete 'active' (stale/abandoned) sessions after 7 days.
 * Sessions that are 'completed' or 'generating' are NOT deleted by TTL.
 * Rule: TTL on active sessions only via partialFilterExpression.
 */
chatSessionSchema.index(
  { createdAt: 1 },
  {
    expireAfterSeconds: 604800, // 7 days
    partialFilterExpression: { status: 'active' },
    name: 'ttl_active_sessions',
  }
);

// ─── Virtuals ─────────────────────────────────────────────────────────────────

chatSessionSchema.virtual('isComplete').get(function () {
  return this.status === 'completed';
});

chatSessionSchema.virtual('messageCount').get(function () {
  return this.messages.length;
});

chatSessionSchema.virtual('userMessageCount').get(function () {
  return this.messages.filter((m) => m.role === 'user').length;
});

// ─── Pre-save Hooks ────────────────────────────────────────────────────────────

chatSessionSchema.pre('save', function (next) {
  // Keep lastMessageAt in sync whenever messages change
  if (this.isModified('messages') && this.messages.length > 0) {
    this.lastMessageAt = new Date();
  }

  // Recompute progressPercent
  if (this.totalQuestions > 0) {
    this.progressPercent = Math.round((this.answeredQuestions / this.totalQuestions) * 100);
  }

  // Set completedAt / abandonedAt timestamps
  if (this.isModified('status')) {
    if (this.status === 'completed' && !this.completedAt) {
      this.completedAt = new Date();
    }
    if (this.status === 'abandoned' && !this.abandonedAt) {
      this.abandonedAt = new Date();
    }
  }

  next();
});

// ─── Instance Methods ──────────────────────────────────────────────────────────

/**
 * addMessage — append a message and update lastMessageAt atomically.
 */
chatSessionSchema.methods.addMessage = async function (role, content, meta = {}) {
  const message = { role, content, createdAt: new Date(), ...meta };
  this.messages.push(message);
  this.lastMessageAt = new Date();
  return this.save();
};

/**
 * setField — set a value in collectedData and update progress.
 */
chatSessionSchema.methods.setField = function (key, value) {
  if (!this.collectedData) this.collectedData = new Map();
  this.collectedData.set(key, value);
  this.answeredQuestions = this.collectedData.size;
};

/**
 * toCollectedDataObject — serialize collectedData Map to plain object.
 */
chatSessionSchema.methods.toCollectedDataObject = function () {
  if (!this.collectedData) return {};
  if (this.collectedData instanceof Map) {
    return Object.fromEntries(this.collectedData);
  }
  return this.collectedData;
};

// ─── Static Methods ────────────────────────────────────────────────────────────

chatSessionSchema.statics.findActiveForUser = function (userId) {
  return this.find({
    user: userId,
    status: { $in: ['active', 'paused', 'data_complete'] },
  })
    .populate('template', 'name slug category icon')
    .sort({ lastMessageAt: -1 });
};

// Apply field encryption plugin for collectedData (AES-256, Rule #10)
// The plugin is registered in a separate init step to keep this file clean:
// require('mongoose-field-encryption')({ fields: ['collectedData'], secret: process.env.FIELD_ENCRYPTION_KEY })(chatSessionSchema)
// Done externally in server/src/config/db.js after model load.

module.exports = mongoose.model('ChatSession', chatSessionSchema);
