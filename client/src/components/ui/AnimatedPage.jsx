/**
 * client/src/components/ui/AnimatedPage.jsx
 *
 * Framer Motion page-transition wrapper.
 * Wrap every page component with this to get consistent
 * opacity + vertical-slide transitions.
 *
 * Animation is skipped entirely when:
 *   - useReducedMotion() is true (OS-level preference), OR
 *   - featureFlags.enablePageTransitions is false
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
import { motion, useReducedMotion } from 'framer-motion';
import { useFeatureFlag } from '../../utils/featureFlags';

const PAGE_VARIANTS = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit:    { opacity: 0, y: -8 },
};

const PAGE_TRANSITION = {
  duration: 0.3,
  ease: 'easeInOut',
};

/**
 * @param {object}  props
 * @param {React.ReactNode} props.children
 * @param {string}  [props.className]
 * @param {object}  [props.style]
 * @param {object}  [props.variants]    Override animation variants
 * @param {object}  [props.transition]  Override transition config
 */
function AnimatedPage({
  children,
  className,
  style,
  variants = PAGE_VARIANTS,
  transition = PAGE_TRANSITION,
  ...rest
}) {
  const prefersReducedMotion = useReducedMotion();
  const pageTransitionsEnabled = useFeatureFlag('enablePageTransitions');

  const skip = prefersReducedMotion || !pageTransitionsEnabled;

  return (
    <motion.div
      variants={skip ? undefined : variants}
      initial={skip ? false : 'initial'}
      animate={skip ? undefined : 'animate'}
      exit={skip ? undefined : 'exit'}
      transition={skip ? undefined : transition}
      className={className}
      style={{ width: '100%', ...style }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

export default AnimatedPage;

// ─── Convenience variants — reused across the app ────────────────────────────

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

/**
 * Scroll-reveal transition — use with whileInView for entrance animations.
 * Gate with useFeatureFlag('enableScrollReveal') before applying.
 *
 * Usage:
 *   const shouldReveal = useFeatureFlag('enableScrollReveal') && !prefersReducedMotion;
 *   <motion.div
 *     initial={shouldReveal ? SCROLL_REVEAL.initial : false}
 *     whileInView={SCROLL_REVEAL.whileInView}
 *     viewport={SCROLL_REVEAL.viewport}
 *     transition={SCROLL_REVEAL.transition}
 *   >
 */
export const SCROLL_REVEAL = {
  initial:    { opacity: 0, y: 36 },
  whileInView: { opacity: 1, y: 0 },
  viewport:   { once: true, margin: '-60px' },
  transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
};
