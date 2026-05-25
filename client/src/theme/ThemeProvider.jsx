/**
 * client/src/theme/ThemeProvider.jsx
 *
 * Reads ui.theme from Redux, applies CSS custom properties to :root,
 * constructs the MUI theme, handles RTL for Urdu, and injects Google Fonts
 * exactly once.
 */

import React, { useEffect, useMemo, useRef } from 'react';
import { useSelector } from 'react-redux';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import rtlPlugin from 'stylis-plugin-rtl';
import { CacheProvider } from '@emotion/react';
import createCache from '@emotion/cache';
import { prefixer } from 'stylis';

import { selectTheme, selectLanguage } from '../store/slices/uiSlice';

import defaultTheme from './themes/default';
import saffronTheme from './themes/saffron';
import darkTheme from './themes/dark';
import highContrastTheme from './themes/highContrast';
import emeraldTheme from './themes/emerald';

// ─── Theme registry ───────────────────────────────────────────────────────────

const THEME_MAP = {
  default:      defaultTheme,
  saffron:      saffronTheme,
  dark:         darkTheme,
  highContrast: highContrastTheme,
  emerald:      emeraldTheme,
};

// ─── Emotion caches (LTR + RTL) ──────────────────────────────────────────────

const ltrCache = createCache({ key: 'nyaya-ltr' });
const rtlCache = createCache({
  key: 'nyaya-rtl',
  stylisPlugins: [prefixer, rtlPlugin],
});

// ─── Google Fonts injection (once) ───────────────────────────────────────────

const GOOGLE_FONTS_URL =
  'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;0,800;1,400;1,600&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=JetBrains+Mono:wght@400;500;600&display=swap';

function injectGoogleFonts() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('nyaya-google-fonts')) return;

  const preconnect1 = document.createElement('link');
  preconnect1.rel = 'preconnect';
  preconnect1.href = 'https://fonts.googleapis.com';

  const preconnect2 = document.createElement('link');
  preconnect2.rel = 'preconnect';
  preconnect2.href = 'https://fonts.gstatic.com';
  preconnect2.crossOrigin = 'anonymous';

  const link = document.createElement('link');
  link.id = 'nyaya-google-fonts';
  link.rel = 'stylesheet';
  link.href = GOOGLE_FONTS_URL;

  document.head.appendChild(preconnect1);
  document.head.appendChild(preconnect2);
  document.head.appendChild(link);
}

// ─── CSS vars applicator ─────────────────────────────────────────────────────

function applyCSSVars(vars) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;

  // Enable smooth transition for background and color only
  root.style.transition = 'background-color 0.3s ease, color 0.3s ease';

  Object.entries(vars).forEach(([prop, value]) => {
    root.style.setProperty(prop, value);
  });

  // Remove transition after it completes so it doesn't affect other properties
  const cleanup = setTimeout(() => {
    root.style.transition = '';
  }, 350);

  return cleanup;
}

// ─── RTL languages ───────────────────────────────────────────────────────────

const RTL_LANGUAGES = ['ur', 'ar', 'fa', 'he'];

// ─── Component ───────────────────────────────────────────────────────────────

function NyayaThemeProvider({ children }) {
  const themeName = useSelector(selectTheme) || 'default';
  const language = useSelector(selectLanguage) || 'en';
  const isRTL = RTL_LANGUAGES.includes(language);
  const fontsInjected = useRef(false);

  // Inject Google Fonts once on mount
  useEffect(() => {
    if (!fontsInjected.current) {
      injectGoogleFonts();
      fontsInjected.current = true;
    }
  }, []);

  // Apply CSS vars to :root whenever theme changes
  useEffect(() => {
    const selectedTheme = THEME_MAP[themeName] || THEME_MAP.default;
    const cleanup = applyCSSVars(selectedTheme.CSS_VARS);
    return () => {
      if (cleanup) clearTimeout(cleanup);
    };
  }, [themeName]);

  // Handle RTL: set dir attribute on <html>
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
  }, [isRTL, language]);

  // Build MUI theme, extending with RTL direction if needed
  const muiTheme = useMemo(() => {
    const selectedTheme = THEME_MAP[themeName] || THEME_MAP.default;
    if (isRTL) {
      return {
        ...selectedTheme.muiTheme,
        direction: 'rtl',
      };
    }
    return selectedTheme.muiTheme;
  }, [themeName, isRTL]);

  const emotionCache = isRTL ? rtlCache : ltrCache;

  return (
    <CacheProvider value={emotionCache}>
      <MuiThemeProvider theme={muiTheme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </CacheProvider>
  );
}

export default NyayaThemeProvider;
