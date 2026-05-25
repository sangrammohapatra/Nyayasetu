const mongoose = require('mongoose');
const { Schema } = mongoose;

// ─── Sub-schemas ───────────────────────────────────────────────────────────────

const applicableActSchema = new Schema(
  {
    act: {
      type: Schema.Types.ObjectId,
      ref: 'LegalAct',
    },
    actShortName: {
      type: String,
      trim: true,
      // Denormalized shortname so AI prompt can be built without populate
    },
    isOverride: {
      type: Boolean,
      default: false,
      // true = this state has a specific law that overrides the central act
    },
    notes: {
      type: String,
      trim: true,
      // e.g. "Maharashtra uses MRTP Act 1966 in addition to central act"
    },
    sectionNumbers: [{ type: String }],
    // Specific sections of this act relevant to this document type in this state
  },
  { _id: true }
);

const filingAuthoritySchema = new Schema(
  {
    name: {
      type: String,
      trim: true,
      required: true,
      // e.g. "District Consumer Disputes Redressal Commission"
    },
    address: { type: String, trim: true },
    website: { type: String, trim: true },
    phone: { type: String, trim: true },
    email: { type: String, trim: true },
    onlinePortal: {
      type: String,
      trim: true,
      // URL to file online if available
    },
    workingHours: { type: String, trim: true }, // "Monday-Friday 10:00-17:00"
  },
  { _id: false }
);

const filingFeeSchema = new Schema(
  {
    amount: {
      type: Number,
      default: 0,
      // in paise; 0 = no court fee
    },
    currency: { type: String, default: 'INR' },
    notes: {
      type: String,
      trim: true,
      // e.g. "Fee varies by claim amount: ₹200 for claims up to ₹1 lakh"
    },
    feeSlabs: [
      {
        claimUpTo: { type: Number },     // claim amount in paise; null = no upper limit
        fee: { type: Number },            // court fee in paise
        _id: false,
      },
    ],
  },
  { _id: false }
);

const limitationPeriodSchema = new Schema(
  {
    days: {
      type: Number,
      // Limitation period in days; null = no fixed period
    },
    fromEvent: {
      type: String,
      trim: true,
      // e.g. "date of deficiency in service", "date of last purchase", "date of termination"
    },
    notes: { type: String, trim: true },
    isCondonable: {
      type: Boolean,
      default: true,
      // Whether the court can condone delay beyond this period
    },
  },
  { _id: false }
);

const courtHierarchySchema = new Schema(
  {
    level: {
      type: Number,
      required: true,
      // 1 = first forum to approach, 2 = appellate, 3 = highest for this matter
    },
    name: {
      type: String,
      trim: true,
      required: true,
      // e.g. "District Consumer Forum", "State Consumer Commission"
    },
    jurisdiction: {
      type: String,
      trim: true,
      // e.g. "Claims up to ₹50 lakh", "Appeals from District Forum"
    },
    website: { type: String, trim: true },
  },
  { _id: false }
);

// ─── Main Schema ───────────────────────────────────────────────────────────────

const jurisdictionRuleSchema = new Schema(
  {
    // ── Identity ──────────────────────────────────────────────────────────────
    state: {
      type: String,
      required: [true, 'State is required'],
      trim: true,
      index: true,
    },
    documentType: {
      type: String,
      required: [true, 'Document type (template slug) is required'],
      trim: true,
      lowercase: true,
      index: true,
      // Matches DocumentTemplate.slug exactly
    },

    // ── Laws ──────────────────────────────────────────────────────────────────
    applicableActs: {
      type: [applicableActSchema],
      default: [],
    },

    // ── Filing ────────────────────────────────────────────────────────────────
    filingAuthority: {
      type: filingAuthoritySchema,
    },
    filingFee: {
      type: filingFeeSchema,
      default: () => ({}),
    },

    // ── Time Limits ────────────────────────────────────────────────────────────
    limitationPeriod: {
      type: limitationPeriodSchema,
    },

    // ── Court Hierarchy ────────────────────────────────────────────────────────
    courtHierarchy: {
      type: [courtHierarchySchema],
      default: [],
    },

    // ── Additional AI Context ─────────────────────────────────────────────────
    // Extra instructions injected into the AI system prompt for this
    // state + document type combination. Overrides template.systemPromptAddendum.
    additionalContext: {
      type: String,
      trim: true,
      // e.g. "In Tamil Nadu, consumer complaints must be filed in Tamil or English"
    },
    stateSpecificRequirements: [
      {
        requirement: { type: String, trim: true },
        mandatory: { type: Boolean, default: false },
        _id: false,
      },
    ],

    // ── Metadata ──────────────────────────────────────────────────────────────
    isActive: { type: Boolean, default: true },
    lastVerified: {
      type: Date,
      default: Date.now,
      // Date when a human last verified this data is accurate
    },
    verifiedBy: { type: String, trim: true },  // Admin name / source
    sourceReferences: [{ type: String, trim: true }],
    // Links to government notifications / gazette that confirm the rules
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─── Indexes ───────────────────────────────────────────────────────────────────

// Unique compound index — one rule per state+documentType combination
jurisdictionRuleSchema.index(
  { state: 1, documentType: 1 },
  { unique: true, name: 'unique_state_doctype' }
);
jurisdictionRuleSchema.index({ documentType: 1, isActive: 1 });

// ─── Virtuals ─────────────────────────────────────────────────────────────────

jurisdictionRuleSchema.virtual('limitationDays').get(function () {
  return this.limitationPeriod?.days || null;
});

// ─── Static Methods ────────────────────────────────────────────────────────────

/**
 * findForStateAndDocType — primary lookup used by documentEngine.js.
 * Falls back to a 'ALL' state rule if no state-specific rule exists.
 *
 * @param {string} state       — e.g. "Maharashtra"
 * @param {string} documentType — template slug, e.g. "consumer_complaint"
 */
jurisdictionRuleSchema.statics.findForStateAndDocType = async function (state, documentType) {
  // Try exact state match first
  let rule = await this.findOne({ state, documentType, isActive: true })
    .populate('applicableActs.act', 'shortName fullName year sections');

  // Fall back to 'ALL' (central rules applicable nationwide)
  if (!rule) {
    rule = await this.findOne({ state: 'ALL', documentType, isActive: true })
      .populate('applicableActs.act', 'shortName fullName year sections');
  }

  return rule;
};

/**
 * getStatesForDocType — list all states that have specific rules for a document type.
 */
jurisdictionRuleSchema.statics.getStatesForDocType = function (documentType) {
  return this.distinct('state', { documentType, isActive: true });
};

module.exports = mongoose.model('JurisdictionRule', jurisdictionRuleSchema);
