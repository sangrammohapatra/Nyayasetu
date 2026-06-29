/**
 * client/src/components/ui/GlassCard.jsx
 *
 * Theme-aware card primitive. Styling comes from theme.custom tokens.
 * Blur is gated behind featureFlags.enableBlur (OFF by default).
 *
 * Props (new):
 *   as         — override the rendered HTML element (e.g. 'article', 'section')
 *   hoverable  — enable -6px lift on hover (requires enableHoverLift flag + no reduced motion)
 *
 * Props (preserved from v1):
 *   elevation  — kept for API compat (no longer drives blur intensity)
 *   blur       — kept for API compat
 *   alpha      — kept for API compat
 *   borderAlpha — kept for API compat
 *   sx         — MUI sx passthrough
 *   children
 */

import React from 'react';
import Paper from '@mui/material/Paper';
import { useTheme } from '@mui/material/styles';
import { motion, useReducedMotion } from 'framer-motion';
import { useFeatureFlag } from '../../utils/featureFlags';

// motion.create() wraps MUI Paper so we can use whileHover / whileTap without
// an extra wrapper DOM node.
const MotionPaper = motion.create(Paper);

function GlassCard({
  children,
  // backward-compat props (no longer control styling, retained for API stability)
  elevation,    // eslint-disable-line no-unused-vars
  blur,         // eslint-disable-line no-unused-vars
  alpha,        // eslint-disable-line no-unused-vars
  borderAlpha,  // eslint-disable-line no-unused-vars
  // new props
  as,
  hoverable = false,
  sx,
  ...props
}) {
  const theme = useTheme();
  const prefersReducedMotion = useReducedMotion();
  const blurEnabled = useFeatureFlag('enableBlur');
  const hoverLiftEnabled = useFeatureFlag('enableHoverLift');

  const shouldLift = hoverable && hoverLiftEnabled && !prefersReducedMotion;

  const cardSx = {
    background: theme.custom.cardBg,
    border: theme.custom.cardBorder,
    boxShadow: theme.custom.cardShadow,
    borderRadius: 3,
    backgroundImage: 'none',
    transition: 'box-shadow 0.25s ease, border-color 0.25s ease',
    ...(blurEnabled && {
      backdropFilter: theme.custom.cardBlur,
      WebkitBackdropFilter: theme.custom.cardBlur,
    }),
    ...sx,
  };

  const motionProps = shouldLift
    ? {
        whileHover: { y: -6 },
        transition: { type: 'spring', stiffness: 300, damping: 20 },
      }
    : {};

  // Use MotionPaper always so the component type stays stable across renders.
  return (
    <MotionPaper
      component={as}
      elevation={0}
      sx={cardSx}
      {...motionProps}
      {...props}
    >
      {children}
    </MotionPaper>
  );
}

export default GlassCard;
