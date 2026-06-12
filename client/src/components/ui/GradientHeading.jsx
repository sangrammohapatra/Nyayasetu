/**
 * client/src/components/ui/GradientHeading.jsx
 *
 * Typography variant with gradient text sourced from theme.custom.gradientText.
 * Works for both Latin (Playfair Display) and Devanagari (Tiro Devanagari Hindi)
 * scripts — background-clip:text is script-agnostic.
 *
 * Props:
 *   variant   — MUI Typography variant (default 'h2')
 *   component — override the rendered HTML element
 *   sx        — sx passthrough (merged last, can override gradient)
 *   children
 *   ...rest   — forwarded to Typography
 */

import React from 'react';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';

function GradientHeading({ variant = 'h2', component, children, sx, ...rest }) {
  const theme = useTheme();

  return (
    <Typography
      variant={variant}
      component={component || variant}
      sx={{
        // Fallback: primary color when background-clip:text is unsupported
        color: theme.palette.primary.main,
        background: theme.custom.gradientText,
        // When supported, render background through glyph shapes
        '@supports (-webkit-background-clip: text) or (background-clip: text)': {
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          color: 'transparent',
          WebkitTextFillColor: 'transparent',
        },
        ...sx,
      }}
      {...rest}
    >
      {children}
    </Typography>
  );
}

export default GradientHeading;
