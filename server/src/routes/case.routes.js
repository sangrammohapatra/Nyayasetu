const express = require('express');
const { body, param, validationResult } = require('express-validator');

const {
  addCase,
  listCases,
  getCaseDetail,
  refreshCase,
  updateAlerts,
  shareWithLawyer,
  removeCase,
} = require('../controllers/case.controller');

const { verifyToken }    = require('../middleware/auth.middleware');
const { checkFreeQuota } = require('../middleware/subscription.middleware');
const asyncHandler       = require('../utils/asyncHandler');

const router = express.Router();

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

// All case routes require authentication
router.use(verifyToken);

/**
 * POST /v1/cases
 * Add a new case to track. Quota-checked for free tier.
 */
router.post(
  '/',
  checkFreeQuota('case'),
  validate([
    body('cnrNumber')
      .notEmpty().withMessage('CNR number is required')
      .matches(/^[A-Z]{2}[0-9]{2}[0-9]{6}[0-9]{4}$/i)
      .withMessage('Invalid CNR format. Example: DLHC010012342024'),
    body('alertDaysBefore')
      .optional()
      .isInt({ min: 1, max: 7 }).withMessage('alertDaysBefore must be 1–7'),
    body('alertChannels.whatsapp')
      .optional()
      .isBoolean().withMessage('alertChannels.whatsapp must be boolean'),
    body('alertChannels.email')
      .optional()
      .isBoolean().withMessage('alertChannels.email must be boolean'),
  ]),
  addCase
);

/**
 * GET /v1/cases
 * List all tracked cases, sorted by next hearing date.
 */
router.get('/', listCases);

/**
 * GET /v1/cases/:id
 * Full case details with hearing history.
 */
router.get(
  '/:id',
  validate([param('id').isMongoId().withMessage('Invalid case ID')]),
  getCaseDetail
);

/**
 * POST /v1/cases/:id/refresh
 * Re-fetch latest data from eCourts API.
 */
router.post(
  '/:id/refresh',
  validate([param('id').isMongoId().withMessage('Invalid case ID')]),
  refreshCase
);

/**
 * PATCH /v1/cases/:id/alerts
 * Update alert settings (days before, channels, enable/disable).
 */
router.patch(
  '/:id/alerts',
  validate([
    param('id').isMongoId().withMessage('Invalid case ID'),
    body('alertDaysBefore')
      .optional()
      .isInt({ min: 1, max: 7 }).withMessage('alertDaysBefore must be 1–7'),
    body('alertsEnabled')
      .optional()
      .isBoolean().withMessage('alertsEnabled must be boolean'),
  ]),
  updateAlerts
);

/**
 * POST /v1/cases/:id/share-lawyer
 * Share case with a verified lawyer (requires Pro plan).
 */
router.post(
  '/:id/share-lawyer',
  validate([
    param('id').isMongoId().withMessage('Invalid case ID'),
    body('lawyerId').notEmpty().isMongoId().withMessage('Valid lawyerId is required'),
  ]),
  shareWithLawyer
);

/**
 * DELETE /v1/cases/:id
 * Stop tracking a case (soft delete).
 */
router.delete(
  '/:id',
  validate([param('id').isMongoId().withMessage('Invalid case ID')]),
  removeCase
);

module.exports = router;
