/**
 * client/src/components/ui/GlassCard.jsx
 *
 * MUI Paper variant with glassmorphism styling.
 * All colours come from CSS custom properties — zero hardcoded hex.
 *
 * Props:
 *   elevation (0-3) — controls blur intensity (4 / 8 / 12 / 20 px)
 *   blur            — override blur in px
 *   alpha           — override surface alpha (0-1)
 *   borderAlpha     — override border alpha (0-1)
 *   sx              — MUI sx passthrough
 *   children
 *
 * Usage:
 *   <GlassCard elevation={2} sx={{ p: 3 }}>
 *     <Typography>...</Typography>
 *   </GlassCard>
 */

import React from 'react';
import Paper from '@mui/material/Paper';
import { styled } from '@mui/material/styles';
import { RADIUS } from '../../theme/tokens';

// Map MUI elevation levels to blur intensity
const BLUR_MAP = { 0: 4, 1: 8, 2: 12, 3: 20 };

// Styled base component — uses CSS custom properties only
const StyledGlass = styled(Paper, {
  shouldForwardProp: (prop) =>
    !['blurPx', 'surfaceAlpha', 'borderAlpha'].includes(prop),
})(({ blurPx, surfaceAlpha, borderAlpha }) => ({
  // Semi-transparent surface using the CSS custom property with alpha override
  backgroundColor: `color-mix(in srgb, var(--color-surface) ${Math.round(surfaceAlpha * 100)}%, transparent)`,
  // Fallback for browsers without color-mix support
  '@supports not (background-color: color-mix(in srgb, white 85%, transparent))': {
    backgroundColor: 'var(--color-surface)',
    opacity: surfaceAlpha,
  },
  backdropFilter: `blur(${blurPx}px)`,
  WebkitBackdropFilter: `blur(${blurPx}px)`,
  border: `1px solid color-mix(in srgb, var(--color-border) ${Math.round(borderAlpha * 100)}%, transparent)`,
  '@supports not (border-color: color-mix(in srgb, white 50%, transparent))': {
    border: '1px solid var(--color-border)',
  },
  borderRadius: RADIUS.lg,
  boxShadow: 'none',
  backgroundImage: 'none',
  // Smooth transitions when theme changes
  transition: 'background-color 0.3s ease, backdrop-filter 0.3s ease, border-color 0.3s ease',
}));

function GlassCard({
  children,
  elevation = 1,
  blur,
  alpha = 0.85,
  borderAlpha = 0.5,
  sx,
  ...props
}) {
  const blurPx = blur !== undefined ? blur : (BLUR_MAP[elevation] ?? BLUR_MAP[1]);

  return (
    <StyledGlass
      blurPx={blurPx}
      surfaceAlpha={alpha}
      borderAlpha={borderAlpha}
      elevation={0} // Disable MUI box-shadow — we handle it via glassmorphism
      sx={sx}
      {...props}
    >
      {children}
    </StyledGlass>
  );
}

export default GlassCard;
