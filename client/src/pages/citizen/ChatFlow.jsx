/**
 * client/src/pages/citizen/ChatFlow.jsx
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

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
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Skeleton from '@mui/material/Skeleton';

import {
  createSession, sendMessage, loadSession, abandonSession,
  selectCurrentSession, selectMessages, selectIsStreaming,
  selectStreamBuffer, selectDataComplete, selectChatLoading, selectChatError,
  clearChat, clearChatError,
} from '../../store/slices/chatSlice';
import { selectLanguage, setLanguage } from '../../store/slices/uiSlice';
import MessageBubble, { TypingIndicator } from '../../components/chat/MessageBubble';
import VoiceInput from '../../components/chat/VoiceInput';
import GlassCard from '../../components/ui/GlassCard';
import GradientHeading from '../../components/ui/GradientHeading';
import { RADIUS, SHADOWS, TYPOGRAPHY } from '../../theme/tokens';
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
  const prefersReducedMotion = useReducedMotion();
  return (
    <motion.div
      initial={prefersReducedMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={prefersReducedMotion ? undefined : { opacity: 0 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1400,
        background: 'rgba(var(--color-bg-rgb, 248,250,255), 0.92)',
        backdropFilter: 'blur(12px)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 20,
      }}
    >
      <motion.div
        animate={prefersReducedMotion ? undefined : { rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
        style={{ fontSize: 64 }}
      >
        ⚖️
      </motion.div>
      <Typography variant="h5" sx={{
        fontFamily: TYPOGRAPHY.fontFamily.display, fontWeight: 700, color: 'var(--color-primary)',
      }}>
        {t('myDocs.generating', 'Generating your document…')}
      </Typography>
      <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)', textAlign: 'center', maxWidth: 280 }}>
        {t('myDocs.generating_desc', 'Our AI is crafting a professional legal document tailored to your situation.')}
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
 * Resume session dialog
 * ------------------------------------------------------------------------ */
