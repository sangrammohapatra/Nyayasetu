/**
 * client/src/theme/themes/dark.js
 *
 * Dark Mode — Developer-friendly dark navy.
 * Optimised for low-light reading of legal documents.
 */

import { createTheme } from '@mui/material/styles';
import { TYPOGRAPHY, RADIUS, SHADOWS, SPACING } from '../tokens';

export const CSS_VARS = {
  '--color-primary':        '#5C9BF5',
  '--color-primary-light':  '#90C2FF',
  '--color-primary-dark':   '#1E5FBF',
  '--color-primary-alpha':  'rgba(92, 155, 245, 0.16)',
  '--color-secondary':      '#FFB74D',
  '--color-secondary-light':'#FFD95A',
  '--color-secondary-alpha':'rgba(255, 183, 77, 0.14)',
  '--color-bg':             '#0D1117',
  '--color-surface':        '#161B22',
  '--color-surface-raised': '#1C2128',
  '--color-text':           '#E6EDF3',
  '--color-text-secondary': '#8B949E',
  '--color-text-disabled':  '#484F58',
  '--color-border':         '#30363D',
  '--color-border-strong':  '#484F58',
  '--color-success':        '#3FB950',
  '--color-success-light':  '#0D2B14',
  '--color-error':          '#F85149',
  '--color-error-light':    '#2D0F0E',
  '--color-warning':        '#D29922',
  '--color-warning-light':  '#2D1F00',
  '--color-info':           '#58A6FF',
  '--color-info-light':     '#0C1E35',
  '--color-overlay':        'rgba(92, 155, 245, 0.06)',
};

export const muiTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main:        '#5C9BF5',
      light:       '#90C2FF',
      dark:        '#1E5FBF',
      contrastText: '#0D1117',
    },
    secondary: {
      main:        '#FFB74D',
      light:       '#FFD95A',
      dark:        '#F57C00',
      contrastText: '#0D1117',
    },
    background: {
      default: '#0D1117',
      paper:   '#161B22',
    },
    text: {
      primary:   '#E6EDF3',
      secondary: '#8B949E',
      disabled:  '#484F58',
    },
    success: { main: '#3FB950', light: '#0D2B14' },
    error:   { main: '#F85149', light: '#2D0F0E' },
    warning: { main: '#D29922', light: '#2D1F00' },
    info:    { main: '#58A6FF', light: '#0C1E35' },
    divider: '#30363D',
  },
  typography: {
    fontFamily: TYPOGRAPHY.fontFamily.body,
    h1: { fontFamily: TYPOGRAPHY.fontFamily.display, fontWeight: 700, letterSpacing: '-0.02em', color: '#E6EDF3' },
    h2: { fontFamily: TYPOGRAPHY.fontFamily.display, fontWeight: 700, letterSpacing: '-0.01em' },
    h3: { fontFamily: TYPOGRAPHY.fontFamily.display, fontWeight: 600 },
    h4: { fontFamily: TYPOGRAPHY.fontFamily.display, fontWeight: 600 },
    h5: { fontFamily: TYPOGRAPHY.fontFamily.display, fontWeight: 600 },
    h6: { fontFamily: TYPOGRAPHY.fontFamily.display, fontWeight: 600 },
    body1: { fontFamily: TYPOGRAPHY.fontFamily.body, lineHeight: 1.6 },
    body2: { fontFamily: TYPOGRAPHY.fontFamily.body, lineHeight: 1.5 },
    button: { fontFamily: TYPOGRAPHY.fontFamily.body, fontWeight: 600, textTransform: 'none' },
  },
  shape: { borderRadius: RADIUS.md },
  spacing: SPACING.sm,
  custom: {
    gradientText:  'linear-gradient(130deg, #5C9BF5 0%, #58A6FF 100%)',
    gradientBrand: 'linear-gradient(135deg, #5C9BF5 0%, #FFB74D 60%, #58A6FF 100%)',
    glowPrimary:   '0 0 28px rgba(92, 155, 245, 0.50)',
    glowAccent:    '0 0 28px rgba(88, 166, 255, 0.45)',
    cardBg:        'rgba(255,255,255,0.04)',
    cardBorder:    '1px solid rgba(255,255,255,0.09)',
    cardBlur:      'blur(12px)',
    cardShadow:    '0 8px 32px rgba(0,0,0,0.38)',
    darkStrip:     '#1C2940',
    focusRing:     '0 0 0 3px rgba(92, 155, 245, 0.35)',
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: RADIUS.md, fontWeight: 600, textTransform: 'none' },
        containedPrimary: {
          background: 'var(--color-primary)',
          color: '#0D1117',
          '&:hover': { background: 'var(--color-primary-light)' },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: RADIUS.lg,
          border: '1px solid var(--color-border)',
          backgroundColor: 'var(--color-surface)',
        },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: { borderColor: 'var(--color-border)' },
      },
    },
    MuiCssBaseline: {
      styleOverrides: `
        body { background-color: var(--color-bg); color: var(--color-text); }
        ::selection { background-color: var(--color-primary-alpha); color: var(--color-primary-light); }
        a { color: var(--color-primary); }
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: var(--color-bg); }
        ::-webkit-scrollbar-thumb { background: var(--color-border-strong); border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: var(--color-text-secondary); }
      `,
    },
  },
});

export default { CSS_VARS, muiTheme };
