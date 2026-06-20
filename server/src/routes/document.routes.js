const express = require('express');
const { body, param, validationResult } = require('express-validator');

const {
  generateDocument,
  getDocument,
  listDocuments,
  getPDF,
  explainClauseHandler,
  shareDocument,
  getSharedDocument,
  deleteDocument,
  linkCase,
  regenerate,
  updateApprovalStatus,
  addAnnotation,
  lawyerEditDocument,
  getLinkedConsultation,
} = require('../controllers/document.controller');

const { verifyToken, optionalAuth }    = require('../middleware/auth.middleware');
const { checkFeatureAccess, checkFreeQuota } = require('../middleware/subscription.middleware');
const asyncHandler                     = require('../utils/asyncHandler');

const router = express.Router();

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

// ─── Public routes (no auth) ──────────────────────────────────────────────────

/**
 * GET /v1/documents/shared/:shareToken
 * Public view of a shared document — no auth required.
 */
router.get('/shared/:shareToken', getSharedDocument);

// ─── All other document routes require authentication ─────────────────────────
router.use(verifyToken);

/**
 * POST /v1/documents/generate
 * Initiate async document generation from a completed chat session.
 * Returns 202 Accepted immediately; Bull job does the heavy lifting.
 */
router.post(
  '/generate',
  checkFreeQuota('document'),
  validate([
    body('sessionId')
      .notEmpty().withMessage('sessionId is required')
      .isMongoId().withMessage('Invalid sessionId'),
  ]),
  generateDocument
);

/**
 * GET /v1/documents
 * List the authenticated user's documents (paginated).
 */
router.get('/', listDocuments);

/**
 * GET /v1/documents/:id
 * Get a single document. PDF URL is gated by plan.
 */
router.get(
  '/:id',
  validate([param('id').isMongoId().withMessage('Invalid document ID')]),
  getDocument
);

/**
 * GET /v1/documents/:id/pdf
 * Get a fresh 15-minute signed PDF URL.
 * Requires pdf_download feature (Basic plan or pay-per-doc).
 */
router.get(
  '/:id/pdf',
  validate([param('id').isMongoId().withMessage('Invalid document ID')]),
  getPDF
);

/**
 * POST /v1/documents/:id/explain-clause
 * SSE stream — plain-language explanation of a clause.
 * Requires clause_explainer feature (Basic plan or higher).
 */
router.post(
  '/:id/explain-clause',
  validate([
    param('id').isMongoId().withMessage('Invalid document ID'),
    body('clauseText')
      .notEmpty().withMessage('clauseText is required')
      .isLength({ max: 1500 }).withMessage('Clause text too long'),
  ]),
  checkFeatureAccess('clause_explainer'),
  explainClauseHandler
);

/**
 * POST /v1/documents/:id/share
 * Generate a public share link for the document.
 * Requires document_sharing feature (Basic plan or higher).
 */
router.post(
  '/:id/share',
  validate([
    param('id').isMongoId().withMessage('Invalid document ID'),
    body('expiryDays')
      .optional()
      .isInt({ min: 1, max: 90 }).withMessage('expiryDays must be between 1 and 90'),
  ]),
  checkFeatureAccess('document_sharing'),
  shareDocument
);

/**
 * PATCH /v1/documents/:id/link-case
 * Link a document to a tracked case.
 */
router.patch(
  '/:id/link-case',
  validate([
    param('id').isMongoId().withMessage('Invalid document ID'),
    body('caseId')
      .optional()
      .isMongoId().withMessage('Invalid caseId'),
  ]),
  linkCase
);

/**
 * POST /v1/documents/:id/regenerate
 * Re-generate document with optional data patches.
 * Requires document_regenerate feature (Basic plan or higher).
 */
router.post(
  '/:id/regenerate',
  validate([
    param('id').isMongoId().withMessage('Invalid document ID'),
    body('patches')
      .optional()
      .isObject().withMessage('patches must be an object'),
  ]),
  checkFeatureAccess('document_regenerate'),
  regenerate
);

/**
 * DELETE /v1/documents/:id
 * Soft-delete a document.
 */
router.delete(
  '/:id',
  validate([param('id').isMongoId().withMessage('Invalid document ID')]),
  deleteDocument
);

/**
 * PATCH /v1/documents/:id/approval-status
 * Advance the document through the approval workflow.
 */
router.patch(
  '/:id/approval-status',
  validate([
    param('id').isMongoId().withMessage('Invalid document ID'),
    body('status')
      .notEmpty().withMessage('status is required')
      .isIn(['shared_with_lawyer', 'under_review', 'lawyer_reviewed', 'finalized'])
      .withMessage('Invalid status'),
  ]),
  updateApprovalStatus
);

/**
 * POST /v1/documents/:id/annotations
 * Lawyer adds an inline annotation to a document.
 */
router.post(
  '/:id/annotations',
  validate([
    param('id').isMongoId().withMessage('Invalid document ID'),
    body('note').notEmpty().withMessage('note is required').isLength({ max: 2000 }),
    body('clauseIndex').optional().isInt({ min: 0 }),
    body('clauseText').optional().isLength({ max: 500 }),
  ]),
  addAnnotation
);

/**
 * PATCH /v1/documents/:id/lawyer-edit
 * Lawyer submits an edited version of the document.
 */
router.patch(
  '/:id/lawyer-edit',
  validate([
    param('id').isMongoId().withMessage('Invalid document ID'),
    body('content').notEmpty().withMessage('content is required'),
  ]),
  lawyerEditDocument
);

/**
 * GET /v1/documents/:id/consultation
 * Citizen fetches the consultation linked to this document (for the chat button).
 */
router.get(
  '/:id/consultation',
  validate([param('id').isMongoId().withMessage('Invalid document ID')]),
  getLinkedConsultation
);

module.exports = router;