function ResumeDialog({ session, onResume, onStartFresh, loading }) {
  const { t } = useTranslation();

  const isDataReady = session?.status === 'data_complete' || session?.status === 'generating';
  const templateName = session?.template?.name || 'document';
  const progress = session?.progressPercent || 0;
  const lastActivity = session?.lastMessageAt
    ? new Date(session.lastMessageAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

  return (
    <Dialog
      open
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
        },
      }}
    >
      <DialogTitle sx={{
        fontFamily: "'Playfair Display', serif",
        fontWeight: 700,
        color: 'var(--color-text)',
        pb: 0.5,
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
      }}>
        <span style={{ fontSize: 28 }}>⚖️</span>
        {isDataReady
          ? t('myDocs.resume_title_ready', 'Resume Document Generation')
          : t('myDocs.resume_title_active', 'Continue Where You Left Off')}
      </DialogTitle>

      <DialogContent sx={{ pt: 1.5 }}>
        <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)', mb: 2 }}>
          {isDataReady
            ? t('myDocs.resume_desc_ready',
                'You\'ve already answered all questions for {{name}}. Resume to generate your document without re-answering.',
                { name: templateName })
            : t('myDocs.resume_desc_active',
                'You\'re {{progress}}% through collecting information for {{name}}.',
                { progress, name: templateName })}
        </Typography>

        {!isDataReady && (
          <Box sx={{ mb: 2 }}>
            <LinearProgress
              variant="determinate"
              value={progress}
              sx={{
                height: 6, borderRadius: 3,
                background: 'var(--color-border)',
                '& .MuiLinearProgress-bar': {
                  background: 'var(--color-primary)',
                  borderRadius: 3,
                },
              }}
            />
            <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)', mt: 0.5, display: 'block' }}>
              {progress}% {t('myDocs.resume_complete', 'complete')}
            </Typography>
          </Box>
        )}

        {isDataReady && (
          <Box sx={{
            display: 'flex', alignItems: 'center', gap: 1,
            px: 1.5, py: 1,
            background: 'var(--color-primary-alpha)',
            borderRadius: 2,
            border: '1px solid var(--color-primary)',
            mb: 1,
          }}>
            <Typography sx={{ fontSize: 18 }}>✅</Typography>
            <Typography variant="caption" sx={{ color: 'var(--color-primary)', fontWeight: 600 }}>
              {t('myDocs.resume_data_ready', 'All information collected — ready to generate')}
            </Typography>
          </Box>
        )}

        {lastActivity && (
          <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)' }}>
            {t('myDocs.resume_last_activity', 'Last activity: {{date}}', { date: lastActivity })}
          </Typography>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1, flexDirection: 'column', alignItems: 'stretch' }}>
        <Button
          variant="contained"
          fullWidth
          onClick={onResume}
          disabled={loading}
          sx={{
            background: 'var(--color-primary)',
            color: '#fff',
            borderRadius: 2,
            fontWeight: 700,
            py: 1.2,
            '&:hover': { background: 'var(--color-primary-dark, var(--color-primary))' },
          }}
        >
          {loading
            ? <CircularProgress size={20} sx={{ color: '#fff' }} />
            : isDataReady
              ? t('myDocs.resume_generate_btn', 'Generate Document')
              : t('myDocs.resume_continue_btn', 'Continue Session')}
        </Button>
        <Button
          variant="text"
          fullWidth
          onClick={onStartFresh}
          disabled={loading}
          sx={{ color: 'var(--color-text-secondary)', borderRadius: 2 }}
        >
          {t('myDocs.resume_start_fresh_btn', 'Start Over')}
        </Button>
      </DialogActions>
    </Dialog>
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
  const prefersReducedMotion = useReducedMotion();

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
  // 'checking' while querying for existing sessions, 'resume-dialog' when one is found, 'ready' otherwise
  const [initPhase, setInitPhase] = useState('checking');
  const [resumeCandidate, setResumeCandidate] = useState(null);
  const [resumeLoading, setResumeLoading] = useState(false);
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

  // On mount, check for a resumable session for this template before creating a new one.
  useEffect(() => {
    if (!templateSlug) return;
    let cancelled = false;

    async function initSession() {
      try {
        const { data } = await api.get(
          `/chat/sessions?templateSlug=${encodeURIComponent(templateSlug)}&limit=10`
        );
        if (cancelled) return;

        const sessions = data.sessions || [];
        // A session is resumable when the user made real progress or data is already complete
        const resumable = sessions.find((s) =>
          (s.status === 'active' && s.progressPercent > 0) ||
          s.status === 'data_complete' ||
          s.status === 'generating'
        );

        if (resumable) {
          setResumeCandidate(resumable);
          setInitPhase('resume-dialog');
        } else {
          dispatch(clearChat());
          dispatch(createSession({ templateSlug, language: reduxLang || 'en' }));
          setInitPhase('ready');
        }
      } catch {
        if (cancelled) return;
        // On any error just start fresh
        dispatch(clearChat());
        dispatch(createSession({ templateSlug, language: reduxLang || 'en' }));
        setInitPhase('ready');
      }
    }

    initSession();
    return () => { cancelled = true; };
  }, [templateSlug]); // eslint-disable-line react-hooks/exhaustive-deps

  // When data collection is complete → trigger generation → poll for completion
  useEffect(() => {
    if (!dataComplete || navigatedRef.current || !session) return;
    navigatedRef.current = true;
    setShowGenerating(true);

    let poll;
    let pollCount = 0;
    const MAX_POLLS = 60; // 5 minutes at 5-second intervals

    async function startGeneration() {
      let documentId;
      try {
        const { data } = await api.post('/documents/generate', { sessionId: session._id });
        documentId = data.documentId;
      } catch (err) {
        // Document may already exist for this session (e.g. page refresh) — fall back to list
        try {
          const { data } = await api.get(`/documents?sessionId=${session._id}&limit=1`);
          const docs = data.documents || [];
          if (docs.length > 0) documentId = docs[0]._id;
        } catch (_) {}
      }

      if (!documentId) return;

      poll = setInterval(async () => {
        pollCount += 1;
        if (pollCount > MAX_POLLS) {
          clearInterval(poll);
          return;
        }
        try {
          const { data } = await api.get(`/documents/${documentId}`);
          const doc = data.document || data;
          // Document model has no status field — completion is on session.status
          // and content being populated by the Bull job
          const isComplete =
            doc.session?.status === 'completed' ||
            (doc.content && doc.content.length > 0);
          if (isComplete) {
            clearInterval(poll);
            navigate(`/citizen/documents/${documentId}`, { replace: true });
          }
        } catch (_) {}
      }, 5000);
    }

    startGeneration();

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

  const handleResume = useCallback(async () => {
    setResumeLoading(true);
    dispatch(clearChat());
    await dispatch(loadSession(resumeCandidate._id));
    setInitPhase('ready');
    setResumeLoading(false);
    // If status was data_complete/generating, dataComplete selector is now true →
    // the generation useEffect fires automatically on next render
  }, [resumeCandidate, dispatch]);

  const handleStartFresh = useCallback(async () => {
    setInitPhase('ready');
    if (resumeCandidate) {
      // Fire and forget — don't block the new session on this
      dispatch(abandonSession(resumeCandidate._id));
    }
    navigatedRef.current = false;
    dispatch(clearChat());
    dispatch(createSession({ templateSlug, language: reduxLang || 'en' }));
  }, [resumeCandidate, templateSlug, reduxLang, dispatch]);

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

  // Show skeleton while checking for resumable sessions
  if (initPhase === 'checking') {
    return (
      <Box sx={{
        display: 'flex', flexDirection: 'column',
        height: { xs: 'calc(100vh - 56px)', md: 'calc(100vh - 64px)' },
        background: 'var(--color-bg)', p: 2, gap: 1.5,
      }}>
        {[80, 120, 60, 100].map((h, i) => (
          <Skeleton key={i} variant="rounded" height={h} animation="wave"
            sx={{ borderRadius: 2, bgcolor: 'var(--color-surface)', alignSelf: i % 2 === 0 ? 'flex-start' : 'flex-end', width: '65%' }} />
        ))}
        <Box sx={{ flex: 1 }} />
        <Skeleton variant="rounded" height={52} animation="wave"
          sx={{ borderRadius: 3, bgcolor: 'var(--color-surface)' }} />
      </Box>
    );
  }

  return (
    <Box sx={{
      display: 'flex', flexDirection: 'row',
      height: { xs: 'calc(100vh - 56px)', md: 'calc(100vh - 64px)' },
      background: 'var(--color-bg)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* ── Left: chat panel (65% desktop, 100% mobile) ── */}
      <Box sx={{
        flex: { xs: '1 1 100%', md: '0 0 65%' },
        display: 'flex', flexDirection: 'column',
        borderRight: { md: '1px solid var(--color-border)' },
        minWidth: 0,
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
              <GradientHeading variant="body1" component="div" sx={{
                fontWeight: 700, fontFamily: TYPOGRAPHY.fontFamily.display,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                fontSize: '0.95rem',
              }}>
                {templateMeta?.name || templateSlug}
              </GradientHeading>
              <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)' }}>
                {t('myDocs.chat_ai_assistant', 'NyayaSetu AI · Collecting information')}
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
              initial={prefersReducedMotion ? false : { opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={prefersReducedMotion ? undefined : { opacity: 0, y: -8 }}
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
                  animate={prefersReducedMotion ? { opacity: 1 } : { opacity: [1, 0.3, 1] }}
                  transition={{ duration: 1.2, repeat: Infinity }}
                  style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--color-primary)' }}
                />
                <Typography variant="caption" sx={{ color: 'var(--color-primary)', fontWeight: 600 }}>
                  {t('myDocs.chat_ai_thinking', 'AI is thinking…')}
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
                  {t('myDocs.chat_starting', 'Starting conversation…')}
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
                    initial={prefersReducedMotion ? false : { opacity: 0, y: 8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={prefersReducedMotion ? undefined : { opacity: 0, y: 8, scale: 0.95 }}
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
              placeholder={t('myDocs.chat_input_placeholder', 'Type your answer…')}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isStreaming || dataComplete}
              size="small"
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: `${RADIUS.lg}px`,
                  background: 'var(--color-bg)',
                  fontFamily: TYPOGRAPHY.fontFamily.body,
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
            <motion.div whileHover={prefersReducedMotion ? undefined : { scale: 1.06 }} whileTap={prefersReducedMotion ? undefined : { scale: 0.94 }}>
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
      </Box>

      {/* ── Right: document context panel (35% desktop only) ── */}
      <Box sx={{
        display: { xs: 'none', md: 'flex' },
        flex: '0 0 35%',
        flexDirection: 'column',
        overflowY: 'auto',
        p: 3,
        gap: 2,
        background: 'var(--color-bg)',
        '&::-webkit-scrollbar': { width: 4 },
        '&::-webkit-scrollbar-thumb': { background: 'var(--color-border)', borderRadius: 2 },
      }}>
        {/* Template info card */}
        <GlassCard sx={{ p: 2.5 }}>
          <GradientHeading variant="h6" sx={{ fontSize: '1rem', fontFamily: TYPOGRAPHY.fontFamily.display, mb: 1 }}>
            {templateMeta?.name || templateSlug || t('myDocs.template', 'Template')}
          </GradientHeading>
          {templateMeta?.description && (
            <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)', lineHeight: 1.6, display: 'block', mb: 1.5 }}>
              {templateMeta.description}
            </Typography>
          )}
          {/* Progress ring */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ position: 'relative', width: 48, height: 48 }}>
              <CircularProgress
                variant="determinate"
                value={100}
                size={48}
                sx={{ color: 'var(--color-border)', position: 'absolute', top: 0, left: 0 }}
              />
              <CircularProgress
                variant="determinate"
                value={progress}
                size={48}
                sx={{ color: 'var(--color-primary)', position: 'absolute', top: 0, left: 0 }}
              />
              <Typography variant="caption" sx={{
                position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: '0.65rem', color: 'var(--color-primary)',
              }}>
                {progress}%
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" sx={{ fontWeight: 700, color: 'var(--color-text)', display: 'block' }}>
                {t('myDocs.resume_complete', 'Complete')}
              </Typography>
              <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)' }}>
                {t('myDocs.chat_collecting', 'Collecting your information')}
              </Typography>
            </Box>
          </Box>
        </GlassCard>

        {/* Tips card */}
        <GlassCard sx={{ p: 2.5 }}>
          <Typography variant="caption" sx={{
            fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase',
            letterSpacing: '0.08em', display: 'block', mb: 1,
          }}>
            {t('myDocs.tips_title', 'Tips')}
          </Typography>
          {[
            t('myDocs.tip1', 'Answer as clearly as possible — the AI uses your words.'),
            t('myDocs.tip2', 'Use voice input for longer answers.'),
            t('myDocs.tip3', 'You can switch language at any time.'),
          ].map((tip, i) => (
            <Box key={i} sx={{ display: 'flex', gap: 1, mb: 0.75 }}>
              <Typography sx={{ fontSize: '0.7rem', color: 'var(--color-primary)', mt: 0.05 }}>•</Typography>
              <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)', lineHeight: 1.55 }}>
                {tip}
              </Typography>
            </Box>
          ))}
        </GlassCard>
      </Box>

      {/* Resume session dialog */}
      {initPhase === 'resume-dialog' && resumeCandidate && (
        <ResumeDialog
          session={resumeCandidate}
          onResume={handleResume}
          onStartFresh={handleStartFresh}
          loading={resumeLoading}
        />
      )}

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
