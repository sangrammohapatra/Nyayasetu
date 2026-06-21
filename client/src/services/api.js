/**
 * client/src/services/api.js
 *
 * Central Axios instance for all NyayaSetu API calls.
 *
 * Request interceptor  → attaches Authorization: Bearer <token>
 * Response interceptor → on 401, attempts one silent token refresh,
 *                        retries the original request, then on second 401
 *                        dispatches logout and redirects to /login.
 */

import axios from 'axios';
import tokenStore from './tokenStore';

const BASE_URL = import.meta.env.VITE_API_URL || '/v1';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

/* ---------------------------------------------------------------------------
 * Helpers — thin wrappers over tokenStore to avoid circular dependencies.
 * The store is imported lazily inside the interceptor callbacks.
 * ------------------------------------------------------------------------ */

const getAccessToken  = () => tokenStore.get();
const getRefreshToken = () => tokenStore.getRefresh();
const setAccessToken  = (t) => tokenStore.set(t);
const clearAuthStorage = () => tokenStore.clear();

/* ---------------------------------------------------------------------------
 * Helpers — token expiry check (no library needed, JWT payload is base64)
 * ------------------------------------------------------------------------ */

function getTokenExpiresInSeconds(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp - Math.floor(Date.now() / 1000);
  } catch {
    return null;
  }
}

async function proactiveRefresh(token) {
  const refreshToken = getRefreshToken();
  if (!refreshToken || isRefreshing) return;

  isRefreshing = true;
  try {
    const response = await axios.post(
      `${BASE_URL}/auth/refresh`,
      { refreshToken },
      { withCredentials: true }
    );
    const { accessToken: newToken, refreshToken: newRefreshToken } = response.data;
    setAccessToken(newToken);
    if (newRefreshToken) tokenStore.setRefresh(newRefreshToken);
    import('../store/store').then(({ default: store }) => {
      import('../store/slices/authSlice').then(({ setToken }) => {
        store.dispatch(setToken({ token: newToken }));
      });
    });
  } catch {
    // If proactive refresh fails, let the 401 path handle it
  } finally {
    isRefreshing = false;
  }
}

/* ---------------------------------------------------------------------------
 * Request interceptor — attach Bearer token + proactive refresh if expiring soon
 * ------------------------------------------------------------------------ */
api.interceptors.request.use(
  async (config) => {
    const token = getAccessToken();
    if (token) {
      const expiresIn = getTokenExpiresInSeconds(token);
      // Refresh proactively when token expires in under 60 s
      if (expiresIn !== null && expiresIn < 60) {
        await proactiveRefresh(token);
      }
      // Re-read in case proactiveRefresh just updated it
      config.headers.Authorization = `Bearer ${getAccessToken()}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

/* ---------------------------------------------------------------------------
 * Response interceptor — silent refresh on 401
 * ------------------------------------------------------------------------ */

let isRefreshing = false;
// Queue of { resolve, reject } for requests that came in while a refresh was in-flight
let refreshQueue = [];

function processRefreshQueue(error, token = null) {
  refreshQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else {
      resolve(token);
    }
  });
  refreshQueue = [];
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // A 401 from an auth endpoint means wrong credentials, not an expired session.
    // Attempting a token refresh here would clear storage and force-logout the user.
    const isAuthEndpoint = originalRequest?.url &&
      ['/auth/login', '/auth/send-otp', '/auth/verify-otp', '/auth/register'].some(
        (ep) => originalRequest.url.includes(ep)
      );

    // Only handle 401s that haven't already been retried (and not on auth endpoints)
    if (
      error.response &&
      error.response.status === 401 &&
      !originalRequest._retried &&
      !isAuthEndpoint
    ) {
      // If we're already refreshing, queue this request
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          refreshQueue.push({ resolve, reject });
        })
          .then((newToken) => {
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retried = true;
      isRefreshing = true;

      const refreshToken = getRefreshToken();

      if (!refreshToken) {
        isRefreshing = false;
        clearAuthStorage();
        handleForcedLogout();
        return Promise.reject(error);
      }

      try {
        const response = await axios.post(
          `${BASE_URL}/auth/refresh`,
          { refreshToken },
          { withCredentials: true }
        );

        const { accessToken: newToken, refreshToken: newRefreshToken } = response.data;

        setAccessToken(newToken);
        if (newRefreshToken) {
          localStorage.setItem('nyayasetu_refresh_token', newRefreshToken);
        }

        // Update store token without triggering another 401 cycle
        import('../store/store').then(({ default: store }) => {
          import('../store/slices/authSlice').then(({ setToken }) => {
            store.dispatch(setToken({ token: newToken }));
          });
        });

        processRefreshQueue(null, newToken);
        isRefreshing = false;

        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        processRefreshQueue(refreshError);
        isRefreshing = false;
        clearAuthStorage();
        handleForcedLogout();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

/**
 * Force logout — clears Redux state and redirects to /login.
 * Uses dynamic import to avoid circular dependency with the store.
 */
const AUTH_PAGES = ['/login', '/register'];

function handleForcedLogout() {
  import('../store/store').then(({ default: store }) => {
    import('../store/slices/authSlice').then(({ forceLogout }) => {
      store.dispatch(forceLogout());
    });
  });

  // Don't encode auth pages as returnUrl — that creates a redirect loop
  // (e.g. /login?returnUrl=/login → navigates to /login → repeat).
  const currentPath = window.location.pathname;
  const isAuthPage = AUTH_PAGES.some((p) => currentPath.startsWith(p));
  const to = isAuthPage
    ? '/login'
    : `/login?returnUrl=${encodeURIComponent(currentPath + window.location.search)}`;

  window.location.href = to;
}

export default api;
