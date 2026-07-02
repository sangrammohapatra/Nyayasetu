const mongoose = require('mongoose');
const { Schema } = mongoose;

const ratingSchema = new Schema(
  {
    citizen: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    request: { type: Schema.Types.ObjectId, ref: 'NotarizationRequest' },
    score: { type: Number, required: true, min: 1, max: 5 },
    review: { type: String, trim: true, maxlength: 1000 },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const availabilitySlotSchema = new Schema(
  {
    dayOfWeek: { type: Number, min: 0, max: 6 },
    startTime: { type: String, match: /^\d{2}:\d{2}$/ },
    endTime: { type: String, match: /^\d{2}:\d{2}$/ },
    isActive: { type: Boolean, default: true },
  },
  { _id: false }
);

const verificationDocSchema = new Schema(
  {
    type: {
      type: String,
      enum: ['notary_certificate', 'identity_proof', 'address_proof', 'appointment_order', 'other'],
    },
    url: { type: String },
    uploadedAt: { type: Date, default: Date.now },
    verifiedAt: { type: Date },
    notes: { type: String, trim: true },
  },
  { _id: true }
);

const notaryProfileSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },

    // ── Registration Details ─────────────────────────────────────────────────
    notaryRegistrationNumber: {
      type: String,
      required: [true, 'Notary registration number is required'],
      trim: true,
      unique: true,
    },
    appointingAuthority: {
      type: String,
      trim: true,
    },
    registrationState: {
      type: String,
      required: [true, 'Registration state is required'],
      trim: true,
    },
    appointmentYear: {
      type: Number,
      min: 1960,
      max: new Date().getFullYear(),
    },

    // ── Professional Details ─────────────────────────────────────────────────
    experience: {
      type: Number,
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
    practicingStates: {
      type: [String],
      default: [],
    },

    // ── Settings ─────────────────────────────────────────────────────────────
    isAcceptingRequests: { type: Boolean, default: true },
    availability: {
      type: [availabilitySlotSchema],
      default: [],
    },

    // ── Ratings ─────────────────────────────────────────────────────────────
    ratings: { type: [ratingSchema], default: [] },
    averageRating: { type: Number, min: 0, max: 5, default: 0 },
    totalRatings: { type: Number, default: 0 },

    // ── Verification ─────────────────────────────────────────────────────────
    isVerified: { type: Boolean, default: false, index: true },
    verifiedAt: { type: Date },
    verifiedBy: { type: Schema.Types.ObjectId, ref: 'User' },
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

    // ── Bank Account (for payouts) ────────────────────────────────────────────
    bankAccount: {
      accountHolderName: { type: String, trim: true },
      accountNumber: { type: String, trim: true },
      ifscCode: { type: String, trim: true, uppercase: true },
      bankName: { type: String, trim: true },
    },

    // ── Revenue ──────────────────────────────────────────────────────────────
    platformCommissionPercent: {
      type: Number,
      default: 15, // platform takes 15%
      min: 0,
      max: 30,
    },
    totalEarnings: { type: Number, default: 0 },
    // Credited when payment is verified, moved to totalEarnings once the document is
    // stamped/delivered. Lets admins see money collected for work not yet completed.
    pendingEarnings: { type: Number, default: 0 },
    withdrawnAmount: { type: Number, default: 0 },

    // ── Stats ─────────────────────────────────────────────────────────────────
    totalNotarizations: { type: Number, default: 0 },
    profileViews: { type: Number, default: 0 },
    isPublic: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

notaryProfileSchema.index({ user: 1 });
notaryProfileSchema.index({ notaryRegistrationNumber: 1 });
notaryProfileSchema.index({ registrationState: 1 });
notaryProfileSchema.index({ isVerified: 1, isPublic: 1, averageRating: -1 });

notaryProfileSchema.pre('save', function (next) {
  if (this.isModified('ratings') && this.ratings.length > 0) {
    const sum = this.ratings.reduce((acc, r) => acc + r.score, 0);
    this.totalRatings = this.ratings.length;
    this.averageRating = Math.round((sum / this.ratings.length) * 10) / 10;
  } else if (this.ratings.length === 0) {
    this.averageRating = 0;
    this.totalRatings = 0;
  }
  next();
});

notaryProfileSchema.methods.addRating = async function ({ citizenId, requestId, score, review }) {
  this.ratings = this.ratings.filter(
    (r) => !(r.citizen.equals(citizenId) && r.request?.equals(requestId))
  );
  this.ratings.push({ citizen: citizenId, request: requestId, score, review });
  return this.save();
};

notaryProfileSchema.statics.findVerified = function (filters = {}) {
  const query = { isVerified: true, isPublic: true, ...filters };
  return this.find(query)
    .populate('user', 'name avatar state preferredLanguage')
    .sort({ averageRating: -1, totalNotarizations: -1 });
};

module.exports = mongoose.model('NotaryProfile', notaryProfileSchema);
