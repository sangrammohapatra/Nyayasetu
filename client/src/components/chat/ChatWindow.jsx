/**
 * ChatWindow Component — main chat interface
 * Features:
 * - Real-time message streaming with SSE
 * - Voice input with visual feedback
 * - Message quota indicator with upgrade prompts
 * - Legal citations + document suggestions
 * - Share with lawyer functionality
 * - Multi-language support
 */

import React, { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Paper,
  TextField,
  IconButton,
  Chip,
  CircularProgress,
  Alert,
  Tooltip,
  Menu,
  MenuItem,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Send as SendIcon,
  Mic as MicIcon,
  MicOff as MicOffIcon,
  Share as ShareIcon,
  Archive as ArchiveIcon,
  Delete as DeleteIcon,
  MoreVert as MoreVertIcon,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import {
  sendMessage,
  sendVoiceMessage,
  addUserMessage,
  getQuotaStatus,
  shareChat,
  archiveChat,
  deleteChat,
  clearError,
} from '../store/slices/chatSlice';
import MessageBubble from './MessageBubble';
import QuotaIndicator from './QuotaIndicator';
import LegalCitationCard from './LegalCitationCard';
import { useMediaQuery } from '@mui/material';

const ChatWindow = ({ sessionId, initialMessages = [] }) => {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // Redux state
  const messages = useSelector((state) => state.chat.messages[sessionId] || initialMessages);
  const quota = useSelector((state) => state.chat.quota);
  const loading = useSelector((state) => state.chat.loading);
  const streaming = useSelector((state) => state.chat.streaming);
  const error = useSelector((state) => state.chat.error);
  const userPlan = useSelector((state) => state.auth.user?.subscription?.plan || 'free');

  // Local state
  const [inputValue, setInputValue] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [anchorEl, setAnchorEl] = useState(null);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [showCitations, setShowCitations] = useState(false);

  const messagesEndRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordingIntervalRef = useRef(null);
  const audioChunksRef = useRef([]);

  // ============================================================================
  // AUTO-SCROLL TO LATEST MESSAGE
  // ============================================================================
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ============================================================================
  // LOAD QUOTA STATUS ON MOUNT
  // ============================================================================
  useEffect(() => {
    dispatch(getQuotaStatus());
  }, [dispatch]);

  // ============================================================================
  // SEND TEXT MESSAGE
  // ============================================================================
  const handleSendMessage = async (e) => {
    e.preventDefault();

    if (!inputValue.trim()) return;

    // Check quota
    if (quota.remainingMessages <= 0 && !quota.unlimited) {
      dispatch(
        clearError()
      );
      // Show upgrade prompt
      return;
    }

    // Optimistically add user message
    dispatch(addUserMessage({ sessionId, message: { content: inputValue } }));
    setInputValue('');

    // Send to backend
    try {
      await dispatch(
        sendMessage({ sessionId, content: inputValue.trim(), audioUrl: null })
      ).unwrap();
    } catch (err) {
      // Error already handled by Redux
    }
  };

  // ============================================================================
  // VOICE RECORDING
  // ============================================================================
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        audioChunksRef.current.push(e.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        const audioFile = new File([audioBlob], 'recording.wav', { type: 'audio/wav' });

        // Send voice message
        try {
          await dispatch(
            sendVoiceMessage({ sessionId, audioFile })
          ).unwrap();
        } catch (err) {
          // Error already handled
        }

        // Stop all tracks
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setRecordingTime(0);

      // Update recording time every second
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      dispatch(clearError());
      // Could show "Microphone access denied" error
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(recordingIntervalRef.current);
    }
  };

  // ============================================================================
  // HANDLE QUOTA EXCEEDED
  // ============================================================================
  const handleQuotaExceeded = () => {
    return (
      <Alert severity="warning" sx={{ mb: 2 }}>
        <Box>
          <strong>{t('chat.quotaExceeded')}</strong>
          <p>{t('chat.upgradePrompt')}</p>
          <Button
            size="small"
            variant="contained"
            href="/pricing"
            sx={{
              background: 'var(--color-primary)',
              '&:hover': { background: 'var(--color-primary-light)' },
            }}
          >
            {t('chat.upgradeToPro')}
          </Button>
        </Box>
      </Alert>
    );
  };

  // ============================================================================
  // HANDLE SHARE
  // ============================================================================
  const handleShare = async (lawyerId) => {
    try {
      await dispatch(
        shareChat({ sessionId, lawyerId, expiryDays: 30 })
      ).unwrap();
      setShareDialogOpen(false);
      setAnchorEl(null);
    } catch (err) {
      // Error handled by Redux
    }
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <Box
      component={motion.div}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        bgcolor: 'var(--color-bg)',
      }}
    >
      {/* HEADER */}
      <Paper
        elevation={1}
        sx={{
          p: 2,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderRadius: 0,
        }}
      >
        <Box>
          <h2 style={{ color: 'var(--color-text)', margin: '0 0 8px 0' }}>
            {t('chat.title')}
          </h2>
          <Chip
            label={`${quota.remainingMessages}/${quota.totalDailyQuota || '∞'} ${t('chat.messagesRemaining')}`}
            color={quota.remainingMessages <= 2 ? 'error' : 'primary'}
            size="small"
          />
        </Box>

        <Box>
          <Tooltip title={t('chat.share')}>
            <IconButton size="small" onClick={(e) => setAnchorEl(e.currentTarget)}>
              <MoreVertIcon />
            </IconButton>
          </Tooltip>

          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={() => setAnchorEl(null)}
          >
            <MenuItem onClick={() => setShareDialogOpen(true)}>
              <ShareIcon sx={{ mr: 1 }} /> {t('chat.shareWithLawyer')}
            </MenuItem>
            <MenuItem onClick={() => dispatch(archiveChat(sessionId))}>
              <ArchiveIcon sx={{ mr: 1 }} /> {t('chat.archive')}
            </MenuItem>
            <MenuItem
              onClick={() => {
                dispatch(deleteChat(sessionId));
                setAnchorEl(null);
              }}
            >
              <DeleteIcon sx={{ mr: 1 }} /> {t('chat.delete')}
            </MenuItem>
          </Menu>
        </Box>
      </Paper>

      {/* QUOTA ALERT */}
      {quota.remainingMessages <= 0 && !quota.unlimited && handleQuotaExceeded()}

      {/* ERROR ALERT */}
      {error && (
        <Alert severity="error" sx={{ m: 2 }}>
          {error.message || error.error || t('chat.error')}
        </Alert>
      )}

      {/* MESSAGES CONTAINER */}
      <Box
        sx={{
          flex: 1,
          overflowY: 'auto',
          p: 2,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        <AnimatePresence>
          {messages.map((msg, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <MessageBubble
                message={msg}
                isUser={msg.role === 'user'}
                citations={msg.citations}
                suggestions={msg.suggestions}
                nextQuestions={msg.nextQuestions}
              />
            </motion.div>
          ))}
        </AnimatePresence>

        {/* STREAMING INDICATOR */}
        {streaming && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <CircularProgress size={20} />
              <span style={{ color: 'var(--color-text-secondary)' }}>
                {t('chat.aiThinking')}
              </span>
            </Box>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </Box>

      {/* INPUT AREA */}
      <Paper
        sx={{
          p: 2,
          m: 2,
          borderRadius: 2,
          bgcolor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
        }}
      >
        {/* RECORDING INDICATOR */}
        {isRecording && (
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '12px',
              padding: '8px',
              backgroundColor: 'rgba(244, 67, 54, 0.1)',
              borderRadius: '8px',
            }}
          >
            <motion.div
              animate={{ opacity: [1, 0.5, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
            >
              <MicIcon sx={{ color: 'error.main' }} />
            </motion.div>
            <span style={{ color: 'var(--color-text)' }}>
              {t('chat.recording')} {Math.floor(recordingTime / 60)}:
              {String(recordingTime % 60).padStart(2, '0')}
            </span>
          </motion.div>
        )}

        <Box component="form" onSubmit={handleSendMessage} sx={{ display: 'flex', gap: 1 }}>
          <TextField
            fullWidth
            placeholder={t('chat.typeMessage')}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            disabled={streaming || (quota.remainingMessages <= 0 && !quota.unlimited)}
            multiline
            maxRows={3}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderColor: 'var(--color-border)',
                '&:hover': { borderColor: 'var(--color-primary)' },
                color: 'var(--color-text)',
              },
            }}
          />

          <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
            <Tooltip title={isRecording ? t('chat.stopRecording') : t('chat.startRecording')}>
              <IconButton
                type="button"
                onClick={isRecording ? stopRecording : startRecording}
                sx={{
                  color: isRecording ? 'error.main' : 'primary.main',
                }}
              >
                {isRecording ? <MicOffIcon /> : <MicIcon />}
              </IconButton>
            </Tooltip>

            <Tooltip title={t('chat.send')}>
              <span>
                <IconButton
                  type="submit"
                  disabled={!inputValue.trim() || streaming || loading}
                  sx={{ color: 'var(--color-primary)' }}
                >
                  <SendIcon />
                </IconButton>
              </span>
            </Tooltip>
          </Box>
        </Box>

        {/* QUOTA INFO */}
        {!quota.unlimited && (
          <Box sx={{ mt: 1, fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
            {t('chat.quotaInfo', {
              remaining: quota.remainingMessages,
              total: quota.totalDailyQuota,
            })}
          </Box>
        )}
      </Paper>

      {/* SHARE DIALOG */}
      <Dialog open={shareDialogOpen} onClose={() => setShareDialogOpen(false)}>
        <DialogTitle>{t('chat.shareWithLawyer')}</DialogTitle>
        <DialogContent>
          <p>{t('chat.shareDescription')}</p>
          {/* In production, add a lawyer selector here */}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShareDialogOpen(false)}>{t('common.cancel')}</Button>
          <Button onClick={() => handleShare(null)} variant="contained">
            {t('common.share')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ChatWindow;
