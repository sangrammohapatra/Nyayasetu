const mongoose = require('mongoose');
const { Schema } = mongoose;
const { CNR_REGEX } = require('../config/constants');

// ─── Sub-schemas ───────────────────────────────────────────────────────────────

const hearingSchema = new Schema(
  {
    date: { type: Date, required: true },
    purpose: { type: String, trim: true },    // "Arguments", "Evidence", "Judgment", etc.
    nextDate: { type: Date },
    judge: { type: String, trim: true },
    courtRoom: { type: String, trim: true },
    orderText: { type: String, trim: true },  // Order passed at this hearing
    status: {
      type: String,
      enum: ['scheduled', 'held', 'adjourned', 'cancelled'],
      default: 'scheduled',
    },
    alertSent: { type: Boolean, default: false }, // Whether hearing alert was dispatched
    fetchedAt: { type: Date, default: Date.now }, // When this data was last pulled from eCourts
  },
  { _id: true }
);

const alertChannelsSchema = new Schema(
  {
    whatsapp: { type: Boolean, default: false },
    email: { type: Boolean, default: false },
    sms: { type: Boolean, default: false },
    web: { type: Boolean, default: true },
  },
  { _id: false }
);

const partySchema = new Schema(
  {
    name: { type: String, trim: true },
    advocate: { type: String, trim: true },
    role: {
      type: String,
      enum: ['petitioner', 'respondent', 'applicant', 'opposite_party', 'other'],
    },
  },
  { _id: false }
);

// ─── Main Schema ───────────────────────────────────────────────────────────────

const caseTrackerSchema = new Schema(
  {
    // ── Ownership ─────────────────────────────────────────────────────────────
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // ── Case Identity ─────────────────────────────────────────────────────────
    cnrNumber: {
      type: String,
      required: [true, 'CNR number is required'],
      trim: true,
      uppercase: true,
      validate: {
        validator: (v) => CNR_REGEX.test(v),
        message: 'Invalid CNR format. Expected: 4 letters + 2 digits + 6 digits + 4-digit year (e.g. DLHC010012342024)',
      },
    },
    caseTitle: {
      type: String,
      trim: true,
      // e.g. "Ramesh Kumar vs State of Delhi"
    },
    caseType: {
      type: String,
      trim: true,
      // e.g. "Civil Suit", "Criminal Appeal", "Writ Petition"
    },
    caseNumber: { type: String, trim: true },
    filingDate: { type: Date },

    // ── Court Details ─────────────────────────────────────────────────────────
    court: {
      type: String,
      trim: true,
      // e.g. "Delhi High Court", "District Court Saket"
    },
    courtCode: { type: String, trim: true },  // eCourts court code
    state: {
      type: String,
      trim: true,
      required: [true, 'State is required for case tracking'],
      index: true,
    },
    district: { type: String, trim: true },
    bench: { type: String, trim: true },

    // ── Parties ───────────────────────────────────────────────────────────────
    parties: {
      type: [partySchema],
      default: [],
    },

    // ── Hearing History ───────────────────────────────────────────────────────
    hearings: {
      type: [hearingSchema],
      default: [],
    },
    nextHearingDate: {
      type: Date,
      default: null,
      index: true,
    },

    // ── Case Status ────────────────────────────────────────────────────────────
    caseStatus: {
      type: String,
      enum: ['pending', 'disposed', 'transferred', 'unknown'],
      default: 'pending',
      index: true,
    },
    disposalDate: { type: Date },
    disposalType: { type: String, trim: true },  // "Allowed", "Dismissed", "Settled", etc.

    // ── Alert Configuration ────────────────────────────────────────────────────
    alertDaysBefore: {
      type: Number,
      default: 1,
      min: 1,
      max: 7,
      // Send alert this many days before the hearing
    },
    alertChannels: {
      type: alertChannelsSchema,
      default: () => ({}),
    },
    alertsEnabled: { type: Boolean, default: true },

    // ── Lawyer Sharing ────────────────────────────────────────────────────────
    sharedWithLawyer: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    sharedAt: { type: Date },

    // ── Linked Documents ──────────────────────────────────────────────────────
    linkedDocuments: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Document',
      },
    ],

    // ── eCourts Sync ──────────────────────────────────────────────────────────
    lastSyncedAt: {
      type: Date,
      default: null,
      // When this case was last fetched from eCourts API
    },
    syncError: { type: String, default: null },
    rawEcourtsData: { type: Schema.Types.Mixed, default: null },
    // Full raw API response stored for debugging; not exposed in API responses

    // ── Metadata ──────────────────────────────────────────────────────────────
    notes: {
      type: String,
      trim: true,
      maxlength: 2000,
    },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        delete ret.rawEcourtsData;
        delete ret.__v;
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

