const mongoose = require('mongoose');
const { Schema } = mongoose;
const { v4: uuidv4 } = require('uuid');

// ─── Sub-schemas ───────────────────────────────────────────────────────────────

const legalCitationSchema = new Schema(
  {
    act: {
      type: String,
      required: true,
      trim: true,
      // e.g. "Consumer Protection Act, 2019"
    },
    section: {
      type: String,
      trim: true,
      // e.g. "Section 35"
    },
    description: {
      type: String,
      trim: true,
      // Plain-language description of what this citation supports
    },
    url: {
      type: String,
      trim: true,
      // Indian Kanoon URL for the exact section
    },
  },
  { _id: true }
);

const clauseExplanationSchema = new Schema(
  {
    clauseIndex: {
      type: Number,
      required: true,
      // 0-based index of the paragraph/clause in documentText
    },
    clauseText: {
      type: String,
      trim: true,
      // First 200 chars of the clause (for identification)
    },
    explanation: {
      type: String,
      trim: true,
      // Plain English explanation
    },
    // Explanations in regional languages (pre-generated for common templates)
    explanationHi: { type: String, trim: true },  // Hindi
    explanationBn: { type: String, trim: true },  // Bengali
    explanationMr: { type: String, trim: true },  // Marathi
    explanationTa: { type: String, trim: true },  // Tamil
  },
  { _id: true }
);

const nextStepSchema = new Schema(
  {
    step: { type: Number, required: true },
    instruction: { type: String, trim: true, required: true },
    authority: { type: String, trim: true },   // "District Consumer Forum", "Police Station", etc.
    fee: { type: String, trim: true },          // "₹200 court fee" — kept as string for flexibility
    timelineExpected: { type: String, trim: true }, // "15-30 working days"
    onlineLink: { type: String, trim: true },   // Government portal URL if applicable
    instructionHi: { type: String, trim: true },
  },
  { _id: true }
);

const versionSnapshotSchema = new Schema(
  {
    version: { type: Number, required: true },
    content: { type: String, required: true },
    contentHtml: { type: String },
    pdfUrl: { type: String },
    regeneratedAt: { type: Date, default: Date.now },
    regenerationReason: { type: String },
  },
  { _id: true }
);

// ─── Main Schema ───────────────────────────────────────────────────────────────

