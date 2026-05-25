/**
 * client/src/utils/featureFlags.js
 *
 * Single source of truth for feature gating across the entire frontend.
 * The <FeatureGate> component, useFeatureAccess hook, and useAuth.isFeatureAllowed
 * all derive their answers from hasFeature() below.
 *
 * Inheritance model:
 *   - Each higher plan implicitly includes all lower-plan features.
 *   - The PLAN_HIERARCHY arrays express this ordering.
 */

// ─── Plan hierarchies ────────────────────────────────────────────────────────

const CITIZEN_PLAN_HIERARCHY = ['free', 'basic', 'pro'];
const LAWYER_PLAN_HIERARCHY = ['free', 'professional', 'firm'];

// ─── Feature map ─────────────────────────────────────────────────────────────

export const FEATURE_MAP = {
  citizen: {
    free: [
      'basic_templates',
      'preview_document',
      'ai_chat_limited',
      'track_1_case',
      'domestic_violence_template',
      'police_complaint_template',
    ],
    basic: [
      'all_basic_templates',
      'pdf_download',
      'voice_input',
      'clause_explainer',
      'document_sharing',
      'track_5_cases',
      'hearing_alerts_whatsapp',
      'view_lawyer_profiles',
      'ai_chat_extended',
    ],
    pro: [
      'all_templates',
      'unlimited_docs',
      'unlimited_cases',
      'all_alerts',
      'hearing_alerts_email',
      'book_consultation',
      'priority_support',
      'ai_chat_unlimited',
      'advanced_clause_explainer',
    ],
  },
  lawyer: {
    free: [
      'apply_profile',
      'view_public_cases',
    ],
    professional: [
      'client_portal',
      'case_management',
      'consultation_bookings',
      'verified_badge',
      'review_client_docs',
      'basic_analytics',
      'revenue_90pct',
    ],
    firm: [
      'all_professional',
      'team_access',
      'analytics',
      'custom_branding',
      'priority_placement',
      'gold_verified_badge',
      'revenue_92pct',
      'paralegal_accounts',
    ],
  },
  paralegal: {
    // Paralegals inherit their supervising lawyer's plan features at limited scope
    free: ['view_assigned_cases', 'view_assigned_documents'],
    professional: ['edit_assigned_documents', 'client_communication'],
    firm: ['full_paralegal_access'],
  },
  admin: {
    // Admins can access everything
    free: ['admin_dashboard', 'manage_users', 'manage_templates', 'verify_lawyers', 'view_all_stats'],
  },
};

// ─── Plan resolution helpers ─────────────────────────────────────────────────

/**
 * Return all features available to persona+plan, including inherited ones
 * from lower plans in the hierarchy.
 *
 * @param {string} persona  'citizen' | 'lawyer' | 'paralegal' | 'admin'
 * @param {string} plan     e.g. 'free', 'basic', 'pro', 'professional', 'firm'
 * @returns {string[]}      Deduplicated feature list
 */
export function getFeaturesForPlan(persona, plan) {
  if (persona === 'admin') {
    // Admins have everything
    return Object.values(FEATURE_MAP.admin || {}).flat();
  }

  const personaMap = FEATURE_MAP[persona];
  if (!personaMap) return [];

  const hierarchy =
    persona === 'lawyer' || persona === 'paralegal'
      ? LAWYER_PLAN_HIERARCHY
      : CITIZEN_PLAN_HIERARCHY;

  const planIndex = hierarchy.indexOf(plan);
  if (planIndex === -1) {
    // Unknown plan — fall back to free
    return personaMap.free || [];
  }

  // Collect features from all plans at or below the current tier
  const features = new Set();
  for (let i = 0; i <= planIndex; i++) {
    const tierFeatures = personaMap[hierarchy[i]] || [];
    tierFeatures.forEach((f) => features.add(f));
  }
  return Array.from(features);
}

/**
 * Check whether a specific feature is accessible to a persona+plan combination.
 *
 * @param {string}  persona     'citizen' | 'lawyer' | 'paralegal' | 'admin'
 * @param {string}  plan        e.g. 'free', 'basic', 'pro'
 * @param {string}  featureName Feature key from FEATURE_MAP
 * @returns {boolean}
 */
export function hasFeature(persona, plan, featureName) {
  if (!persona || !featureName) return false;
  if (persona === 'admin') return true;

  const features = getFeaturesForPlan(persona, plan || 'free');
  return features.includes(featureName);
}

/**
 * Return the minimum plan required to access a feature for a given persona.
 * Returns null if the feature doesn't exist for that persona.
 *
 * @param {string} persona
 * @param {string} featureName
 * @returns {string|null}
 */
export function minimumPlanFor(persona, featureName) {
  const personaMap = FEATURE_MAP[persona];
  if (!personaMap) return null;

  const hierarchy =
    persona === 'lawyer' || persona === 'paralegal'
      ? LAWYER_PLAN_HIERARCHY
      : CITIZEN_PLAN_HIERARCHY;

  for (const plan of hierarchy) {
    const tierFeatures = personaMap[plan] || [];
    if (tierFeatures.includes(featureName)) return plan;
  }
  return null;
}
