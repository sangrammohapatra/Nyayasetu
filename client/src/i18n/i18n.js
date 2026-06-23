/**
 * client/src/i18n/i18n.js
 *
 * i18next configuration for NyayaSetu.
 *
 * Supported languages:
 *   en  — English       (default fallback)
 *   hi  — हिन्दी (Hindi)
 *   bn  — বাংলা (Bengali)
 *   mr  — मराठी (Marathi)
 *   ta  — தமிழ் (Tamil)
 *   te  — తెలుగు (Telugu)
 *   gu  — ગુજરાતી (Gujarati)
 *   kn  — ಕನ್ನಡ (Kannada)
 *   ml  — മലയാളം (Malayalam)
 *   pa  — ਪੰਜਾਬੀ (Punjabi)
 *   ur  — اردو (Urdu) — RTL
 *
 * Loading strategy:
 *   Production: HTTP backend from /locales/{{lng}}/translation.json
 *   Testing:    Falls back to bundled en translations
 *
 * Detection order:
 *   1. localStorage (key: 'nyayasetu_lng')
 *   2. Browser navigator.language
 *   3. HTML <html lang=""> attribute
 *   Fallback: 'en'
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import HttpBackend from 'i18next-http-backend';
import LanguageDetector from 'i18next-browser-languagedetector';
import enLang from '../../public/locales/en/translation.json';
import hiLang from '../../public/locales/hi/translation.json';
import bnLang from '../../public/locales/bn/translation.json';
import mrLang from '../../public/locales/mr/translation.json';
import taLang from '../../public/locales/ta/translation.json';
import teLang from '../../public/locales/te/translation.json';
import guLang from '../../public/locales/gu/translation.json';
import knLang from '../../public/locales/kn/translation.json';
import mlLang from '../../public/locales/ml/translation.json';
import paLang from '../../public/locales/pa/translation.json';
import urLang from '../../public/locales/ur/translation.json';
import odLang from '../../public/locales/od/translation.json';
// ─── Supported language codes ─────────────────────────────────────────────────

export const SUPPORTED_LANGUAGES = ['en', 'hi', 'bn', 'mr', 'ta', 'te', 'gu', 'kn', 'ml', 'pa', 'ur', 'od'];

// RTL languages — ThemeProvider uses this to set dir="rtl" on <html>
export const RTL_LANGUAGES = ['ur', 'ar'];

// ─── Language display metadata ─────────────────────────────────────────────────

export const LANGUAGE_META = {
  en: { label: 'English',    native: 'English',    flag: '🇬🇧', dir: 'ltr' },
  hi: { label: 'Hindi',     native: 'हिन्दी',       flag: '🇮🇳', dir: 'ltr' },
  bn: { label: 'Bengali',   native: 'বাংলা',        flag: '🇮🇳', dir: 'ltr' },
  mr: { label: 'Marathi',   native: 'मराठी',        flag: '🇮🇳', dir: 'ltr' },
  ta: { label: 'Tamil',     native: 'தமிழ்',        flag: '🇮🇳', dir: 'ltr' },
  te: { label: 'Telugu',    native: 'తెలుగు',       flag: '🇮🇳', dir: 'ltr' },
  gu: { label: 'Gujarati',  native: 'ગુજરાતી',     flag: '🇮🇳', dir: 'ltr' },
  kn: { label: 'Kannada',   native: 'ಕನ್ನಡ',        flag: '🇮🇳', dir: 'ltr' },
  ml: { label: 'Malayalam', native: 'മലയാളം',       flag: '🇮🇳', dir: 'ltr' },
  pa: { label: 'Punjabi',   native: 'ਪੰਜਾਬੀ',      flag: '🇮🇳', dir: 'ltr' },
  ur: { label: 'Urdu',      native: 'اردو',         flag: '🇵🇰', dir: 'rtl' },
  od: { label: 'Odia',      native: 'ଓଡ଼ିଆ',         flag: '🇮🇳', dir: 'ltr' },
};

// ─── i18next initialisation ────────────────────────────────────────────────────

i18n
  .use(HttpBackend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    // Fallback language when a key is missing in the active language
    fallbackLng: 'en',

    // Only load languages we explicitly support
    supportedLngs: SUPPORTED_LANGUAGES,

    // Namespace — NyayaSetu uses a single 'translation' namespace
    defaultNS: 'translation',
    ns: ['translation'],

    // Debug mode — only in development
    debug: import.meta.env.DEV && import.meta.env.VITE_I18N_DEBUG === 'true',

    // Interpolation — React escapes by default; disable i18next escaping
    interpolation: {
      escapeValue: false,
    },
    resources: {
      en: {
        translation: enLang,
      },
      hi: {
        translation: hiLang,
      },
      bn: {
        translation: bnLang,
      },
      mr: {
        translation: mrLang,
      },
      ta: {
        translation: taLang,
      },
      te: {
        translation: teLang,
      },
      gu: {
        translation: guLang,
      },
      kn: {
        translation: knLang,
      },
      ml: {
        translation: mlLang,
      },
      pa: {
        translation: paLang,
      },
      ur: {
        translation: urLang,
      },
      od: {
        translation: odLang,
      },
    },

    // ── Language Detection ──────────────────────────────────────────────────
    detection: {
      // Order of detection strategies
      order: ['localStorage', 'navigator', 'htmlTag'],

      // Cache detected language in localStorage
      lookupLocalStorage: 'nyayasetu_lng',
      cacheUserLanguage: true,
      caches: ['localStorage'],

      // Map browser locale codes to our supported codes
      // e.g., 'en-US' → 'en', 'hi-IN' → 'hi'
      convertDetectedLanguage: (lng) => {
        const base = lng.split('-')[0].toLowerCase();
        return SUPPORTED_LANGUAGES.includes(base) ? base : 'en';
      },
    },

    // ── React-specific options ──────────────────────────────────────────────
    react: {
        // Don't suspend during translation loading — components use fallback strings instead.
      // Suspending inside route children causes React Router to treat it as an unrecoverable error.
      useSuspense: false,
      // Bind i18n events to trigger re-renders
      bindI18n: 'languageChanged loaded',
      bindI18nStore: 'added removed',
    },

    // ── Missing key handling ────────────────────────────────────────────────
    missingKeyHandler: (lng, ns, key) => {
      if (import.meta.env.DEV) {
        console.warn(`[i18n] Missing key: "${key}" in lang "${lng}" ns "${ns}"`);
      }
    },
    parseMissingKeyHandler: (key) => {
      // Return the last segment of the key path as a human-readable fallback
      const parts = key.split('.');
      return parts[parts.length - 1]
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
    },

    // Don't load extra files or append language code to namespace
    load: 'languageOnly',
    cleanCode: true,
  });

/**
 * Change the active language and update the <html> dir attribute.
 * Also persists the selection to localStorage (handled by detector).
 *
 * @param {string} langCode  e.g. 'hi', 'en', 'ur'
 */
export async function changeLanguage(langCode) {
  if (!SUPPORTED_LANGUAGES.includes(langCode)) {
    console.warn(`[i18n] Unsupported language: ${langCode}`);
    return;
  }

  await i18n.changeLanguage(langCode);

  // Update <html> dir for RTL support
  const meta = LANGUAGE_META[langCode];
  if (meta) {
    document.documentElement.dir = meta.dir;
    document.documentElement.lang = langCode;
  }
}

export default i18n;
