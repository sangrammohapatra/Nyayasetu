/**
 * client/src/hooks/useCaseTracker.js
 *
 * Single source of truth for citizen case tracking state and actions.
 * Replaces inline dispatch calls and plan-limit derivation scattered across pages.
 */

import { useCallback, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  listCases,
  addCase,
  refreshCase,
  removeCase,
  updateCaseAlerts,
  clearCaseError,
  selectCases,
  selectCaseLoading,
  selectCaseError,
  selectCurrentCase,
} from '../store/slices/caseSlice';
import { selectUserPlan } from '../store/slices/authSlice';
import { selectFreeUsage } from '../store/slices/subscriptionSlice';

const PLAN_LIMITS = { free: 1, basic: 5, pro: Infinity };

/**
 * @param {object}  [opts]
 * @param {boolean} [opts.autoLoad=false]  Dispatch listCases() on mount.
 *
 * @returns {{
 *   cases:          object[],
 *   loading:        boolean,
 *   error:          string|null,
 *   currentCase:    object|null,
 *   plan:           string,
 *   caseLimit:      number,
 *   casesTracked:   number,
 *   atLimit:        boolean,
 *   slotsRemaining: number|null,   // null means unlimited
 *   load:           (params?) => Promise,
 *   add:            ({ cnrNumber, alertChannels?, alertDaysBefore? }) => Promise,
 *   refresh:        (caseId) => Promise,
 *   remove:         (caseId, confirmMsg?) => Promise<boolean>,
 *   updateAlerts:   (caseId, { alertDaysBefore?, alertChannels?, alertsEnabled?, notes? }) => Promise,
 *   clearError:     () => void,
 *   upgradeOrAdd:   (onAdd: () => void) => void,
 * }}
 */
export function useCaseTracker({ autoLoad = false } = {}) {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const cases       = useSelector(selectCases);
  const loading     = useSelector(selectCaseLoading);
  const error       = useSelector(selectCaseError);
  const currentCase = useSelector(selectCurrentCase);
  const plan        = useSelector(selectUserPlan);
  const freeUsage   = useSelector(selectFreeUsage);

  const caseLimit      = PLAN_LIMITS[plan] ?? Infinity;
  const casesTracked   = freeUsage?.casesTracked ?? cases.length;
  const atLimit        = caseLimit !== Infinity && casesTracked >= caseLimit;
  const slotsRemaining = caseLimit === Infinity ? null : Math.max(0, caseLimit - casesTracked);

  const load = useCallback(
    (params) => dispatch(listCases(params)),
    [dispatch],
  );

  useEffect(() => {
    if (autoLoad) load();
  }, [autoLoad, load]);

  const add = useCallback(
    ({ cnrNumber, alertChannels, alertDaysBefore }) =>
      dispatch(addCase({ cnrNumber, alertChannels, alertDaysBefore })),
    [dispatch],
  );

  const refresh = useCallback(
    (caseId) => dispatch(refreshCase(caseId)),
    [dispatch],
  );

  /**
   * @param {string}  caseId
   * @param {string}  [confirmMsg]  window.confirm text — skipped if omitted.
   * @returns {Promise<boolean>}    false if user cancelled.
   */
  const remove = useCallback(
    async (caseId, confirmMsg) => {
      if (confirmMsg && !window.confirm(confirmMsg)) return false;
      await dispatch(removeCase(caseId));
      return true;
    },
    [dispatch],
  );

  /**
   * Thin wrapper around updateCaseAlerts that accepts arbitrary alert fields
   * (alertDaysBefore, alertChannels, alertsEnabled, notes) so callers are not
   * constrained to the thunk's original parameter shape.
   */
  const updateAlerts = useCallback(
    (caseId, alertOpts) => dispatch(updateCaseAlerts({ caseId, ...alertOpts })),
    [dispatch],
  );

  const clearError = useCallback(() => dispatch(clearCaseError()), [dispatch]);

  /**
   * If the user is at their plan limit, navigate to /pricing.
   * Otherwise invoke onAdd so the caller can open the add-case flow.
   */
  const upgradeOrAdd = useCallback(
    (onAdd) => {
      if (atLimit) navigate('/pricing');
      else onAdd?.();
    },
    [atLimit, navigate],
  );

  return {
    cases,
    loading,
    error,
    currentCase,
    plan,
    caseLimit,
    casesTracked,
    atLimit,
    slotsRemaining,
    load,
    add,
    refresh,
    remove,
    updateAlerts,
    clearError,
    upgradeOrAdd,
  };
}

export default useCaseTracker;
