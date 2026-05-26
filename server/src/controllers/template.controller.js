const DocumentTemplate = require('../models/DocumentTemplate.model');
const asyncHandler = require('../utils/asyncHandler');
const { createError } = require('../middleware/error.middleware');
const logger = require('../utils/logger');

// ─── Plan hierarchy ───────────────────────────────────────────────────────────

const CITIZEN_PLANS = ['free', 'basic', 'pro'];
const LAWYER_PLANS  = ['free', 'professional', 'firm'];

/**
 * Compute access level for a template given the requesting user's plan/persona.
 * Called on every template object returned to the client so the frontend can
 * render lock icons, pay-per-doc prices, or upgrade CTAs without a second trip.
 *
 * @param {object} template - lean DocumentTemplate document
 * @param {string} plan     - from req.user.plan  (JWT payload)
 * @param {string} persona  - from req.user.persona (JWT payload)
 * @returns {{ type: string, isAccessible: boolean, priceINR?: number, requiredPlan?: string }}
 */
function resolveAccess(template, plan, persona) {
  if (template.isAlwaysFree) return { type: 'free', isAccessible: true };

  const p     = (persona || 'citizen').toLowerCase();
  const plans = p === 'lawyer' ? LAWYER_PLANS : CITIZEN_PLANS;

  const requiredPlan  = template.requiredPlan?.[p] || 'free';
  const userPlanIdx   = plans.indexOf(plan || 'free');
  const requiredIdx   = plans.indexOf(requiredPlan);

  // User's plan meets or exceeds the required plan
  if (requiredPlan === 'free' || userPlanIdx >= requiredIdx) {
    return { type: 'subscription', isAccessible: true };
  }

  // Template has a pay-per-doc price → user can unlock individually
  if (template.pricePayPerDoc > 0) {
    return {
      type: 'pay_per_doc',
      isAccessible: true,
      priceINR: template.pricePayPerDoc / 100,
    };
  }

  return { type: 'upgrade_required', isAccessible: false, requiredPlan };
}

// ─── listTemplates ────────────────────────────────────────────────────────────

/**
 * GET /v1/templates
 * Returns paginated, filtered list of active templates.
 * Excludes questionFlow and systemPromptAddendum — those are only needed
 * when starting a chat session (fetched via GET /:slug).
 */
