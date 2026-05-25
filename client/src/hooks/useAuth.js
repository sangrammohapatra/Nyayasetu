/**
 * client/src/hooks/useAuth.js
 *
 * Wraps auth Redux state + actions into a convenient hook.
 * Also exposes isFeatureAllowed(featureName) using the FEATURE_MAP.
 */

import { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import {
  selectUser,
  selectIsAuthenticated,
  selectUserPlan,
  selectUserPersona,
  selectAuthLoading,
  selectAuthError,
  selectOtpSent,
  sendOTP,
  verifyOTP,
  register,
  getMe,
  updateMe,
  logout,
  clearError,
} from '../store/slices/authSlice';

import { hasFeature } from '../utils/featureFlags';

/**
 * @returns {{
 *   user: object|null,
 *   isAuthenticated: boolean,
 *   plan: string,
 *   persona: string,
 *   loading: boolean,
 *   error: string|null,
 *   otpSent: boolean,
 *   sendOTP: (phone: string) => Promise<any>,
 *   verifyOTP: (args: { phone: string, otp: string }) => Promise<any>,
 *   register: (data: object) => Promise<any>,
 *   refreshUser: () => Promise<any>,
 *   updateProfile: (data: object) => Promise<any>,
 *   logout: () => Promise<any>,
 *   isFeatureAllowed: (featureName: string) => boolean,
 *   clearError: () => void,
 * }}
 */
export function useAuth() {
  const dispatch = useDispatch();

  const user = useSelector(selectUser);
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const plan = useSelector(selectUserPlan);
  const persona = useSelector(selectUserPersona);
  const loading = useSelector(selectAuthLoading);
  const error = useSelector(selectAuthError);
  const otpSent = useSelector(selectOtpSent);

  const handleSendOTP = useCallback(
    (phone) => dispatch(sendOTP(phone)),
    [dispatch]
  );

  const handleVerifyOTP = useCallback(
    ({ phone, otp }) => dispatch(verifyOTP({ phone, otp })),
    [dispatch]
  );

  const handleRegister = useCallback(
    (profileData) => dispatch(register(profileData)),
    [dispatch]
  );

  const refreshUser = useCallback(
    () => dispatch(getMe()),
    [dispatch]
  );

  const updateProfile = useCallback(
    (data) => dispatch(updateMe(data)),
    [dispatch]
  );

  const handleLogout = useCallback(
    () => dispatch(logout()),
    [dispatch]
  );

  const handleClearError = useCallback(
    () => dispatch(clearError()),
    [dispatch]
  );

  /**
   * Check whether the currently authenticated user can access a named feature.
   * Works for unauthenticated users too (falls back to citizen/free).
   */
  const isFeatureAllowed = useCallback(
    (featureName) => {
      const effectivePersona = persona || 'citizen';
      const effectivePlan = plan || 'free';
      return hasFeature(effectivePersona, effectivePlan, featureName);
    },
    [persona, plan]
  );

  return {
    user,
    isAuthenticated,
    plan,
    persona,
    loading,
    error,
    otpSent,
    sendOTP: handleSendOTP,
    verifyOTP: handleVerifyOTP,
    register: handleRegister,
    refreshUser,
    updateProfile,
    logout: handleLogout,
    isFeatureAllowed,
    clearError: handleClearError,
  };
}

export default useAuth;
