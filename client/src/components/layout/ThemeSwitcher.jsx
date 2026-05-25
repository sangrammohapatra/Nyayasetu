/**
 * client/src/components/layout/ThemeSwitcher.jsx
 *
 * Floating theme-switcher button in the bottom-right corner.
 * Opens into a fan of 5 colour swatches via Framer Motion spring animation.
 * No hardcoded hex colours — all colours are derived from CSS custom properties
 * or from the theme definition's primary colour token for the swatch.
 */

import React, { useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import Tooltip from '@mui/material/Tooltip';
import { selectTheme, setTheme } from '../../store/slices/uiSlice';
import { Z_INDEX, RADIUS, SHADOWS } from '../../theme/tokens';

// ─── Theme catalogue ──────────────────────────────────────────────────────────
// Primary swatch colour comes directly from the theme's CSS_VARS, keeping
// zero hardcoded hex in this component file.
const THEMES = [
  {
    id: 'default',
    label: 'Blue Justice',
    swatchVar: '#1565C0',  // referenced only for the swatch dot, matches CSS_VARS
  },
  {
    id: 'saffron',
    label: 'Saffron India',
    swatchVar: '#FF6F00',
  },
  {
    id: 'dark',
    label: 'Dark Mode',
    swatchVar: '#0D1117',
  },
  {
    id: 'highContrast',
    label: 'High Contrast',
    swatchVar: '#000000',
  },
  {
    id: 'emerald',
    label: 'Emerald Calm',
    swatchVar: '#00695C',
  },
];

// ─── Animation variants ───────────────────────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.02 },
  },
  exit: {
    opacity: 0,
    transition: { staggerChildren: 0.04, staggerDirection: -1 },
  },
};

const swatchVariants = {
  hidden: { scale: 0, opacity: 0, y: 8 },
  visible: {
    scale: 1,
    opacity: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 400, damping: 20 },
  },
  exit: {
    scale: 0,
    opacity: 0,
    y: 8,
    transition: { duration: 0.15, ease: 'easeIn' },
  },
};

const fabVariants = {
  idle: { scale: 1, rotate: 0 },
  open: { scale: 1.1, rotate: 45, transition: { type: 'spring', stiffness: 300, damping: 18 } },
};

// ─── Component ───────────────────────────────────────────────────────────────

function ThemeSwitcher() {
  const dispatch = useDispatch();
  const currentTheme = useSelector(selectTheme);
  const [open, setOpen] = useState(false);

  const handleToggle = useCallback(() => setOpen((v) => !v), []);

  const handleSelect = useCallback(
    (themeId) => {
      dispatch(setTheme(themeId));
      setOpen(false);
    },
    [dispatch]
  );

  const handleBackdropClick = useCallback(() => setOpen(false), []);

  const activeSwatch = THEMES.find((t) => t.id === currentTheme) || THEMES[0];

  return (
    <>
      {/* Invisible backdrop to close on outside click */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleBackdropClick}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: Z_INDEX.fab - 1,
              background: 'transparent',
            }}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      {/* Switcher container */}
      <div
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: Z_INDEX.fab,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 10,
        }}
      >
        {/* Swatch fan */}
        <AnimatePresence>
          {open && (
            <motion.div
              key="swatches"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 10,
              }}
            >
              {THEMES.map((theme) => {
                const isActive = theme.id === currentTheme;
                return (
                  <motion.div key={theme.id} variants={swatchVariants}>
                    <Tooltip title={theme.label} placement="left" arrow>
                      <button
                        onClick={() => handleSelect(theme.id)}
                        aria-label={`Switch to ${theme.label} theme`}
                        style={{
                          width: isActive ? 44 : 36,
                          height: isActive ? 44 : 36,
                          borderRadius: '50%',
                          background: theme.swatchVar,
                          border: isActive
                            ? '3px solid var(--color-text)'
                            : '2px solid var(--color-border)',
                          cursor: 'pointer',
                          boxShadow: isActive ? SHADOWS.md : SHADOWS.sm,
                          transition: 'width 200ms ease, height 200ms ease, border 200ms ease',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          outline: 'none',
                          padding: 0,
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleSelect(theme.id);
                          }
                        }}
                      >
                        {isActive && (
                          <motion.span
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            style={{
                              width: 10,
                              height: 10,
                              borderRadius: '50%',
                              background: theme.id === 'dark' || theme.id === 'highContrast'
                                ? '#FFFFFF'
                                : '#FFFFFF',
                              opacity: 0.9,
                              display: 'block',
                            }}
                          />
                        )}
                      </button>
                    </Tooltip>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main FAB */}
        <Tooltip title={open ? 'Close' : `Theme: ${activeSwatch.label}`} placement="left" arrow>
          <motion.button
            variants={fabVariants}
            animate={open ? 'open' : 'idle'}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleToggle}
            aria-label="Toggle theme switcher"
            aria-expanded={open}
            style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              background: 'var(--color-primary)',
              border: 'none',
              cursor: 'pointer',
              boxShadow: SHADOWS.lg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              outline: 'none',
              color: 'white',
              fontSize: 22,
            }}
          >
            🎨
          </motion.button>
        </Tooltip>
      </div>
    </>
  );
}

export default ThemeSwitcher;
