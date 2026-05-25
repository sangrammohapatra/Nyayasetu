/**
 * client/src/store/slices/uiSlice.js
 */

import { createSlice } from '@reduxjs/toolkit';
import i18n from '../../i18n/i18n';

// ─── Theme CSS custom property application ───────────────────────────────────

const THEME_TOKENS = {
  default: {
    '--color-primary': '#1565C0',
    '--color-primary-light': '#1976D2',
    '--color-primary-alpha': 'rgba(21,101,192,0.12)',
    '--color-secondary': '#F57C00',
    '--color-bg': '#F8FAFF',
    '--color-surface': '#FFFFFF',
    '--color-text': '#1A1A1A',
    '--color-text-secondary': '#5F6B7A',
    '--color-border': '#E3E8F0',
    '--color-success': '#1B5E20',
    '--color-error': '#C62828',
    '--color-warning': '#E65100',
  },
  saffron: {
    '--color-primary': '#FF6F00',
    '--color-primary-light': '#FFA000',
    '--color-primary-alpha': 'rgba(255,111,0,0.12)',
    '--color-secondary': '#1B5E20',
    '--color-bg': '#FFFDE7',
    '--color-surface': '#FFFFFF',
    '--color-text': '#1A1A1A',
    '--color-text-secondary': '#5D4037',
    '--color-border': '#FFE0B2',
    '--color-success': '#1B5E20',
    '--color-error': '#B71C1C',
    '--color-warning': '#E65100',
  },
  dark: {
    '--color-primary': '#90CAF9',
    '--color-primary-light': '#BBDEFB',
    '--color-primary-alpha': 'rgba(144,202,249,0.12)',
    '--color-secondary': '#80DEEA',
    '--color-bg': '#0D1117',
    '--color-surface': '#161B22',
    '--color-text': '#E6EDF3',
    '--color-text-secondary': '#8B949E',
    '--color-border': '#30363D',
    '--color-success': '#3FB950',
    '--color-error': '#F85149',
    '--color-warning': '#D29922',
  },
  highContrast: {
    '--color-primary': '#000000',
    '--color-primary-light': '#333333',
    '--color-primary-alpha': 'rgba(0,0,0,0.12)',
    '--color-secondary': '#000000',
    '--color-bg': '#FFFFFF',
    '--color-surface': '#FFFFFF',
    '--color-text': '#000000',
    '--color-text-secondary': '#1A1A1A',
    '--color-border': '#000000',
    '--color-success': '#006400',
    '--color-error': '#8B0000',
    '--color-warning': '#8B4500',
  },
  emerald: {
    '--color-primary': '#00695C',
    '--color-primary-light': '#00897B',
    '--color-primary-alpha': 'rgba(0,105,92,0.12)',
    '--color-secondary': '#558B2F',
    '--color-bg': '#F0FDF4',
    '--color-surface': '#FFFFFF',
    '--color-text': '#1A1A1A',
    '--color-text-secondary': '#37474F',
    '--color-border': '#B2DFDB',
    '--color-success': '#2E7D32',
    '--color-error': '#C62828',
    '--color-warning': '#E65100',
  },
};

export function applyThemeToDOM(themeName) {
  const tokens = THEME_TOKENS[themeName] || THEME_TOKENS.default;
  const root = document.documentElement;
  Object.entries(tokens).forEach(([prop, value]) => {
    root.style.setProperty(prop, value);
  });
}

// ─── Initial state ────────────────────────────────────────────────────────────

const PERSISTED_UI_KEY = 'nyayasetu_ui';

function loadPersistedUI() {
  try {
    const raw = localStorage.getItem(PERSISTED_UI_KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return {};
}

const persisted = loadPersistedUI();

const initialState = {
  theme: persisted.theme || 'default',
  language: persisted.language || 'en',
  sidebarOpen: false,
  mobileNavOpen: false,
  globalLoading: false,
  snackbars: [], // { id, message, severity, duration }
  activeModal: null, // string key of the currently open modal
};

// Apply persisted theme immediately on load
applyThemeToDOM(initialState.theme);

// ─── Slice ───────────────────────────────────────────────────────────────────

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setTheme(state, action) {
      const theme = action.payload;
      state.theme = theme;

      // Apply CSS vars to :root immediately
      applyThemeToDOM(theme);

      // Persist theme choice
      try {
        const prev = loadPersistedUI();
        localStorage.setItem(PERSISTED_UI_KEY, JSON.stringify({ ...prev, theme }));
      } catch (_) {}
    },

    setLanguage(state, action) {
      const language = action.payload;
      state.language = language;

      // Switch i18next language immediately
      if (i18n.language !== language) {
        i18n.changeLanguage(language).catch(() => {});
      }

      // Persist
      try {
        const prev = loadPersistedUI();
        localStorage.setItem(PERSISTED_UI_KEY, JSON.stringify({ ...prev, language }));
      } catch (_) {}

      // Optimistic sync to backend — fire-and-forget, no await in reducer
      import('../../services/api').then(({ default: api }) => {
        api.patch('/auth/me', { preferredLanguage: language }).catch(() => {});
      });
    },

    toggleSidebar(state) {
      state.sidebarOpen = !state.sidebarOpen;
    },

    setSidebarOpen(state, action) {
      state.sidebarOpen = action.payload;
    },

    toggleMobileNav(state) {
      state.mobileNavOpen = !state.mobileNavOpen;
    },

    setGlobalLoading(state, action) {
      state.globalLoading = action.payload;
    },

    pushSnackbar(state, action) {
      const { message, severity = 'info', duration = 4000 } = action.payload;
      state.snackbars.push({
        id: `snack_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        message,
        severity,
        duration,
      });
    },

    dismissSnackbar(state, action) {
      state.snackbars = state.snackbars.filter((s) => s.id !== action.payload);
    },

    setActiveModal(state, action) {
      state.activeModal = action.payload;
    },

    closeModal(state) {
      state.activeModal = null;
    },
  },
});

export const {
  setTheme,
  setLanguage,
  toggleSidebar,
  setSidebarOpen,
  toggleMobileNav,
  setGlobalLoading,
  pushSnackbar,
  dismissSnackbar,
  setActiveModal,
  closeModal,
} = uiSlice.actions;

// ─── Selectors ───────────────────────────────────────────────────────────────

export const selectTheme = (state) => state.ui.theme;
export const selectLanguage = (state) => state.ui.language;
export const selectSidebarOpen = (state) => state.ui.sidebarOpen;
export const selectGlobalLoading = (state) => state.ui.globalLoading;
export const selectSnackbars = (state) => state.ui.snackbars;
export const selectActiveModal = (state) => state.ui.activeModal;

export default uiSlice.reducer;
