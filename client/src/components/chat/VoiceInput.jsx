/**
 * client/src/components/chat/VoiceInput.jsx
 *
 * Hold-to-record voice input.
 *
 * When `sessionId` is provided: records via MediaRecorder and POSTs to
 * /v1/chat/sessions/:id/voice for server-side Whisper transcription
 * (supports all 11 Indian languages).
 *
 * When `sessionId` is absent: falls back to the browser Web Speech API.
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Tooltip from '@mui/material/Tooltip';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import { selectLanguage } from '../../store/slices/uiSlice';
import { useFeatureFlag } from '../../utils/featureFlags';
import api from '../../services/api';

/* ---------------------------------------------------------------------------
 * Language code → BCP-47 locale mapping for Web Speech API fallback
 * ------------------------------------------------------------------------ */
const LANG_TO_BCP47 = {
  en: 'en-IN', hi: 'hi-IN', bn: 'bn-IN', mr: 'mr-IN',
  ta: 'ta-IN', te: 'te-IN', gu: 'gu-IN', kn: 'kn-IN',
  ml: 'ml-IN', pa: 'pa-IN', ur: 'ur-IN',
};

const speechSupported = () =>
  typeof window !== 'undefined' &&
  ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

const mediaRecorderSupported = () =>
  typeof window !== 'undefined' &&
  typeof navigator.mediaDevices?.getUserMedia === 'function' &&
  typeof MediaRecorder !== 'undefined';

/* ---------------------------------------------------------------------------
 * Component
 *
 * Props:
 *   onTranscript(text)  — called with the recognised text
 *   disabled            — disables the button
 *   sessionId           — when provided, uses Whisper via backend instead of
 *                         Web Speech API (required for multilingual support)
 * ------------------------------------------------------------------------ */
