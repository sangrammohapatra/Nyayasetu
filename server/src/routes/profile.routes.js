const express  = require('express');
const { body, validationResult } = require('express-validator');

const { getMe, updateMe, setPassword } = require('../controllers/auth.controller');
const { verifyToken }  = require('../middleware/auth.middleware');
const asyncHandler     = require('../utils/asyncHandler');
const { SUPPORTED_LANGUAGES, INDIAN_PHONE_REGEX } = require('../config/constants');
const User             = require('../models/User.model');

const router = express.Router();

// ─── Validation helper ────────────────────────────────────────────────────────

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

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * GET /v1/profile
 * Fetch the authenticated user's full profile, subscription status, and usage.
 * Protected: requires valid access token.
 *
 * Resp: { user, lawyerProfile? }
 */
router.get('/', verifyToken, getMe);

/**
 * PATCH /v1/profile
 * Update mutable profile fields.
 * Protected: requires valid access token.
 *
 * Body: { name?, email?, state?, district?, pincode?,
 *         preferredLanguage?, preferredTheme?,
 *         whatsappOptIn?, whatsappNumber?, avatar? }
 * Resp: { user }
 */
router.patch(
  '/',
  verifyToken,
  validate([
    body('name')
      .optional()
      .isLength({ min: 2, max: 100 }).withMessage('Name must be 2–100 characters')
      .trim(),

    body('email')
      .optional({ checkFalsy: true })
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

    body('preferredLanguage')
      .optional()
      .isIn(SUPPORTED_LANGUAGES)
      .withMessage(`Language must be one of: ${SUPPORTED_LANGUAGES?.join(', ')}`),

    body('preferredTheme')
      .optional()
      .isIn(['default', 'saffron', 'dark', 'highContrast', 'emerald'])
      .withMessage('Invalid theme name'),

    body('whatsappOptIn')
      .optional()
      .isBoolean().withMessage('whatsappOptIn must be true or false'),

    body('whatsappNumber')
      .optional({ checkFalsy: true })
      .customSanitizer((v) => {
        const digits = String(v).replace(/\D/g, '');
        if (digits.length === 10)                             return `+91${digits}`;
        if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
        return v;
      })
      .matches(INDIAN_PHONE_REGEX)
      .withMessage('Please enter a valid Indian WhatsApp number'),

    body('avatar')
      .optional({ checkFalsy: true })
      .isURL().withMessage('Avatar must be a valid URL'),
  ]),
  updateMe
);

/**
 * POST /v1/profile/change-password
 * Set or change the account password.
 * If a password is already set, currentPassword must be provided.
 * Protected: requires valid access token.
 *
 * Body:  { password, currentPassword? }
 * Resp:  { message }
 */
router.post(
  '/change-password',
  verifyToken,
  validate([
    body('password')
      .notEmpty().withMessage('New password is required')
      .isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('currentPassword').optional(),
  ]),
  setPassword
);

/**
 * DELETE /v1/profile/account
 * Soft-deactivate the authenticated user's account (isActive = false).
 * Protected: requires valid access token.
 *
 * Resp: { message }
 */
router.delete(
  '/account',
  verifyToken,
  asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(req.user.userId, {
      isActive: false,
      refreshTokens: [],
    });
    res.json({ message: 'Account deactivated successfully. Contact support to reactivate.' });
  })
);

module.exports = router;
