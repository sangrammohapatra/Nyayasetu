const mongoose = require('mongoose');
const { Schema } = mongoose;

// ─── Main Schema ───────────────────────────────────────────────────────────────

const auditLogSchema = new Schema(
  {
    // ── Actor ─────────────────────────────────────────────────────────────────
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,   // null for unauthenticated actions (e.g. failed login)
    },
    // Denormalized snapshot so logs remain meaningful even if user is deleted
    userSnapshot: {
      phone: { type: String },
      email: { type: String },
      persona: { type: String },
      plan: { type: String },
    },

    // ── Action ────────────────────────────────────────────────────────────────
    action: {
      type: String,
      required: [true, 'Action is required'],
      trim: true,
      // Verb-style, e.g.:
      //   'user.login', 'user.logout', 'user.register'
      //   'document.generate', 'document.download', 'document.delete'
      //   'payment.initiated', 'payment.captured', 'payment.failed'
      //   'subscription.activated', 'subscription.cancelled'
      //   'lawyer.applied', 'lawyer.verified', 'lawyer.rejected'
      //   'admin.user.deactivated', 'admin.template.created'
      //   'otp.requested', 'otp.failed', 'otp.verified'
      index: true,
    },

    // ── Subject ───────────────────────────────────────────────────────────────
    entity: {
      type: String,
      trim: true,
      // Model name: 'User', 'Document', 'Payment', 'ChatSession', etc.
      index: true,
    },
    entityId: {
      type: Schema.Types.ObjectId,
      // _id of the affected entity
    },

    // ── Request Context ───────────────────────────────────────────────────────
    ipAddress: {
      type: String,
      trim: true,
    },
    userAgent: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    requestMethod: { type: String, trim: true },   // 'GET', 'POST', etc.
    requestPath: { type: String, trim: true },     // '/v1/documents/generate'
    responseStatus: { type: Number },              // HTTP status code

    // ── Metadata ──────────────────────────────────────────────────────────────
    // Flexible bag for action-specific context
    // e.g. { planFrom: 'free', planTo: 'basic', amount: 9900 }
    //      { templateSlug: 'consumer_complaint', documentId: '...' }
    //      { failureReason: 'Invalid OTP', attemptCount: 3 }
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },

    // ── Outcome ───────────────────────────────────────────────────────────────
    success: {
      type: Boolean,
      default: true,
    },
    errorCode: { type: String, trim: true },
    errorMessage: { type: String, trim: true },
  },
  {
    // Audit logs are immutable — only createdAt, no updatedAt
    timestamps: { createdAt: true, updatedAt: false },

    // Disable _id override — use the auto-generated MongoDB ObjectId
    toJSON: {
      transform: (_doc, ret) => {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// ─── Indexes ───────────────────────────────────────────────────────────────────
auditLogSchema.index({ user: 1, createdAt: -1 });
auditLogSchema.index({ entity: 1, entityId: 1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ ipAddress: 1, createdAt: -1 });
auditLogSchema.index({ success: 1, action: 1 });

// TTL: keep audit logs for 1 year in production
// Uncomment in production to auto-expire:
// auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 31536000, name: 'ttl_audit_1yr' });

// ─── Immutability Guard ────────────────────────────────────────────────────────

/**
 * Prevent any updates to audit logs — they are write-once.
 */
auditLogSchema.pre(['updateOne', 'updateMany', 'findOneAndUpdate'], function (next) {
  const err = new Error('AuditLog records are immutable and cannot be updated');
  err.status = 403;
  next(err);
});

// ─── Static Methods ────────────────────────────────────────────────────────────

/**
 * log — create an audit log entry from an Express request context.
 * The primary API for all audit logging throughout the codebase.
 *
 * Usage (in controllers):
 *   await AuditLog.log(req, 'document.generate', 'Document', document._id, { templateSlug });
 *   await AuditLog.log(req, 'payment.failed', 'Payment', null, { orderId, reason }, false);
 *
 * @param {import('express').Request} req
 * @param {string}  action
 * @param {string}  [entity]
 * @param {*}       [entityId]
 * @param {object}  [metadata]
 * @param {boolean} [success]
 */
auditLogSchema.statics.log = async function (
  req,
  action,
  entity = null,
  entityId = null,
  metadata = {},
  success = true
) {
  try {
    const entry = {
      action,
      entity,
      entityId,
      metadata,
      success,
      ipAddress: req.ip || req.connection?.remoteAddress,
      userAgent: req.get('user-agent'),
      requestMethod: req.method,
      requestPath: req.originalUrl,
    };

    if (req.user) {
      entry.user = req.user.userId;
      entry.userSnapshot = {
        persona: req.user.persona,
        plan: req.user.plan,
      };
    }

    await this.create(entry);
  } catch (err) {
    // Audit logging must NEVER crash the main request flow
    // Log to console as a last resort
    console.error('[AuditLog] Failed to write audit entry:', err.message);
  }
};

/**
 * logFailure — convenience wrapper for logging failed actions.
 */
auditLogSchema.statics.logFailure = function (req, action, errorCode, errorMessage, metadata = {}) {
  return this.log(req, action, null, null, { ...metadata, errorCode, errorMessage }, false);
};

/**
 * getActivityForUser — paginated activity timeline for a user.
 */
auditLogSchema.statics.getActivityForUser = function (userId, { page = 1, limit = 20 } = {}) {
  return this.find({ user: userId })
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();
};

/**
 * getSuspiciousActivity — find IPs with multiple failed login attempts.
 * Used by admin security dashboard.
 */
auditLogSchema.statics.getSuspiciousActivity = function (withinHours = 1) {
  const since = new Date(Date.now() - withinHours * 60 * 60 * 1000);
  return this.aggregate([
    {
      $match: {
        action: { $in: ['user.login', 'otp.failed', 'otp.requested'] },
        success: false,
        createdAt: { $gte: since },
      },
    },
    {
      $group: {
        _id: '$ipAddress',
        failureCount: { $sum: 1 },
        lastAttempt: { $max: '$createdAt' },
        actions: { $addToSet: '$action' },
      },
    },
    { $match: { failureCount: { $gte: 5 } } },
    { $sort: { failureCount: -1 } },
  ]);
};

module.exports = mongoose.model('AuditLog', auditLogSchema);
