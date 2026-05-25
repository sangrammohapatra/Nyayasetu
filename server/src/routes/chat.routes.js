const express  = require('express');
const multer   = require('multer');
const { body, param, validationResult } = require('express-validator');

const {
  createSession,
  sendMessage,
  getSession,
  listSessions,
  abandonSession,
  voiceMessage,
} = require('../controllers/chat.controller');

const { verifyToken }          = require('../middleware/auth.middleware');
const { checkFreeQuota }       = require('../middleware/subscription.middleware');
const asyncHandler             = require('../utils/asyncHandler');

const router = express.Router();

// ─── Multer for voice uploads (memory storage — passed to transcription service) ─
const voiceUpload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (_req, file, cb) => {
    const allowed = ['audio/webm', 'audio/wav', 'audio/mp4', 'audio/mpeg', 'audio/ogg', 'audio/m4a'];
    if (allowed.includes(file.mimetype) || file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are accepted for voice input'), false);
    }
  },
});

// ─── Validation helper ────────────────────────────────────────────────────────
const validate = (checks) => [
  ...checks,
  asyncHandler(async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const fields = {};
      errors.array().forEach((e) => { fields[e.path] = e.msg; });
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Validation failed', fields });
    }
    next();
  }),
];

// ─── All chat routes require authentication ───────────────────────────────────
router.use(verifyToken);

/**
 * POST /v1/chat/sessions
 * Create a new document data-collection session.
 * Quota-checked: ai_chat
 */
router.post(
  '/sessions',
  validate([
    body('templateSlug')
      .notEmpty().withMessage('templateSlug is required')
      .isLength({ max: 100 }).withMessage('Invalid template slug'),
    body('language')
      .optional()
      .isIn(['en','hi','bn','mr','ta','te','gu','kn','ml','pa','ur'])
      .withMessage('Invalid language code'),
    body('source')
      .optional()
      .isIn(['web', 'whatsapp', 'mobile'])
      .withMessage('source must be: web, whatsapp, or mobile'),
  ]),
  createSession
);

/**
 * GET /v1/chat/sessions
 * List user's sessions (paginated, most recent first).
 */
router.get('/sessions', listSessions);

/**
 * GET /v1/chat/sessions/:id
 * Get full session including messages and collectedData.
 */
router.get(
  '/sessions/:id',
  validate([param('id').isMongoId().withMessage('Invalid session ID')]),
  getSession
);

/**
 * POST /v1/chat/sessions/:id/message
 * Send a message and receive the AI response as SSE stream.
 * This is the hot path — called on every user message during chat.
 */
router.post(
  '/sessions/:id/message',
  validate([
    param('id').isMongoId().withMessage('Invalid session ID'),
    body('message')
      .notEmpty().withMessage('message is required')
      .isLength({ max: 2000 }).withMessage('Message too long (max 2000 characters)'),
  ]),
  sendMessage
);

/**
 * POST /v1/chat/sessions/:id/voice
 * Upload audio and receive transcription.
 * Requires voice_input feature (Basic plan or higher).
 */
router.post(
  '/sessions/:id/voice',
  validate([param('id').isMongoId().withMessage('Invalid session ID')]),
  voiceUpload.single('audio'),
  voiceMessage
);

/**
 * POST /v1/chat/sessions/:id/abandon
 * Mark a session as abandoned.
 */
router.post(
  '/sessions/:id/abandon',
  validate([param('id').isMongoId().withMessage('Invalid session ID')]),
  abandonSession
);

module.exports = router;
