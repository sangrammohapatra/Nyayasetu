/**
 * server/src/controllers/notification.controller.js
 *
 * In-app notification controller. All endpoints require an authenticated user
 * (req.user.userId set by verifyToken middleware).
 *
 *   GET    /v1/notifications              — paginated list, newest first
 *   PATCH  /v1/notifications/:id/read     — mark a single notification read
 *   POST   /v1/notifications/read-all     — mark every notification read for the user
 */

const mongoose = require('mongoose');

const Notification = require('../models/Notification.model');
const asyncHandler = require('../utils/asyncHandler');
const logger = require('../utils/logger');

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;

/**
 * GET /v1/notifications
 * Query params:
 *   page    (default 1)
 *   limit   (default 20, max 100)
 *   unread  ('true' to only show unread)
 *   channel ('web' | 'whatsapp' | 'email' | 'sms' — optional filter)
 *
 * Returns { items, total, unreadTotal, page, limit, totalPages }
 */
const getNotifications = asyncHandler(async (req, res) => {
  const userId = req.user && req.user.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(req.query.limit, 10) || DEFAULT_LIMIT));
  const skip = (page - 1) * limit;

  const filter = { user: userId };
  if (req.query.unread === 'true') filter.isRead = false;
  if (req.query.channel && ['web', 'whatsapp', 'email', 'sms'].includes(req.query.channel)) {
    filter.channel = req.query.channel;
  }

  try {
    const [items, total, unreadTotal] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Notification.countDocuments(filter),
      Notification.countDocuments({ user: userId, isRead: false }),
    ]);

    return res.json({
      items,
      total,
      unreadTotal,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (err) {
    logger.error('[notification.controller] getNotifications failed', {
      userId,
      error: err.message,
    });
    return res.status(500).json({ error: 'Failed to load notifications' });
  }
});

/**
 * PATCH /v1/notifications/:id/read
 * Mark a single notification as read. Idempotent — returns the (updated) record.
 */
const markRead = asyncHandler(async (req, res) => {
  const userId = req.user && req.user.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid notification id' });
  }

  try {
    const notif = await Notification.findOneAndUpdate(
      { _id: id, user: userId },
      { $set: { isRead: true, readAt: new Date() } },
      { new: true }
    );

    if (!notif) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    const unreadTotal = await Notification.countDocuments({ user: userId, isRead: false });
    return res.json({ notification: notif, unreadTotal });
  } catch (err) {
    logger.error('[notification.controller] markRead failed', {
      userId,
      id,
      error: err.message,
    });
    return res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

/**
 * POST /v1/notifications/read-all
 * Mark every unread notification for this user as read.
 * Returns the number of notifications updated.
 */
const markAllRead = asyncHandler(async (req, res) => {
  const userId = req.user && req.user.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const now = new Date();
    const result = await Notification.updateMany(
      { user: userId, isRead: false },
      { $set: { isRead: true, readAt: now } }
    );

    const modifiedCount = result.modifiedCount !== undefined ? result.modifiedCount : result.nModified || 0;
    logger.info('[notification.controller] markAllRead', { userId, modifiedCount });

    return res.json({
      ok: true,
      modifiedCount,
      unreadTotal: 0,
    });
  } catch (err) {
    logger.error('[notification.controller] markAllRead failed', {
      userId,
      error: err.message,
    });
    return res.status(500).json({ error: 'Failed to mark all notifications as read' });
  }
});

module.exports = {
  getNotifications,
  markRead,
  markAllRead,
};
