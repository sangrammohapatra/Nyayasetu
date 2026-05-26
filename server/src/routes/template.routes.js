const express = require('express');
const { query, param, body, validationResult } = require('express-validator');

const asyncHandler = require('../utils/asyncHandler');
const { verifyToken, optionalAuth, requireAdmin } = require('../middleware/auth.middleware');
const {
  listTemplates,
  getFeaturedTemplates,
  getCategories,
  getTemplateBySlug,
  createTemplate,
  updateTemplate,
  deleteTemplate,
} = require('../controllers/template.controller');

const router = express.Router();

// ─── Shared constants (mirrors DocumentTemplate schema enums) ─────────────────

const VALID_CATEGORIES = [
  'property', 'consumer', 'rti', 'employment', 'criminal',
  'family', 'civil', 'financial', 'labour', 'startup', 'other',
];
const VALID_COMPLEXITIES = ['simple', 'moderate', 'complex'];
const VALID_PLANS_CITIZEN = ['free', 'basic', 'pro'];
const VALID_PLANS_LAWYER  = ['free', 'professional', 'firm'];

// ─── Validation helper (matches project-wide pattern) ────────────────────────

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

// ─── Public / optional-auth routes ───────────────────────────────────────────
// NOTE: /categories and /featured MUST be declared before /:slug so Express
//       does not mistake the static segments for a slug value.

/**
 * GET /v1/templates
 *
 * List active templates with optional filters. Optional auth enriches each
 * template with an `access` object (free | subscription | pay_per_doc |
 * upgrade_required) so the frontend can render lock icons and CTAs.
 *
 * Query params:
 *   category    – one of VALID_CATEGORIES
 *   complexity  – simple | moderate | complex
 *   search      – full-text search across name, description, tags (regex)
 *   state       – Indian state name; filters by availableStates
 *   featured    – "true" to return only featured templates
 *   page        – default 1
 *   limit       – default 20, max 50
 */
router.get(
  '/',
  optionalAuth,
  validate([
    query('category')
      .optional()
      .isIn(VALID_CATEGORIES)
      .withMessage(`category must be one of: ${VALID_CATEGORIES.join(', ')}`),
    query('complexity')
      .optional()
      .isIn(VALID_COMPLEXITIES)
      .withMessage(`complexity must be one of: ${VALID_COMPLEXITIES.join(', ')}`),
    query('search')
      .optional()
      .isString()
      .isLength({ max: 100 })
      .withMessage('search must be a string of at most 100 characters'),
    query('state')
      .optional()
      .isString()
      .trim(),
    query('featured')
      .optional()
      .isBoolean()
      .withMessage('featured must be "true" or "false"'),
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage('limit must be between 1 and 50'),
  ]),
  listTemplates
);

/**
 * GET /v1/templates/categories
 *
 * Returns all categories that have at least one active template, along with
 * a live count. Useful for rendering category filter chips.
 */
router.get('/categories', getCategories);

/**
 * GET /v1/templates/featured
 *
 * Returns all templates marked isFeatured, sorted by category.
 * Optional auth adds `access` annotations.
 */
router.get('/featured', optionalAuth, getFeaturedTemplates);

/**
 * GET /v1/templates/:slug
 *
 * Returns the full template including questionFlow (required by the chat engine
 * to know which questions to ask in which order).
 * Optional auth adds the `access` annotation.
 * Admins can fetch inactive templates; all others get 404.
 */
router.get(
  '/:slug',
  optionalAuth,
  validate([
    param('slug')
      .matches(/^[a-z0-9_]+$/)
      .withMessage('slug must contain only lowercase letters, numbers, and underscores'),
  ]),
  getTemplateBySlug
);

// ─── Admin CRUD (verifyToken + admin persona required) ────────────────────────

/**
 * POST /v1/templates
 *
 * Create a new document template. The pre-save hook auto-sets isAlwaysFree
 * (based on ALWAYS_FREE_TEMPLATES constant) and sorts questionFlow by order.
 *
 * Required body fields: slug, name, category, complexity, questionFlow
 */
