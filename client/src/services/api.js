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
    // Release any requests that queued behind this refresh (e.g. concurrent 401s
    // that arrived while isRefreshing was true — they must not be left hanging).
    processRefreshQueue(null, newToken);
  } catch (err) {
    // Drain the queue with an error so queued requests reject rather than hanging.
    processRefreshQueue(err);
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
 * Admin session re-auth subscriber system.
 *
 * When a request fails with ADMIN_SESSION_EXPIRED (401), the interceptor
 * pauses the request and notifies all subscribers. AdminSessionGate subscribes,
 * shows the re-auth modal, calls POST /admin/reauth, then calls resolve() to
 * signal success (the interceptor retries the original request) or reject() to
 * signal failure.
 *
 * Concurrent requests that expire simultaneously are queued; they all retry
 * automatically once the re-auth completes.
 * ------------------------------------------------------------------------ */

let isReauthing = false;
let reauthQueue = []; // { resolve, reject } for requests queued while dialog is open
let reauthCallbacks = []; // Subscribers (AdminSessionGate)

export function subscribeAdminReauth(callback) {
  reauthCallbacks.push(callback);
  return () => { reauthCallbacks = reauthCallbacks.filter((cb) => cb !== callback); };
}

function processReauthQueue(err = null) {
  reauthQueue.forEach(({ resolve, reject }) => err ? reject(err) : resolve());
  reauthQueue = [];
}

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

    // ── Admin session timeout ─────────────────────────────────────────────────
    // Server returns 401 + error:'ADMIN_SESSION_EXPIRED' when the 15-min idle
    // window has passed. We pause the request and route it through the re-auth
    // dialog rather than letting the generic refresh handler run.
    if (
      error.response?.status === 401 &&
      error.response?.data?.error === 'ADMIN_SESSION_EXPIRED' &&
      !originalRequest?._reauthRetried
    ) {
      originalRequest._reauthRetried = true;

      // Queue concurrent expired requests — only one re-auth dialog at a time.
      if (isReauthing) {
        return new Promise((resolve, reject) => {
          reauthQueue.push({ resolve, reject });
        }).then(() => api(originalRequest));
      }

      isReauthing = true;
      return new Promise((resolve, reject) => {
        if (reauthCallbacks.length === 0) {
          // No listener mounted yet (should not happen in production).
          isReauthing = false;
          return reject(error);
        }
        reauthCallbacks.forEach((cb) =>
          cb({
            resolve: () => {
              processReauthQueue();
              isReauthing = false;
              resolve(api(originalRequest)); // Retry triggering request.
            },
            reject: (err) => {
              processReauthQueue(err);
              isReauthing = false;
              reject(err);
            },
          })
        );
      });
    }

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