const documentSchema = new Schema(
  {
    // ── Ownership & Reference ─────────────────────────────────────────────────
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    session: {
      type: Schema.Types.ObjectId,
      ref: 'ChatSession',
      required: true,
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
      index: true,
    },

    // ── Document Content ──────────────────────────────────────────────────────
    title: {
      type: String,
      required: [true, 'Document title is required'],
      trim: true,
      maxlength: 300,
    },
    content: {
      type: String,
      required: [true, 'Document content is required'],
      // Raw legal document text (formal English)
    },
    contentHtml: {
      type: String,
      // HTML-rendered version for display in the browser
    },
    language: {
      type: String,
      default: 'en',
      // Language the document was generated in
    },

    // ── AI-generated Enrichments ──────────────────────────────────────────────
    legalCitations: {
      type: [legalCitationSchema],
      default: [],
    },
    clauseExplanations: {
      type: [clauseExplanationSchema],
      default: [],
    },
    nextSteps: {
      type: [nextStepSchema],
      default: [],
    },

    // ── Jurisdiction Context ──────────────────────────────────────────────────
    jurisdiction: {
      state: { type: String },
      district: { type: String },
      applicableActs: [{ type: String }],
      filingAuthority: { type: String },
    },

    // ── PDF ───────────────────────────────────────────────────────────────────
    pdfUrl: {
      type: String,
      default: null,
      // Signed URL with 15-minute expiry (Rule #9). Refreshed on each access.
      // The permanent storage key is in pdfStorageKey.
    },
    pdfStorageKey: {
      type: String,
      default: null,
      // Cloudinary public_id or S3 key — used to generate fresh signed URLs
    },
    pdfGeneratedAt: { type: Date },
    pdfSizeBytes: { type: Number },

    // ── Access Control ────────────────────────────────────────────────────────
    isPaid: {
      type: Boolean,
      default: false,
      index: true,
    },
    accessType: {
      type: String,
      enum: ['free_tier', 'subscription', 'pay_per_doc', 'lawyer_generated'],
      required: true,
      default: 'free_tier',
    },
    paymentId: {
      type: Schema.Types.ObjectId,
      ref: 'Payment',
      default: null,
    },

    // ── Sharing ───────────────────────────────────────────────────────────────
    shareToken: {
      type: String,
      unique: true,
      sparse: true,
      default: null,
      // Set when user chooses to share; UUID v4
    },
    shareTokenExpiresAt: { type: Date, default: null },
    isShareable: { type: Boolean, default: false },

    // ── Lawyer Linking ────────────────────────────────────────────────────────
    linkedCase: {
      type: Schema.Types.ObjectId,
      ref: 'CaseTracker',
      default: null,
    },
    reviewedByLawyer: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    lawyerReviewNotes: { type: String, trim: true },

    // ── Versioning ────────────────────────────────────────────────────────────
    version: {
      type: Number,
      default: 1,
      min: 1,
    },
    previousVersions: {
      type: [versionSnapshotSchema],
      default: [],
    },

    // ── Status ────────────────────────────────────────────────────────────────
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        // Never expose the internal storage key
        delete ret.pdfStorageKey;
        delete ret.__v;
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

// ─── Indexes ───────────────────────────────────────────────────────────────────
documentSchema.index({ user: 1, createdAt: -1 });
documentSchema.index({ user: 1, isDeleted: 1 });
documentSchema.index({ shareToken: 1 }, { sparse: true });
documentSchema.index({ templateSlug: 1 });
documentSchema.index({ accessType: 1 });
documentSchema.index({ linkedCase: 1 }, { sparse: true });

// ─── Virtuals ─────────────────────────────────────────────────────────────────

documentSchema.virtual('isShareTokenValid').get(function () {
  if (!this.shareToken || !this.shareTokenExpiresAt) return false;
  return new Date() < new Date(this.shareTokenExpiresAt);
});

documentSchema.virtual('hasPdf').get(function () {
  return !!this.pdfStorageKey;
});

// ─── Pre-save Hooks ────────────────────────────────────────────────────────────

documentSchema.pre('save', function (next) {
  // Snapshot the current version before saving a regeneration
  if (
    this.isModified('content') &&
    !this.isNew &&
    this.version > 1
  ) {
    // Previous version already captured by the regenerate controller
  }
  next();
});

// ─── Instance Methods ──────────────────────────────────────────────────────────

/**
 * generateShareToken — creates a share token with an expiry date.
 * @param {number} expiryDays — how many days the share link is valid (default: 30)
 */
documentSchema.methods.generateShareToken = async function (expiryDays = 30) {
  this.shareToken = uuidv4();
  this.shareTokenExpiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000);
  this.isShareable = true;
  return this.save();
};

/**
 * revokeShareToken — invalidates the share link.
 */
documentSchema.methods.revokeShareToken = async function () {
  this.shareToken = null;
  this.shareTokenExpiresAt = null;
  this.isShareable = false;
  return this.save();
};

/**
 * softDelete — marks document as deleted without removing from DB.
 */
documentSchema.methods.softDelete = async function () {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.isActive = false;
  return this.save();
};

// ─── Static Methods ────────────────────────────────────────────────────────────

documentSchema.statics.findForUser = function (userId, opts = {}) {
  return this.find({
    user: userId,
    isDeleted: false,
    ...opts,
  })
    .populate('template', 'name slug category icon complexity')
    .sort({ createdAt: -1 });
};

documentSchema.statics.findByShareToken = function (token) {
  return this.findOne({
    shareToken: token,
    isDeleted: false,
    shareTokenExpiresAt: { $gt: new Date() },
  }).populate('user', 'name').populate('template', 'name slug');
};

module.exports = mongoose.model('Document', documentSchema);
