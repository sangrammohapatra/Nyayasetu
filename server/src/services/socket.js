/**
 * server/src/services/socket.js
 *
 * Wires all Socket.IO event handlers onto the io instance.
 * Called once from server.js after io is created.
 *
 * Rooms:
 *   user:{userId}              — personal room for notifications
 *   consultation:{id}          — consultation chat room
 *
 * Events emitted to clients:
 *   consultation:joined        — ack that the join was successful
 *   consultation:message       — a new message (populated with sender)
 *   consultation:typing        — typing indicator from the other party
 *   consultation:new_message   — notification to the offline party's personal room
 */

const jwt = require('jsonwebtoken');
const ConsultationMessage = require('../models/ConsultationMessage.model');
const Consultation = require('../models/Consultation.model');
const User = require('../models/User.model');
const LawyerProfile = require('../models/LawyerProfile.model');
const logger = require('../utils/logger');

// ─── JWT auth middleware for socket connections ────────────────────────────────
async function socketAuth(socket, next) {
  try {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) return next(new Error('SOCKET_AUTH_REQUIRED'));

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId)
      .select('_id persona name isActive')
      .lean();

    if (!user || !user.isActive) return next(new Error('SOCKET_USER_NOT_FOUND'));

    socket.userId   = user._id.toString();
    socket.persona  = user.persona;
    socket.userName = user.name || 'User';
    next();
  } catch {
    next(new Error('SOCKET_INVALID_TOKEN'));
  }
}

// ─── Verify the user is a party to the consultation ──────────────────────────
// NOTE: Consultation.lawyer stores LawyerProfile._id (not User._id).
// Citizen is stored as User._id. So the check is asymmetric.
async function assertIsParty(consultationId, userId) {
  const c = await Consultation.findById(consultationId).select('citizen lawyer').lean();
  if (!c) return null;

  if (c.citizen.toString() === userId) return c;

  // Check lawyer side: find LawyerProfile for this user and compare
  const profile = await LawyerProfile.findOne({ user: userId }).select('_id').lean();
  if (profile && c.lawyer.toString() === profile._id.toString()) return c;

  return null;
}

// ─── initSocket ───────────────────────────────────────────────────────────────
function initSocket(io) {
  io.use(socketAuth);

  io.on('connection', (socket) => {
    logger.info(`Socket connected: ${socket.id}  user:${socket.userId}`);

    // Join personal notification room immediately
    socket.join(`user:${socket.userId}`);

    // ── Legacy join-room (keep for backward compat) ───────────────────────────
    socket.on('join-room', (userId) => {
      if (userId === socket.userId) socket.join(`user:${userId}`);
    });

    // ── Join a consultation chat room ─────────────────────────────────────────
    socket.on('consultation:join', async ({ consultationId }) => {
      try {
        if (!consultationId) return;
        const consultation = await assertIsParty(consultationId, socket.userId);
        if (!consultation) {
          return socket.emit('consultation:error', { code: 'FORBIDDEN' });
        }

        const room = `consultation:${consultationId}`;
        socket.join(room);
        socket.emit('consultation:joined', { consultationId });
        logger.debug(`${socket.id} joined ${room}`);
      } catch (err) {
        logger.error(`consultation:join error: ${err.message}`);
      }
    });

    // ── Send a message ────────────────────────────────────────────────────────
    socket.on('consultation:message', async ({ consultationId, content, messageType = 'text', documentRef }) => {
      try {
        if (!content?.trim() || !consultationId) return;

        const consultation = await assertIsParty(consultationId, socket.userId);
        if (!consultation) return;

        const msg = await ConsultationMessage.create({
          consultation: consultationId,
          sender:       socket.userId,
          senderRole:   socket.persona,
          content:      content.trim().slice(0, 5000),
          messageType,
          documentRef:  documentRef || null,
        });

        const populated = await ConsultationMessage.findById(msg._id)
          .populate('sender', 'name persona avatar')
          .lean();

        // Broadcast to everyone in the consultation room (including sender)
        io.to(`consultation:${consultationId}`).emit('consultation:message', populated);

        // Notify the other party's personal room (for unread badge even if not in room)
        // Lawyer stores LawyerProfile._id, so we must resolve the actual User._id
        let otherId;
        if (consultation.citizen.toString() === socket.userId) {
          const lawyerProf = await LawyerProfile.findById(consultation.lawyer).select('user').lean();
          otherId = lawyerProf?.user?.toString() || null;
        } else {
          otherId = consultation.citizen.toString();
        }

        if (otherId) {
          io.to(`user:${otherId}`).emit('consultation:new_message', {
            consultationId,
            messageId:  msg._id,
            senderName: socket.userName,
            preview:    content.slice(0, 60),
          });
        }
      } catch (err) {
        logger.error(`consultation:message error: ${err.message}`);
        socket.emit('consultation:error', { code: 'MESSAGE_FAILED', message: err.message });
      }
    });

    // ── Typing indicator ──────────────────────────────────────────────────────
    socket.on('consultation:typing', ({ consultationId, isTyping }) => {
      if (!consultationId) return;
      socket.to(`consultation:${consultationId}`).emit('consultation:typing', {
        userId: socket.userId,
        isTyping: !!isTyping,
      });
    });

    // ── Leave a consultation room ─────────────────────────────────────────────
    socket.on('consultation:leave', ({ consultationId }) => {
      if (consultationId) socket.leave(`consultation:${consultationId}`);
    });

    // ── Disconnect ────────────────────────────────────────────────────────────
    socket.on('disconnect', (reason) => {
      logger.debug(`Socket ${socket.id} disconnected: ${reason}`);
    });
  });
}

module.exports = { initSocket };
