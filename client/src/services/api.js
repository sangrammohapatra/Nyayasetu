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
 * Helpers — kept outside the store import to avoid circular dependencies.
 * The store is imported lazily inside the interceptor callbacks.
 * ------------------------------------------------------------------------ */

function getAccessToken() {
  return localStorage.getItem('nyayasetu_token');
}

function getRefreshToken() {
  return localStorage.getItem('nyayasetu_refresh_token');
}

function setAccessToken(token) {
  localStorage.setItem('nyayasetu_token', token);
}

function clearAuthStorage() {
  localStorage.removeItem('nyayasetu_token');
  localStorage.removeItem('nyayasetu_refresh_token');
}

/* ---------------------------------------------------------------------------
 * Request interceptor — attach Bearer token
 * ------------------------------------------------------------------------ */
api.interceptors.request.use(
  (config) => {
    const token = getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
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

    // Only handle 401s that haven't already been retried
    if (
      error.response &&
      error.response.status === 401 &&
      !originalRequest._retried
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
function handleForcedLogout() {
  import('../store/store').then(({ default: store }) => {
    import('../store/slices/authSlice').then(({ forceLogout }) => {
      store.dispatch(forceLogout());
    });
  });

  // Redirect outside of React so it works even if the router is not mounted
  const returnUrl = encodeURIComponent(window.location.pathname + window.location.search);
  window.location.href = `/login?returnUrl=${returnUrl}`;
}

export default api;
