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

// ─── Audio magic-bytes validator ──────────────────────────────────────────────
// Clients can set any MIME type they like. After Multer stores the buffer we
// read the first few bytes and confirm the file is actually audio data.
//
// Signatures checked:
//   WAV   52 49 46 46 (RIFF)
//   MP3   49 44 33   (ID3 tag)  or  FF FB / FF F3 / FF F2 / FF E3 (MPEG sync)
//   OGG   4F 67 67 53 (OggS)
//   WebM  1A 45 DF A3 (EBML)
//   MP4/M4A  bytes 4-7 == 66 74 79 70 (ftyp box)
function isValidAudioBuffer(buf) {
  if (!buf || buf.length < 4) return false;
  const b = buf;

  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46) return true; // WAV (RIFF)
  if (b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33)                   return true; // MP3 (ID3)
  if (b[0] === 0xFF && (b[1] & 0xE0) === 0xE0)                           return true; // MP3 sync
  if (b[0] === 0x4F && b[1] === 0x67 && b[2] === 0x67 && b[3] === 0x53) return true; // OGG
  if (b[0] === 0x1A && b[1] === 0x45 && b[2] === 0xDF && b[3] === 0xA3) return true; // WebM
  if (buf.length >= 8 &&
      b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) return true; // MP4/M4A (ftyp)

  return false;
}

function validateAudioMagicBytes(req, res, next) {
  if (!req.file) {
    return res.status(400).json({ error: 'NO_FILE', message: 'No audio file provided' });
  }
  if (!isValidAudioBuffer(req.file.buffer)) {
    return res.status(400).json({ error: 'INVALID_AUDIO_FORMAT', message: 'File is not a recognised audio format' });
  }
  next();
}

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
  validateAudioMagicBytes,
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
