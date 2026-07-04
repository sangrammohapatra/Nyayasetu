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
const asyncHandler         = require('../utils/asyncHandler');
const { createError }      = require('../middleware/error.middleware');

// ─── helpers ─────────────────────────────────────────────────────────────────

// A citizen who paid for one session shouldn't get indefinite free access to
// the lawyer once it's marked complete — chat closes 48h after completedAt.
const CHAT_RETENTION_HOURS = 48;

// Consultation.lawyer stores User._id (set from lawyerProfile.user._id at
// booking time in createConsultation) — compare directly, no LawyerProfile lookup needed.
async function assertParty(consultationId, userId) {
  const c = await Consultation.findById(consultationId).select('citizen lawyer status completedAt');
  if (!c) throw createError(404, 'NOT_FOUND', 'Consultation not found');

  const isCitizen = c.citizen.toString() === userId;
  const isLawyer = c.lawyer.toString() === userId;
  if (!isCitizen && !isLawyer) {
    throw createError(403, 'FORBIDDEN', 'You are not a party to this consultation');
  }

  if (c.status === 'completed' && c.completedAt) {
    const hoursSinceCompletion = (Date.now() - new Date(c.completedAt).getTime()) / (1000 * 60 * 60);
    if (hoursSinceCompletion > CHAT_RETENTION_HOURS) {
      throw createError(403, 'CHAT_EXPIRED', `Chat access closes ${CHAT_RETENTION_HOURS} hours after the consultation is marked complete.`);
    }
  }

  return c;
}

async function getOtherPartyId(consultation, userId) {
  if (consultation.citizen.toString() === userId) {
    return consultation.lawyer.toString();
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
