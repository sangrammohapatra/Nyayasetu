const mongoose = require('mongoose');
const { Schema } = mongoose;

// ─── Main Schema ───────────────────────────────────────────────────────────────

const paymentSchema = new Schema(
  {
    // ── Ownership ─────────────────────────────────────────────────────────────
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // ── Payment Classification ─────────────────────────────────────────────────
    type: {
      type: String,
      enum: ['pay_per_doc', 'subscription', 'consultation'],
      required: [true, 'Payment type is required'],
      index: true,
    },

    // ── Entity Reference ──────────────────────────────────────────────────────
    // Polymorphic: points to Document, Subscription, or Consultation
    entityId: {
      type: Schema.Types.ObjectId,
      refPath: 'entityModel',
    },
    entityModel: {
      type: String,
      enum: ['Document', 'Subscription', 'Consultation'],
    },

    // ── Razorpay IDs ──────────────────────────────────────────────────────────
    razorpayOrderId: {
      type: String,
      required: [true, 'Razorpay order ID is required'],
      unique: true,
      trim: true,
    },
    razorpayPaymentId: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      // Set after successful payment capture
    },
    razorpaySignature: {
      type: String,
      trim: true,
      // HMAC-SHA256 signature verified on capture
    },

    // ── Amounts (all in paise) ────────────────────────────────────────────────
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0, 'Amount cannot be negative'],
    },
    currency: {
      type: String,
      default: 'INR',
    },
    // For consultation payments — revenue split
    lawyerEarnings: {
      type: Number,
      default: 0,   // in paise; 0 for non-consultation payments
    },
    platformEarnings: {
      type: Number,
      default: 0,   // in paise
    },
    lawyerPaidAt: { type: Date, default: null },  // When payout was processed

    // ── Status ────────────────────────────────────────────────────────────────
    status: {
      type: String,
      enum: ['created', 'paid', 'failed', 'refunded', 'partially_refunded'],
      default: 'created',
      index: true,
    },
    failureReason: { type: String, trim: true },
    failureCode: { type: String, trim: true },

    // ── Refund ────────────────────────────────────────────────────────────────
    refundId: { type: String, trim: true },
    refundAmount: { type: Number, default: 0 },
    refundedAt: { type: Date },
    refundReason: { type: String, trim: true },

    // ── Metadata ──────────────────────────────────────────────────────────────
    description: { type: String, trim: true },
    // e.g. "Consumer Complaint (pay-per-doc)", "Basic Plan - Monthly"
    receipt: { type: String, trim: true },  // Short reference for Razorpay receipt

    // ── Webhook Tracking ──────────────────────────────────────────────────────
    webhookEventId: { type: String, trim: true },  // Razorpay event ID (idempotency)
    webhookProcessedAt: { type: Date },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        // Never expose the raw Razorpay signature in API responses
        delete ret.razorpaySignature;
        delete ret.__v;
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

// ─── Indexes ───────────────────────────────────────────────────────────────────
paymentSchema.index({ user: 1, createdAt: -1 });
paymentSchema.index({ razorpayOrderId: 1 });
paymentSchema.index({ razorpayPaymentId: 1 }, { sparse: true });
paymentSchema.index({ status: 1 });
paymentSchema.index({ type: 1, status: 1 });
paymentSchema.index({ webhookEventId: 1 }, { sparse: true });

// ─── Virtuals ─────────────────────────────────────────────────────────────────

paymentSchema.virtual('amountFormatted').get(function () {
  return `₹${this.amount / 100}`;
});

paymentSchema.virtual('isPaid').get(function () {
  return this.status === 'paid';
});

// ─── Pre-save Hooks ────────────────────────────────────────────────────────────

paymentSchema.pre('save', function (next) {
  // Compute platform/lawyer earnings split for consultation payments
  if (this.isModified('status') && this.status === 'paid' && this.type === 'consultation') {
    // Default: 10% platform, 90% lawyer — actual split set by controller
    if (this.lawyerEarnings === 0 && this.platformEarnings === 0) {
      this.platformEarnings = Math.round(this.amount * 0.1);
      this.lawyerEarnings = this.amount - this.platformEarnings;
    }
  }
  next();
});

// ─── Static Methods ────────────────────────────────────────────────────────────

/**
 * findByRazorpayOrder — idempotency helper for webhook processing.
 */
paymentSchema.statics.findByRazorpayOrder = function (orderId) {
  return this.findOne({ razorpayOrderId: orderId });
};

/**
 * getRevenueStats — aggregate platform earnings for admin dashboard.
 * @param {Date} from
 * @param {Date} to
 */
paymentSchema.statics.getRevenueStats = function (from, to) {
  return this.aggregate([
    {
      $match: {
        status: 'paid',
        createdAt: { $gte: from, $lte: to },
      },
    },
    {
      $group: {
        _id: '$type',
        totalAmount: { $sum: '$amount' },
        platformEarnings: { $sum: '$platformEarnings' },
        lawyerEarnings: { $sum: '$lawyerEarnings' },
        count: { $sum: 1 },
      },
    },
  ]);
};

module.exports = mongoose.model('Payment', paymentSchema);
