const mongoose = require('mongoose');
const { Schema } = mongoose;

// ─── Main Schema ───────────────────────────────────────────────────────────────

const subscriptionSchema = new Schema(
  {
    // ── Ownership ─────────────────────────────────────────────────────────────
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // ── Plan Details ──────────────────────────────────────────────────────────
    plan: {
      type: String,
      enum: ['basic', 'pro', 'professional', 'firm'],
      required: [true, 'Plan is required'],
    },
    persona: {
      type: String,
      enum: ['citizen', 'lawyer'],
      required: true,
      // The persona this subscription is for (determines which plan table applies)
    },
    billingCycle: {
      type: String,
      enum: ['monthly', 'annual'],
      default: 'monthly',
    },

    // ── Duration ──────────────────────────────────────────────────────────────
    startDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    endDate: {
      type: Date,
      required: true,
      // = startDate + 1 month (monthly) or + 1 year (annual)
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    autoRenew: {
      type: Boolean,
      default: true,
    },
    cancelledAt: { type: Date },
    cancellationReason: { type: String, trim: true },

    // ── Razorpay ──────────────────────────────────────────────────────────────
    // One-time order ID (used for pay-upfront monthly/annual subscriptions)
    razorpayOrderId: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },
    // Recurring subscription ID (used when Razorpay Subscriptions API is wired)
    razorpaySubscriptionId: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },
    razorpayPlanId: { type: String, trim: true },
    razorpayCustomerId: { type: String, trim: true },

    // ── Pricing at time of purchase ───────────────────────────────────────────
    // Stored for historical accuracy (prices may change)
    amountPaid: {
      type: Number,     // in paise
      required: true,
    },
    currency: {
      type: String,
      default: 'INR',
    },
    discountCode: { type: String, trim: true },
    discountAmount: { type: Number, default: 0 },  // in paise

    // ── Renewal History ───────────────────────────────────────────────────────
    renewalCount: { type: Number, default: 0 },
    lastRenewedAt: { type: Date },
    nextRenewalDate: { type: Date },
    renewalFailures: { type: Number, default: 0 },

    // ── Upgrade / Downgrade ───────────────────────────────────────────────────
    previousPlan: { type: String },
    upgradedFrom: {
      type: Schema.Types.ObjectId,
      ref: 'Subscription',
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─── Indexes ───────────────────────────────────────────────────────────────────
subscriptionSchema.index({ user: 1, isActive: 1 });
subscriptionSchema.index({ user: 1, createdAt: -1 });
subscriptionSchema.index({ razorpayOrderId: 1 }, { sparse: true });
subscriptionSchema.index({ razorpaySubscriptionId: 1 }, { sparse: true });
subscriptionSchema.index({ endDate: 1, isActive: 1 });  // For expiry checks

// ─── Virtuals ─────────────────────────────────────────────────────────────────

subscriptionSchema.virtual('isExpired').get(function () {
  return new Date() > new Date(this.endDate);
});

subscriptionSchema.virtual('daysRemaining').get(function () {
  const diff = new Date(this.endDate) - new Date();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
});

subscriptionSchema.virtual('amountFormatted').get(function () {
  return `₹${this.amountPaid / 100}`;
});

// ─── Pre-save Hooks ────────────────────────────────────────────────────────────

subscriptionSchema.pre('save', function (next) {
  // Auto-set endDate based on billingCycle and startDate
  if (this.isNew && !this.endDate) {
    const start = new Date(this.startDate);
    if (this.billingCycle === 'annual') {
      this.endDate = new Date(start.setFullYear(start.getFullYear() + 1));
    } else {
      this.endDate = new Date(start.setMonth(start.getMonth() + 1));
    }
  }

  // Set nextRenewalDate = endDate when autoRenew is true
  if (this.autoRenew && this.endDate) {
    this.nextRenewalDate = this.endDate;
  }

  next();
});

// ─── Static Methods ────────────────────────────────────────────────────────────

/**
 * findActiveForUser — get the current active subscription for a user.
 */
subscriptionSchema.statics.findActiveForUser = function (userId) {
  return this.findOne({
    user: userId,
    isActive: true,
    endDate: { $gt: new Date() },
  }).sort({ createdAt: -1 });
};

/**
 * findExpiringWithinDays — find subscriptions expiring soon (for renewal reminders).
 * Called by the monthly Bull job.
 */
subscriptionSchema.statics.findExpiringWithinDays = function (days = 7) {
  const cutoff = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  return this.find({
    isActive: true,
    autoRenew: false,
    endDate: { $lte: cutoff, $gte: new Date() },
  }).populate('user', 'name phone email preferredLanguage');
};

module.exports = mongoose.model('Subscription', subscriptionSchema);
