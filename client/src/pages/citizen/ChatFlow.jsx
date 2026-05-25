/**
 * client/src/pages/citizen/ChatFlow.jsx
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import Chip from '@mui/material/Chip';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';

import {
  createSession, sendMessage, loadSession,
  selectCurrentSession, selectMessages, selectIsStreaming,
  selectStreamBuffer, selectDataComplete, selectChatLoading, selectChatError,
  clearChat, clearChatError,
} from '../../store/slices/chatSlice';
import { selectLanguage, setLanguage } from '../../store/slices/uiSlice';
import MessageBubble, { TypingIndicator } from '../../components/chat/MessageBubble';
import VoiceInput from '../../components/chat/VoiceInput';
import { RADIUS, SHADOWS } from '../../theme/tokens';
import api from '../../services/api';

const LANGUAGES = [
  { code: 'en', label: 'EN' }, { code: 'hi', label: 'HI' },
  { code: 'bn', label: 'BN' }, { code: 'mr', label: 'MR' },
  { code: 'ta', label: 'TA' }, { code: 'te', label: 'TE' },
];

/* ---------------------------------------------------------------------------
 * Document generating animation overlay
 * ------------------------------------------------------------------------ */
function GeneratingOverlay() {
  const { t } = useTranslation();
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1400,
        background: 'rgba(var(--color-bg-rgb, 248,250,255), 0.92)',
        backdropFilter: 'blur(12px)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 20,
      }}
    >
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
        style={{ fontSize: 64 }}
      >
        ⚖️
      </motion.div>
      <Typography variant="h5" sx={{
        fontFamily: "'Playfair Display',serif", fontWeight: 700, color: 'var(--color-primary)',
      }}>
        {t('chat.generating', 'Generating your document…')}
      </Typography>
      <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)', textAlign: 'center', maxWidth: 280 }}>
        {t('chat.generatingDesc', 'Our AI is crafting a professional legal document tailored to your situation.')}
      </Typography>
      <Box sx={{ width: 240 }}>
        <LinearProgress sx={{
          height: 5, borderRadius: 3,
          background: 'var(--color-border)',
          '& .MuiLinearProgress-bar': { background: 'var(--color-primary)', borderRadius: 3 },
        }} />
      </Box>
    </motion.div>
  );
}

/* ---------------------------------------------------------------------------
 * Main component
 * ------------------------------------------------------------------------ */