function VoiceInput({ onTranscript, disabled = false, sessionId }) {
  const { t } = useTranslation();
  const language = useSelector(selectLanguage);
  const animEnabled = useFeatureFlag('enableScrollReveal');
  const prefersReducedMotion = useReducedMotion();
  const shouldAnimate = animEnabled && !prefersReducedMotion;

  const [recording, setRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [denied, setDenied] = useState(false);
  const [noSupport, setNoSupport] = useState(false);
  const [snackOpen, setSnackOpen] = useState(false);
  const [snackMsg, setSnackMsg] = useState('');
  const [snackSeverity, setSnackSeverity] = useState('info');

  // Web Speech API refs
  const recognitionRef = useRef(null);
  // MediaRecorder refs
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);

  const holdTimerRef = useRef(null);

  const useWhisper = Boolean(sessionId) && mediaRecorderSupported();

  useEffect(() => {
    if (!useWhisper && !speechSupported()) setNoSupport(true);
    return () => {
      stopSpeechRecognition();
      stopMediaRecorder();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showSnack = (msg, severity = 'info') => {
    setSnackMsg(msg);
    setSnackSeverity(severity);
    setSnackOpen(true);
  };

  /* ── Web Speech API path ─────────────────────────────────────────────────── */

  const stopSpeechRecognition = () => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (_) {}
      recognitionRef.current = null;
    }
    setRecording(false);
  };

  const startSpeechRecognition = useCallback(() => {
    if (!speechSupported()) {
      showSnack(t('voice.not_supported', 'Voice input is not supported in this browser. Try Chrome or Edge.'));
      return;
    }
    if (denied) {
      showSnack(t('voice.permission_denied', 'Microphone access was denied. Please allow it in browser settings.'), 'error');
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
        stopSpeechRecognition();
      }
    };

    recognition.onerror = (event) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setDenied(true);
        showSnack(t('voice.permission_denied', 'Microphone permission denied.'), 'error');
      } else if (event.error === 'no-speech') {
        showSnack(t('voice.no_speech', 'No speech detected. Please try again.'));
      }
      stopSpeechRecognition();
    };

    recognition.onend = () => {
      setRecording(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [language, denied, onTranscript, t]);

  /* ── MediaRecorder / Whisper path ────────────────────────────────────────── */

  const stopMediaRecorder = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setRecording(false);
  };

  const startMediaRecorder = useCallback(async () => {
    if (denied) {
      showSnack(t('voice.permission_denied', 'Microphone access was denied. Please allow it in browser settings.'), 'error');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      const recorder = new MediaRecorder(stream, { mimeType });

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;

        if (chunksRef.current.length === 0) return;

        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const file = new File([blob], `voice_${Date.now()}.webm`, { type: 'audio/webm' });

        setUploading(true);
        try {
          const form = new FormData();
          form.append('audio', file);
          const { data } = await api.post(
            `/chat/sessions/${sessionId}/voice`,
            form,
            { headers: { 'Content-Type': 'multipart/form-data' } }
          );
          if (data.transcribedText) {
            onTranscript(data.transcribedText);
          } else {
            showSnack(t('voice.no_speech', 'No speech detected. Please try again.'));
          }
        } catch {
          showSnack(t('voice.transcription_failed', 'Transcription failed. Please try typing instead.'), 'error');
        } finally {
          setUploading(false);
        }
      };

      recorder.start(200);
      mediaRecorderRef.current = recorder;
      setRecording(true);
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        setDenied(true);
        showSnack(t('voice.permission_denied', 'Microphone permission denied.'), 'error');
      } else {
        showSnack(t('voice.mic_error', 'Could not access microphone.'), 'error');
      }
    }
  }, [sessionId, language, denied, onTranscript, t]);

  /* ── Pointer handlers ────────────────────────────────────────────────────── */

  const handlePointerDown = (e) => {
    e.preventDefault();
    if (disabled || noSupport || uploading) return;
    holdTimerRef.current = setTimeout(
      useWhisper ? startMediaRecorder : startSpeechRecognition,
      120,
    );
  };

  const handlePointerUp = () => {
    clearTimeout(holdTimerRef.current);
    if (recording) {
      if (useWhisper) stopMediaRecorder();
      else stopSpeechRecognition();
    }
  };

  if (noSupport) return null;

  const isActive = recording || uploading;

  return (
    <>
      <Tooltip
        title={
          uploading
            ? t('voice.transcribing', 'Transcribing…')
            : recording
              ? t('voice.release', 'Release to send')
              : t('voice.hold', 'Hold to speak')
        }
        placement="top"
      >
        <Box
          component="button"
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          disabled={disabled || uploading}
          aria-label={t('voice.aria', 'Voice input')}
          sx={{
            position: 'relative',
            width: 44, height: 44,
            borderRadius: '50%',
            border: isActive ? 'none' : '2px solid var(--color-primary)',
            background: recording
              ? 'var(--color-error)'
              : uploading
                ? 'var(--color-primary)'
                : 'transparent',
            cursor: disabled || uploading ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.22s, border-color 0.22s',
            userSelect: 'none',
            WebkitUserSelect: 'none',
            outline: 'none',
            flexShrink: 0,
            color: isActive ? '#fff' : 'var(--color-primary)',
            '&:focus-visible': { outline: '2px solid var(--color-primary)', outlineOffset: 2 },
          }}
        >
          {/* Pulsing rings while recording */}
          <AnimatePresence>
            {recording && shouldAnimate && (
              <>
                <motion.div
                  key="pulse-inner"
                  initial={{ scale: 1, opacity: 0.55 }}
                  animate={{ scale: [1, 1.65, 1], opacity: [0.55, 0, 0.55] }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1.1, repeat: Infinity, ease: 'easeOut' }}
                  style={{
                    position: 'absolute', inset: -5,
                    borderRadius: '50%',
                    border: '2px solid var(--color-error)',
                    pointerEvents: 'none',
                  }}
                />
                <motion.div
                  key="pulse-outer"
                  initial={{ scale: 1, opacity: 0.3 }}
                  animate={{ scale: [1, 2.1, 1], opacity: [0.3, 0, 0.3] }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1.1, repeat: Infinity, ease: 'easeOut', delay: 0.22 }}
                  style={{
                    position: 'absolute', inset: -10,
                    borderRadius: '50%',
                    border: '2px solid var(--color-error)',
                    pointerEvents: 'none',
                  }}
                />
              </>
            )}
          </AnimatePresence>

          {uploading
            ? <CircularProgress size={18} thickness={5} sx={{ color: '#fff' }} />
            : recording
              ? <MicOffIcon sx={{ fontSize: 20 }} />
              : <MicIcon sx={{ fontSize: 20 }} />}
        </Box>
      </Tooltip>

      <Snackbar
        open={snackOpen}
        autoHideDuration={4000}
        onClose={() => setSnackOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={snackSeverity}
          onClose={() => setSnackOpen(false)}
          sx={{ borderRadius: 2, background: 'var(--color-surface)', color: 'var(--color-text)' }}
        >
          {snackMsg}
        </Alert>
      </Snackbar>
    </>
  );
}

export default VoiceInput;
