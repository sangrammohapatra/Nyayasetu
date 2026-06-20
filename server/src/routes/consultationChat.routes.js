/**
 * server/src/routes/consultationChat.routes.js
 *
 * Mounted at /v1/consultations in app.js.
 *
 * GET  /v1/consultations/:id/messages
 * POST /v1/consultations/:id/messages
 * GET  /v1/consultations/:id/unread-count
 */

const express    = require('express');
const { body, param, validationResult } = require('express-validator');
const { getMessages, sendMessage, getUnreadCount } = require('../controllers/consultationChat.controller');
const { getDocumentForLawyer } = require('../controllers/document.controller');
const { verifyToken } = require('../middleware/auth.middleware');
const asyncHandler    = require('../utils/asyncHandler');

const router = express.Router();

const validate = (checks) => [
  ...checks,
  asyncHandler(async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const fields = {};
      errors.array().forEach((e) => { fields[e.path] = e.msg; });
      return res.status(400).json({ error: 'VALIDATION_ERROR', fields });
    }
    next();
  }),
];

router.use(verifyToken);

router.get(
  '/:id/messages',
  validate([param('id').isMongoId().withMessage('Invalid consultation ID')]),
  getMessages
);

router.post(
  '/:id/messages',
  validate([
    param('id').isMongoId().withMessage('Invalid consultation ID'),
    body('content').notEmpty().withMessage('content is required').isLength({ max: 5000 }),
    body('messageType').optional().isIn(['text', 'document_note']),
    body('documentRef').optional().isMongoId(),
  ]),
  sendMessage
);

router.get(
  '/:id/unread-count',
  validate([param('id').isMongoId().withMessage('Invalid consultation ID')]),
  getUnreadCount
);

/**
 * GET /v1/consultations/:consultationId/document
 * Lawyer retrieves the document shared in this consultation.
 */
router.get(
  '/:consultationId/document',
  validate([param('consultationId').isMongoId().withMessage('Invalid consultation ID')]),
  getDocumentForLawyer
);

module.exports = router;
