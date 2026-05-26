/**
 * Chat Routes — all chat-related endpoints
 * Authentication required for all routes
 * Real-time SSE streaming for AI responses
 */

const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const { verifyToken } = require('../middleware/auth');
const { checkFeatureAccess } = require('../middleware/subscription');
const multer = require('multer');

// Multer config for audio files
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'audio/mpeg',
      'audio/wav',
      'audio/ogg',
      'audio/webm',
      'audio/m4a',
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid audio format'));
    }
  },
});

// ============================================================================
// ALL ROUTES PROTECTED BY JWT AUTH
// ============================================================================
router.use(verifyToken);

// ============================================================================
// CREATE NEW CHAT SESSION
// ============================================================================
router.post(
  '/sessions',
  checkFeatureAccess('chat'),
  chatController.createChatSession
);

// ============================================================================
// LIST ALL CHATS FOR CURRENT USER
// ============================================================================
router.get('/sessions', chatController.listChats);

// ============================================================================
// GET SINGLE CHAT SESSION (with full message history)
// ============================================================================
router.get('/sessions/:sessionId', chatController.getChatSession);

// ============================================================================
// SEND TEXT MESSAGE & GET AI RESPONSE (SSE streaming)
// ============================================================================
router.post(
  '/sessions/:sessionId/message',
  checkFeatureAccess('chat'),
  chatController.sendMessage
);

// ============================================================================
// SEND VOICE MESSAGE (audio file → transcription → AI response)
// ============================================================================
router.post(
  '/sessions/:sessionId/voice',
  checkFeatureAccess('voice_input'),
  upload.single('audio'),
  chatController.sendVoiceMessage
);

// ============================================================================
// SHARE CHAT WITH A LAWYER
// ============================================================================
router.post(
  '/sessions/:sessionId/share',
  chatController.shareChat
);

// ============================================================================
// GET SHARED CHAT (public, no auth required for this specific route)
// ============================================================================
router.get('/shared/:shareToken', (req, res, next) => {
  // Skip auth for shared chats
  chatController.getSharedChat(req, res).catch(next);
});

// ============================================================================
// ARCHIVE CHAT
// ============================================================================
router.patch(
  '/sessions/:sessionId/archive',
  chatController.archiveChat
);

// ============================================================================
// DELETE CHAT
// ============================================================================
router.delete(
  '/sessions/:sessionId',
  chatController.deleteChat
);

// ============================================================================
// RATE CHAT RESPONSE
// ============================================================================
router.post(
  '/sessions/:sessionId/rate',
  chatController.rateChatResponse
);

// ============================================================================
// GET DAILY MESSAGE QUOTA STATUS
// ============================================================================
router.get('/quota/status', chatController.getQuotaStatus);

// ============================================================================
// ERROR HANDLING FOR MULTER
// ============================================================================
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'FILE_TOO_LARGE') {
      return res.status(413).json({ error: 'Audio file too large (max 10MB)' });
    }
    return res.status(400).json({ error: error.message });
  }
  if (error.message === 'Invalid audio format') {
    return res.status(400).json({ error });
  }
  next(error);
});

module.exports = router;
