const express    = require('express');
const rateLimit  = require('express-rate-limit');
const { body, validationResult } = require('express-validator');

const {
  sendOTPHandler,
  verifyOTPHandler,
  register,
  getMe,
  updateMe,
  refresh,
  logout,
  whatsappEntry,
} = require('../controllers/auth.controller');

const { verifyToken }  = require('../middleware/auth.middleware');
const asyncHandler     = require('../utils/asyncHandler');
const { SUPPORTED_LANGUAGES, INDIAN_PHONE_REGEX, PERSONAS } = require('../config/constants');

const router = express.Router();

// ─── Rate Limiters ────────────────────────────────────────────────────────────

/**
 * otpRequestLimiter — 3 requests per phone per 15 minutes.
 * Keyed by phone number (not IP) so separate phones on same network aren't blocked.
 */
const otpRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const raw = req.body?.phone || req.ip;
    return String(raw).replace(/\D/g, '').slice(-10);
  },
  handler: (_req, res) => res.status(429).json({
    error: 'OTP_RATE_LIMIT',
    message: 'Too many OTP requests for this number. Please wait 15 minutes.',
    retryAfter: 900,
  }),
  skip: (req) => {
    // Never limit the dev test phone
    const digits = String(req.body?.phone || '').replace(/\D/g, '');
    return digits.endsWith('9999999999') && process.env.NODE_ENV === 'development';
  },
});

const verifyOTPLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => String(req.body?.phone || req.ip).replace(/\D/g, '').slice(-10),
  handler: (_req, res) => res.status(429).json({
    error: 'VERIFY_RATE_LIMIT',
    message: 'Too many verification attempts. Please wait 15 minutes.',
    retryAfter: 900,
  }),
});

const refreshLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => res.status(429).json({
    error: 'REFRESH_RATE_LIMIT',
    message: 'Too many token refresh requests.',
    retryAfter: 60,
  }),
});

const whatsappEntryLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => req.body?.phone || req.ip,
  handler: (_req, res) => res.status(429).json({
    error: 'RATE_LIMIT',
    message: 'Too many WhatsApp entry attempts.',
  }),
});

// ─── Validation Helper ────────────────────────────────────────────────────────

/**
 * validate — runs express-validator checks and short-circuits with 400 on failure.
 * Returns an array so it can be spread into the route middleware chain.
 */
const validate = (checks) => [
  ...checks,
  asyncHandler(async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const fields = {};
      errors.array().forEach((e) => { fields[e.path] = e.msg; });
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Validation failed. Please check the highlighted fields.',
        fields,
      });
    }
    next();
  }),
];

// Phone sanitizer + validator (reused on multiple routes)
const phoneValidator = body('phone')
  .notEmpty().withMessage('Phone number is required')
  .customSanitizer((v) => {
    const digits = String(v).replace(/\D/g, '');
    if (digits.length === 10)                             return `+91${digits}`;
    if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
    return v;
  })
  .matches(INDIAN_PHONE_REGEX)
  .withMessage('Please enter a valid 10-digit Indian mobile number (starting with 6–9)');

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * POST /v1/auth/send-otp
 * Request a 6-digit OTP for the given Indian mobile number.
 * Rate-limited: 3 requests per phone per 15 min.
 *
 * Body:  { phone }
 * Resp:  { message, expiresIn: 300, isNewUser }
 */
router.post(
  '/send-otp',
  otpRequestLimiter,
  validate([phoneValidator]),
  sendOTPHandler
);

/**
 * POST /v1/auth/verify-otp
 * Verify OTP and receive JWT token pair.
 * Rate-limited: 10 attempts per phone per 15 min.
 *
 * Body:  { phone, otp }
 * Resp:  { accessToken, refreshToken, user, isNewUser }
 */
router.post(
  '/verify-otp',
  verifyOTPLimiter,
  validate([
    phoneValidator,
    body('otp')
      .notEmpty().withMessage('OTP is required')
      .isLength({ min: 6, max: 6 }).withMessage('OTP must be exactly 6 digits')
      .isNumeric().withMessage('OTP must contain only digits'),
  ]),
  verifyOTPHandler
);

/**
 * POST /v1/auth/register
 * Complete profile after OTP verification.
 * Protected: requires valid access token.
 *
 * Body:  { name, state?, district?, persona?, preferredLanguage?, email?, pincode? }
 * Resp:  { message, accessToken, refreshToken, user }
 */
