const mongoose = require('mongoose');
const { Schema } = mongoose;
const { ALWAYS_FREE_TEMPLATES, PRICES } = require('../config/constants');

// ─── Sub-schemas ───────────────────────────────────────────────────────────────

/**
 * A single question in the conversational data-collection flow.
 * The AI uses these to know what to ask and in what order.
 */
const questionSchema = new Schema(
  {
    key: {
      type: String,
      required: true,
      trim: true,
      // e.g. 'complainant_name', 'purchase_date', 'complaint_details'
    },
    label: {
      type: String,
      required: true,
      trim: true,
      // Human-readable label for the admin UI
    },
    questionText: {
      type: String,
      required: true,
      trim: true,
      // The exact question the AI asks the user, in English
      // The AI translates this to the user's preferredLanguage
    },
    questionTextHi: { type: String, trim: true }, // Pre-translated Hindi (faster)
    inputType: {
      type: String,
      enum: ['text', 'textarea', 'date', 'number', 'select', 'multiselect', 'boolean', 'address'],
      default: 'text',
    },
    options: [{ type: String }],  // For select/multiselect types
    isRequired: { type: Boolean, default: true },
    validation: {
      minLength: { type: Number },
      maxLength: { type: Number },
      pattern: { type: String },  // Regex as string
      customMessage: { type: String },
    },
    dependsOn: {
      // Only ask this question if another field has a specific value
      key: { type: String },
      value: { type: Schema.Types.Mixed },
    },
    order: { type: Number, required: true },  // Display order
    section: { type: String },  // Groups related questions (e.g. "Complainant Details")
  },
  { _id: true }
);

const requiredPlanSchema = new Schema(
  {
    citizen: {
      type: String,
      enum: ['free', 'basic', 'pro'],
      default: 'free',
    },
    lawyer: {
      type: String,
      enum: ['free', 'professional', 'firm'],
      default: 'free',
    },
  },
  { _id: false }
);

// ─── Main Schema ───────────────────────────────────────────────────────────────

const documentTemplateSchema = new Schema(
  {
    // ── Identity ─────────────────────────────────────────────────────────────
    slug: {
      type: String,
      required: [true, 'Template slug is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[a-z0-9_]+$/, 'Slug must contain only lowercase letters, numbers and underscores'],
    },
    name: {
      type: String,
      required: [true, 'Template name is required'],
      trim: true,
    },
    nameHi: { type: String, trim: true },   // Hindi
    nameBn: { type: String, trim: true },   // Bengali
    nameMr: { type: String, trim: true },   // Marathi
    nameTa: { type: String, trim: true },   // Tamil
    nameTe: { type: String, trim: true },   // Telugu

    description: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    descriptionHi: { type: String, trim: true },

    // ── Classification ────────────────────────────────────────────────────────
    category: {
      type: String,
      required: true,
      enum: [
        'property',
        'consumer',
        'rti',
        'employment',
        'criminal',
        'family',
        'civil',
        'financial',
        'labour',
        'startup',
        'other',
      ],
      index: true,
    },
    complexity: {
      type: String,
      enum: ['simple', 'moderate', 'complex'],
      required: true,
    },
    estimatedMinutes: {
      type: Number,
      default: 10,  // Estimated time to complete the chat flow
    },

    // ── Pricing ───────────────────────────────────────────────────────────────
    pricePayPerDoc: {
      type: Number,  // in paise; 0 = always free
      required: true,
      default: 0,
    },
    isAlwaysFree: {
      type: Boolean,
      default: false,
      // Set automatically in pre-save based on ALWAYS_FREE_TEMPLATES
    },
    requiredPlan: {
      type: requiredPlanSchema,
      default: () => ({}),
    },

    // ── Availability ──────────────────────────────────────────────────────────
    availableStates: {
      type: [String],
      default: [],  // Empty = available in all states
    },
    isActive: { type: Boolean, default: true, index: true },
    isFeatured: { type: Boolean, default: false },

    // ── AI Prompt Configuration ───────────────────────────────────────────────
    /**
     * questionFlow — ordered list of data-collection questions.
     * The questionEngine.js uses this to drive the conversational AI.
     */
    questionFlow: {
      type: [questionSchema],
      default: [],
      validate: {
        validator: (arr) => arr.length > 0,
        message: 'A template must have at least one question',
      },
    },

    /**
     * systemPromptAddendum — extra instructions appended to the document
     * generation system prompt for this specific template type.
     * E.g. "Always cite Section 12 of the Consumer Protection Act 2019"
     */
    systemPromptAddendum: {
      type: String,
      trim: true,
    },

    /**
     * outputFormat — hints for the AI about document structure.
     */
    outputFormat: {
      includeDate: { type: Boolean, default: true },
      includeSignatureLine: { type: Boolean, default: true },
      includeWitnesses: { type: Boolean, default: false },
      includeNotary: { type: Boolean, default: false },
      formalSalutation: { type: Boolean, default: true },
    },

    // ── Metadata ──────────────────────────────────────────────────────────────
    tags: [{ type: String, trim: true, lowercase: true }],
    icon: { type: String },          // MUI icon name or emoji
    totalGenerated: { type: Number, default: 0 },  // Usage counter
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─── Indexes ───────────────────────────────────────────────────────────────────
documentTemplateSchema.index({ slug: 1 });
documentTemplateSchema.index({ category: 1, isActive: 1 });
documentTemplateSchema.index({ isFeatured: 1, isActive: 1 });
documentTemplateSchema.index({ isAlwaysFree: 1 });
documentTemplateSchema.index({ tags: 1 });

// ─── Pre-save Hook ─────────────────────────────────────────────────────────────

documentTemplateSchema.pre('save', function (next) {
  // Auto-set isAlwaysFree based on the canonical list
  this.isAlwaysFree = ALWAYS_FREE_TEMPLATES.includes(this.slug);

  // Always-free templates have zero price
  if (this.isAlwaysFree) {
    this.pricePayPerDoc = 0;
  }

  // Sort questionFlow by order field
  if (this.isModified('questionFlow') && this.questionFlow.length > 1) {
    this.questionFlow.sort((a, b) => a.order - b.order);
  }

  next();
});

// ─── Virtuals ─────────────────────────────────────────────────────────────────

documentTemplateSchema.virtual('priceFormatted').get(function () {
  if (this.pricePayPerDoc === 0) return 'Free';
  return `₹${this.pricePayPerDoc / 100}`;
});

documentTemplateSchema.virtual('requiredFields').get(function () {
  return this.questionFlow.filter((q) => q.isRequired).map((q) => q.key);
});

// ─── Static Methods ────────────────────────────────────────────────────────────

documentTemplateSchema.statics.findBySlug = function (slug) {
  return this.findOne({ slug: slug.toLowerCase().trim(), isActive: true });
};

documentTemplateSchema.statics.findFeatured = function () {
  return this.find({ isFeatured: true, isActive: true }).sort({ category: 1 });
};

documentTemplateSchema.statics.findByCategory = function (category) {
  return this.find({ category, isActive: true }).sort({ complexity: 1, name: 1 });
};

module.exports = mongoose.model('DocumentTemplate', documentTemplateSchema);
