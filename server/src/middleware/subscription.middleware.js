const User = require('../models/User.model');
const { createError } = require('./error.middleware');
const asyncHandler = require('../utils/asyncHandler');

// ─── Feature Map ───────────────────────────────────────────────────────────────

/**
 * FEATURE_MAP — the single source of truth for which persona+plan combinations
 * unlock which features.
 *
 * Structure: { [feature]: { citizen: string[], lawyer: string[] } }
 *   citizen plans:  free | basic | pro
 *   lawyer plans:   free | professional | firm
 *
 * 'admin' persona always bypasses all feature gates.
 * Mirror of client/src/hooks/useAuth.js hasFeature() — keep in sync.
 */
const FEATURE_MAP = {
  // ── Documents ───────────────────────────────────────────────────────────────
  pdf_download: {
    citizen: ['basic', 'pro'],
    lawyer:  ['professional', 'firm'],
  },
  document_sharing: {
    citizen: ['basic', 'pro'],
    lawyer:  ['professional', 'firm'],
  },
  clause_explainer: {
    citizen: ['basic', 'pro'],
    lawyer:  ['professional', 'firm'],
  },
  document_regenerate: {
    citizen: ['basic', 'pro'],
    lawyer:  ['professional', 'firm'],
  },
  premium_templates: {
    citizen: ['pro'],
    lawyer:  ['professional', 'firm'],
  },

  // ── Voice ────────────────────────────────────────────────────────────────────
  voice_input: {
    citizen: ['basic', 'pro'],
    lawyer:  ['professional', 'firm'],
  },

  // ── Case tracking ─────────────────────────────────────────────────────────
  hearing_alerts_whatsapp: {
    citizen: ['basic', 'pro'],
    lawyer:  ['professional', 'firm'],
  },
  hearing_alerts_email: {
    citizen: ['pro'],
    lawyer:  ['professional', 'firm'],
  },

  // ── Lawyer access (citizen features) ─────────────────────────────────────
  lawyer_profile_view: {
    citizen: ['basic', 'pro'],
    lawyer:  ['free', 'professional', 'firm'],
  },
  book_consultation: {
    citizen: ['pro'],
    lawyer:  ['free', 'professional', 'firm'], // Lawyers can always receive bookings
  },
  priority_support: {
    citizen: ['pro'],
    lawyer:  ['firm'],
  },

  // ── Lawyer portal features ────────────────────────────────────────────────
  case_management: {
    citizen: [],                               // Citizens don't get this
    lawyer:  ['professional', 'firm'],
  },
  client_portal: {
    citizen: [],
    lawyer:  ['professional', 'firm'],
  },
  review_client_docs: {
    citizen: [],
    lawyer:  ['professional', 'firm'],
  },
  analytics_basic: {
    citizen: [],
    lawyer:  ['professional', 'firm'],
  },
  analytics_advanced: {
    citizen: [],
    lawyer:  ['firm'],
  },
  custom_branding: {
    citizen: [],
    lawyer:  ['firm'],
  },
  team_members: {
    citizen: [],
    lawyer:  ['firm'],
  },
};

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
  return (req, res, next) => {
    if (!req.user) {
      return next(createError(401, 'UNAUTHORIZED', 'Authentication required'));
    }

    const { persona, plan } = req.user;

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

    // Get the list of plans that allow this feature for this persona type
    // Paralegals inherit lawyer plan permissions
    const personaKey = (persona === 'paralegal') ? 'lawyer' : persona;
    const allowedPlans = featureConfig[personaKey] || [];

    if (!allowedPlans.includes(plan)) {
      return res.status(403).json({
        error: 'FEATURE_NOT_AVAILABLE',
        message: `This feature requires a paid plan. Your current plan (${plan}) does not include "${feature}".`,
        feature,
        requiredPlans: allowedPlans,
        upgradeUrl: '/pricing',
      });
    }

    next();
  };
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
