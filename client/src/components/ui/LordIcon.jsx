/**
 * client/src/components/ui/LordIcon.jsx
 *
 * Thin React wrapper around <lord-icon> from @lordicon/element.
 * defineElement() must be called once in main.jsx before use.
 *
 * Props:
 *   src      — Lordicon CDN URL or local JSON path  (required)
 *   trigger  — "hover" | "click" | "loop" | "loop-on-hover" | "boomerang" | "in"
 *   target   — CSS selector of the ancestor that owns the hover target
 *   size     — pixel size for width + height (default 32)
 *   colors   — explicit color string, e.g. "primary:#1565C0,secondary:#5C9BF5"
 *   tint     — CSS color applied to both --lord-icon-primary/secondary CSS vars;
 *              ignored when `colors` is also set
 *   glow     — boolean; wraps icon in a Box that shows theme.custom.glowAccent
 *              as a box-shadow (useful for hero icons)
 *   style    — extra inline styles merged onto the <lord-icon> element
 */

import React from 'react';
import Box from '@mui/material/Box';
import { useTheme } from '@mui/material/styles';

export default function LordIcon({
  src,
  trigger = 'hover',
  target,
  size = 32,
  colors,
  tint,
  glow = false,
  style,
  ...rest
}) {
  const theme = useTheme();

  const icon = (
    <lord-icon
      src={src}
      trigger={trigger}
      target={target}
      colors={colors}
      style={{
        width: size,
        height: size,
        display: 'block',
        flexShrink: 0,
        '--lord-icon-primary': tint || 'currentColor',
        '--lord-icon-secondary': tint || 'currentColor',
        ...style,
      }}
      {...rest}
    />
  );

  if (!glow) return icon;

  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '50%',
        boxShadow: theme.custom?.glowAccent,
        transition: 'box-shadow 0.25s ease',
      }}
    >
      {icon}
    </Box>
  );
}
