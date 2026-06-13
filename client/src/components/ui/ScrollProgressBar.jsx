import React from 'react';
import { motion, useScroll, useSpring, useReducedMotion } from 'framer-motion';
import { useTheme } from '@mui/material/styles';
import { useFeatureFlag } from '../../utils/featureFlags';

export default function ScrollProgressBar() {
  const enabled = useFeatureFlag('enableScrollProgress');
  const prefersReducedMotion = useReducedMotion();
  const muiTheme = useTheme();
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 120, damping: 30, restDelta: 0.001 });

  if (!enabled || prefersReducedMotion) return null;

  return (
    <motion.div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: 3,
        zIndex: 2000,
        transformOrigin: '0%',
        scaleX,
        background: muiTheme.custom?.gradientBrand || 'var(--color-primary)',
        pointerEvents: 'none',
      }}
    />
  );
}
