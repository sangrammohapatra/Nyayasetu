const mongoose = require('mongoose');
const { Schema } = mongoose;

// ─── Sub-schemas ───────────────────────────────────────────────────────────────

const sectionSchema = new Schema(
  {
    number: {
      type: String,
      required: true,
      trim: true,
      // e.g. "12", "35(1)", "2(g)", "Schedule II"
    },
    title: {
      type: String,
      trim: true,
      // e.g. "Manner in which complaint shall be made"
    },
    text: {
      type: String,
      trim: true,
      // Full statutory text — verbatim from the act
    },
    simplifiedText: {
      type: String,
      trim: true,
      // Plain-language summary for clause explainer feature
    },
    simplifiedTextHi: { type: String, trim: true }, // Hindi plain-language version
    // Tags indicating which document types benefit from this section
    relevantTo: {
      type: [String],
      default: [],
      // Array of template slugs, e.g. ["consumer_complaint", "insurance_claim"]
      index: true,
    },
    // Indian Kanoon direct link for this section
    indianKanoonUrl: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
  },
  { _id: true }
);

// ─── Main Schema ───────────────────────────────────────────────────────────────

const legalActSchema = new Schema(
  {
    // ── Identity ──────────────────────────────────────────────────────────────
    shortName: {
      type: String,
      required: [true, 'Short name is required'],
      trim: true,
      unique: true,
      // e.g. "CPA 2019", "IPC 1860", "RTI Act 2005"
    },
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
      // e.g. "Consumer Protection Act, 2019"
    },
    fullNameHi: { type: String, trim: true }, // Hindi name
    year: {
      type: Number,
      required: [true, 'Year is required'],
      min: 1860,
      max: new Date().getFullYear() + 1,
    },
    actNumber: {
      type: String,
      trim: true,
      // e.g. "Act No. 35 of 2019"
    },

    // ── Scope ─────────────────────────────────────────────────────────────────
    type: {
      type: String,
      enum: ['central', 'state'],
      required: [true, 'Act type is required'],
      index: true,
    },
    applicableState: {
      type: String,
      trim: true,
      default: null,
      // null = central act (applies everywhere); set to state name for state acts
    },
    category: {
      type: String,
      enum: [
        'consumer',
        'criminal',
        'civil',
        'property',
        'family',
        'labour',
        'corporate',
        'constitutional',
        'environmental',
        'information',
        'finance',
        'other',
      ],
      index: true,
    },

    // ── Sections ──────────────────────────────────────────────────────────────
    sections: {
      type: [sectionSchema],
      default: [],
    },

    // ── References ────────────────────────────────────────────────────────────
    indianKanoonId: {
      type: String,
      trim: true,
      // Indian Kanoon document ID for deep linking
    },
    officialGazetteUrl: {
      type: String,
      trim: true,
      // Link to the official Gazette of India notification
    },
    currentlyInForce: {
      type: Boolean,
      default: true,
    },
    amendedBy: [
      {
        actName: { type: String, trim: true },
        year: { type: Number },
        _id: false,
      },
    ],

    // ── Summary ───────────────────────────────────────────────────────────────
    summary: {
      type: String,
      trim: true,
      maxlength: 2000,
    },
    summaryHi: { type: String, trim: true },

    // ── Metadata ──────────────────────────────────────────────────────────────
    isActive: { type: Boolean, default: true, index: true },
    lastReviewedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─── Indexes ───────────────────────────────────────────────────────────────────
legalActSchema.index({ shortName: 1 });
legalActSchema.index({ type: 1, isActive: 1 });
legalActSchema.index({ 'sections.relevantTo': 1 });
legalActSchema.index({ year: -1 });
legalActSchema.index({ category: 1 });

// Text index for full-text search across act names and section text
legalActSchema.index(
  { fullName: 'text', shortName: 'text', 'sections.title': 'text', 'sections.text': 'text' },
  { name: 'legalact_text_search', weights: { fullName: 10, shortName: 10, 'sections.title': 5, 'sections.text': 1 } }
);

// ─── Virtuals ─────────────────────────────────────────────────────────────────

legalActSchema.virtual('sectionCount').get(function () {
  return this.sections.filter((s) => s.isActive).length;
});

// ─── Instance Methods ──────────────────────────────────────────────────────────

/**
 * getSectionsForDocType — return only sections relevant to a given document type.
 * Used by documentEngine.js to inject the right legal text into the AI prompt.
 *
 * @param {string} templateSlug — e.g. "consumer_complaint"
 * @param {number} maxSections  — limit to avoid overloading the AI context window
 */
legalActSchema.methods.getSectionsForDocType = function (templateSlug, maxSections = 10) {
  return this.sections
    .filter((s) => s.isActive && s.relevantTo.includes(templateSlug))
    .slice(0, maxSections)
    .map((s) => ({
      number: s.number,
      title: s.title,
      text: s.text,
      simplifiedText: s.simplifiedText,
      indianKanoonUrl: s.indianKanoonUrl,
    }));
};

// ─── Static Methods ────────────────────────────────────────────────────────────

/**
 * findRelevantForDocType — fetch all active acts that have sections tagged for
 * the given template slug. Used by documentEngine.js.
 *
 * @param {string} templateSlug
 */
legalActSchema.statics.findRelevantForDocType = function (templateSlug) {
  return this.find({
    isActive: true,
    currentlyInForce: true,
    'sections.relevantTo': templateSlug,
  }).select('shortName fullName year type sections indianKanoonId');
};

/**
 * findByShortName — case-insensitive lookup by short name.
 */
legalActSchema.statics.findByShortName = function (shortName) {
  return this.findOne({
    shortName: { $regex: new RegExp(`^${shortName}$`, 'i') },
    isActive: true,
  });
};

module.exports = mongoose.model('LegalAct', legalActSchema);
