/**
 * client/src/hooks/useFeatureAccess.js
 *
 * Returns a canAccess(featureName) function that checks the current user's
 * persona and plan against FEATURE_MAP.
 *
 * Also exports useGate(featureName) — returns { allowed, minimumPlan }
 * which is handy for rendering upgrade prompts.
 */

import { useCallback } from 'react';
import { useSelector } from 'react-redux';
import { selectUserPersona, selectUserPlan } from '../store/slices/authSlice';
import { hasFeature, minimumPlanFor } from '../utils/featureFlags';

/**
 * @returns {{ canAccess: (featureName: string) => boolean }}
 */
export function useFeatureAccess() {
  const persona = useSelector(selectUserPersona);
  const plan = useSelector(selectUserPlan);

  const canAccess = useCallback(
    (featureName) => hasFeature(persona || 'citizen', plan || 'free', featureName),
    [persona, plan]
  );

  return { canAccess };
}

/**
 * Convenience hook for a single feature.
 *
 * @param {string} featureName
 * @returns {{ allowed: boolean, minimumPlan: string|null }}
 */
export function useGate(featureName) {
  const persona = useSelector(selectUserPersona);
  const plan = useSelector(selectUserPlan);

  const allowed = hasFeature(persona || 'citizen', plan || 'free', featureName);
  const minPlan = allowed ? null : minimumPlanFor(persona || 'citizen', featureName);

  return { allowed, minimumPlan: minPlan };
}

export default useFeatureAccess;
