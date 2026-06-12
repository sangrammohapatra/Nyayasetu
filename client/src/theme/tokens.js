/**
 * client/src/theme/tokens.js
 *
 * Single source of truth for all design tokens used across
 * NyayaSetu's theme system. Values here must never be hardcoded
 * in component files — always import from this module or read from
 * CSS custom properties via var(--token-name).
 */

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const RADIUS = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
};

export const SHADOWS = {
  sm: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)',
  md: '0 4px 12px rgba(0,0,0,0.10), 0 2px 6px rgba(0,0,0,0.06)',
  lg: '0 12px 32px rgba(0,0,0,0.12), 0 4px 12px rgba(0,0,0,0.08)',
  xl: '0 24px 56px rgba(0,0,0,0.16), 0 8px 20px rgba(0,0,0,0.10)',
  /** Uses CSS custom property — only valid in contexts where :root vars are set */
  glow: '0 0 20px var(--color-primary-alpha)',
  glowLg: '0 0 40px var(--color-primary-alpha)',
  inner: 'inset 0 2px 6px rgba(0,0,0,0.08)',
};

export const TYPOGRAPHY = {
  fontFamily: {
    display: '"Playfair Display", "Tiro Devanagari Hindi", Georgia, serif',
    body:    '"Inter", "Noto Sans Devanagari", system-ui, -apple-system, sans-serif',
    mono:    'ui-monospace, "SF Mono", Menlo, monospace',
  },
  fontSize: {
    xs: '0.75rem',    // 12px
    sm: '0.875rem',   // 14px
    md: '1rem',       // 16px
    lg: '1.125rem',   // 18px
    xl: '1.25rem',    // 20px
    '2xl': '1.5rem',  // 24px
    '3xl': '1.875rem',// 30px
    '4xl': '2.25rem', // 36px
    '5xl': '3rem',    // 48px
  },
  fontWeight: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800,
  },
  lineHeight: {
    tight: 1.2,
    snug: 1.4,
    normal: 1.6,
    relaxed: 1.75,
    loose: 2,
  },
  letterSpacing: {
    tight: '-0.02em',
    normal: '0',
    wide: '0.02em',
    wider: '0.05em',
    widest: '0.1em',
  },
};

export const TRANSITIONS = {
  fast: '150ms ease',
  normal: '250ms ease',
  slow: '400ms ease',
  spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
};

export const BREAKPOINTS = {
  xs: 0,
  sm: 600,
  md: 900,
  lg: 1200,
  xl: 1536,
};

export const Z_INDEX = {
  drawer: 1200,
  appBar: 1100,
  modal: 1300,
  snackbar: 1400,
  tooltip: 1500,
  fab: 1050,
};

/** MUI spacing multiplier (px per unit) */
export const MUI_SPACING = 8;
