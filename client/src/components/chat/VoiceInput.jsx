/**
 * client/src/components/chat/VoiceInput.jsx
 *
 * Hold-to-record voice input using the Web Speech API.
 * Gracefully handles permission denial and browsers that don't support it.
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import { selectLanguage } from '../../store/slices/uiSlice';

/* ---------------------------------------------------------------------------
 * Language code → BCP-47 locale mapping for SpeechRecognition
 * ------------------------------------------------------------------------ */
const LANG_TO_BCP47 = {
  en: 'en-IN', hi: 'hi-IN', bn: 'bn-IN', mr: 'mr-IN',
  ta: 'ta-IN', te: 'te-IN', gu: 'gu-IN', kn: 'kn-IN',
  ml: 'ml-IN', pa: 'pa-IN', ur: 'ur-IN',
};

const isSupported = () =>
  typeof window !== 'undefined' &&
  ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

/* ---------------------------------------------------------------------------
 * Component
 *
 * Props:
 *   onTranscript(text)  — called with the recognised text
 *   disabled            — disables the button
 * ------------------------------------------------------------------------ */
function VoiceInput({ onTranscript, disabled = false }) {
  const { t } = useTranslation();
  const language = useSelector(selectLanguage);
  const [recording, setRecording] = useState(false);
  const [denied, setDenied] = useState(false);
  const [noSupport, setNoSupport] = useState(false);
  const [snackOpen, setSnackOpen] = useState(false);
  const [snackMsg, setSnackMsg] = useState('');
  const recognitionRef = useRef(null);
  const holdTimerRef = useRef(null);

  useEffect(() => {
    if (!isSupported()) setNoSupport(true);
    return () => stopRecognition();
  }, []);

  const stopRecognition = () => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (_) {}
      recognitionRef.current = null;
    }
    clearTimeout(holdTimerRef.current);
    setRecording(false);
  };

  const startRecognition = useCallback(() => {
    if (!isSupported()) {
      setSnackMsg(t('voice.not_supported', 'Voice input is not supported in this browser. Try Chrome or Edge.'));
      setSnackOpen(true);
      return;
    }
    if (denied) {
      setSnackMsg(t('voice.permission_denied', 'Microphone access was denied. Please allow it in browser settings.'));
      setSnackOpen(true);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = LANG_TO_BCP47[language] || 'en-IN';
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setRecording(true);

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((r) => r[0].transcript)
        .join('');
      if (event.results[event.results.length - 1].isFinal) {
        onTranscript(transcript);
        stopRecognition();
      }
    };

    recognition.onerror = (event) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setDenied(true);
        setSnackMsg(t('voice.permission_denied', 'Microphone permission denied.'));
        setSnackOpen(true);
      } else if (event.error === 'no-speech') {
        setSnackMsg(t('voice.no_speech', 'No speech detected. Please try again.'));
        setSnackOpen(true);
      }
      stopRecognition();
    };

    recognition.onend = () => {
      setRecording(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [language, denied, onTranscript, t]);

  const handlePointerDown = (e) => {
    e.preventDefault();
    if (disabled || noSupport) return;
    // Small delay before starting so accidental taps don't trigger
    holdTimerRef.current = setTimeout(startRecognition, 120);
  };

  const handlePointerUp = () => {
    clearTimeout(holdTimerRef.current);
    if (recording) stopRecognition();
  };

  if (noSupport) return null;

  return (
    <>
      <Tooltip
        title={recording
          ? t('voice.release', 'Release to send')
          : t('voice.hold', 'Hold to speak')}
        placement="top"
      >
        <Box
          component="button"
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          disabled={disabled}
          aria-label={t('voice.aria', 'Voice input')}
          sx={{
            position: 'relative',
            width: 44, height: 44,
            borderRadius: '50%',
            border: 'none',
            background: recording ? 'var(--color-error)' : 'var(--color-border)',
            cursor: disabled ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20,
            transition: 'background 0.2s',
            userSelect: 'none',
            WebkitUserSelect: 'none',
            outline: 'none',
            flexShrink: 0,
            '&:focus-visible': { outline: '2px solid var(--color-primary)', outlineOffset: 2 },
          }}
        >
          {/* Pulsing ring when recording */}
          <AnimatePresence>
            {recording && (
              <motion.div
                key="pulse"
                initial={{ scale: 1, opacity: 0.6 }}
                animate={{ scale: [1, 1.7, 1], opacity: [0.6, 0, 0.6] }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.1, repeat: Infinity, ease: 'easeOut' }}
                style={{
                  position: 'absolute', inset: -4,
                  borderRadius: '50%',
                  border: '2px solid var(--color-error)',
                  pointerEvents: 'none',
                }}
              />
            )}
          </AnimatePresence>

          <Typography sx={{ fontSize: 20, lineHeight: 1, userSelect: 'none' }}>
            {recording ? '🔴' : '🎤'}
          </Typography>
        </Box>
      </Tooltip>

      <Snackbar
        open={snackOpen}
        autoHideDuration={4000}
        onClose={() => setSnackOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={denied ? 'error' : 'info'} onClose={() => setSnackOpen(false)}
          sx={{ borderRadius: 2, background: 'var(--color-surface)', color: 'var(--color-text)' }}>
          {snackMsg}
        </Alert>
      </Snackbar>
    </>
  );
}

export default VoiceInput;
