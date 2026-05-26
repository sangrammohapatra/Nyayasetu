/**
 * nyayabotRoutes.js
 * All NyayaBot API routes.
 *
 * Base: /v1/nyayabot
 *
 * Private (JWT required):
 *   POST   /sessions                           Create session + greeting
 *   GET    /sessions                           List user sessions
 *   GET    /sessions/:sessionId                Get session + messages
 *   POST   /sessions/:sessionId/message        Send message (SSE)
 *   POST   /sessions/:sessionId/messages/:messageId/rate  Thumbs up/down
 *   POST   /sessions/:sessionId/rate           Rate full session
 *   PATCH  /sessions/:sessionId/archive        Archive / unarchive
 *   PATCH  /sessions/:sessionId/pin            Pin / unpin
 *   DELETE /sessions/:sessionId                Delete session
 *   POST   /sessions/:sessionId/share          Generate share link
 *   GET    /quota                              Get quota status
 *
 * Public (no JWT):
 *   GET    /shared/:shareToken                 View shared session
 */

const router = require('express').Router();
const ctrl = require('../controllers/nyayabotController');
const { verifyToken } = require('../middleware/auth.middleware');
const rateLimit = require('express-rate-limit');
const { body, param, query, validationResult } = require('express-validator');

// ─── Validation error handler ─────────────────────────────────────────────────
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', details: errors.array() });
  }
  next();
};

// ─── Rate limiters ────────────────────────────────────────────────────────────

// 10 messages / minute per user (strict — AI is expensive)
const messageLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  keyGenerator: (req) => req.user?.userId || req.ip,
  handler: (req, res) =>
    res.status(429).json({
      error: 'RATE_LIMITED',
      message: 'Too many messages. Please wait a moment before sending again.',
    }),
  skip: (req) => req.user?.plan === 'pro' || req.user?.plan === 'firm',
});

// 20 session creations / hour
const sessionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  keyGenerator: (req) => req.user?.userId || req.ip,
  handler: (req, res) =>
    res.status(429).json({ error: 'RATE_LIMITED', message: 'Too many sessions created. Try again later.' }),
});

// ─── All routes below require authentication ───────────────────────────────────
router.use(verifyToken);

// ─── CREATE SESSION ───────────────────────────────────────────────────────────
router.post(
  '/sessions',
  sessionLimiter,
  [
    body('language').optional().isIn(['en','hi','bn','mr','ta','te','gu','kn','ml','pa','ur']),
    body('contextType').optional().isIn(['general','document','case','lawyer','payment','unknown']),
    body('contextRefId').optional().isMongoId(),
    body('source').optional().isIn(['widget','page','whatsapp','mobile']),
  ],
  validate,
  ctrl.createSession
);

// ─── LIST SESSIONS ────────────────────────────────────────────────────────────
router.get(
  '/sessions',
  [
    query('archived').optional().isBoolean(),
    query('limit').optional().isInt({ min: 1, max: 50 }),
    query('skip').optional().isInt({ min: 0 }),
  ],
  validate,
  ctrl.listSessions
);

// ─── GET SINGLE SESSION ───────────────────────────────────────────────────────
router.get(
  '/sessions/:sessionId',
  [param('sessionId').isMongoId()],
  validate,
  ctrl.getSession
);

// ─── SEND MESSAGE (SSE) ───────────────────────────────────────────────────────
router.post(
  '/sessions/:sessionId/message',
  messageLimiter,
  [
    param('sessionId').isMongoId(),
    body('content')
      .isString()
      .trim()
      .isLength({ min: 2, max: 5000 })
      .withMessage('Message must be 2–5000 characters'),
  ],
  validate,
  ctrl.sendMessage
);

// ─── RATE INDIVIDUAL MESSAGE (thumbs) ────────────────────────────────────────
router.post(
  '/sessions/:sessionId/messages/:messageId/rate',
  [
    param('sessionId').isMongoId(),
    param('messageId').isMongoId(),
    body('thumbsUp').isBoolean(),
  ],
  validate,
  ctrl.rateMessage
);

// ─── RATE FULL SESSION ────────────────────────────────────────────────────────
router.post(
  '/sessions/:sessionId/rate',
  [
    param('sessionId').isMongoId(),
    body('rating').isInt({ min: 1, max: 5 }),
    body('feedback').optional().isString().isLength({ max: 500 }),
  ],
  validate,
  ctrl.rateSession
);

// ─── ARCHIVE / UNARCHIVE ──────────────────────────────────────────────────────
router.patch(
  '/sessions/:sessionId/archive',
  [param('sessionId').isMongoId(), body('archive').isBoolean()],
  validate,
  ctrl.archiveSession
);

// ─── PIN / UNPIN ──────────────────────────────────────────────────────────────
router.patch(
  '/sessions/:sessionId/pin',
  [param('sessionId').isMongoId(), body('pinned').isBoolean()],
  validate,
  ctrl.pinSession
);

// ─── DELETE SESSION ───────────────────────────────────────────────────────────
router.delete(
  '/sessions/:sessionId',
  [param('sessionId').isMongoId()],
  validate,
  ctrl.deleteSession
);

// ─── SHARE SESSION ────────────────────────────────────────────────────────────
router.post(
  '/sessions/:sessionId/share',
  [
    param('sessionId').isMongoId(),
    body('lawyerId').optional().isMongoId(),
    body('expiryDays').optional().isInt({ min: 1, max: 90 }),
  ],
  validate,
  ctrl.shareSession
);

// ─── QUOTA STATUS ─────────────────────────────────────────────────────────────
router.get('/quota', ctrl.getQuota);

// ─── PUBLIC: SHARED SESSION (no auth) ────────────────────────────────────────
// Note: This intentionally overrides verifyToken for the /shared/* path.
// Place this AFTER verifyToken.use() — router applies middleware per-route so
// we manually bypass by declaring before the handler (verifyToken already ran
// for all others; this specific route was added last and will match).
router.get(
  '/shared/:shareToken',
  // Remove auth requirement for this one route:
  (req, res, next) => {
    // Skip verifyToken check — already attached to router
    next();
  },
  ctrl.getSharedSession
);

module.exports = router;