router.post(
  '/register',
  verifyToken,
  validate([
    body('name')
      .notEmpty().withMessage('Name is required')
      .isLength({ min: 2, max: 100 }).withMessage('Name must be 2–100 characters')
      .trim(),

    body('persona')
      .optional()
      .isIn([PERSONAS.CITIZEN, PERSONAS.LAWYER, PERSONAS.PARALEGAL])
      .withMessage('Persona must be: citizen, lawyer, or paralegal'),

    body('preferredLanguage')
      .optional()
      .isIn(SUPPORTED_LANGUAGES)
      .withMessage(`Language must be one of: ${SUPPORTED_LANGUAGES?.join(', ')}`),

    body('email')
      .optional()
      .isEmail().withMessage('Please enter a valid email address')
      .normalizeEmail(),

    body('state')
      .optional()
      .isLength({ max: 100 }).withMessage('State name too long')
      .trim(),

    body('district')
      .optional()
      .isLength({ max: 100 }).withMessage('District name too long')
      .trim(),

    body('pincode')
      .optional()
      .matches(/^\d{6}$/).withMessage('Pincode must be exactly 6 digits'),
  ]),
  register
);

/**
 * GET /v1/auth/me
 * Return the authenticated user's full profile.
 * Protected: requires valid access token.
 *
 * Resp: { user, lawyerProfile? }
 */
router.get('/me', verifyToken, getMe);

/**
 * PATCH /v1/auth/me
 * Update mutable profile fields. Phone/persona changes are NOT allowed here.
 * Protected: requires valid access token.
 *
 * Body:  { name?, state?, district?, preferredLanguage?, preferredTheme?,
 *          whatsappOptIn?, whatsappNumber?, email?, pincode? }
 * Resp:  { user }
 */
router.patch(
  '/me',
  verifyToken,
  validate([
    body('name')
      .optional()
      .isLength({ min: 2, max: 100 }).withMessage('Name must be 2–100 characters')
      .trim(),

    body('preferredLanguage')
      .optional()
      .isIn(SUPPORTED_LANGUAGES)
      .withMessage(`Language must be one of: ${SUPPORTED_LANGUAGES?.join(', ')}`),

    body('preferredTheme')
      .optional()
      .isIn(['default', 'saffron', 'dark', 'highContrast', 'emerald'])
      .withMessage('Invalid theme name'),

    body('email')
      .optional()
      .isEmail().withMessage('Please enter a valid email address')
      .normalizeEmail(),

    body('whatsappOptIn')
      .optional()
      .isBoolean().withMessage('whatsappOptIn must be true or false'),

    body('whatsappNumber')
      .optional()
      .customSanitizer((v) => {
        const digits = String(v).replace(/\D/g, '');
        if (digits.length === 10)                             return `+91${digits}`;
        if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
        return v;
      })
      .matches(INDIAN_PHONE_REGEX)
      .withMessage('Please enter a valid Indian WhatsApp number'),

    body('pincode')
      .optional()
      .matches(/^\d{6}$/).withMessage('Pincode must be exactly 6 digits'),
  ]),
  updateMe
);

/**
 * POST /v1/auth/refresh
 * Exchange a valid refresh token for a fresh access + refresh token pair.
 * Implements rotation — old token is invalidated on use.
 * Rate-limited: 20 calls per minute.
 *
 * Body:  { refreshToken }
 * Resp:  { accessToken, refreshToken }
 */
router.post(
  '/refresh',
  refreshLimiter,
  validate([
    body('refreshToken')
      .notEmpty().withMessage('Refresh token is required'),
  ]),
  refresh
);

/**
 * POST /v1/auth/logout
 * Invalidate a refresh token (single-device) or all tokens (all-device).
 * Protected: requires valid access token.
 *
 * Body:  { refreshToken? }   — omit for all-device logout
 * Resp:  { message }
 */
router.post('/logout', verifyToken, logout);

/**
 * POST /v1/auth/whatsapp-entry
 * Deep-link entry from the WhatsApp bot.
 * The bot embeds a short-lived wa_token in the web link it sends to the user.
 * Rate-limited: 10 per phone per 5 minutes.
 *
 * Body:  { phone, wa_token }
 * Resp:  { accessToken, refreshToken, user, isNewUser }
 */
router.post(
  '/whatsapp-entry',
  whatsappEntryLimiter,
  validate([
    body('phone').notEmpty().withMessage('Phone is required'),
    body('wa_token').notEmpty().withMessage('WhatsApp entry token is required'),
  ]),
  whatsappEntry
);

module.exports = router;