function ChatFlow() {
  const { templateSlug } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down('sm'));

  const reduxLang = useSelector(selectLanguage);
  const session = useSelector(selectCurrentSession);
  const messages = useSelector(selectMessages);
  const isStreaming = useSelector(selectIsStreaming);
  const streamBuffer = useSelector(selectStreamBuffer);
  const dataComplete = useSelector(selectDataComplete);
  const chatLoading = useSelector(selectChatLoading);
  const chatError = useSelector(selectChatError);

  const [inputValue, setInputValue] = useState('');
  const [templateMeta, setTemplateMeta] = useState(null);
  const [showGenerating, setShowGenerating] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const navigatedRef = useRef(false);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamBuffer]);

  // Load template metadata
  useEffect(() => {
    if (!templateSlug) return;
    api.get(`/templates/${templateSlug}`).then(({ data }) => {
      setTemplateMeta(data.template || data);
    }).catch(() => {});
  }, [templateSlug]);

  // Create or load session on mount
  useEffect(() => {
    if (!templateSlug) return;
    if (!session || session.template?.slug !== templateSlug) {
      dispatch(clearChat());
      dispatch(createSession({ templateSlug, language: reduxLang || 'en' }));
    }
    return () => {
      // Don't clear on unmount so the user can navigate back and resume
    };
  }, [templateSlug]);

  // When data collection is complete → show generating overlay → poll for doc
  useEffect(() => {
    if (!dataComplete || navigatedRef.current || !session) return;
    navigatedRef.current = true;
    setShowGenerating(true);

    const poll = setInterval(async () => {
      try {
        const { data } = await api.get(`/documents?sessionId=${session._id}&limit=1`);
        const docs = data.documents || data.items || [];
        if (docs.length > 0 && docs[0].status === 'completed') {
          clearInterval(poll);
          navigate(`/citizen/documents/${docs[0]._id}`, { replace: true });
        }
      } catch (_) {}
    }, 2000);

    return () => clearInterval(poll);
  }, [dataComplete, session, navigate]);

  const handleSend = useCallback(async () => {
    const text = inputValue.trim();
    if (!text || !session || isStreaming) return;
    setInputValue('');
    inputRef.current?.focus();
    await dispatch(sendMessage({ sessionId: session._id, message: text }));
  }, [inputValue, session, isStreaming, dispatch]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleVoiceTranscript = (text) => {
    setInputValue((prev) => (prev ? `${prev} ${text}` : text));
    inputRef.current?.focus();
  };

  const handleLangChange = (code) => {
    dispatch(setLanguage(code));
    setLangOpen(false);
  };

  const progress = session?.progressPercent || 0;

  // Build visible messages list — append streaming buffer as provisional AI message
  const displayMessages = [...messages];
  if (isStreaming && streamBuffer) {
    displayMessages.push({ role: 'assistant', content: streamBuffer, _streaming: true });
  } else if (isStreaming) {
    displayMessages.push({ role: 'assistant', typing: true, content: '' });
  }

  return (
    <Box sx={{
      display: 'flex', flexDirection: 'column',
      height: { xs: 'calc(100vh - 56px)', md: 'calc(100vh - 64px)' },
      background: 'var(--color-bg)',
      position: 'relative',
    }}>
      {/* Header */}
      <Box sx={{
        px: 2, py: 1.5,
        background: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)',
        boxShadow: SHADOWS.sm,
        zIndex: 10,
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
          <IconButton size="small" onClick={() => navigate('/citizen/documents/new')}
            sx={{ color: 'var(--color-text-secondary)' }}>
            ←
          </IconButton>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" sx={{ fontWeight: 700, color: 'var(--color-text)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {templateMeta?.name || templateSlug}
            </Typography>
            <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)' }}>
              {t('chat.aiAssistant', 'NyayaSetu AI · Collecting information')}
            </Typography>
          </Box>
          {progress > 0 && (
            <Typography variant="caption" sx={{ color: 'var(--color-primary)', fontWeight: 700, flexShrink: 0 }}>
              {progress}%
            </Typography>
          )}
        </Box>

        {/* Progress bar */}
        <LinearProgress
          variant="determinate"
          value={progress}
          sx={{
            height: 4, borderRadius: 2,
            background: 'var(--color-border)',
            '& .MuiLinearProgress-bar': {
              background: 'linear-gradient(90deg, var(--color-primary), var(--color-primary-light))',
              borderRadius: 2,
              transition: 'transform 0.8s ease',
            },
          }}
        />
      </Box>

      {/* AI thinking banner */}
      <AnimatePresence>
        {isStreaming && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            style={{ position: 'absolute', top: 80, left: 0, right: 0, zIndex: 9 }}
          >
            <Box sx={{
              mx: 'auto', width: 'fit-content',
              background: 'var(--color-primary-alpha)',
              border: '1px solid var(--color-primary)',
              borderRadius: `${RADIUS.full}px`,
              px: 2, py: 0.4,
              display: 'flex', alignItems: 'center', gap: 1,
            }}>
              <motion.div
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 1.2, repeat: Infinity }}
                style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--color-primary)' }}
              />
              <Typography variant="caption" sx={{ color: 'var(--color-primary)', fontWeight: 600 }}>
                {t('chat.aiThinking', 'AI is thinking…')}
              </Typography>
            </Box>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages area */}
      <Box sx={{
        flex: 1, overflowY: 'auto', px: { xs: 1.5, sm: 2.5 }, py: 2,
        display: 'flex', flexDirection: 'column', gap: 0.5,
        '&::-webkit-scrollbar': { width: 4 },
        '&::-webkit-scrollbar-thumb': { background: 'var(--color-border)', borderRadius: 2 },
      }}>
        {/* Empty state */}
        {displayMessages.length === 0 && !chatLoading && (
          <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography sx={{ fontSize: 48, mb: 1.5 }}>⚖️</Typography>
              <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)' }}>
                {t('chat.starting', 'Starting conversation…')}
              </Typography>
            </Box>
          </Box>
        )}

        {displayMessages.map((msg, i) => (
          <MessageBubble
            key={i}
            message={msg}
            isStreaming={isStreaming && i === displayMessages.length - 1 && msg.role === 'assistant'}
          />
        ))}

        <div ref={messagesEndRef} />
      </Box>

      {/* Input area */}
      <Box sx={{
        px: { xs: 1.5, sm: 2 }, py: 1.5,
        background: 'var(--color-surface)',
        borderTop: '1px solid var(--color-border)',
        boxShadow: '0 -4px 16px var(--color-primary-alpha)',
      }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1 }}>
          {/* Language chip */}
          <Box sx={{ position: 'relative' }}>
            <Chip
              label={(reduxLang || 'en').toUpperCase()}
              size="small"
              onClick={() => setLangOpen(!langOpen)}
              sx={{
                height: 28, fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer',
                background: 'var(--color-primary-alpha)', color: 'var(--color-primary)',
                border: '1px solid var(--color-primary)',
                '&:hover': { background: 'var(--color-primary)', color: '#fff' },
              }}
            />
            <AnimatePresence>
              {langOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.95 }}
                  transition={{ duration: 0.18 }}
                  style={{
                    position: 'absolute', bottom: 36, left: 0, zIndex: 100,
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: RADIUS.lg,
                    boxShadow: SHADOWS.lg,
                    padding: '6px 0', minWidth: 90,
                  }}
                >
                  {LANGUAGES.map((l) => (
                    <Box key={l.code} onClick={() => handleLangChange(l.code)} sx={{
                      px: 2, py: 0.75, cursor: 'pointer', fontSize: '0.8rem',
                      fontWeight: l.code === reduxLang ? 700 : 400,
                      color: l.code === reduxLang ? 'var(--color-primary)' : 'var(--color-text)',
                      '&:hover': { background: 'var(--color-overlay)' },
                    }}>
                      {l.label}
                    </Box>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </Box>

          {/* Text input */}
          <TextField
            inputRef={inputRef}
            multiline
            maxRows={4}
            fullWidth
            placeholder={t('chat.inputPlaceholder', 'Type your answer…')}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isStreaming || dataComplete}
            size="small"
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: `${RADIUS.lg}px`,
                background: 'var(--color-bg)',
                '& fieldset': { borderColor: 'var(--color-border)' },
                '&:hover fieldset': { borderColor: 'var(--color-primary)' },
                '&.Mui-focused fieldset': { borderColor: 'var(--color-primary)' },
              },
              '& textarea': { fontSize: '0.9rem', lineHeight: 1.5 },
            }}
          />

          {/* Voice input */}
          <VoiceInput onTranscript={handleVoiceTranscript} disabled={isStreaming || dataComplete} />

          {/* Send button */}
          <motion.div whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }}>
            <IconButton
              onClick={handleSend}
              disabled={!inputValue.trim() || isStreaming || dataComplete}
              sx={{
                width: 44, height: 44,
                background: inputValue.trim() ? 'var(--color-primary)' : 'var(--color-border)',
                color: inputValue.trim() ? '#fff' : 'var(--color-text-secondary)',
                borderRadius: '50%',
                transition: 'all 0.2s',
                '&:hover': { background: inputValue.trim() ? 'var(--color-primary-dark, var(--color-primary))' : undefined },
                '&:disabled': { background: 'var(--color-border)', color: 'var(--color-text-secondary)' },
              }}
            >
              <Typography sx={{ fontSize: 18, lineHeight: 1 }}>➤</Typography>
            </IconButton>
          </motion.div>
        </Box>
      </Box>

      {/* Generating overlay */}
      <AnimatePresence>
        {showGenerating && <GeneratingOverlay key="gen-overlay" />}
      </AnimatePresence>

      {/* Error snackbar */}
      <Snackbar open={!!chatError} autoHideDuration={4000} onClose={() => dispatch(clearChatError())}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
        <Alert severity="error" onClose={() => dispatch(clearChatError())} sx={{ borderRadius: 2 }}>
          {chatError}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default ChatFlow;
