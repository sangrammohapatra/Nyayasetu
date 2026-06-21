const mongoose = require('mongoose');
const { Schema } = mongoose;

// ─── Sub-schemas ───────────────────────────────────────────────────────────────

const ratingSchema = new Schema(
  {
    score: { type: Number, min: 1, max: 5 },
    review: { type: String, trim: true, maxlength: 1000 },
    ratedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

// ─── Main Schema ───────────────────────────────────────────────────────────────

const consultationSchema = new Schema(
  {
    // ── Parties ───────────────────────────────────────────────────────────────
    citizen: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Citizen reference is required'],
      index: true,
    },
    lawyer: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Lawyer reference is required'],
      index: true,
    },
    lawyerProfile: {
      type: Schema.Types.ObjectId,
      ref: 'LawyerProfile',
      // Denormalized for faster queries
    },

    // ── Booking Details ────────────────────────────────────────────────────────
    mode: {
      type: String,
      enum: ['chat', 'video', 'phone', 'in_person'],
      required: [true, 'Consultation mode is required'],
    },
    scheduledAt: {
      type: Date,
      required: [true, 'Scheduled time is required'],
    },
    durationMinutes: {
      type: Number,
      default: 30,
      min: 15,
      max: 120,
    },
    timezone: {
      type: String,
      default: 'Asia/Kolkata',
    },
    meetingLink: { type: String, trim: true },     // Video call URL
    meetingNotes: { type: String, trim: true },    // Pre-call notes from citizen

    // ── Status State Machine ───────────────────────────────────────────────────
    // requested → accepted → completed
    // requested → rejected
    // accepted  → cancelled (by either party)
    status: {
      type: String,
      enum: ['requested', 'accepted', 'rejected', 'completed', 'cancelled', 'no_show'],
      default: 'requested',
      index: true,
    },
    rejectionReason: { type: String, trim: true },
    cancellationReason: { type: String, trim: true },
    cancelledBy: {
      type: String,
      enum: ['citizen', 'lawyer', 'admin', null],
      default: null,
    },

    // ── Timing ───────────────────────────────────────────────────────────────
    acceptedAt: { type: Date },
    startedAt: { type: Date },
    endedAt: { type: Date },
    actualDurationMinutes: { type: Number },

    // ── Document Context ─────────────────────────────────────────────────────
    // The citizen can share a document for the lawyer to review during consultation
    sharedDocument: {
      type: Schema.Types.ObjectId,
      ref: 'Document',
      default: null,
    },
    // Subject / brief description of the legal matter
    subject: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    caseArea: {
      type: String,
      enum: [
        'criminal', 'civil', 'family', 'property', 'consumer',
        'labour', 'corporate', 'tax', 'rti', 'startup', 'other',
      ],
    },

    // ── Payment ───────────────────────────────────────────────────────────────
    fee: {
      type: Number,  // in paise; copied from LawyerProfile.consultationFee at booking time
      required: true,
    },
    payment: {
      type: Schema.Types.ObjectId,
      ref: 'Payment',
      default: null,
    },
    isPaid: { type: Boolean, default: false },

    // ── Post-consultation ─────────────────────────────────────────────────────
    lawyerNotes: {
      type: String,
      trim: true,
      // Private notes from lawyer (not visible to citizen)
    },
    summary: {
      type: String,
      trim: true,
      // Summary shared with citizen after consultation
    },
    followUpRecommended: { type: Boolean, default: false },
    followUpNotes: { type: String, trim: true },

    // ── Ratings ───────────────────────────────────────────────────────────────
    citizenRating: {
      type: ratingSchema,
      default: null,
    },
    lawyerRating: {
      // Lawyer's rating of the citizen interaction
      type: ratingSchema,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        // Lawyer's private notes never go to citizen-facing responses
        // (filtered out in controller based on req.user.persona)
        delete ret.__v;
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

// ─── Indexes ───────────────────────────────────────────────────────────────────
consultationSchema.index({ citizen: 1, status: 1 });
consultationSchema.index({ lawyer: 1, status: 1 });
consultationSchema.index({ scheduledAt: 1 });
consultationSchema.index({ status: 1, scheduledAt: 1 });
// Bug #3: Prevents double-bookings for the same lawyer slot under concurrent requests.
// Unique only for active statuses so rejected/cancelled slots can be re-booked.
consultationSchema.index(
  { lawyer: 1, scheduledAt: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ['requested', 'accepted'] } },
    name: 'unique_lawyer_slot_active',
  }
);

// ─── Virtuals ─────────────────────────────────────────────────────────────────

consultationSchema.virtual('feeFormatted').get(function () {
  return `₹${this.fee / 100}`;
});

consultationSchema.virtual('isUpcoming').get(function () {
  return (
    ['requested', 'accepted'].includes(this.status) &&
    new Date(this.scheduledAt) > new Date()
  );
});

consultationSchema.virtual('isPast').get(function () {
  return new Date(this.scheduledAt) < new Date();
});

// ─── Pre-save Hooks ────────────────────────────────────────────────────────────

consultationSchema.pre('save', function (next) {
  if (this.isModified('status')) {
    if (this.status === 'accepted' && !this.acceptedAt) {
      this.acceptedAt = new Date();
    }
    if (this.status === 'completed' && !this.endedAt) {
      this.endedAt = new Date();
      if (this.startedAt) {
        this.actualDurationMinutes = Math.round(
          (this.endedAt - this.startedAt) / 60000
        );
      }
    }
  }
  next();
});

// ─── Instance Methods ──────────────────────────────────────────────────────────

/**
 * rateByCitizen — citizen rates the consultation and triggers LawyerProfile rating update.
 */
consultationSchema.methods.rateByCitizen = async function (score, review) {
  this.citizenRating = { score, review, ratedAt: new Date() };
  await this.save();

  // Update the aggregated rating on LawyerProfile
  const LawyerProfile = mongoose.model('LawyerProfile');
  const profile = await LawyerProfile.findOne({ user: this.lawyer });
  if (profile) {
    await profile.addRating({
      citizenId: this.citizen,
      consultationId: this._id,
      score,
      review,
    });
  }
};

// ─── Static Methods ────────────────────────────────────────────────────────────

consultationSchema.statics.findUpcomingForLawyer = function (lawyerId) {
  return this.find({
    lawyer: lawyerId,
    status: { $in: ['requested', 'accepted'] },
    scheduledAt: { $gte: new Date() },
  })
    .populate('citizen', 'name phone avatar preferredLanguage')
    .populate('sharedDocument', 'title templateSlug')
    .sort({ scheduledAt: 1 });
};

consultationSchema.statics.findUpcomingForCitizen = function (citizenId) {
  return this.find({
    citizen: citizenId,
    status: { $in: ['requested', 'accepted'] },
    scheduledAt: { $gte: new Date() },
  })
    .populate('lawyer', 'name avatar')
    .populate('lawyerProfile', 'specialisations averageRating isVerified')
    .sort({ scheduledAt: 1 });
};

module.exports = mongoose.model('Consultation', consultationSchema);
