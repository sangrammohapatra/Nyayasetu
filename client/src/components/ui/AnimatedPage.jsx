/**
 * client/src/components/ui/AnimatedPage.jsx
 *
 * Framer Motion page-transition wrapper.
 * Wrap every page component with this to get consistent
 * opacity + vertical-slide transitions.
 *
 * Usage:
 *   <AnimatedPage>
 *     <DashboardContent />
 *   </AnimatedPage>
 *
 * For route-level transitions, ensure AnimatePresence wraps
 * the <Routes> block in App.jsx with mode="wait".
 */

import React from 'react';
import { motion } from 'framer-motion';

const pageVariants = {
  initial: {
    opacity: 0,
    y: 20,
  },
  animate: {
    opacity: 1,
    y: 0,
  },
  exit: {
    opacity: 0,
    y: -20,
  },
};

const pageTransition = {
  duration: 0.3,
  ease: 'easeOut',
};

/**
 * @param {object}  props
 * @param {React.ReactNode} props.children
 * @param {string}  [props.className]
 * @param {object}  [props.style]
 * @param {object}  [props.variants]      Override animation variants
 * @param {object}  [props.transition]    Override transition config
 */
function AnimatedPage({
  children,
  className,
  style,
  variants = pageVariants,
  transition = pageTransition,
  ...rest
}) {
  return (
    <motion.div
      variants={variants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={transition}
      className={className}
      style={{ width: '100%', ...style }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

export default AnimatedPage;

// ─── Convenience variants for different animation styles ─────────────────────

/** Fade-only (no vertical movement). Use for modal-like pages. */
export const fadeVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit:    { opacity: 0 },
};

/** Slide in from the right (for wizard steps / multi-step flows). */
export const slideRightVariants = {
  initial: { opacity: 0, x: 40 },
  animate: { opacity: 1, x: 0 },
  exit:    { opacity: 0, x: -40 },
};

/** Slide in from the left (back-navigation feel). */
export const slideLeftVariants = {
  initial: { opacity: 0, x: -40 },
  animate: { opacity: 1, x: 0 },
  exit:    { opacity: 0, x: 40 },
};

/** Scale-up (for dashboard cards / modals). */
export const scaleVariants = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1 },
  exit:    { opacity: 0, scale: 0.96 },
};
