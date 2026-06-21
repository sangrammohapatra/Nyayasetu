const mongoose = require('mongoose');
const { Schema } = mongoose;

// ─── Sub-schemas ───────────────────────────────────────────────────────────────

const ratingSchema = new Schema(
  {
    citizen: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    consultation: { type: Schema.Types.ObjectId, ref: 'Consultation' },
    score: { type: Number, required: true, min: 1, max: 5 },
    review: { type: String, trim: true, maxlength: 1000 },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const availabilitySlotSchema = new Schema(
  {
    dayOfWeek: { type: Number, min: 0, max: 6 }, // 0 = Sunday
    startTime: { type: String, match: /^\d{2}:\d{2}$/ }, // "09:00"
    endTime: { type: String, match: /^\d{2}:\d{2}$/ },   // "17:00"
    isActive: { type: Boolean, default: true },
  },
  { _id: false }
);

const verificationDocSchema = new Schema(
  {
    type: {
      type: String,
      enum: ['bar_certificate', 'identity_proof', 'address_proof', 'degree_certificate', 'other'],
    },
    url: { type: String },          // Signed Cloudinary / S3 URL
    uploadedAt: { type: Date, default: Date.now },
    verifiedAt: { type: Date },
    notes: { type: String, trim: true },
  },
  { _id: true }
);

// ─── Main Schema ───────────────────────────────────────────────────────────────

const lawyerProfileSchema = new Schema(
  {
    // ── Core reference ───────────────────────────────────────────────────────
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,   // 1:1 with User
    },

    // ── Bar Council & Credentials ────────────────────────────────────────────
    barCouncilNumber: {
      type: String,
      required: [true, 'Bar Council enrollment number is required'],
      trim: true,
      unique: true,
    },
    barCouncilState: {
      type: String,
      trim: true,
      required: [true, 'State Bar Council is required'],
    },
    enrollmentYear: {
      type: Number,
      min: 1950,
      max: new Date().getFullYear(),
    },

    // ── Professional Details ─────────────────────────────────────────────────
    specialisations: {
      type: [String],
      enum: [
        'criminal',
        'civil',
        'family',
        'property',
        'consumer',
        'labour',
        'corporate',
        'intellectual_property',
        'tax',
        'constitutional',
        'environmental',
        'cyber',
        'immigration',
        'rti',
        'startup',
        'other',
      ],
      default: [],
    },
    practicingStates: {
      type: [String],
      default: [],
    },
    practicingCourts: {
      type: [String],
      enum: [
        'supreme_court',
        'high_court',
        'district_court',
        'consumer_forum',
        'labour_court',
        'family_court',
        'magistrate_court',
        'tribunal',
        'other',
      ],
      default: [],
    },
    experience: {
      type: Number,  // years
      min: 0,
      max: 60,
      required: [true, 'Years of experience is required'],
    },
    languages: {
      type: [String],
      default: ['en'],
    },
    bio: {
      type: String,
      trim: true,
      maxlength: [2000, 'Bio cannot exceed 2000 characters'],
    },
    education: [
      {
        degree: { type: String, trim: true },
        institution: { type: String, trim: true },
        year: { type: Number },
        _id: false,
      },
    ],

    // ── Consultation Settings ────────────────────────────────────────────────
    consultationFee: {
      type: Number,  // in paise (₹ × 100)
      min: 0,
      default: 50000,  // ₹500 default
    },
    consultationModes: {
      type: [String],
      enum: ['chat', 'video', 'phone', 'in_person'],
      default: ['chat', 'phone'],
    },
    availability: {
      type: [availabilitySlotSchema],
      default: [],
    },
    isAcceptingClients: { type: Boolean, default: true },

    // ── Ratings ─────────────────────────────────────────────────────────────
    ratings: {
      type: [ratingSchema],
      default: [],
    },
    averageRating: {
      type: Number,
      min: 0,
      max: 5,
      default: 0,
    },
    totalRatings: {
      type: Number,
      default: 0,
    },

    // ── Verification ─────────────────────────────────────────────────────────
    isVerified: { type: Boolean, default: false, index: true },
    verifiedAt: { type: Date },
    verifiedBy: { type: Schema.Types.ObjectId, ref: 'User' },  // Admin who verified
    verificationDocs: { type: [verificationDocSchema], default: [] },
    verificationStatus: {
      type: String,
      enum: ['pending', 'under_review', 'approved', 'rejected'],
      default: 'pending',
      index: true,
    },
    rejectionReason: { type: String, trim: true },
    rejectedAt: { type: Date },
    rejectedBy: { type: Schema.Types.ObjectId, ref: 'User' },

    // ── Subscription ─────────────────────────────────────────────────────────
    lawyerPlan: {
      type: String,
      enum: ['free', 'professional', 'firm'],
      default: 'free',
      index: true,
    },

    // ── Revenue ──────────────────────────────────────────────────────────────
    referralFeePercent: {
      type: Number,
      default: 10,   // Platform takes 10%, lawyer gets 90%
      min: 0,
      max: 30,
    },
    totalEarnings: {
      type: Number,
      default: 0,    // cumulative in paise
    },

    // ── Stats ─────────────────────────────────────────────────────────────────
    totalConsultations: { type: Number, default: 0 },
    totalDocumentsReviewed: { type: Number, default: 0 },
    profileViews: { type: Number, default: 0 },

    // ── Profile visibility ────────────────────────────────────────────────────
    isPublic: { type: Boolean, default: true },
    featuredUntil: { type: Date },  // Admin can feature lawyers
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─── Indexes ───────────────────────────────────────────────────────────────────
lawyerProfileSchema.index({ user: 1 });
lawyerProfileSchema.index({ barCouncilNumber: 1 });
lawyerProfileSchema.index({ specialisations: 1 });
lawyerProfileSchema.index({ practicingStates: 1 });
lawyerProfileSchema.index({ isVerified: 1, isPublic: 1, averageRating: -1 });
lawyerProfileSchema.index({ lawyerPlan: 1 });

// ─── Virtuals ─────────────────────────────────────────────────────────────────

lawyerProfileSchema.virtual('revenueSharePercent').get(function () {
  return 100 - this.referralFeePercent;
});

lawyerProfileSchema.virtual('verifiedBadge').get(function () {
  if (!this.isVerified) return null;
  return this.lawyerPlan === 'firm' ? 'gold' : 'standard';
});

// ─── Pre-save Hooks ────────────────────────────────────────────────────────────

/**
 * Recompute averageRating and totalRatings whenever ratings array changes.
 */
lawyerProfileSchema.pre('save', function (next) {
  if (this.isModified('ratings') && this.ratings.length > 0) {
    const sum = this.ratings.reduce((acc, r) => acc + r.score, 0);
    this.totalRatings = this.ratings.length;
    this.averageRating = Math.round((sum / this.ratings.length) * 10) / 10; // 1 decimal
  } else if (this.ratings.length === 0) {
    this.averageRating = 0;
    this.totalRatings = 0;
  }
  next();
});

// ─── Instance Methods ──────────────────────────────────────────────────────────

/**
 * addRating — add a new rating and trigger averageRating recomputation.
 * Prevents duplicate ratings from the same citizen for the same consultation.
 */
lawyerProfileSchema.methods.addRating = async function ({ citizenId, consultationId, score, review }) {
  // Remove any prior rating from this citizen for this consultation
  this.ratings = this.ratings.filter(
    (r) => !(r.citizen.equals(citizenId) && r.consultation?.equals(consultationId))
  );
  this.ratings.push({ citizen: citizenId, consultation: consultationId, score, review });
  return this.save();
};

// ─── Static Methods ────────────────────────────────────────────────────────────

/**
 * findVerified — search verified lawyers with filters.
 */
lawyerProfileSchema.statics.findVerified = function (filters = {}) {
  const query = { isVerified: true, isPublic: true, ...filters };
  return this.find(query)
    .populate('user', 'name avatar state district preferredLanguage')
    .sort({ averageRating: -1, totalConsultations: -1 });
};

module.exports = mongoose.model('LawyerProfile', lawyerProfileSchema);
