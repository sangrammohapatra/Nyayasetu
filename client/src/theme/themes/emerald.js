/**
 * client/src/theme/themes/emerald.js
 *
 * Calm Emerald — Teal (#00695C) on Mint (#F0FDF4).
 * Approachable, nature-inspired. Reduces stress for sensitive legal topics.
 */

import { createTheme } from '@mui/material/styles';
import { TYPOGRAPHY, RADIUS, SHADOWS, SPACING } from '../tokens';

export const CSS_VARS = {
  '--color-primary':        '#00695C',
  '--color-primary-light':  '#00897B',
  '--color-primary-dark':   '#004D40',
  '--color-primary-alpha':  'rgba(0, 105, 92, 0.13)',
  '--color-secondary':      '#558B2F',
  '--color-secondary-light':'#7CB342',
  '--color-secondary-alpha':'rgba(85, 139, 47, 0.12)',
  '--color-bg':             '#F0FDF4',
  '--color-surface':        '#FFFFFF',
  '--color-surface-raised': '#E8F5E9',
  '--color-text':           '#004D40',
  '--color-text-secondary': '#37474F',
  '--color-text-disabled':  '#78909C',
  '--color-border':         '#B2DFDB',
  '--color-border-strong':  '#80CBC4',
  '--color-success':        '#2E7D32',
  '--color-success-light':  '#E8F5E9',
  '--color-error':          '#C62828',
  '--color-error-light':    '#FFEBEE',
  '--color-warning':        '#BF6900',
  '--color-warning-light':  '#FFF8E1',
  '--color-info':           '#006064',
  '--color-info-light':     '#E0F7FA',
  '--color-overlay':        'rgba(0, 105, 92, 0.06)',
};

export const muiTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main:        '#00695C',
      light:       '#00897B',
      dark:        '#004D40',
      contrastText: '#FFFFFF',
    },
    secondary: {
      main:        '#558B2F',
      light:       '#7CB342',
      dark:        '#33691E',
      contrastText: '#FFFFFF',
    },
    background: {
      default: '#F0FDF4',
      paper:   '#FFFFFF',
    },
    text: {
      primary:   '#004D40',
      secondary: '#37474F',
      disabled:  '#78909C',
    },
    success: { main: '#2E7D32', light: '#E8F5E9' },
    error:   { main: '#C62828', light: '#FFEBEE' },
    warning: { main: '#BF6900', light: '#FFF8E1' },
    info:    { main: '#006064', light: '#E0F7FA' },
    divider: '#B2DFDB',
  },
  typography: {
    fontFamily: TYPOGRAPHY.fontFamily.body,
    h1: { fontFamily: TYPOGRAPHY.fontFamily.display, fontWeight: 700, letterSpacing: '-0.02em' },
    h2: { fontFamily: TYPOGRAPHY.fontFamily.display, fontWeight: 700, letterSpacing: '-0.01em' },
    h3: { fontFamily: TYPOGRAPHY.fontFamily.display, fontWeight: 600 },
    h4: { fontFamily: TYPOGRAPHY.fontFamily.display, fontWeight: 600 },
    h5: { fontFamily: TYPOGRAPHY.fontFamily.display, fontWeight: 600 },
    h6: { fontFamily: TYPOGRAPHY.fontFamily.display, fontWeight: 600 },
    body1: { fontFamily: TYPOGRAPHY.fontFamily.body, lineHeight: 1.65 },
    body2: { fontFamily: TYPOGRAPHY.fontFamily.body, lineHeight: 1.55 },
    button: { fontFamily: TYPOGRAPHY.fontFamily.body, fontWeight: 600, textTransform: 'none' },
  },
  shape: { borderRadius: RADIUS.md },
  spacing: SPACING.sm,
  components: {
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: RADIUS.md, fontWeight: 600, textTransform: 'none' },
        containedPrimary: {
          background: 'var(--color-primary)',
          '&:hover': { background: 'var(--color-primary-dark)' },
        },
      },
    },
    MuiPaper: {
      styleOverrides: { root: { backgroundImage: 'none' } },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: RADIUS.lg,
          border: '1px solid var(--color-border)',
        },
      },
    },
    MuiCssBaseline: {
      styleOverrides: `
        body { background-color: var(--color-bg); color: var(--color-text); }
        ::selection { background-color: var(--color-primary-alpha); color: var(--color-primary-dark); }
        a { color: var(--color-primary); }
        a:hover { color: var(--color-primary-light); }
      `,
    },
  },
});

export default { CSS_VARS, muiTheme };
