/**
 * NyayaBotWindow.jsx
 * The chat window used inside both NyayaBotWidget (floating) and NyayaBotPage (full-screen).
 * Handles message display, input, quota display, streaming indicator.
 *
 * Props:
 *   sessionId     — active session ObjectId string
 *   compact       — true = widget mode (narrow), false = full page
 *   onClose       — called when user closes (widget only)
 *   onNewSession  — called when user wants a new conversation
 */

import React, { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@mui/material/styles';
import {
  Box, IconButton, TextField, LinearProgress,
  Chip, Tooltip, Menu, MenuItem, Divider,
  CircularProgress, Alert, Button, Snackbar,
} from '@mui/material';
import {
  Send, Mic, MicOff, MoreVert, Share, Archive,
  Delete, Add, Close, Balance, InfoOutlined,
} from '@mui/icons-material';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  sendNyayaBotMessage,
  createNyayaBotSession,
  archiveNyayaBotSession,
  deleteNyayaBotSession,
  shareNyayaBotSession,
  clearError,
} from '../../store/slices/nyayabotSlice';
import { useNyayaBot, useVoiceInput } from '../../hooks/useNyayaBot';
import NyayaBotMessage from './NyayaBotMessage';

// ─── Streaming dots indicator ─────────────────────────────────────────────────
function ThinkingDots() {
  const prefersReducedMotion = useReducedMotion();
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 1.5, py: 0.75 }}>
      <Box
        sx={{
          width: 32, height: 32, borderRadius: '50%',
          bgcolor: 'var(--color-primary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Balance sx={{ fontSize: 16, color: '#fff' }} />
      </Box>
      <Box
        sx={{
          px: 1.75, py: 1.25,
          borderRadius: '4px 18px 18px 18px',
          bgcolor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          display: 'flex', gap: 0.5, alignItems: 'center',
        }}
      >
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            animate={prefersReducedMotion ? { opacity: 1, scale: 1 } : { scale: [1, 1.4, 1], opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.2 }}
            style={{
              width: 7, height: 7, borderRadius: '50%',
              backgroundColor: 'var(--color-primary)',
            }}
          />
        ))}
      </Box>
    </Box>
  );
}

