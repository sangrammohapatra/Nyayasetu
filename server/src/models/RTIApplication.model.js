'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

// ─── RTI Status State Machine ──────────────────────────────────────────────────
// drafted → filed → response_received (satisfactory) → closed
//                 → first_appeal_due → first_appeal_filed → first_appeal_decided → closed
//                                                          → cic_filed → cic_decided → closed
//         → withdrawn

const RTI_STATUSES = [
  'drafted',            // Created but not yet filed
  'filed',              // Submitted to PIO, awaiting response
  'response_received',  // PIO replied (satisfactory)
  'first_appeal_due',   // 30-day deadline passed with no/unsatisfactory response
  'first_appeal_filed', // First Appeal submitted to FAA
  'first_appeal_decided', // FAA decision received
  'cic_filed',          // Second Appeal filed with CIC/SIC
  'cic_decided',        // CIC/SIC decision received
  'closed',             // Matter resolved
  'withdrawn',          // Applicant withdrew
];

// ─── Sub-schemas ───────────────────────────────────────────────────────────────

const alertSentSchema = new Schema(
  {
    day25:                 { type: Boolean, default: false },
    day30:                 { type: Boolean, default: false },
    firstAppealReminder:   { type: Boolean, default: false },
    cicReminder:           { type: Boolean, default: false },
  },
  { _id: false }
);

// ─── Main Schema ───────────────────────────────────────────────────────────────

