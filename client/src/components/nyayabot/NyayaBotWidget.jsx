/**
 * NyayaBotWidget.jsx
 * The floating NyayaBot FAB + animated chat panel.
 * Renders globally via AppLayout — persists across page navigation.
 *
 * Changes from restyle (Chunk 4):
 * - FAB: 56×56, gradientBrand bg, glowPrimary shadow, responsive bottom position
 * - Mount animation: spring scale pop (gated by useReducedMotion)
 * - Pulse animation: gated by enableScrollReveal flag, disabled after first interaction
 * - Panel: 380×560 desktop, full-viewport mobile (<sm)
 * - Panel shell: GlassCard styling
 *
 * All existing logic preserved: FabLabel, session creation, toggleWidget, auth guard.
 */

import React, { useEffect, useState, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import Box from '@mui/material/Box';
import Badge from '@mui/material/Badge';
import Tooltip from '@mui/material/Tooltip';
import Fab from '@mui/material/Fab';
import { Balance, Close, AutoAwesome } from '@mui/icons-material';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  toggleWidget,
  createNyayaBotSession,
} from '../../store/slices/nyayabotSlice';
import { useFeatureFlag } from '../../utils/featureFlags';
import NyayaBotWindow from './NyayaBotWindow';
import { RADIUS, SHADOWS } from '../../theme/tokens';

// ─── Animated FAB label ───────────────────────────────────────────────────────