const listTemplates = asyncHandler(async (req, res) => {
  const {
    category,
    complexity,
    search,
    state,
    featured,
    page  = 1,
    limit = 20,
  } = req.query;

  const filter = { isActive: true };

  if (category)           filter.category   = category;
  if (complexity)         filter.complexity  = complexity;
  if (featured === 'true') filter.isFeatured = true;

  // Build $and conditions so search + state can coexist
  const andClauses = [];

  if (search) {
    const re = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    andClauses.push({
      $or: [{ name: re }, { description: re }, { tags: re }, { nameHi: re }],
    });
  }

  if (state) {
    // availableStates: [] means available in all states
    andClauses.push({
      $or: [
        { availableStates: { $size: 0 } },
        { availableStates: state },
      ],
    });
  }

  if (andClauses.length) filter.$and = andClauses;

  const pageNum  = Math.max(1, parseInt(page, 10)  || 1);
  const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
  const skip     = (pageNum - 1) * limitNum;

  const projection = { questionFlow: 0, systemPromptAddendum: 0 };

  const [templates, total] = await Promise.all([
    DocumentTemplate
      .find(filter, projection)
      .sort({ isFeatured: -1, totalGenerated: -1, name: 1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    DocumentTemplate.countDocuments(filter),
  ]);

  const { plan, persona } = req.user || {};
  const decorated = templates.map((t) => ({ ...t, access: resolveAccess(t, plan, persona) }));

  res.json({
    templates: decorated,
    pagination: {
      total,
      page:  pageNum,
      limit: limitNum,
      pages: Math.ceil(total / limitNum),
    },
  });
});

// ─── getFeaturedTemplates ─────────────────────────────────────────────────────

/**
 * GET /v1/templates/featured
 * Returns all featured active templates, sorted by category.
 */
const getFeaturedTemplates = asyncHandler(async (req, res) => {
  const templates = await DocumentTemplate.findFeatured().lean();

  const { plan, persona } = req.user || {};
  const decorated = templates.map((t) => ({ ...t, access: resolveAccess(t, plan, persona) }));

  res.json({ templates: decorated });
});

// ─── getCategories ────────────────────────────────────────────────────────────

/**
 * GET /v1/templates/categories
 * Returns each category with a live count of active templates.
 */
const getCategories = asyncHandler(async (req, res) => {
  const counts = await DocumentTemplate.aggregate([
    { $match: { isActive: true } },
    { $group: { _id: '$category', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);

  res.json({
    categories: counts.map(({ _id, count }) => ({ category: _id, count })),
  });
});

// ─── getTemplateBySlug ────────────────────────────────────────────────────────

/**
 * GET /v1/templates/:slug
 * Returns the full template including questionFlow (needed by the chat engine).
 * Admins can fetch inactive templates; everyone else gets a 404 for inactive ones.
 */
const getTemplateBySlug = asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const isAdmin   = req.user?.persona?.toLowerCase() === 'admin';

  const filter = isAdmin
    ? { slug: slug.toLowerCase() }
    : { slug: slug.toLowerCase(), isActive: true };

  const template = await DocumentTemplate.findOne(filter).lean();
  if (!template) throw createError(404, 'TEMPLATE_NOT_FOUND', 'Template not found');

  const { plan, persona } = req.user || {};

  res.json({
    template: { ...template, access: resolveAccess(template, plan, persona) },
  });
});

// ─── Admin: createTemplate ────────────────────────────────────────────────────

/**
 * POST /v1/templates
 * Admin-only. Creates a new document template.
 * The pre-save hook auto-sets isAlwaysFree and sorts questionFlow by order.
 */
const createTemplate = asyncHandler(async (req, res) => {
  const template = await DocumentTemplate.create(req.body);
  logger.info(`[template] created slug="${template.slug}" by admin userId=${req.user.userId}`);
  res.status(201).json({ template });
});

// ─── Admin: updateTemplate ────────────────────────────────────────────────────

/**
 * PUT /v1/templates/:id
 * Admin-only. Full or partial update of a template by MongoDB _id.
 */
const updateTemplate = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Prevent accidentally re-assigning _id or __v
  delete req.body._id;
  delete req.body.__v;

  const template = await DocumentTemplate.findByIdAndUpdate(
    id,
    { $set: req.body },
    { new: true, runValidators: true }
  );
  if (!template) throw createError(404, 'TEMPLATE_NOT_FOUND', 'Template not found');

  logger.info(`[template] updated slug="${template.slug}" by admin userId=${req.user.userId}`);
  res.json({ template });
});

// ─── Admin: deleteTemplate (soft) ────────────────────────────────────────────

/**
 * DELETE /v1/templates/:id
 * Admin-only. Soft-deletes by setting isActive = false.
 * Existing ChatSessions that reference this template continue to work;
 * new sessions will receive a 404 when they try to resolve the slug.
 */
const deleteTemplate = asyncHandler(async (req, res) => {
  const template = await DocumentTemplate.findByIdAndUpdate(
    req.params.id,
    { $set: { isActive: false } },
    { new: true }
  );
  if (!template) throw createError(404, 'TEMPLATE_NOT_FOUND', 'Template not found');

  logger.info(`[template] deactivated slug="${template.slug}" by admin userId=${req.user.userId}`);
  res.json({ message: 'Template deactivated successfully', slug: template.slug });
});

module.exports = {
  listTemplates,
  getFeaturedTemplates,
  getCategories,
  getTemplateBySlug,
  createTemplate,
  updateTemplate,
  deleteTemplate,
};
