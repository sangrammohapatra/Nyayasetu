const mongoose = require('mongoose');
const { Schema } = mongoose;

// ─── Main Schema ───────────────────────────────────────────────────────────────

const notificationSchema = new Schema(
  {
    // ── Ownership ─────────────────────────────────────────────────────────────
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // ── Content ───────────────────────────────────────────────────────────────
    type: {
      type: String,
      required: [true, 'Notification type is required'],
      enum: [
        'document_ready',
        'document_shared',
        'hearing_alert',
        'case_updated',
        'consultation_requested',
        'consultation_accepted',
        'consultation_rejected',
        'consultation_completed',
        'consultation_reminder',
        'payment_success',
        'payment_failed',
        'subscription_activated',
        'subscription_renewed',
        'subscription_expiring',
        'subscription_cancelled',
        'lawyer_verified',
        'quota_warning',
        'quota_exceeded',
        'system',
      ],
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Notification title is required'],
      trim: true,
      maxlength: 200,
    },
    titleHi: { type: String, trim: true },  // Pre-translated title for Hindi users
    body: {
      type: String,
      required: [true, 'Notification body is required'],
      trim: true,
      maxlength: 1000,
    },
    bodyHi: { type: String, trim: true },

    // ── Action Data ───────────────────────────────────────────────────────────
    // Contextual data for rendering the notification action button / deep link
    data: {
      type: Schema.Types.Mixed,
      default: {},
      // Examples:
      //   { documentId: '...', documentTitle: 'Consumer Complaint' }
      //   { caseId: '...', cnrNumber: 'DLHC...', hearingDate: '2024-03-15' }
      //   { consultationId: '...', lawyerName: 'Adv. Sharma' }
    },
    actionUrl: {
      type: String,
      trim: true,
      // Frontend route to navigate to when notification is tapped
      // e.g. "/documents/abc123", "/cases/xyz789"
    },

    // ── Delivery Channel ──────────────────────────────────────────────────────
    channel: {
      type: String,
      enum: ['web', 'whatsapp', 'email', 'sms'],
      required: true,
      default: 'web',
    },

    // ── Read State ────────────────────────────────────────────────────────────
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: { type: Date, default: null },

    // ── Delivery Status ───────────────────────────────────────────────────────
    // For channels other than 'web' — tracks whether the external notification was sent
    isDelivered: { type: Boolean, default: false },
    deliveredAt: { type: Date },
    deliveryError: { type: String, trim: true },

    // ── Priority ──────────────────────────────────────────────────────────────
    priority: {
      type: String,
      enum: ['low', 'normal', 'high', 'urgent'],
      default: 'normal',
    },
  },
  {
    // Manual createdAt (not updatedAt — notifications are immutable after creation)
    timestamps: { createdAt: true, updatedAt: false },
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
notificationSchema.index({ user: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ user: 1, type: 1 });
notificationSchema.index({ channel: 1, isDelivered: 1 });

/**
 * TTL Index — auto-delete notifications older than 90 days.
 * MongoDB deletes documents when createdAt + 7776000s < now.
 */
notificationSchema.index(
  { createdAt: 1 },
  {
    expireAfterSeconds: 7776000,  // 90 days = 90 × 24 × 60 × 60
    name: 'ttl_notifications_90d',
  }
);

// ─── Virtuals ─────────────────────────────────────────────────────────────────

notificationSchema.virtual('isExpired').get(function () {
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  return this.createdAt < ninetyDaysAgo;
});

// ─── Pre-save Hooks ────────────────────────────────────────────────────────────

notificationSchema.pre('save', function (next) {
  if (this.isModified('isRead') && this.isRead && !this.readAt) {
    this.readAt = new Date();
  }
  if (this.isModified('isDelivered') && this.isDelivered && !this.deliveredAt) {
    this.deliveredAt = new Date();
  }
  next();
});

// ─── Static Methods ────────────────────────────────────────────────────────────

/**
 * createForUser — factory method to create and save a notification,
 * then push it to the user's Socket.IO room in real time.
 *
 * @param {object} opts
 * @param {mongoose.Types.ObjectId} opts.userId
 * @param {string}  opts.type
 * @param {string}  opts.title
 * @param {string}  opts.body
 * @param {object}  [opts.data]
 * @param {string}  [opts.actionUrl]
 * @param {string}  [opts.channel]     default: 'web'
 * @param {string}  [opts.priority]    default: 'normal'
 * @param {object}  [opts.io]          Socket.IO server instance (optional)
 */
notificationSchema.statics.createForUser = async function ({
  userId,
  type,
  title,
  body,
  data = {},
  actionUrl,
  channel = 'web',
  priority = 'normal',
  io = null,
}) {
  const notification = await this.create({
    user: userId,
    type,
    title,
    body,
    data,
    actionUrl,
    channel,
    priority,
  });

  // Push to browser in real time via Socket.IO if server instance is provided
  if (io) {
    io.to(`user:${userId}`).emit('notification', {
      _id: notification._id,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      data: notification.data,
      actionUrl: notification.actionUrl,
      priority: notification.priority,
      createdAt: notification.createdAt,
    });
  }

  return notification;
};

/**
 * getUnreadCount — fast unread count for the notification bell badge.
 */
notificationSchema.statics.getUnreadCount = function (userId) {
  return this.countDocuments({ user: userId, isRead: false });
};

/**
 * markAllReadForUser — bulk mark-all-read operation.
 */
notificationSchema.statics.markAllReadForUser = function (userId) {
  return this.updateMany(
    { user: userId, isRead: false },
    { $set: { isRead: true, readAt: new Date() } }
  );
};

module.exports = mongoose.model('Notification', notificationSchema);