const rtiApplicationSchema = new Schema(
  {
    // ── Ownership ──────────────────────────────────────────────────────────────
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // ── Display ────────────────────────────────────────────────────────────────
    title: {
      type: String,
      required: [true, 'RTI title is required'],
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 2000,
      // Plain-language description of what the user wants to find out
    },

    // ── PIO & Department ───────────────────────────────────────────────────────
    govLevel: {
      type: String,
      enum: ['central', 'state'],
      required: true,
      default: 'central',
    },
    state: { type: String, trim: true },   // For state-level RTI
    ministry: {
      type: String,
      trim: true,
      required: [true, 'Ministry/Department is required'],
    },
    department: { type: String, trim: true },
    pioName: { type: String, trim: true },
    pioDesignation: { type: String, trim: true },
    pioAddress: {
      type: String,
      trim: true,
      required: [true, 'PIO address is required'],
    },
    pioEmail: { type: String, trim: true, lowercase: true },
    pioPhone: { type: String, trim: true },

    // ── RTI Questions ──────────────────────────────────────────────────────────
    subjects: {
      type: [String],
      required: [true, 'At least one RTI question is required'],
      validate: {
        validator: (arr) => arr.length >= 1 && arr.length <= 15,
        message: 'RTI application must have between 1 and 15 questions',
      },
    },

    // ── Applicant Details ──────────────────────────────────────────────────────
    applicantName: { type: String, trim: true },
    applicantAddress: { type: String, trim: true },
    applicantPhone: { type: String, trim: true },
    applicantEmail: { type: String, trim: true, lowercase: true },
    applicantBpl: { type: Boolean, default: false }, // BPL citizens are fee-exempt

    // ── Filing Details ─────────────────────────────────────────────────────────
    filedDate: { type: Date, default: null },
    referenceNumber: {
      type: String,
      trim: true,
      default: null,
      // Provided by RTI Online portal or PIO acknowledgement
    },
    feeAmount: { type: Number, default: 10 }, // ₹10 for Central; varies by state
    feeMode: {
      type: String,
      enum: ['online', 'ipo', 'court_fee_stamp', 'demand_draft', 'free'],
      default: 'online',
    },
    feeStatus: {
      type: String,
      enum: ['pending', 'paid', 'exempted'],
      default: 'pending',
    },

    // ── Deadlines ──────────────────────────────────────────────────────────────
    responseDeadline: { type: Date, default: null }, // filedDate + 30 days
    // First Appeal must be filed within 30 days of response deadline if no reply
    firstAppealDeadline: { type: Date, default: null }, // responseDeadline + 30 days

    // ── Status ─────────────────────────────────────────────────────────────────
    status: {
      type: String,
      enum: RTI_STATUSES,
      default: 'drafted',
      index: true,
    },

    // ── PIO Response ───────────────────────────────────────────────────────────
    responseDate: { type: Date, default: null },
    responseText: { type: String, trim: true, maxlength: 5000 },
    isResponseSatisfactory: { type: Boolean, default: null },

    // ── First Appeal (to FAA - First Appellate Authority) ──────────────────────
    firstAppealFiledDate: { type: Date, default: null },
    firstAppealReferenceNumber: { type: String, trim: true },
    faaName: { type: String, trim: true },
    faaAddress: { type: String, trim: true },
    firstAppealDecisionDate: { type: Date, default: null },
    firstAppealDecisionText: { type: String, trim: true, maxlength: 5000 },

    // ── CIC/SIC Second Appeal ──────────────────────────────────────────────────
    cicFiledDate: { type: Date, default: null },
    cicReferenceNumber: { type: String, trim: true },
    cicDecisionDate: { type: Date, default: null },
    cicDecisionText: { type: String, trim: true, maxlength: 5000 },

    // ── Notifications ──────────────────────────────────────────────────────────
    alertsEnabled: { type: Boolean, default: true },
    alertSent: { type: alertSentSchema, default: () => ({}) },

    // ── Notes & Metadata ───────────────────────────────────────────────────────
    notes: { type: String, trim: true, maxlength: 3000 },
    isActive: { type: Boolean, default: true, index: true },

    // ── AI-generation metadata ─────────────────────────────────────────────────
    aiDrafted: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        delete ret.__v;
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

// ─── Indexes ───────────────────────────────────────────────────────────────────
rtiApplicationSchema.index({ user: 1, isActive: 1 });
rtiApplicationSchema.index({ user: 1, status: 1 });
rtiApplicationSchema.index({ responseDeadline: 1, status: 1, alertsEnabled: 1 });
rtiApplicationSchema.index({ firstAppealDeadline: 1, status: 1 });

// ─── Virtuals ─────────────────────────────────────────────────────────────────

rtiApplicationSchema.virtual('daysUntilDeadline').get(function () {
  if (!this.responseDeadline) return null;
  const diff = new Date(this.responseDeadline) - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
});

rtiApplicationSchema.virtual('isOverdue').get(function () {
  if (!this.responseDeadline) return false;
  if (['drafted', 'response_received', 'closed', 'withdrawn'].includes(this.status)) return false;
  return new Date() > new Date(this.responseDeadline);
});

rtiApplicationSchema.virtual('deadlineUrgency').get(function () {
  const days = this.daysUntilDeadline;
  if (days === null) return 'none';
  if (days < 0) return 'overdue';
  if (days <= 3) return 'critical';
  if (days <= 7) return 'warning';
  return 'normal';
});

// ─── Pre-save hooks ────────────────────────────────────────────────────────────

rtiApplicationSchema.pre('save', function (next) {
  // Auto-set deadlines when filedDate is provided
  if (this.isModified('filedDate') && this.filedDate) {
    this.responseDeadline = new Date(this.filedDate.getTime() + 30 * 24 * 60 * 60 * 1000);
    this.firstAppealDeadline = new Date(this.filedDate.getTime() + 60 * 24 * 60 * 60 * 1000);
    if (this.status === 'drafted') {
      this.status = 'filed';
    }
  }
  next();
});

// ─── Static Methods ────────────────────────────────────────────────────────────

rtiApplicationSchema.statics.findApplicationsNeedingAlerts = function () {
  const now = new Date();
  const thirtyFiveDaysOut = new Date(now.getTime() + 35 * 24 * 60 * 60 * 1000);
  return this.find({
    isActive: true,
    alertsEnabled: true,
    status: { $in: ['filed', 'first_appeal_due'] },
    responseDeadline: { $gte: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000), $lte: thirtyFiveDaysOut },
  }).populate('user', 'name email phone whatsappNumber whatsappOptIn preferredLanguage');
};

rtiApplicationSchema.statics.findOverdueApplications = function () {
  const now = new Date();
  return this.find({
    isActive: true,
    status: 'filed',
    responseDeadline: { $lt: now },
  }).populate('user', 'name email phone');
};

module.exports = mongoose.model('RTIApplication', rtiApplicationSchema);
