/**
 * tokenStore — single abstraction over localStorage token keys.
 *
 * All token reads/writes go through here so that renaming a key or switching
 * to a different storage backend (sessionStorage, IndexedDB, etc.) requires
 * editing exactly one file.
 */

const TOKEN_KEY        = 'nyayasetu_token';
const REFRESH_KEY      = 'nyayasetu_refresh_token';
const AUTH_PERSIST_KEY = 'nyayasetu_auth';

const tokenStore = {
  /** Read the current access token, or null if absent. */
  get()               { return localStorage.getItem(TOKEN_KEY); },

  /** Persist an access token. */
  set(token)          { localStorage.setItem(TOKEN_KEY, token); },

  /** Read the current refresh token, or null if absent. */
  getRefresh()        { return localStorage.getItem(REFRESH_KEY); },

  /** Persist a refresh token. */
  setRefresh(token)   { localStorage.setItem(REFRESH_KEY, token); },

  /** Remove both tokens plus the redux-persist auth snapshot. */
  clear() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(AUTH_PERSIST_KEY);
  },
};

export default tokenStore;
