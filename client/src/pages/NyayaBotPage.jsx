/**
 * NyayaBotPage.jsx
 * Full-page NyayaBot view at /nyayabot and /nyayabot/:sessionId
 * Two-panel layout: sidebar (session history) + main chat window.
 * On mobile, sidebar is a bottom sheet.
 *
 * Routes:
 *   /nyayabot              → creates new session, redirects to /nyayabot/:id
 *   /nyayabot/:sessionId   → loads specific session
 */

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import {
  Box, Drawer, List, ListItem, ListItemText,
  ListItemButton, IconButton, Button, Chip,
  Tooltip, Divider, Typography, useMediaQuery,
  useTheme, CircularProgress,
} from '@mui/material';
import {
  Add, Balance, HistoryOutlined, Menu as MenuIcon,
  PushPin, PushPinOutlined,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import {
  createNyayaBotSession,
  getNyayaBotSession,
  listNyayaBotSessions,
  deleteNyayaBotSession,
  pinSession,
  setActiveSession,
} from '../store/slices/nyayabotSlice';
import NyayaBotWindow from '../components/nyayabot/NyayaBotWindow';

const SIDEBAR_WIDTH = 260;

// ─── Session list item ────────────────────────────────────────────────────────
function SessionItem({ session, isActive, onSelect, onDelete, onPin }) {
  const { t } = useTranslation();
  const dispatch = useDispatch();

  return (
    <ListItem
      disablePadding
      secondaryAction={
        <Tooltip title={session.isPinned ? t('nyayabot.unpin') : t('nyayabot.pin')}>
          <IconButton
            size="small"
            edge="end"
            onClick={(e) => { e.stopPropagation(); onPin(session.sessionId, !session.isPinned); }}
            sx={{ color: session.isPinned ? 'var(--color-primary)' : 'var(--color-text-secondary)' }}
          >
            {session.isPinned ? <PushPin fontSize="small" /> : <PushPinOutlined fontSize="small" />}
          </IconButton>
        </Tooltip>
      }
    >
      <ListItemButton
        selected={isActive}
        onClick={() => onSelect(session.sessionId)}
        sx={{
          borderRadius: 1.5, mx: 0.5, mb: 0.25,
          pr: 5,
          bgcolor: isActive ? 'var(--color-primary-alpha)' : 'transparent',
          '&.Mui-selected': {
            bgcolor: 'var(--color-primary-alpha)',
            '&:hover': { bgcolor: 'var(--color-primary-alpha)' },
          },
          '&:hover': { bgcolor: 'var(--color-border)' },
        }}
      >
        <ListItemText
          primary={
            <Box sx={{ fontWeight: isActive ? 700 : 500, fontSize: '0.85rem', color: 'var(--color-text)', mb: 0.2 }}>
              {session.title || t('nyayabot.untitled')}
            </Box>
          }
          secondary={
            <Box sx={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)' }}>
              {session.messageCount} {t('nyayabot.messages')} ·{' '}
              {new Date(session.updatedAt).toLocaleDateString()}
            </Box>
          }
          disableTypography
        />
      </ListItemButton>
    </ListItem>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
function Sidebar({ sessions, activeSessionId, onSelect, onNewSession, onPin, loading }) {
  const { t } = useTranslation();

  return (
    <Box
      sx={{
        width: SIDEBAR_WIDTH, flexShrink: 0,
        height: '100%', display: 'flex', flexDirection: 'column',
        borderRight: '1px solid var(--color-border)',
        bgcolor: 'var(--color-surface)',
      }}
    >
      {/* Sidebar header */}
      <Box
        sx={{
          px: 1.5, py: 1.5,
          display: 'flex', alignItems: 'center', gap: 1,
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <Balance sx={{ color: 'var(--color-primary)', fontSize: 22 }} />
        <Box sx={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--color-text)', letterSpacing: '-0.01em' }}>
          NyayaBot
        </Box>
      </Box>

      {/* New chat button */}
      <Box sx={{ px: 1, pt: 1 }}>
        <Button
          fullWidth
          variant="contained"
          startIcon={<Add />}
          onClick={onNewSession}
          size="small"
          sx={{
            bgcolor: 'var(--color-primary)',
            color: '#fff',
            fontWeight: 700, fontSize: '0.82rem',
            borderRadius: 1.5, py: 0.9,
            '&:hover': { bgcolor: 'var(--color-primary-light)' },
          }}
        >
          {t('nyayabot.newChat')}
        </Button>
      </Box>

      {/* Sessions */}
      <Box sx={{ flex: 1, overflowY: 'auto', pt: 0.75, pb: 1 }}>
        <Box sx={{ px: 1.5, py: 0.75, fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-secondary)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          {t('nyayabot.recentChats')}
        </Box>

        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
            <CircularProgress size={24} sx={{ color: 'var(--color-primary)' }} />
          </Box>
        )}

        {!loading && sessions.length === 0 && (
          <Box sx={{ px: 2, py: 2, fontSize: '0.8rem', color: 'var(--color-text-secondary)', textAlign: 'center' }}>
            {t('nyayabot.noSessions')}
          </Box>
        )}

        <List dense disablePadding>
          {sessions.map((s) => (
            <SessionItem
              key={s.sessionId}
              session={s}
              isActive={s.sessionId === activeSessionId}
              onSelect={onSelect}
              onPin={onPin}
            />
          ))}
        </List>
      </Box>

      {/* Sidebar footer */}
      <Box
        sx={{
          px: 1.5, py: 1,
          borderTop: '1px solid var(--color-border)',
          fontSize: '0.7rem', color: 'var(--color-text-secondary)',
          lineHeight: 1.5,
        }}
      >
        {t('nyayabot.disclaimer')}
      </Box>
    </Box>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function NyayaBotPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const sessions = useSelector((s) => s.nyayabot.sessions);
  const activeSessionId = useSelector((s) => s.nyayabot.activeSessionId || sessionId);
  const loading = useSelector((s) => s.nyayabot.loading);
  const creating = useSelector((s) => s.nyayabot.creating);

  const [sidebarOpen, setSidebarOpen] = useState(false);

  // ── Load sessions list on mount ─────────────────────────────────────────
  useEffect(() => {
    dispatch(listNyayaBotSessions());
  }, [dispatch]);

  // ── Load specific session or create new ─────────────────────────────────
  useEffect(() => {
    if (sessionId) {
      dispatch(getNyayaBotSession(sessionId));
      dispatch(setActiveSession(sessionId));
    } else {
      // No session in URL: create one
      dispatch(createNyayaBotSession({ source: 'page' })).then((action) => {
        if (action.payload?.sessionId) {
          navigate(`/nyayabot/${action.payload.sessionId}`, { replace: true });
        }
      });
    }
  }, [sessionId, dispatch, navigate]);

  const handleSelectSession = (sid) => {
    setSidebarOpen(false);
    navigate(`/nyayabot/${sid}`);
  };

  const handleNewSession = () => {
    setSidebarOpen(false);
    dispatch(createNyayaBotSession({ source: 'page' })).then((action) => {
      if (action.payload?.sessionId) {
        navigate(`/nyayabot/${action.payload.sessionId}`);
        dispatch(listNyayaBotSessions());
      }
    });
  };

  const handlePin = (sid, pinned) => {
    dispatch(pinSession({ sessionId: sid, pinned }));
  };

  const sidebarContent = (
    <Sidebar
      sessions={sessions}
      activeSessionId={activeSessionId}
      onSelect={handleSelectSession}
      onNewSession={handleNewSession}
      onPin={handlePin}
      loading={loading}
    />
  );

  // ── Loading ────────────────────────────────────────────────────────────
  if (creating && !activeSessionId) {
    return (
      <Box sx={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'var(--color-bg)' }}>
        <Box sx={{ textAlign: 'center' }}>
          <motion.div animate={{ rotate: [0, 10, -10, 0] }} transition={{ duration: 2, repeat: Infinity }}>
            <Balance sx={{ fontSize: 52, color: 'var(--color-primary)', mb: 2 }} />
          </motion.div>
          <Box sx={{ color: 'var(--color-text)', fontWeight: 600 }}>{t('nyayabot.starting')}</Box>
        </Box>
      </Box>
    );
  }

  return (
    <Box
      component={motion.div}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
      sx={{
        display: 'flex',
        height: 'calc(100vh - 64px)', // subtract app bar height
        bgcolor: 'var(--color-bg)',
        overflow: 'hidden',
      }}
    >
      {/* ── DESKTOP SIDEBAR ────────────────────────────────────────────── */}
      {!isMobile && sidebarContent}

      {/* ── MOBILE SIDEBAR DRAWER ──────────────────────────────────────── */}
      {isMobile && (
        <Drawer
          anchor="left"
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          PaperProps={{ sx: { width: SIDEBAR_WIDTH, bgcolor: 'var(--color-surface)' } }}
        >
          {sidebarContent}
        </Drawer>
      )}

      {/* ── MAIN CHAT PANEL ────────────────────────────────────────────── */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, height: '100%' }}>
        {/* Mobile top bar */}
        {isMobile && (
          <Box
            sx={{
              display: 'flex', alignItems: 'center', gap: 1,
              px: 1.5, py: 1,
              borderBottom: '1px solid var(--color-border)',
              bgcolor: 'var(--color-surface)',
            }}
          >
            <IconButton onClick={() => setSidebarOpen(true)} size="small">
              <MenuIcon sx={{ color: 'var(--color-text)' }} />
            </IconButton>
            <Balance sx={{ color: 'var(--color-primary)' }} />
            <Box sx={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--color-text)' }}>NyayaBot</Box>
          </Box>
        )}

        {activeSessionId ? (
          <NyayaBotWindow
            sessionId={activeSessionId}
            compact={false}
            onNewSession={handleNewSession}
          />
        ) : (
          <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CircularProgress sx={{ color: 'var(--color-primary)' }} />
          </Box>
        )}
      </Box>
    </Box>
  );
}
