/**
 * client/src/theme/themes/saffron.js
 *
 * India-inspired — Saffron (#FF6F00) + India Green (#1B5E20).
 * Evokes the Indian tricolour: saffron courage, white purity, green prosperity.
 */

import { createTheme } from '@mui/material/styles';
import { TYPOGRAPHY, RADIUS, SHADOWS, SPACING } from '../tokens';

export const CSS_VARS = {
  '--color-primary':        '#FF6F00',
  '--color-primary-light':  '#FFA000',
  '--color-primary-dark':   '#E65100',
  '--color-primary-alpha':  'rgba(255, 111, 0, 0.14)',
  '--color-secondary':      '#1B5E20',
  '--color-secondary-light':'#43A047',
  '--color-secondary-alpha':'rgba(27, 94, 32, 0.12)',
  '--color-bg':             '#FFFBF0',
  '--color-surface':        '#FFFFFF',
  '--color-surface-raised': '#FFF8E1',
  '--color-text':           '#1A1200',
  '--color-text-secondary': '#5D4037',
  '--color-text-disabled':  '#A1887F',
  '--color-border':         '#FFE0B2',
  '--color-border-strong':  '#FFCC80',
  '--color-success':        '#1B5E20',
  '--color-success-light':  '#E8F5E9',
  '--color-error':          '#B71C1C',
  '--color-error-light':    '#FFEBEE',
  '--color-warning':        '#FF6F00',
  '--color-warning-light':  '#FFF8E1',
  '--color-info':           '#01579B',
  '--color-info-light':     '#E1F5FE',
  '--color-overlay':        'rgba(255, 111, 0, 0.06)',
};

export const muiTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main:        '#FF6F00',
      light:       '#FFA000',
      dark:        '#E65100',
      contrastText: '#FFFFFF',
    },
    secondary: {
      main:        '#1B5E20',
      light:       '#43A047',
      dark:        '#1A4E23',
      contrastText: '#FFFFFF',
    },
    background: {
      default: '#FFFBF0',
      paper:   '#FFFFFF',
    },
    text: {
      primary:   '#1A1200',
      secondary: '#5D4037',
      disabled:  '#A1887F',
    },
    success: { main: '#1B5E20', light: '#E8F5E9' },
    error:   { main: '#B71C1C', light: '#FFEBEE' },
    warning: { main: '#FF6F00', light: '#FFF8E1' },
    info:    { main: '#01579B', light: '#E1F5FE' },
    divider: '#FFE0B2',
  },
  typography: {
    fontFamily: TYPOGRAPHY.fontFamily.body,
    h1: { fontFamily: TYPOGRAPHY.fontFamily.display, fontWeight: 700, letterSpacing: '-0.02em' },
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
    gradientText:  'linear-gradient(130deg, #FF6F00 0%, #01579B 100%)',
    gradientBrand: 'linear-gradient(135deg, #FF6F00 0%, #1B5E20 60%, #01579B 100%)',
    glowPrimary:   '0 0 28px rgba(255, 111, 0, 0.50)',
    glowAccent:    '0 0 28px rgba(1, 87, 155, 0.45)',
    cardBg:        '#FFFFFF',
    cardBorder:    '1px solid #FFE0B2',
    cardBlur:      'blur(12px)',
    cardShadow:    '0 6px 28px rgba(18,23,43,0.07)',
    darkStrip:     '#0F1623',
    focusRing:     '0 0 0 3px rgba(255, 111, 0, 0.35)',
  },
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
        root: { borderRadius: RADIUS.lg, border: '1px solid var(--color-border)' },
      },
    },
    MuiCssBaseline: {
      styleOverrides: `
        body { background-color: var(--color-bg); color: var(--color-text); }
        ::selection { background-color: var(--color-primary-alpha); color: var(--color-primary-dark); }
        a { color: var(--color-primary); }
      `,
    },
  },
});

export default { CSS_VARS, muiTheme };
