/**
 * client/src/components/consultation/ConsultationChat.jsx
 *
 * Real-time chat panel between a lawyer and a citizen on a specific consultation.
 * Renders as a Drawer (slide-in panel) so it can be overlaid on any page.
 *
 * Props:
 *   consultationId  — string
 *   open            — boolean
 *   onClose         — () => void
 *   otherPartyName  — string (displayed in the header)
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import Drawer from '@mui/material/Drawer';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Avatar from '@mui/material/Avatar';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';

import {
  fetchMessages,
  sendMessageRest,
  receiveMessage,
  clearUnread,
  setActiveChatConsultation,
  clearActiveChatConsultation,
  selectMessages,
  selectChatLoading,
  selectChatSending,
} from '../../store/slices/consultationChatSlice';
import socketService from '../../services/socket';
import { RADIUS } from '../../theme/tokens';

// ─── Single message bubble ─────────────────────────────────────────────────────

function MessageBubble({ message, currentUserId }) {
  const isMine = message.sender?._id === currentUserId || message.sender === currentUserId;
  const senderName = message.sender?.name || 'User';
  const initials = senderName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
  const time = message.createdAt
    ? new Date(message.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
    : '';

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: isMine ? 'row-reverse' : 'row',
        alignItems: 'flex-end',
        gap: 1,
        mb: 1.5,
      }}
    >
      {!isMine && (
        <Avatar sx={{ width: 30, height: 30, fontSize: '0.72rem', background: 'var(--color-primary)', flexShrink: 0 }}>
          {initials}
        </Avatar>
      )}
      <Box sx={{ maxWidth: '72%' }}>
        {!isMine && (
          <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)', display: 'block', mb: 0.25, ml: 0.5 }}>
            {senderName}
          </Typography>
        )}
        <Box
          sx={{
            px: 1.75, py: 1,
            borderRadius: isMine
              ? `${RADIUS.lg}px ${RADIUS.sm}px ${RADIUS.lg}px ${RADIUS.lg}px`
              : `${RADIUS.sm}px ${RADIUS.lg}px ${RADIUS.lg}px ${RADIUS.lg}px`,
            background: isMine ? 'var(--color-primary)' : 'var(--color-surface)',
            border: isMine ? 'none' : '1px solid var(--color-border)',
            color: isMine ? '#fff' : 'var(--color-text)',
          }}
        >
          <Typography variant="body2" sx={{ lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {message.content}
          </Typography>
        </Box>
        <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)', display: 'block', mt: 0.25, textAlign: isMine ? 'right' : 'left', px: 0.5 }}>
          {time}
        </Typography>
      </Box>
    </Box>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ConsultationChat({ consultationId, open, onClose, otherPartyName = 'Lawyer' }) {
  const dispatch   = useDispatch();
  const messages      = useSelector(selectMessages(consultationId));
  const loading       = useSelector(selectChatLoading);
  const sending       = useSelector(selectChatSending);
  const currentUserId = useSelector((state) => state.auth.user?._id || state.auth.user?.id);

  const [text, setText]           = useState('');
  const [typingVisible, setTyping] = useState(false);
  const typingTimer                = useRef(null);
  const bottomRef                  = useRef(null);

  // Load history and join socket room when the drawer opens
  useEffect(() => {
    if (!open || !consultationId) return;

    dispatch(setActiveChatConsultation(consultationId));
    dispatch(fetchMessages({ consultationId, page: 1 }));
    dispatch(clearUnread(consultationId));

    socketService.joinConsultation(consultationId);

    return () => {
      socketService.leaveConsultation(consultationId);
      dispatch(clearActiveChatConsultation());
    };
  }, [open, consultationId, dispatch]);

  // Listen for real-time messages
  useEffect(() => {
    if (!open) return;

    const handleMessage = (message) => {
      dispatch(receiveMessage({ consultationId, message }));
    };
    const handleTyping = ({ isTyping }) => {
      setTyping(isTyping);
      if (isTyping) {
        clearTimeout(typingTimer.current);
        typingTimer.current = setTimeout(() => setTyping(false), 3000);
      }
    };

    socketService.on('consultation:message', handleMessage);
    socketService.on('consultation:typing',  handleTyping);

    return () => {
      socketService.off('consultation:message', handleMessage);
      socketService.off('consultation:typing',  handleTyping);
      clearTimeout(typingTimer.current);
    };
  }, [open, consultationId, dispatch]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = useCallback(async () => {
    const content = text.trim();
    if (!content || sending) return;
    setText('');
    socketService.sendTyping(consultationId, false);

    // Prefer socket emission; fall back to REST if socket is not connected
    if (socketService.isConnected) {
      socketService.sendMessage(consultationId, content);
    } else {
      dispatch(sendMessageRest({ consultationId, content }));
    }
  }, [text, sending, consultationId, dispatch]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTextChange = (e) => {
    setText(e.target.value);
    socketService.sendTyping(consultationId, !!e.target.value);
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: '100vw', sm: 400 },
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--color-bg)',
        },
      }}
    >
      {/* Header */}
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 1.5,
        px: 2, py: 1.5,
        borderBottom: '1px solid var(--color-border)',
        background: 'var(--color-surface)',
        flexShrink: 0,
      }}>
        <Avatar sx={{ width: 36, height: 36, background: 'var(--color-primary)', fontSize: '0.9rem', fontWeight: 700 }}>
          {otherPartyName?.[0]?.toUpperCase() || '?'}
        </Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" sx={{ fontWeight: 700, color: 'var(--color-text)', lineHeight: 1.2 }}>
            {otherPartyName}
          </Typography>
          <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)' }}>
            {typingVisible ? 'typing…' : 'Consultation Chat'}
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small" sx={{ color: 'var(--color-text-secondary)' }}>
          ✕
        </IconButton>
      </Box>

      {/* Messages area */}
      <Box sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
        {loading && messages.length === 0 ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={28} sx={{ color: 'var(--color-primary)' }} />
          </Box>
        ) : messages.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <Typography sx={{ fontSize: 40, mb: 1.5 }}>💬</Typography>
            <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)' }}>
              No messages yet. Start the conversation!
            </Typography>
          </Box>
        ) : (
          messages.map((msg) => (
            <MessageBubble key={msg._id} message={msg} currentUserId={currentUserId} />
          ))
        )}
        {typingVisible && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>
              {otherPartyName} is typing…
            </Typography>
          </Box>
        )}
        <div ref={bottomRef} />
      </Box>

      {/* Input area */}
      <Divider />
      <Box sx={{ p: 1.5, display: 'flex', gap: 1, alignItems: 'flex-end', flexShrink: 0, background: 'var(--color-surface)' }}>
        <TextField
          fullWidth
          multiline
          maxRows={4}
          size="small"
          placeholder="Type a message…"
          value={text}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          sx={{
            '& .MuiOutlinedInput-root': {
              background: 'var(--color-bg)',
              borderRadius: `${RADIUS.lg}px`,
              '& fieldset': { borderColor: 'var(--color-border)' },
              '&:hover fieldset': { borderColor: 'var(--color-primary)' },
              '&.Mui-focused fieldset': { borderColor: 'var(--color-primary)' },
            },
            '& .MuiInputBase-input': { color: 'var(--color-text)', fontSize: '0.875rem' },
          }}
        />
        <Button
          variant="contained"
          onClick={handleSend}
          disabled={!text.trim() || sending}
          sx={{
            minWidth: 44, height: 44, borderRadius: `${RADIUS.lg}px`,
            background: 'var(--color-primary)',
            '&:hover': { background: 'var(--color-primary)' },
            '&.Mui-disabled': { opacity: 0.5 },
            flexShrink: 0,
            fontSize: '1.1rem',
            px: 1.25,
          }}
        >
          {sending ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : '➤'}
        </Button>
      </Box>
    </Drawer>
  );
}
