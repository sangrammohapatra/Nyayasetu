/**
 * NyayaBotWidget.jsx
 * The floating NyayaBot button and expandable chat window.
 * Renders globally via MainLayout — persists across page navigation.
 *
 * Widget is a scales-of-justice FAB (bottom-right).
 * Clicking opens an animated panel (360×520px) above the button.
 * Collapses back to FAB on close.
 *
 * Usage:
 *   Place once in MainLayout.jsx (or equivalent global layout):
 *   <NyayaBotWidget />
 */

import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Box, Badge, Tooltip, Fab, Paper } from '@mui/material';
import { Balance, Close } from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import {
  toggleWidget,
  createNyayaBotSession,
  openWidget,
} from '../../store/slices/nyayabotSlice';
import NyayaBotWindow from './NyayaBotWindow';

// ─── Animated FAB label ───────────────────────────────────────────────────────
function FabLabel({ show }) {
  const { t } = useTranslation();
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, x: 12, scale: 0.9 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: 12, scale: 0.9 }}
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

  const isOpen = useSelector((s) => s.nyayabot.isWidgetOpen);
  const widgetSessionId = useSelector((s) => s.nyayabot.widgetSessionId);
  const creating = useSelector((s) => s.nyayabot.creating);
  const isAuthenticated = useSelector((s) => !!s.auth.token);
  const [showLabel, setShowLabel] = React.useState(false);

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
    dispatch(toggleWidget());
  };

  const handleNewSession = () => {
    dispatch(createNyayaBotSession({ source: 'widget' }));
  };

  return (
    <>
      {/* ── CHAT WINDOW PANEL ─────────────────────────────────────────── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="nyayabot-panel"
            initial={{ opacity: 0, scale: 0.88, y: 24, transformOrigin: 'bottom right' }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.88, y: 24 }}
            transition={{ type: 'spring', stiffness: 340, damping: 28 }}
            style={{
              position: 'fixed',
              bottom: 88,
              right: 20,
              width: 360,
              height: 530,
              zIndex: 1400,
              borderRadius: 16,
              overflow: 'hidden',
              boxShadow: '0 12px 48px rgba(0,0,0,0.22), 0 4px 16px rgba(0,0,0,0.12)',
            }}
          >
            <Paper
              elevation={0}
              sx={{
                height: '100%', borderRadius: '16px', overflow: 'hidden',
                bgcolor: 'var(--color-bg)',
                border: '1px solid var(--color-border)',
                display: 'flex', flexDirection: 'column',
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
                  }}
                >
                  <motion.div
                    animate={{ rotate: [0, 8, -8, 0] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <Balance sx={{ fontSize: 40, color: 'var(--color-primary)' }} />
                  </motion.div>
                  <Box sx={{ fontSize: '0.85rem' }}>{t('nyayabot.loading')}</Box>
                </Box>
              )}
            </Paper>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── FAB BUTTON ───────────────────────────────────────────────────── */}
      <Box
        sx={{
          position: 'fixed',
          bottom: 20,
          right: 20,
          zIndex: 1400,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <FabLabel show={showLabel && !isOpen} />

        <Tooltip
          title={isOpen ? t('nyayabot.close') : t('nyayabot.openBot')}
          placement="left"
        >
          <Fab
            onClick={handleFabClick}
            aria-label="NyayaBot"
            sx={{
              bgcolor: isOpen ? 'var(--color-text-secondary)' : 'var(--color-primary)',
              color: '#fff',
              width: 52, height: 52,
              boxShadow: '0 4px 20px var(--color-primary-alpha)',
              '&:hover': {
                bgcolor: isOpen ? 'var(--color-text)' : 'var(--color-primary-light)',
                transform: 'scale(1.06)',
              },
              transition: 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}
          >
            <AnimatePresence mode="wait">
              {isOpen ? (
                <motion.div
                  key="close"
                  initial={{ rotate: -90, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: 90, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <Close />
                </motion.div>
              ) : (
                <motion.div
                  key="balance"
                  initial={{ rotate: 90, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: -90, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <Balance />
                </motion.div>
              )}
            </AnimatePresence>
          </Fab>
        </Tooltip>
      </Box>
    </>
  );
}
