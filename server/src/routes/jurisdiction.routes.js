const express = require('express');
const { query, param, validationResult } = require('express-validator');

const JurisdictionRule = require('../models/JurisdictionRule.model');
const LegalAct         = require('../models/LegalAct.model');
const { searchLaw, searchActSection } = require('../services/indianKanoon/kanoonClient');
const { optionalAuth } = require('../middleware/auth.middleware');
const asyncHandler     = require('../utils/asyncHandler');
const { createError }  = require('../middleware/error.middleware');

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

/**
 * GET /v1/jurisdiction/states
 * List all states that have at least one jurisdiction rule.
 * Public route — used to populate state dropdowns in the UI.
 */
router.get('/states', asyncHandler(async (req, res) => {
  const states = await JurisdictionRule.distinct('state', { isActive: true, state: { $ne: 'ALL' } });
  res.json({ states: states.sort(), total: states.length });
}));

/**
 * GET /v1/jurisdiction/laws/search
 * Proxy to Indian Kanoon API with Redis caching.
 * Returns judgments and legislation matching the query.
 *
 * Query params:
 *   q        — search query (required)
 *   page     — 0-based page number
 *   act      — act name (uses searchActSection when combined with section)
 *   section  — section number
 *
 * NOTE: Must be registered before /:state/:docType to avoid the wildcard eating it.
 */
router.get(
  '/laws/search',
  validate([
    query('q').optional().isLength({ min: 2, max: 200 }).withMessage('Query must be 2–200 characters'),
    query('page').optional().isInt({ min: 0, max: 50 }).withMessage('Page must be 0–50'),
  ]),
  asyncHandler(async (req, res) => {
    const { q, page = 0, act, section } = req.query;

    if (!q && !act) {
      throw createError(400, 'QUERY_REQUIRED', 'Provide either q (search query) or act parameter');
    }

    let results;

    if (act && section) {
      results = await searchActSection(act, section, parseInt(page));
    } else {
      results = await searchLaw(q || act, parseInt(page));
    }

    res.json(results);
  })
);

/**
 * GET /v1/jurisdiction/:state/:docType
 * Get the jurisdiction rule for a state + document type combination.
 * Falls back to the 'ALL' (central) rule if no state-specific rule exists.
 */
router.get(
  '/:state/:docType',
  validate([
    param('state').notEmpty().withMessage('State is required'),
    param('docType').notEmpty().withMessage('Document type (template slug) is required'),
  ]),
  asyncHandler(async (req, res) => {
    const { state, docType } = req.params;

    const rule = await JurisdictionRule.findForStateAndDocType(
      state.trim(),
      docType.toLowerCase().trim()
    );

    if (!rule) {
      return res.status(404).json({
        error:   'JURISDICTION_NOT_FOUND',
        message: `No jurisdiction rule found for state "${state}" and document type "${docType}".`,
        fallback: 'Apply general Indian law principles for this document type.',
      });
    }

    res.json({ rule });
  })
);

/**
 * GET /v1/acts
 * List all LegalActs with pagination.
 * Can filter by type (central|state), category, or search by name.
 */
router.get('/acts', asyncHandler(async (req, res) => {
  const page     = Math.max(1, parseInt(req.query.page)  || 1);
  const limit    = Math.min(50, parseInt(req.query.limit) || 20);
  const type     = req.query.type;
  const category = req.query.category;
  const search   = req.query.search;

  const filter = { isActive: true };
  if (type)     filter.type     = type;
  if (category) filter.category = category;

  let queryBuilder = LegalAct.find(filter)
    .select('shortName fullName year type applicableState category summary isActive')
    .sort({ year: -1, shortName: 1 });

  if (search) {
    // Use MongoDB text index for full-text search
    queryBuilder = LegalAct.find({
      ...filter,
      $text: { $search: search },
    })
    .select('shortName fullName year type applicableState category summary isActive')
    .sort({ score: { $meta: 'textScore' }, year: -1 });
  }

  const [acts, total] = await Promise.all([
    queryBuilder.skip((page - 1) * limit).limit(limit).lean(),
    LegalAct.countDocuments(filter),
  ]);

  res.json({
    acts,
    pagination: {
      page, limit, total,
      totalPages: Math.ceil(total / limit),
      hasMore:    page * limit < total,
    },
  });
}));

/**
 * GET /v1/acts/:id/sections
 * Get sections of a specific Legal Act.
 * Optional ?relevantTo=template_slug to filter to relevant sections only.
 */
router.get(
  '/acts/:id/sections',
  validate([param('id').isMongoId().withMessage('Invalid act ID')]),
  asyncHandler(async (req, res) => {
    const { id }        = req.params;
    const { relevantTo } = req.query;

    const act = await LegalAct.findById(id).select('-__v');
    if (!act) throw createError(404, 'ACT_NOT_FOUND', 'Legal act not found');

    let sections = act.sections.filter((s) => s.isActive);

    if (relevantTo) {
      sections = sections.filter((s) => s.relevantTo.includes(relevantTo.toLowerCase().trim()));
    }

    res.json({
      act: {
        _id:        act._id,
        shortName:  act.shortName,
        fullName:   act.fullName,
        year:       act.year,
        type:       act.type,
        category:   act.category,
        indianKanoonId: act.indianKanoonId,
      },
      sections,
      total: sections.length,
    });
  })
);

module.exports = router;
