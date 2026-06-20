const User = require('../models/User.model');
const { createError } = require('./error.middleware');
const asyncHandler = require('../utils/asyncHandler');

// ─── Feature Map ───────────────────────────────────────────────────────────────

const { planFeatures, hierarchies } = require('../../../shared/featureFlags.json');

/**
 * Derive feature-centric lookup from the shared plan-centric map.
 * Result: { [feature]: { [persona]: string[] } } where the plan array
 * contains the plan where the feature is first introduced plus all
 * higher plans (inheritance applied).
 */
function buildFeatureLookup(features, hier) {
  const lookup = {};
  for (const [persona, plans] of Object.entries(features)) {
    if (persona === 'admin') continue;
    const hierarchy = hier[persona] || [];
    for (let i = 0; i < hierarchy.length; i++) {
      for (const feature of (plans[hierarchy[i]] || [])) {
        if (!lookup[feature]) lookup[feature] = {};
        if (!lookup[feature][persona]) lookup[feature][persona] = [];
        for (let j = i; j < hierarchy.length; j++) {
          if (!lookup[feature][persona].includes(hierarchy[j])) {
            lookup[feature][persona].push(hierarchy[j]);
          }
        }
      }
    }
  }
  return lookup;
}

const FEATURE_MAP = buildFeatureLookup(planFeatures, hierarchies);

// ─── checkFeatureAccess ────────────────────────────────────────────────────────

/**
 * checkFeatureAccess — middleware factory that blocks requests when the user's
 * persona+plan does not include the requested feature.
 *
 * Must be used AFTER verifyToken (req.user must exist).
 *
 * Usage:
 *   router.get('/:id/pdf', verifyToken, checkFeatureAccess('pdf_download'), downloadPdf);
 *
 * Response on denial:
 *   403 { error: 'FEATURE_NOT_AVAILABLE', message, feature, upgradeUrl }
 *
 * @param {string} feature — key from FEATURE_MAP
 */
function checkFeatureAccess(feature) {
  return asyncHandler(async (req, res, next) => {
    if (!req.user) {
      return next(createError(401, 'UNAUTHORIZED', 'Authentication required'));
    }

    const { userId, persona } = req.user;

    // Admins always have access to everything
    if (persona === 'admin') return next();

    const featureConfig = FEATURE_MAP[feature];

    // Unknown feature key — fail open (don't block, but log)
    if (!featureConfig) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(`[subscription] checkFeatureAccess: unknown feature "${feature}"`);
      }
      return next();
    }

    // Paralegals inherit lawyer plan permissions
    const personaKey = (persona === 'paralegal') ? 'lawyer' : persona;
    const allowedPlans = featureConfig[personaKey] || [];

    // Free-tier features are always accessible — no DB hit needed
    if (allowedPlans.includes('free')) return next();

    // Paid features: read current subscription from DB so a plan change
    // (purchase, cancellation, expiry) takes effect within the access-token
    // window without requiring a re-login.
    const user = await User.findById(userId)
      .select('subscription.plan subscription.validUntil')
      .lean();

    if (!user) {
      return next(createError(401, 'USER_NOT_FOUND', 'User not found'));
    }

    const now = new Date();
    const activePlan =
      user.subscription?.validUntil && now < new Date(user.subscription.validUntil)
        ? user.subscription.plan
        : 'free';

    if (!allowedPlans.includes(activePlan)) {
      return res.status(403).json({
        error: 'FEATURE_NOT_AVAILABLE',
        message: `This feature requires a paid plan. Your current plan (${activePlan}) does not include "${feature}".`,
        feature,
        requiredPlans: allowedPlans,
        upgradeUrl: '/pricing',
      });
    }

    // Propagate the verified plan so downstream handlers don't need to re-fetch
    req.user.plan = activePlan;
    next();
  });
}

// ─── checkFreeQuota ───────────────────────────────────────────────────────────

/**
 * Quota type → freeUsage field mapping.
 */
const QUOTA_FIELD_MAP = {
  document: { used: 'docsGenerated',  limit: 'docsLimit' },
  ai_chat:  { used: 'aiChatsUsed',    limit: 'aiChatsLimit' },
  case:     { used: 'casesTracked',   limit: 'casesLimit' },
};

/**
 * checkFreeQuota — middleware factory that blocks a request when the user has
 * exhausted their free-tier monthly quota for a given resource type.
 *
 * Paid (non-expired) subscribers bypass the check entirely.
 * Must be used AFTER verifyToken.
 *
 * Usage:
 *   router.post('/', verifyToken, checkFreeQuota('document'), createDocument);
 *
 * Response on denial:
 *   403 { error: 'QUOTA_EXCEEDED', message, used, limit, resetDate, upgradeUrl }
 *
 * @param {'document'|'ai_chat'|'case'} quotaType
 */
function checkFreeQuota(quotaType) {
  return asyncHandler(async (req, res, next) => {
    if (!req.user) {
      return next(createError(401, 'UNAUTHORIZED', 'Authentication required'));
    }

    const { userId, plan, persona } = req.user;

    // Admins are never quota-blocked
    if (persona === 'admin') return next();

    // Paid subscribers (non-free, and plan hasn't expired) skip quota check.
    // We re-fetch the user to get the freshest subscription state.
    if (plan !== 'free') {
      const user = await User.findById(userId)
        .select('subscription.validUntil subscription.plan')
        .lean();

      if (user?.subscription?.validUntil && new Date() < new Date(user.subscription.validUntil)) {
        return next();
      }
      // If subscription has expired, fall through to quota check
    }

    const quotaDef = QUOTA_FIELD_MAP[quotaType];
    if (!quotaDef) {
      // Unknown quota type — fail open
      return next();
    }

    const user = await User.findById(userId)
      .select(`freeUsage.${quotaDef.used} freeUsage.${quotaDef.limit} freeUsage.resetDate`)
      .lean();

    if (!user) {
      return next(createError(401, 'USER_NOT_FOUND', 'User not found'));
    }

    const used  = user.freeUsage?.[quotaDef.used]  ?? 0;
    const limit = user.freeUsage?.[quotaDef.limit] ?? 0;

    if (used >= limit) {
      return res.status(403).json({
        error: 'QUOTA_EXCEEDED',
        message: `You have used all ${limit} free ${quotaType} credit${limit === 1 ? '' : 's'} this month. Upgrade to continue.`,
        quotaType,
        used,
        limit,
        resetDate: user.freeUsage?.resetDate ?? null,
        upgradeUrl: '/pricing',
      });
    }

    next();
  });
}

module.exports = { checkFeatureAccess, checkFreeQuota, FEATURE_MAP };