function FabLabel({ show }) {
  const { t } = useTranslation();
  const prefersReducedMotion = useReducedMotion();
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, x: 12, scale: 0.9 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={prefersReducedMotion ? undefined : { opacity: 0, x: 12, scale: 0.9 }}
          transition={{ duration: 0.2 }}
          style={{
            position: 'absolute',
            right: 64,
            bottom: 2,
            backgroundColor: 'var(--color-primary)',
            color: '#fff',
            fontSize: '0.78rem',
            fontWeight: 700,
            padding: '5px 12px',
            borderRadius: 20,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            boxShadow: '0 2px 12px rgba(0,0,0,0.18)',
            letterSpacing: '0.02em',
          }}
        >
          {t('nyayabot.fabLabel')}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Main widget ──────────────────────────────────────────────────────────────

export default function NyayaBotWidget() {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down('sm'));
  const prefersReducedMotion = useReducedMotion();
  const pulseEnabled = useFeatureFlag('enableScrollReveal');

  const isOpen = useSelector((s) => s.nyayabot.isWidgetOpen);
  const widgetSessionId = useSelector((s) => s.nyayabot.widgetSessionId);
  const creating = useSelector((s) => s.nyayabot.creating);
  const isAuthenticated = useSelector((s) => !!s.auth.token);

  const [showLabel, setShowLabel] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);

  // Show the FAB label after 3 seconds on first visit
  useEffect(() => {
    if (!isAuthenticated) return;
    const seen = localStorage.getItem('nyayabot_widget_seen');
    if (!seen) {
      const t1 = setTimeout(() => setShowLabel(true), 3000);
      const t2 = setTimeout(() => setShowLabel(false), 8000);
      localStorage.setItem('nyayabot_widget_seen', '1');
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
  }, [isAuthenticated]);

  // When widget opens, create a session if there isn't one yet
  useEffect(() => {
    if (isOpen && !widgetSessionId && !creating) {
      dispatch(createNyayaBotSession({ source: 'widget' }));
    }
  }, [isOpen, widgetSessionId, creating, dispatch]);

  // Don't render for unauthenticated users
  if (!isAuthenticated) return null;

  const handleFabClick = () => {
    setShowLabel(false);
    setHasInteracted(true);
    dispatch(toggleWidget());
  };

  const handleNewSession = () => {
    dispatch(createNyayaBotSession({ source: 'widget' }));
  };

  // Pulse: only when flag on + not interacted + widget closed
  const shouldPulse = pulseEnabled && !hasInteracted && !isOpen && !prefersReducedMotion;

  // Panel position + size — full-viewport on mobile, fixed popover on desktop
  const panelStyle = isMobile
    ? {
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        zIndex: 1400,
        borderRadius: 0,
        overflow: 'hidden',
      }
    : {
        position: 'fixed',
        bottom: 96,
        right: 24,
        width: 380,
        height: 560,
        zIndex: 1400,
        borderRadius: `${RADIUS.xl}px`,
        overflow: 'hidden',
        boxShadow: SHADOWS.xl,
      };

  const glowColor = muiTheme.custom?.glowPrimary || '0 0 28px rgba(21, 101, 192, 0.50)';
  const gradientBrand = muiTheme.custom?.gradientBrand || 'var(--color-primary)';

  return (
    <>
      {/* ── CHAT WINDOW PANEL ─────────────────────────────────────────── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="nyayabot-panel"
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 340, damping: 28 }}
            style={{
              ...panelStyle,
              background: muiTheme.custom?.cardBg || muiTheme.palette.background.paper,
              border: muiTheme.custom?.cardBorder || '1px solid var(--color-border)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {widgetSessionId ? (
              <NyayaBotWindow
                sessionId={widgetSessionId}
                compact
                onClose={() => dispatch(toggleWidget())}
                onNewSession={handleNewSession}
              />
            ) : (
              // Loading skeleton while session creates
              <Box
                sx={{
                  flex: 1, display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  gap: 2, color: 'var(--color-text-secondary)',
                  background: 'var(--color-bg)',
                }}
              >
                <motion.div
                  animate={prefersReducedMotion ? undefined : { rotate: [0, 8, -8, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <Balance sx={{ fontSize: 40, color: 'var(--color-primary)' }} />
                </motion.div>
                <Box sx={{ fontSize: '0.85rem' }}>{t('nyayabot.loading')}</Box>
              </Box>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── FAB BUTTON ───────────────────────────────────────────────────── */}
      <Box
        sx={{
          position: 'fixed',
          bottom: { xs: 80, md: 24 },
          right: 24,
          zIndex: 1400,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <FabLabel show={showLabel && !isOpen} />

        {/* Mount spring pop */}
        <motion.div
          initial={prefersReducedMotion ? {} : { scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 280, damping: 22, delay: 0.3 }}
        >
          {/* Pulse ring — only when shouldPulse */}
          <motion.div
            animate={shouldPulse ? { scale: [1, 1.05, 1] } : { scale: 1 }}
            transition={shouldPulse
              ? { duration: 3, repeat: Infinity, ease: 'easeInOut' }
              : { duration: 0 }}
          >
            <Tooltip
              title={isOpen ? t('nyayabot.close') : t('nyayabot.openBot')}
              placement="left"
            >
              <Fab
                onClick={handleFabClick}
                aria-label="NyayaBot"
                sx={{
                  width: 56, height: 56,
                  background: isOpen ? 'var(--color-text-secondary)' : gradientBrand,
                  color: '#fff',
                  boxShadow: isOpen ? SHADOWS.md : glowColor,
                  '&:hover': {
                    background: isOpen ? 'var(--color-text)' : gradientBrand,
                    boxShadow: isOpen ? SHADOWS.md : `${glowColor}, 0 6px 24px rgba(0,0,0,0.18)`,
                    transform: 'scale(1.06)',
                  },
                  '&:active': { transform: 'scale(0.97)' },
                  transition: 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
                }}
              >
                <AnimatePresence mode="wait">
                  {isOpen ? (
                    <motion.div
                      key="close"
                      initial={prefersReducedMotion ? false : { rotate: -90, opacity: 0 }}
                      animate={{ rotate: 0, opacity: 1 }}
                      exit={prefersReducedMotion ? undefined : { rotate: 90, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Close />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="open"
                      initial={prefersReducedMotion ? false : { rotate: 90, opacity: 0 }}
                      animate={{ rotate: 0, opacity: 1 }}
                      exit={prefersReducedMotion ? undefined : { rotate: -90, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <AutoAwesome sx={{ fontSize: 24 }} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </Fab>
            </Tooltip>
          </motion.div>
        </motion.div>
      </Box>
    </>
  );
}
