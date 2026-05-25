/**
 * client/src/theme/themes/highContrast.js
 *
 * Accessibility — Black on White with minimum 7:1 contrast ratios.
 * Complies with WCAG 2.1 AAA standard.
 * Designed for users with visual impairments.
 */

import { createTheme } from '@mui/material/styles';
import { TYPOGRAPHY, RADIUS, SPACING } from '../tokens';

// High-contrast shadows use black with higher opacity to remain visible
const HC_SHADOWS = {
  sm: '0 1px 3px rgba(0,0,0,0.45)',
  md: '0 4px 12px rgba(0,0,0,0.50)',
  lg: '0 8px 24px rgba(0,0,0,0.55)',
};

export const CSS_VARS = {
  '--color-primary':        '#0000CC',
  '--color-primary-light':  '#0000FF',
  '--color-primary-dark':   '#000099',
  '--color-primary-alpha':  'rgba(0, 0, 204, 0.12)',
  '--color-secondary':      '#660000',
  '--color-secondary-light':'#990000',
  '--color-secondary-alpha':'rgba(102, 0, 0, 0.12)',
  '--color-bg':             '#FFFFFF',
  '--color-surface':        '#FFFFFF',
  '--color-surface-raised': '#F5F5F5',
  '--color-text':           '#000000',
  '--color-text-secondary': '#1A1A1A',
  '--color-text-disabled':  '#595959',  // still 7:1 on white
  '--color-border':         '#000000',
  '--color-border-strong':  '#000000',
  '--color-success':        '#004D00',
  '--color-success-light':  '#F0FFF0',
  '--color-error':          '#8B0000',
  '--color-error-light':    '#FFF0F0',
  '--color-warning':        '#663300',
  '--color-warning-light':  '#FFFFF0',
  '--color-info':           '#00008B',
  '--color-info-light':     '#F0F0FF',
  '--color-overlay':        'rgba(0, 0, 0, 0.06)',
};

export const muiTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main:        '#0000CC',
      light:       '#0000FF',
      dark:        '#000099',
      contrastText: '#FFFFFF',
    },
    secondary: {
      main:        '#660000',
      light:       '#990000',
      dark:        '#440000',
      contrastText: '#FFFFFF',
    },
    background: {
      default: '#FFFFFF',
      paper:   '#FFFFFF',
    },
    text: {
      primary:   '#000000',
      secondary: '#1A1A1A',
      disabled:  '#595959',
    },
    success: { main: '#004D00', light: '#F0FFF0' },
    error:   { main: '#8B0000', light: '#FFF0F0' },
    warning: { main: '#663300', light: '#FFFFF0' },
    info:    { main: '#00008B', light: '#F0F0FF' },
    divider: '#000000',
  },
  typography: {
    fontFamily: TYPOGRAPHY.fontFamily.body,
    fontSize: 16, // Larger base font for accessibility
    h1: { fontFamily: TYPOGRAPHY.fontFamily.display, fontWeight: 800, letterSpacing: '-0.01em', color: '#000000' },
    h2: { fontFamily: TYPOGRAPHY.fontFamily.display, fontWeight: 800 },
    h3: { fontFamily: TYPOGRAPHY.fontFamily.display, fontWeight: 700 },
    h4: { fontFamily: TYPOGRAPHY.fontFamily.display, fontWeight: 700 },
    h5: { fontFamily: TYPOGRAPHY.fontFamily.display, fontWeight: 700 },
    h6: { fontFamily: TYPOGRAPHY.fontFamily.display, fontWeight: 700 },
    body1: { fontFamily: TYPOGRAPHY.fontFamily.body, lineHeight: 1.7, fontSize: '1rem' },
    body2: { fontFamily: TYPOGRAPHY.fontFamily.body, lineHeight: 1.6, fontSize: '0.9375rem' },
    button: {
      fontFamily: TYPOGRAPHY.fontFamily.body,
      fontWeight: 700,
      textTransform: 'none',
      fontSize: '1rem',
    },
  },
  shape: { borderRadius: RADIUS.sm }, // Sharper corners are easier to perceive
  spacing: SPACING.sm,
  shadows: [
    'none',
    HC_SHADOWS.sm, HC_SHADOWS.sm,
    HC_SHADOWS.md, HC_SHADOWS.md, HC_SHADOWS.md,
    HC_SHADOWS.lg, HC_SHADOWS.lg, HC_SHADOWS.lg, HC_SHADOWS.lg,
    HC_SHADOWS.lg, HC_SHADOWS.lg, HC_SHADOWS.lg, HC_SHADOWS.lg,
    HC_SHADOWS.lg, HC_SHADOWS.lg, HC_SHADOWS.lg, HC_SHADOWS.lg,
    HC_SHADOWS.lg, HC_SHADOWS.lg, HC_SHADOWS.lg, HC_SHADOWS.lg,
    HC_SHADOWS.lg, HC_SHADOWS.lg, HC_SHADOWS.lg,
  ],
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: RADIUS.sm,
          fontWeight: 700,
          textTransform: 'none',
          border: '2px solid transparent',
          '&:focus-visible': {
            outline: '3px solid var(--color-primary)',
            outlineOffset: '2px',
          },
        },
        containedPrimary: {
          background: 'var(--color-primary)',
          border: '2px solid var(--color-primary-dark)',
          '&:hover': {
            background: 'var(--color-primary-dark)',
          },
        },
        outlinedPrimary: {
          borderColor: 'var(--color-primary)',
          borderWidth: '2px',
          '&:hover': { borderWidth: '2px' },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          border: '1px solid var(--color-border)',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: RADIUS.sm,
          border: '2px solid var(--color-border)',
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            '& fieldset': {
              borderColor: 'var(--color-border)',
              borderWidth: '2px',
            },
            '&:hover fieldset': { borderWidth: '2px' },
            '&.Mui-focused fieldset': { borderWidth: '3px' },
          },
        },
      },
    },
    MuiLink: {
      styleOverrides: {
        root: {
          textDecoration: 'underline',
          textDecorationThickness: '2px',
          textUnderlineOffset: '3px',
        },
      },
    },
    MuiCssBaseline: {
      styleOverrides: `
        body {
          background-color: var(--color-bg);
          color: var(--color-text);
          font-size: 16px;
          line-height: 1.7;
        }
        *:focus-visible {
          outline: 3px solid var(--color-primary);
          outline-offset: 2px;
        }
        ::selection { background-color: #0000CC; color: #FFFFFF; }
        a { color: var(--color-primary); text-decoration: underline; text-underline-offset: 3px; }
        a:visited { color: var(--color-secondary); }
      `,
    },
  },
});

export default { CSS_VARS, muiTheme };
