const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * NotarizationRequest
 *
 * State machine:
 *   pending → accepted → kyc_scheduled → kyc_completed → stamped
 *   Any state → rejected | cancelled
 *   stamped → dispatched (if courier requested)
 */
const notarizationRequestSchema = new Schema(
  {
    // ── Parties ──────────────────────────────────────────────────────────────
    citizen: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    notary: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    notaryProfile: {
      type: Schema.Types.ObjectId,
      ref: 'NotaryProfile',
    },

    // ── Document ─────────────────────────────────────────────────────────────
    document: {
      type: Schema.Types.ObjectId,
      ref: 'Document',
      required: true,
    },

    // ── Status ───────────────────────────────────────────────────────────────
    status: {
      type: String,
      enum: [
        'pending',       // awaiting notary acceptance
        'accepted',      // notary accepted
        'kyc_scheduled', // video KYC session link set
        'kyc_completed', // video KYC done, ready to stamp
        'stamped',       // notary seal added to PDF
        'dispatched',    // physical copy dispatched via courier
        'rejected',      // notary rejected
        'cancelled',     // citizen cancelled
      ],
      default: 'pending',
      index: true,
    },

    // ── Payment ───────────────────────────────────────────────────────────────
    payment: {
      amount: { type: Number, default: 19900 }, // ₹199 in paise
      currency: { type: String, default: 'INR' },
      razorpayOrderId: { type: String },
      razorpayPaymentId: { type: String },
      razorpaySignature: { type: String },
      status: {
        type: String,
        enum: ['pending', 'paid', 'failed', 'refunded'],
        default: 'pending',
      },
      paidAt: { type: Date },
    },

    // ── Video KYC ─────────────────────────────────────────────────────────────
    scheduledAt: { type: Date },
    videoLink: { type: String, trim: true },
    kycCompletedAt: { type: Date },

    // ── Notarized Document ───────────────────────────────────────────────────
    notarizedPdfUrl: { type: String, trim: true },
    stampedAt: { type: Date },
    notaryStampRef: { type: String, trim: true }, // unique stamp serial

    // ── Courier (optional physical dispatch) ──────────────────────────────────
    courierRequested: { type: Boolean, default: false },
    courierAddress: {
      name: { type: String, trim: true },
      line1: { type: String, trim: true },
      line2: { type: String, trim: true },
      city: { type: String, trim: true },
      state: { type: String, trim: true },
      pincode: { type: String, trim: true },
      phone: { type: String, trim: true },
    },
    courierTrackingId: { type: String, trim: true },
    dispatchedAt: { type: Date },

    // ── Citizen notes ─────────────────────────────────────────────────────────
    notes: { type: String, trim: true, maxlength: 1000 },

    // ── Rejection / cancellation ──────────────────────────────────────────────
    rejectionReason: { type: String, trim: true },

    // ── Rating (filled after stamped/dispatched) ───────────────────────────────
    rating: {
      score: { type: Number, min: 1, max: 5 },
      review: { type: String, trim: true, maxlength: 1000 },
      ratedAt: { type: Date },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

notarizationRequestSchema.index({ citizen: 1, status: 1 });
notarizationRequestSchema.index({ notary: 1, status: 1 });
notarizationRequestSchema.index({ document: 1 });

module.exports = mongoose.model('NotarizationRequest', notarizationRequestSchema);