router.post(
  '/',
  verifyToken,
  requireAdmin,
  validate([
    body('slug')
      .notEmpty()
      .withMessage('slug is required')
      .matches(/^[a-z0-9_]+$/)
      .withMessage('slug must be lowercase alphanumeric with underscores only'),
    body('name')
      .notEmpty()
      .trim()
      .withMessage('name is required'),
    body('category')
      .isIn(VALID_CATEGORIES)
      .withMessage(`category must be one of: ${VALID_CATEGORIES.join(', ')}`),
    body('complexity')
      .isIn(VALID_COMPLEXITIES)
      .withMessage(`complexity must be one of: ${VALID_COMPLEXITIES.join(', ')}`),
    body('questionFlow')
      .isArray({ min: 1 })
      .withMessage('questionFlow must be a non-empty array of question objects'),
    body('questionFlow.*.key')
      .notEmpty()
      .withMessage('each question must have a key'),
    body('questionFlow.*.label')
      .notEmpty()
      .withMessage('each question must have a label'),
    body('questionFlow.*.questionText')
      .notEmpty()
      .withMessage('each question must have questionText'),
    body('questionFlow.*.order')
      .isInt({ min: 0 })
      .withMessage('each question must have a numeric order'),
    body('pricePayPerDoc')
      .optional()
      .isInt({ min: 0 })
      .withMessage('pricePayPerDoc must be a non-negative integer (in paise)'),
    body('requiredPlan.citizen')
      .optional()
      .isIn(VALID_PLANS_CITIZEN)
      .withMessage(`requiredPlan.citizen must be one of: ${VALID_PLANS_CITIZEN.join(', ')}`),
    body('requiredPlan.lawyer')
      .optional()
      .isIn(VALID_PLANS_LAWYER)
      .withMessage(`requiredPlan.lawyer must be one of: ${VALID_PLANS_LAWYER.join(', ')}`),
    body('availableStates')
      .optional()
      .isArray()
      .withMessage('availableStates must be an array of state name strings'),
    body('estimatedMinutes')
      .optional()
      .isInt({ min: 1, max: 120 })
      .withMessage('estimatedMinutes must be between 1 and 120'),
    body('isFeatured')
      .optional()
      .isBoolean()
      .withMessage('isFeatured must be a boolean'),
    body('icon')
      .optional()
      .isString()
      .trim(),
    body('tags')
      .optional()
      .isArray()
      .withMessage('tags must be an array of strings'),
  ]),
  createTemplate
);

/**
 * PUT /v1/templates/:id
 *
 * Partial or full update of an existing template by MongoDB _id.
 * All fields are optional; only provided fields are updated ($set).
 * questionFlow, if provided, must be a non-empty array.
 */
router.put(
  '/:id',
  verifyToken,
  requireAdmin,
  validate([
    param('id')
      .isMongoId()
      .withMessage('Invalid template ID'),
    body('slug')
      .optional()
      .matches(/^[a-z0-9_]+$/)
      .withMessage('slug must be lowercase alphanumeric with underscores only'),
    body('category')
      .optional()
      .isIn(VALID_CATEGORIES)
      .withMessage(`category must be one of: ${VALID_CATEGORIES.join(', ')}`),
    body('complexity')
      .optional()
      .isIn(VALID_COMPLEXITIES)
      .withMessage(`complexity must be one of: ${VALID_COMPLEXITIES.join(', ')}`),
    body('questionFlow')
      .optional()
      .isArray({ min: 1 })
      .withMessage('questionFlow must be a non-empty array'),
    body('pricePayPerDoc')
      .optional()
      .isInt({ min: 0 })
      .withMessage('pricePayPerDoc must be a non-negative integer (in paise)'),
    body('requiredPlan.citizen')
      .optional()
      .isIn(VALID_PLANS_CITIZEN)
      .withMessage(`requiredPlan.citizen must be one of: ${VALID_PLANS_CITIZEN.join(', ')}`),
    body('requiredPlan.lawyer')
      .optional()
      .isIn(VALID_PLANS_LAWYER)
      .withMessage(`requiredPlan.lawyer must be one of: ${VALID_PLANS_LAWYER.join(', ')}`),
    body('isFeatured')
      .optional()
      .isBoolean()
      .withMessage('isFeatured must be a boolean'),
    body('isActive')
      .optional()
      .isBoolean()
      .withMessage('isActive must be a boolean'),
    body('availableStates')
      .optional()
      .isArray()
      .withMessage('availableStates must be an array of state name strings'),
    body('estimatedMinutes')
      .optional()
      .isInt({ min: 1, max: 120 })
      .withMessage('estimatedMinutes must be between 1 and 120'),
  ]),
  updateTemplate
);

/**
 * DELETE /v1/templates/:id
 *
 * Soft-deletes a template (sets isActive = false).
 * Existing documents generated from this template are not affected.
 * New chat sessions attempting to use this slug will receive a 404.
 */
router.delete(
  '/:id',
  verifyToken,
  requireAdmin,
  validate([
    param('id').isMongoId().withMessage('Invalid template ID'),
  ]),
  deleteTemplate
);

module.exports = router;