// ─── Indexes ───────────────────────────────────────────────────────────────────
caseTrackerSchema.index({ user: 1, isActive: 1 });
caseTrackerSchema.index({ cnrNumber: 1, user: 1 }, { unique: true }); // One user can't track same CNR twice
caseTrackerSchema.index({ nextHearingDate: 1, alertsEnabled: 1 });
caseTrackerSchema.index({ state: 1 });
caseTrackerSchema.index({ caseStatus: 1 });
caseTrackerSchema.index({ sharedWithLawyer: 1 }, { sparse: true });

// ─── Virtuals ─────────────────────────────────────────────────────────────────

caseTrackerSchema.virtual('daysUntilNextHearing').get(function () {
  if (!this.nextHearingDate) return null;
  const diff = new Date(this.nextHearingDate) - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
});

caseTrackerSchema.virtual('isHearingSoon').get(function () {
  const days = this.daysUntilNextHearing;
  if (days === null) return false;
  return days >= 0 && days <= this.alertDaysBefore;
});

caseTrackerSchema.virtual('lastHearing').get(function () {
  if (!this.hearings.length) return null;
  const held = this.hearings.filter((h) => h.status === 'held');
  if (!held.length) return null;
  return held.sort((a, b) => b.date - a.date)[0];
});

// ─── Pre-save Hooks ────────────────────────────────────────────────────────────

caseTrackerSchema.pre('save', function (next) {
  // Keep nextHearingDate in sync with the earliest future scheduled hearing
  if (this.isModified('hearings')) {
    const futureHearings = this.hearings
      .filter((h) => h.status === 'scheduled' && h.date > new Date())
      .sort((a, b) => a.date - b.date);
    this.nextHearingDate = futureHearings.length > 0 ? futureHearings[0].date : null;
  }
  next();
});

// ─── Instance Methods ──────────────────────────────────────────────────────────

/**
 * updateFromEcourts — merge fresh eCourts API data into the document.
 * @param {Object} ecourtsData — normalized response from ecourtsService
 */
caseTrackerSchema.methods.updateFromEcourts = async function (ecourtsData) {
  const {
    caseTitle, caseType, caseNumber, filingDate, court, courtCode,
    bench, parties, hearings, caseStatus, disposalDate, disposalType,
  } = ecourtsData;

  if (caseTitle) this.caseTitle = caseTitle;
  if (caseType) this.caseType = caseType;
  if (caseNumber) this.caseNumber = caseNumber;
  if (filingDate) this.filingDate = filingDate;
  if (court) this.court = court;
  if (courtCode) this.courtCode = courtCode;
  if (bench) this.bench = bench;
  if (parties) this.parties = parties;
  if (caseStatus) this.caseStatus = caseStatus;
  if (disposalDate) this.disposalDate = disposalDate;
  if (disposalType) this.disposalType = disposalType;

  // Merge hearings — don't overwrite existing ones that have been alerted
  if (hearings && hearings.length > 0) {
    const existingDates = new Set(
      this.hearings.map((h) => new Date(h.date).toISOString().split('T')[0])
    );
    const newHearings = hearings.filter(
      (h) => !existingDates.has(new Date(h.date).toISOString().split('T')[0])
    );
    this.hearings.push(...newHearings);
  }

  this.rawEcourtsData = ecourtsData;
  this.lastSyncedAt = new Date();
  this.syncError = null;

  return this.save();
};

// ─── Static Methods ────────────────────────────────────────────────────────────

/**
 * findCasesNeedingAlerts — find all cases where a hearing alert should be sent today.
 * Called by the hearingAlerts Bull job.
 */
caseTrackerSchema.statics.findCasesNeedingAlerts = function () {
  const now = new Date();
  const sevenDaysOut = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  return this.find({
    isActive: true,
    alertsEnabled: true,
    nextHearingDate: { $gte: now, $lte: sevenDaysOut },
    caseStatus: 'pending',
  }).populate('user', 'name phone email whatsappNumber whatsappOptIn preferredLanguage');
};

/**
 * clearExpiredCache — wipes rawEcourtsData on records whose lastSyncedAt is
 * older than 30 days. Keeps all normalised case fields intact so the UI still
 * shows the last-known state. Called daily by the checkHearingDates cron job.
 */
caseTrackerSchema.statics.clearExpiredCache = function () {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  return this.updateMany(
    { lastSyncedAt: { $lt: thirtyDaysAgo }, rawEcourtsData: { $ne: null } },
    { $unset: { rawEcourtsData: '' } }
  );
};

module.exports = mongoose.model('CaseTracker', caseTrackerSchema);
