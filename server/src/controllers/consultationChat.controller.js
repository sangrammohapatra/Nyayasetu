/**
 * server/src/controllers/consultationChat.controller.js
 *
 * REST endpoints that complement the real-time Socket.IO chat.
 * Used for loading message history and for REST-only clients.
 *
 * GET  /v1/consultations/:id/messages   — paginated message history
 * POST /v1/consultations/:id/messages   — send a message (also emits via socket)
 */

const ConsultationMessage = require('../models/ConsultationMessage.model');
const Consultation         = require('../models/Consultation.model');
const LawyerProfile        = require('../models/LawyerProfile.model');
const asyncHandler         = require('../utils/asyncHandler');
const { createError }      = require('../middleware/error.middleware');

// ─── helpers ─────────────────────────────────────────────────────────────────

// NOTE: Consultation.lawyer stores LawyerProfile._id (not User._id).
async function assertParty(consultationId, userId) {
  const c = await Consultation.findById(consultationId).select('citizen lawyer status');
  if (!c) throw createError(404, 'NOT_FOUND', 'Consultation not found');

  if (c.citizen.toString() === userId) return c;

  const profile = await LawyerProfile.findOne({ user: userId }).select('_id').lean();
  if (profile && c.lawyer.toString() === profile._id.toString()) return c;

  throw createError(403, 'FORBIDDEN', 'You are not a party to this consultation');
}

async function getOtherPartyId(consultation, userId) {
  if (consultation.citizen.toString() === userId) {
    const profile = await LawyerProfile.findById(consultation.lawyer).select('user').lean();
    return profile?.user?.toString() || null;
  }
  return consultation.citizen.toString();
}

// ─── GET /v1/consultations/:id/messages ──────────────────────────────────────

const getMessages = asyncHandler(async (req, res) => {
  const { id: consultationId } = req.params;
  const { userId }             = req.user;

  const page  = Math.max(1, parseInt(req.query.page)  || 1);
  const limit = Math.min(50, parseInt(req.query.limit) || 30);

  await assertParty(consultationId, userId);

  const [messages, total] = await Promise.all([
    ConsultationMessage.find({ consultation: consultationId })
      .populate('sender', 'name persona avatar')
      .sort({ createdAt: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    ConsultationMessage.countDocuments({ consultation: consultationId }),
  ]);

  // Mark messages from the other party as read
  await ConsultationMessage.updateMany(
    { consultation: consultationId, sender: { $ne: userId }, readAt: null },
    { $set: { readAt: new Date() } }
  );

  res.json({
    messages,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasMore:    page * limit < total,
    },
  });
});

// ─── POST /v1/consultations/:id/messages ─────────────────────────────────────

const sendMessage = asyncHandler(async (req, res) => {
  const { id: consultationId } = req.params;
  const { userId, persona }    = req.user;
  const { content, messageType = 'text', documentRef } = req.body;

  if (!content?.trim()) throw createError(400, 'CONTENT_REQUIRED', 'Message content is required');
  if (content.length > 5000) throw createError(400, 'CONTENT_TOO_LONG', 'Message cannot exceed 5000 characters');

  const consultation = await assertParty(consultationId, userId);

  const message = await ConsultationMessage.create({
    consultation: consultationId,
    sender:       userId,
    senderRole:   persona,
    content:      content.trim(),
    messageType,
    documentRef:  documentRef || null,
  });

  const populated = await ConsultationMessage.findById(message._id)
    .populate('sender', 'name persona avatar')
    .lean();

  // Emit real-time event if socket is available
  const io = req.app.get('io');
  if (io) {
    io.to(`consultation:${consultationId}`).emit('consultation:message', populated);

    const otherId = await getOtherPartyId(consultation, userId);
    if (otherId) {
      io.to(`user:${otherId}`).emit('consultation:new_message', {
        consultationId,
        messageId:  message._id,
        preview:    content.slice(0, 60),
      });
    }
  }

  res.status(201).json({ message: populated });
});

// ─── GET /v1/consultations/:id/unread-count ──────────────────────────────────

const getUnreadCount = asyncHandler(async (req, res) => {
  const { id: consultationId } = req.params;
  const { userId }             = req.user;

  await assertParty(consultationId, userId);

  const count = await ConsultationMessage.countDocuments({
    consultation: consultationId,
    sender:       { $ne: userId },
    readAt:       null,
  });

  res.json({ unreadCount: count });
});

module.exports = { getMessages, sendMessage, getUnreadCount };
