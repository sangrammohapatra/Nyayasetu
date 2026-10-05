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
import {
  Box, IconButton, TextField, LinearProgress,
  Chip, Tooltip, Menu, MenuItem, Divider,
  CircularProgress, Alert, Button, Snackbar,
} from '@mui/material';
import {
  Send, Mic, MicOff, MoreVert, Share, Archive,
  Delete, Add, Close, Balance,
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
import { TYPOGRAPHY } from '../../theme/tokens';

// ─── Streaming dots indicator ─────────────────────────────────────────────────
const headerActionSx = {
  width: 30,
  height: 30,
  borderRadius: '8px',
  color: 'var(--color-text-secondary)',
  '&:hover': {
    color: 'var(--color-text)',
    bgcolor: 'var(--color-overlay)',
  },
};

function Mark({ size = 34 }) {
  return (
    <Box
      sx={{
        width: size,
        height: size,
        borderRadius: '10px',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--color-primary)',
        background: 'var(--color-primary-alpha)',
        border: '1px solid color-mix(in srgb, var(--color-primary) 28%, transparent)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12)',
      }}
    >
      <Balance sx={{ fontSize: size * 0.5 }} />
    </Box>
  );
}

function ThinkingDots() {
  const { t } = useTranslation();
  const prefersReducedMotion = useReducedMotion();
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, px: 0.25, py: 0.5 }}>
      <Mark size={30} />
      <Box>
        <Box
          sx={{
            fontSize: '0.68rem',
            fontWeight: 600,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--color-text-secondary)',
          }}
        >
          {t('nyayabot.thinking')}
        </Box>
        <Box sx={{ display: 'flex', gap: 0.6, mt: 0.7, alignItems: 'center' }}>
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              animate={prefersReducedMotion ? { opacity: 0.8 } : { opacity: [0.25, 1, 0.25] }}
              transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.16 }}
              style={{
                width: 18,
                height: 2,
                borderRadius: 2,
                backgroundColor: 'var(--color-primary)',
              }}
            />
          ))}
        </Box>
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
        px: compact ? 1.75 : 2,
        pt: 0.75,
        pb: 0.25,
        bgcolor: 'transparent',
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.6 }}>
        <Box sx={{ fontSize: '0.68rem', letterSpacing: '0.02em', color: 'var(--color-text-secondary)' }}>
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
        height: '100%',
        background: 'var(--color-bg)',
        color: 'var(--color-text)',
        overflow: 'hidden',
      }}
    >
      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <Box
        sx={{
          position: 'relative',
          display: 'flex', alignItems: 'center', gap: 1.25,
          px: compact ? 1.75 : 2.25, py: compact ? 1.35 : 1.6,
          background: 'linear-gradient(180deg, var(--color-surface-raised) 0%, var(--color-surface) 100%)',
          borderBottom: '1px solid var(--color-border)',
          flexShrink: 0,
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0, left: 0, right: 0,
            height: 2,
            background: 'linear-gradient(90deg, var(--color-primary) 0%, var(--color-secondary) 42%, transparent 88%)',
          },
        }}
      >
        <Mark size={compact ? 34 : 38} />

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box
            sx={{
              fontFamily: TYPOGRAPHY.fontFamily.display,
              fontWeight: 600,
              fontSize: compact ? '1.05rem' : '1.2rem',
              letterSpacing: '-0.03em',
              lineHeight: 1.05,
              color: 'var(--color-text)',
            }}
          >
            NyayaBot
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.7, mt: 0.45 }}>
            <Box
              sx={{
                width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                bgcolor: isStreaming ? 'var(--color-warning)' : 'var(--color-success)',
                boxShadow: isStreaming ? 'none' : '0 0 0 3px color-mix(in srgb, var(--color-success) 22%, transparent)',
              }}
            />
            <Box sx={{ fontSize: '0.68rem', letterSpacing: '0.01em', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {isStreaming ? t('nyayabot.thinking') : t('nyayabot.headerSubtitle')}
            </Box>
          </Box>
        </Box>

        {/* Actions */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
          {onNewSession && (
            <Tooltip title={t('nyayabot.newChat')}>
              <IconButton size="small" onClick={onNewSession} sx={headerActionSx}>
                <Add sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          )}

          <Tooltip title={t('nyayabot.moreOptions')}>
            <IconButton size="small" onClick={(e) => setMenuAnchor(e.currentTarget)} sx={headerActionSx}>
              <MoreVert sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>

          {onClose && (
            <Tooltip title={t('common.close')}>
              <IconButton size="small" onClick={onClose} sx={headerActionSx}>
                <Close sx={{ fontSize: 18 }} />
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
            sx: {
              minWidth: 200,
              mt: 0.5,
              borderRadius: '12px',
              bgcolor: 'var(--color-surface)',
              color: 'var(--color-text)',
              border: '1px solid var(--color-border)',
              boxShadow: '0 16px 40px rgba(0,0,0,0.18)',
            },
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
      <Box sx={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <Box
          aria-hidden
          sx={{
            pointerEvents: 'none',
            position: 'absolute',
            inset: 0,
            backgroundImage: 'radial-gradient(circle at 1px 1px, var(--color-border) 1px, transparent 0)',
            backgroundSize: '18px 18px',
            opacity: 0.55,
            maskImage: 'linear-gradient(180deg, #000 0%, transparent 72%)',
            WebkitMaskImage: 'linear-gradient(180deg, #000 0%, transparent 72%)',
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            overflowY: 'auto',
            px: compact ? 1.5 : 2,
            py: 1.75,
            display: 'flex',
            flexDirection: 'column',
            gap: 1.75,
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
              isGreeting={idx === 0 && msg.role === 'nyayabot'}
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
          px: compact ? 1.25 : 1.75,
          pt: 0.75,
          pb: compact ? 1.25 : 1.5,
          bgcolor: 'var(--color-surface)',
          borderTop: '1px solid var(--color-border)',
          flexShrink: 0,
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: 0.5,
            pl: 1.5,
            pr: 0.6,
            py: 0.55,
            borderRadius: '16px',
            bgcolor: 'var(--color-bg)',
            border: '1px solid var(--color-border)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
            transition: 'border-color 0.2s, box-shadow 0.2s',
            '&:focus-within': {
              borderColor: 'var(--color-primary)',
              boxShadow: '0 0 0 3px var(--color-primary-alpha)',
            },
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
          variant="standard"
          InputProps={{ disableUnderline: true }}
          sx={{
            '& .MuiInputBase-root': {
              fontSize: compact ? '0.88rem' : '0.92rem',
              lineHeight: 1.45,
              py: 0.6,
              color: 'var(--color-text)',
            },
            '& .MuiInputBase-input::placeholder': {
              color: 'var(--color-text-secondary)',
              opacity: 0.85,
            },
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
                  width: 34,
                  height: 34,
                  mb: '1px',
                  color: isRecording ? 'var(--color-error)' : 'var(--color-text-secondary)',
                  '&:hover': { color: 'var(--color-primary)', bgcolor: 'var(--color-overlay)' },
                }}
              >
                {isRecording ? <MicOff sx={{ fontSize: 18 }} /> : <Mic sx={{ fontSize: 18 }} />}
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
                width: 34,
                height: 34,
                mb: '1px',
                borderRadius: '11px',
                bgcolor: 'var(--color-primary-dark)',
                color: '#fff',
                '&:hover': { bgcolor: 'var(--color-primary)', transform: 'translateY(-1px)' },
                '&:disabled': {
                  bgcolor: 'var(--color-border)',
                  color: 'var(--color-text-disabled, var(--color-text-secondary))',
                },
                transition: 'background 0.15s, transform 0.15s',
              }}
            >
              {isStreaming ? <CircularProgress size={15} sx={{ color: '#fff' }} /> : <Send sx={{ fontSize: 16 }} />}
            </IconButton>
          </span>
        </Tooltip>
        </Box>
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