// ─── Quota bar ────────────────────────────────────────────────────────────────
function QuotaBar({ quota, plan, compact }) {
  const { t } = useTranslation();
  if (quota.unlimited) return null;

  const used = quota.used || 0;
  const limit = quota.limit || 5;
  const pct = Math.min(100, (used / limit) * 100);
  const isLow = quota.remaining <= 1;
  const isExhausted = quota.remaining <= 0;

  return (
    <Box
      sx={{
        px: compact ? 1.5 : 2,
        py: 0.75,
        bgcolor: isExhausted ? 'rgba(211,47,47,0.06)' : 'var(--color-bg)',
        borderTop: '1px solid var(--color-border)',
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
        <Box sx={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)' }}>
          {isExhausted
            ? t('nyayabot.quotaExhausted')
            : t('nyayabot.quotaRemaining', { remaining: quota.remaining, limit })}
        </Box>
        {isExhausted && (
          <Chip
            label={t('nyayabot.upgrade')}
            size="small"
            component="a"
            href="/pricing"
            clickable
            sx={{
              fontSize: '0.7rem', height: 20,
              bgcolor: 'var(--color-primary)',
              color: '#fff',
              '&:hover': { bgcolor: 'var(--color-primary-light)' },
            }}
          />
        )}
        {isLow && !isExhausted && (
          <Box sx={{ fontSize: '0.7rem', color: 'var(--color-warning)', fontWeight: 600 }}>
            {t('nyayabot.quotaLow')}
          </Box>
        )}
      </Box>
      <LinearProgress
        variant="determinate"
        value={pct}
        sx={{
          height: 3, borderRadius: 2,
          bgcolor: 'var(--color-border)',
          '& .MuiLinearProgress-bar': {
            bgcolor: isExhausted ? 'var(--color-error)' : isLow ? 'var(--color-warning)' : 'var(--color-primary)',
            borderRadius: 2,
          },
        }}
      />
    </Box>
  );
}

// ─── Main NyayaBotWindow ──────────────────────────────────────────────────────

export default function NyayaBotWindow({ sessionId, compact = false, onClose, onNewSession }) {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const muiTheme = useTheme();
  const prefersReducedMotion = useReducedMotion();

  const {
    messages,
    quota,
    isStreaming,
    error,
    canSend,
    isQuotaExhausted,
  } = useNyayaBot(sessionId);

  const userPlan = useSelector((s) => s.auth.user?.subscription?.plan || 'free');

  const [inputValue, setInputValue] = useState('');
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '' });

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  // Focus input when widget opens
  useEffect(() => {
    if (!compact) return;
    const id = setTimeout(() => inputRef.current?.focus(), 150);
    return () => clearTimeout(id);
  }, [compact]);

  // ── Voice input ─────────────────────────────────────────────────────────
  const { isRecording, recordingSeconds, error: voiceError, start: startRecording, stop: stopRecording, cancel: cancelRecording, formatTime } =
    useVoiceInput({
      sessionId,
      onTranscript: (text) => {
        setInputValue(text);
        setTimeout(() => inputRef.current?.focus(), 0);
      },
    });

  // ── Send message ────────────────────────────────────────────────────────
  const handleSend = async (content = inputValue) => {
    const text = content.trim();
    if (!text || !canSend || isStreaming) return;
    setInputValue('');
    dispatch(sendNyayaBotMessage({ sessionId, content: text }));
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ── Follow-up click ─────────────────────────────────────────────────────
  const handleFollowUp = (question) => {
    setInputValue(question);
    inputRef.current?.focus();
  };

  // ── Share ───────────────────────────────────────────────────────────────
  const handleShare = async () => {
    setMenuAnchor(null);
    try {
      const result = await dispatch(shareNyayaBotSession({ sessionId })).unwrap();
      navigator.clipboard.writeText(result.shareUrl);
      setSnackbar({ open: true, message: t('nyayabot.shareLinkCopied') });
    } catch (_) {
      setSnackbar({ open: true, message: t('nyayabot.shareError') });
    }
  };

  // ── Archive ─────────────────────────────────────────────────────────────
  const handleArchive = () => {
    setMenuAnchor(null);
    dispatch(archiveNyayaBotSession({ sessionId, archive: true }));
    onNewSession?.();
  };

  // ── Delete ──────────────────────────────────────────────────────────────
  const handleDelete = () => {
    setMenuAnchor(null);
    dispatch(deleteNyayaBotSession(sessionId));
    onNewSession?.();
  };

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <Box
      sx={{
        display: 'flex', flexDirection: 'column',
        height: '100%', background: 'var(--color-bg)',
        overflow: 'hidden',
      }}
    >
      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <Box
        sx={{
          display: 'flex', alignItems: 'center', gap: 1.5,
          px: compact ? 1.5 : 2, py: compact ? 1.25 : 1.5,
          background: muiTheme.custom?.gradientBrand || 'var(--color-primary)',
          color: '#fff', flexShrink: 0,
        }}
      >
        <Box
          sx={{
            width: compact ? 32 : 36, height: compact ? 32 : 36,
            borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Balance sx={{ fontSize: compact ? 18 : 20 }} />
        </Box>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ fontWeight: 800, fontSize: compact ? '0.9rem' : '1rem', letterSpacing: '-0.01em' }}>
            NyayaBot
          </Box>
          <Box sx={{ fontSize: '0.7rem', opacity: 0.85 }}>
            {isStreaming ? t('nyayabot.thinking') : t('nyayabot.headerSubtitle')}
          </Box>
        </Box>

        {/* Actions */}
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          {onNewSession && (
            <Tooltip title={t('nyayabot.newChat')}>
              <IconButton size="small" onClick={onNewSession} sx={{ color: 'rgba(255,255,255,0.85)' }}>
                <Add fontSize="small" />
              </IconButton>
            </Tooltip>
          )}

          <Tooltip title={t('nyayabot.moreOptions')}>
            <IconButton size="small" onClick={(e) => setMenuAnchor(e.currentTarget)} sx={{ color: 'rgba(255,255,255,0.85)' }}>
              <MoreVert fontSize="small" />
            </IconButton>
          </Tooltip>

          {onClose && (
            <Tooltip title={t('common.close')}>
              <IconButton size="small" onClick={onClose} sx={{ color: 'rgba(255,255,255,0.85)' }}>
                <Close fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>

        {/* Options menu */}
        <Menu
          anchorEl={menuAnchor}
          open={Boolean(menuAnchor)}
          onClose={() => setMenuAnchor(null)}
          sx={{ zIndex: 1500 }}
          PaperProps={{
            sx: { minWidth: 180, bgcolor: 'var(--color-surface)', color: 'var(--color-text)' }
          }}
        >
          <MenuItem onClick={handleShare} sx={{ gap: 1.5, fontSize: '0.88rem' }}>
            <Share fontSize="small" /> {t('nyayabot.shareWithLawyer')}
          </MenuItem>
          <MenuItem onClick={handleArchive} sx={{ gap: 1.5, fontSize: '0.88rem' }}>
            <Archive fontSize="small" /> {t('nyayabot.archive')}
          </MenuItem>
          <Divider />
          <MenuItem onClick={handleDelete} sx={{ gap: 1.5, fontSize: '0.88rem', color: 'var(--color-error)' }}>
            <Delete fontSize="small" /> {t('nyayabot.delete')}
          </MenuItem>
        </Menu>
      </Box>

      {/* ── ERROR ALERT ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={prefersReducedMotion ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={prefersReducedMotion ? undefined : { height: 0, opacity: 0 }}
          >
            <Alert
              severity={error.includes('QUOTA') ? 'warning' : 'error'}
              onClose={() => dispatch(clearError())}
              sx={{ borderRadius: 0, fontSize: '0.82rem' }}
              action={
                error.includes('QUOTA') ? (
                  <Button size="small" href="/pricing" sx={{ fontSize: '0.75rem' }}>
                    {t('nyayabot.upgrade')}
                  </Button>
                ) : undefined
              }
            >
              {error.includes('QUOTA')
                ? t('nyayabot.quotaExhaustedMessage', { plan: userPlan })
                : error}
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── MESSAGES LIST ────────────────────────────────────────────────── */}
      <Box
        sx={{
          flex: 1, overflowY: 'auto', px: compact ? 1 : 1.5, py: 1.5,
          display: 'flex', flexDirection: 'column', gap: 1.5,
          '&::-webkit-scrollbar': { width: 4 },
          '&::-webkit-scrollbar-track': { bgcolor: 'transparent' },
          '&::-webkit-scrollbar-thumb': { bgcolor: 'var(--color-border)', borderRadius: 2 },
        }}
      >
        <AnimatePresence initial={false}>
          {messages.map((msg, idx) => (
            <NyayaBotMessage
              key={msg._id || idx}
              message={{ ...msg, sessionId }}
              onFollowUp={msg.role === 'nyayabot' ? handleFollowUp : undefined}
              compact={compact}
            />
          ))}
        </AnimatePresence>

        {/* Streaming indicator */}
        {isStreaming && (
          <motion.div initial={prefersReducedMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }}>
            <ThinkingDots />
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </Box>

      {/* ── QUOTA BAR ────────────────────────────────────────────────────── */}
      <QuotaBar quota={quota} plan={userPlan} compact={compact} />

      {/* ── VOICE RECORDING BAR ──────────────────────────────────────────── */}
      <AnimatePresence>
        {isRecording && (
          <motion.div
            initial={prefersReducedMotion ? false : { height: 0 }}
            animate={{ height: 'auto' }}
            exit={prefersReducedMotion ? undefined : { height: 0 }}
          >
            <Box
              sx={{
                display: 'flex', alignItems: 'center', gap: 1.5,
                px: 1.5, py: 1,
                bgcolor: 'rgba(211,47,47,0.08)',
                borderTop: '1px solid rgba(211,47,47,0.2)',
              }}
            >
              <motion.div
                animate={prefersReducedMotion ? { opacity: 1 } : { opacity: [1, 0.3, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              >
                <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: 'var(--color-error)' }} />
              </motion.div>
              <Box sx={{ flex: 1, fontSize: '0.85rem', color: 'var(--color-error)', fontWeight: 600 }}>
                {t('nyayabot.recording')} {formatTime(recordingSeconds)}
              </Box>
              <Button size="small" onClick={cancelRecording} sx={{ color: 'var(--color-text-secondary)', fontSize: '0.78rem' }}>
                {t('common.cancel')}
              </Button>
              <Button size="small" variant="contained" onClick={stopRecording} color="error" sx={{ fontSize: '0.78rem' }}>
                {t('nyayabot.stopSend')}
              </Button>
            </Box>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── INPUT AREA ───────────────────────────────────────────────────── */}
      <Box
        component="form"
        onSubmit={(e) => { e.preventDefault(); handleSend(); }}
        sx={{
          display: 'flex', alignItems: 'flex-end', gap: 0.75,
          px: compact ? 1 : 1.5, py: compact ? 1 : 1.25,
          borderTop: '1px solid var(--color-border)',
          bgcolor: 'var(--color-surface)',
          flexShrink: 0,
        }}
      >
        <TextField
          inputRef={inputRef}
          fullWidth
          multiline
          maxRows={4}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            isQuotaExhausted
              ? t('nyayabot.inputDisabledQuota')
              : t('nyayabot.inputPlaceholder')
          }
          disabled={isQuotaExhausted || isStreaming || isRecording}
          variant="outlined"
          size="small"
          sx={{
            '& .MuiOutlinedInput-root': {
              fontSize: compact ? '0.87rem' : '0.9rem',
              borderRadius: 2,
              bgcolor: 'var(--color-bg)',
              '& fieldset': { borderColor: 'var(--color-border)' },
              '&:hover fieldset': { borderColor: 'var(--color-primary)' },
              '&.Mui-focused fieldset': { borderColor: 'var(--color-primary)' },
            },
            '& .MuiInputBase-input': { color: 'var(--color-text)' },
            '& .MuiInputBase-input::placeholder': { color: 'var(--color-text-secondary)', opacity: 1 },
          }}
        />

        {/* Voice button — only if not free */}
        {userPlan !== 'free' && (
          <Tooltip title={isRecording ? t('nyayabot.stopRecording') : t('nyayabot.startRecording')}>
            <span>
              <IconButton
                type="button"
                size="small"
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isStreaming || isQuotaExhausted}
                sx={{
                  color: isRecording ? 'var(--color-error)' : 'var(--color-text-secondary)',
                  '&:hover': { color: 'var(--color-primary)' },
                  mb: '2px',
                }}
              >
                {isRecording ? <MicOff fontSize="small" /> : <Mic fontSize="small" />}
              </IconButton>
            </span>
          </Tooltip>
        )}

        {/* Send button */}
        <Tooltip title={t('nyayabot.send')}>
          <span>
            <IconButton
              type="submit"
              size="small"
              disabled={!inputValue.trim() || !canSend || isStreaming}
              sx={{
                background: muiTheme.custom?.gradientBrand || 'var(--color-primary)',
                color: '#fff',
                borderRadius: '50%',
                p: 1,
                mb: '2px',
                boxShadow: muiTheme.custom?.glowPrimary || 'none',
                '&:hover': {
                  background: muiTheme.custom?.gradientBrand || 'var(--color-primary)',
                  transform: 'scale(1.08)',
                },
                '&:disabled': { background: 'var(--color-border)', color: 'var(--color-text-secondary)', boxShadow: 'none' },
                transition: 'all 0.15s',
              }}
            >
              {isStreaming ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : <Send sx={{ fontSize: 17 }} />}
            </IconButton>
          </span>
        </Tooltip>
      </Box>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ open: false, message: '' })}
        message={snackbar.message}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  );
}
