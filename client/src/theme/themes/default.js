/**
 * client/src/theme/themes/default.js
 *
 * Blue Justice — the primary NyayaSetu brand theme.
 * Deep Blue (#1565C0) on Off-White (#F8FAFF).
 */

import { createTheme } from '@mui/material/styles';
import { TYPOGRAPHY, RADIUS, SHADOWS, SPACING } from '../tokens';

export const CSS_VARS = {
  '--color-primary':        '#1565C0',
  '--color-primary-light':  '#1E88E5',
  '--color-primary-dark':   '#0D47A1',
  '--color-primary-alpha':  'rgba(21, 101, 192, 0.15)',
  '--color-secondary':      '#E65100',
  '--color-secondary-light':'#FF8A50',
  '--color-secondary-alpha':'rgba(230, 81, 0, 0.12)',
  '--color-bg':             '#F8FAFF',
  '--color-surface':        '#FFFFFF',
  '--color-surface-raised': '#F0F4FF',
  '--color-text':           '#1A1A2E',
  '--color-text-secondary': '#5C6BC0',
  '--color-text-disabled':  '#9E9E9E',
  '--color-border':         '#E8EAF6',
  '--color-border-strong':  '#C5CAE9',
  '--color-success':        '#2E7D32',
  '--color-success-light':  '#E8F5E9',
  '--color-error':          '#C62828',
  '--color-error-light':    '#FFEBEE',
  '--color-warning':        '#E65100',
  '--color-warning-light':  '#FFF3E0',
  '--color-info':           '#0277BD',
  '--color-info-light':     '#E1F5FE',
  '--color-overlay':        'rgba(21, 101, 192, 0.06)',
};

export const muiTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main:        '#1565C0',
      light:       '#1E88E5',
      dark:        '#0D47A1',
      contrastText: '#FFFFFF',
    },
    secondary: {
      main:        '#E65100',
      light:       '#FF8A50',
      dark:        '#BF360C',
      contrastText: '#FFFFFF',
    },
    background: {
      default: '#F8FAFF',
      paper:   '#FFFFFF',
    },
    text: {
      primary:   '#1A1A2E',
      secondary: '#5C6BC0',
      disabled:  '#9E9E9E',
    },
    success: { main: '#2E7D32', light: '#E8F5E9' },
    error:   { main: '#C62828', light: '#FFEBEE' },
    warning: { main: '#E65100', light: '#FFF3E0' },
    info:    { main: '#0277BD', light: '#E1F5FE' },
    divider: '#E8EAF6',
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
    caption: { fontFamily: TYPOGRAPHY.fontFamily.body },
    overline: { fontFamily: TYPOGRAPHY.fontFamily.body, letterSpacing: '0.08em' },
    button: { fontFamily: TYPOGRAPHY.fontFamily.body, fontWeight: 600, textTransform: 'none' },
    code: { fontFamily: TYPOGRAPHY.fontFamily.mono },
  },
  shape: { borderRadius: RADIUS.md },
  spacing: SPACING.sm,
  shadows: [
    'none',
    SHADOWS.sm,
    SHADOWS.md,
    SHADOWS.md,
    SHADOWS.lg,
    SHADOWS.lg,
    SHADOWS.lg,
    SHADOWS.xl,
    SHADOWS.xl,
    SHADOWS.xl,
    SHADOWS.xl,
    SHADOWS.xl,
    SHADOWS.xl,
    SHADOWS.xl,
    SHADOWS.xl,
    SHADOWS.xl,
    SHADOWS.xl,
    SHADOWS.xl,
    SHADOWS.xl,
    SHADOWS.xl,
    SHADOWS.xl,
    SHADOWS.xl,
    SHADOWS.xl,
    SHADOWS.xl,
    SHADOWS.xl,
  ],
  custom: {
    gradientText:  'linear-gradient(130deg, #1565C0 0%, #0277BD 100%)',
    gradientBrand: 'linear-gradient(135deg, #1565C0 0%, #E65100 60%, #0277BD 100%)',
    glowPrimary:   '0 0 28px rgba(21, 101, 192, 0.50)',
    glowAccent:    '0 0 28px rgba(2, 119, 189, 0.45)',
    cardBg:        '#FFFFFF',
    cardBorder:    '1px solid #E8EAF6',
    cardBlur:      'blur(12px)',
    cardShadow:    '0 6px 28px rgba(18,23,43,0.07)',
    darkStrip:     '#0F1623',
    focusRing:     '0 0 0 3px rgba(21, 101, 192, 0.35)',
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: RADIUS.md,
          fontWeight: 600,
          textTransform: 'none',
          padding: `${SPACING.sm}px ${SPACING.lg}px`,
        },
        containedPrimary: {
          background: 'var(--color-primary)',
          '&:hover': { background: 'var(--color-primary-dark)' },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: 'none' },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: RADIUS.lg,
          border: '1px solid var(--color-border)',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: RADIUS.full },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: RADIUS.md,
            '& fieldset': { borderColor: 'var(--color-border)' },
          },
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          borderRadius: RADIUS.sm,
          fontSize: '0.75rem',
        },
      },
    },
    MuiCssBaseline: {
      styleOverrides: (themeParam) => `
        *, *::before, *::after { box-sizing: border-box; }
        html { scroll-behavior: smooth; }
        body {
          background-color: var(--color-bg);
          color: var(--color-text);
          font-family: ${TYPOGRAPHY.fontFamily.body};
        }
        ::selection {
          background-color: var(--color-primary-alpha);
          color: var(--color-primary);
        }
        code, pre, kbd, samp {
          font-family: ${TYPOGRAPHY.fontFamily.mono};
        }
        a { color: var(--color-primary); }
        a:hover { color: var(--color-primary-light); }
        ::-webkit-scrollbar { width: 7px; height: 7px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${themeParam.custom?.gradientBrand || themeParam.palette.primary.main}; border-radius: 9999px; }
        ::-webkit-scrollbar-thumb:hover { filter: brightness(1.15); }
      `,
    },
  },
});

export default { CSS_VARS, muiTheme };
