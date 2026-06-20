/**
 * client/src/utils/featureFlags.js
 *
 * Single source of truth for feature gating across the entire frontend.
 * The <FeatureGate> component, useFeatureAccess hook, and useAuth.isFeatureAllowed
 * all derive their answers from hasFeature() below.
 *
 * Inheritance model:
 *   - Each higher plan implicitly includes all lower-plan features.
 *   - The hierarchy arrays in the shared JSON express this ordering.
 *
 * UI / visual feature flags live at the bottom of this file.
 * Use useFeatureFlag('flagName') in components; use isEnabled('flagName') outside React.
 */

import { useState } from 'react';
import { planFeatures as FEATURE_MAP, hierarchies as PLAN_HIERARCHIES } from '@shared/featureFlags.json';

export { FEATURE_MAP };

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
    return Object.values(FEATURE_MAP.admin || {}).flat();
  }

  const personaMap = FEATURE_MAP[persona];
  if (!personaMap) return [];

  const hierarchy = PLAN_HIERARCHIES[persona] || PLAN_HIERARCHIES.citizen;
  const planIndex = hierarchy.indexOf(plan);

  if (planIndex === -1) {
    return personaMap.free || [];
  }

  const features = new Set();
  for (let i = 0; i <= planIndex; i++) {
    (personaMap[hierarchy[i]] || []).forEach((f) => features.add(f));
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
  return getFeaturesForPlan(persona, plan || 'free').includes(featureName);
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

  const hierarchy = PLAN_HIERARCHIES[persona] || PLAN_HIERARCHIES.citizen;
  for (const plan of hierarchy) {
    if ((personaMap[plan] || []).includes(featureName)) return plan;
  }
  return null;
}

// ─── UI / Visual feature flags ───────────────────────────────────────────────
// Heavy effects are OFF by default — low-end Android + 4G users must never pay
// the cost of blur, particles, or conic gradients unless the flag is toggled on.

export const featureFlags = {
  enableBlur:            false, // backdrop-filter blur on cards/navbar
  enableParticles:       false, // tsparticles backgrounds (auth pages only)
  enableMagneticCursor:  false, // magnetic CTA buttons
  enableScrollProgress:  false, // top scroll progress bar
  enableConicGradient:   false, // animated conic-gradient hero
  enablePageTransitions: true,  // Framer Motion page transitions (safe)
  enableHoverLift:       true,  // card hover lift (cheap, safe)
  enableScrollReveal:    true,  // scroll-reveal entrance animations (safe)
};

/** Imperative check — safe to call outside React (e.g. in sx callbacks, utils). */
export const isEnabled = (flag) => Boolean(featureFlags[flag]);

/**
 * React hook — returns the flag value.
 * Wrap in useState so call-sites need no refactor if flags become reactive later.
 *
 * @param {string} flag  Key from featureFlags
 * @returns {boolean}
 */
export function useFeatureFlag(flag) {
  const [value] = useState(() => Boolean(featureFlags[flag]));
  return value;
}
