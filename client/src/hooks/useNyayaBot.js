/**
 * useNyayaBot.js
 * Custom hook that powers both NyayaBotWidget and NyayaBotPage.
 * Handles session lifecycle, message sending, voice input, and quota tracking.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  createNyayaBotSession,
  getNyayaBotSession,
  listNyayaBotSessions,
  sendNyayaBotMessage,
  rateNyayaBotMessage,
  archiveNyayaBotSession,
  deleteNyayaBotSession,
  shareNyayaBotSession,
  getNyayaBotQuota,
  toggleWidget,
  clearError,
} from '../store/slices/nyayabotSlice';
import api from '../services/api';

// ─── Main useNyayaBot hook ────────────────────────────────────────────────────

export function useNyayaBot(sessionId = null) {
  const dispatch = useDispatch();

  const messages = useSelector(
    (s) => s.nyayabot.messages[sessionId || s.nyayabot.activeSessionId] || []
  );
  const activeSessionId = useSelector((s) => sessionId || s.nyayabot.activeSessionId);
  const quota = useSelector((s) => s.nyayabot.quota);
  const loading = useSelector((s) => s.nyayabot.loading);
  const creating = useSelector((s) => s.nyayabot.creating);
  const isStreaming = useSelector(
    (s) => s.nyayabot.streamingSessionId === (sessionId || s.nyayabot.activeSessionId)
  );
  const error = useSelector((s) => s.nyayabot.error || s.nyayabot.streamError);
  const isWidgetOpen = useSelector((s) => s.nyayabot.isWidgetOpen);

  // ── Initialize: create or load session ─────────────────────────────────
  const initialize = useCallback(
    async (options = {}) => {
      if (sessionId) {
        return dispatch(getNyayaBotSession(sessionId));
      }
      return dispatch(createNyayaBotSession(options));
    },
    [sessionId, dispatch]
  );

  // ── Send text message ───────────────────────────────────────────────────
  const sendMessage = useCallback(
    async (content) => {
      if (!activeSessionId || !content?.trim()) return;
      if (!quota.unlimited && quota.remaining <= 0) {
        throw new Error('NYAYABOT_QUOTA_EXCEEDED');
      }
      return dispatch(sendNyayaBotMessage({ sessionId: activeSessionId, content: content.trim() }));
    },
    [activeSessionId, quota, dispatch]
  );

  // ── Rate a message ──────────────────────────────────────────────────────
  const rateMessage = useCallback(
    (messageId, thumbsUp) => {
      if (!activeSessionId) return;
      return dispatch(rateNyayaBotMessage({ sessionId: activeSessionId, messageId, thumbsUp }));
    },
    [activeSessionId, dispatch]
  );

  // ── Archive session ─────────────────────────────────────────────────────
  const archiveSession = useCallback(
    (archive = true) => {
      if (!activeSessionId) return;
      return dispatch(archiveNyayaBotSession({ sessionId: activeSessionId, archive }));
    },
    [activeSessionId, dispatch]
  );

  // ── Delete session ──────────────────────────────────────────────────────
  const deleteSession = useCallback(
    (sid) => dispatch(deleteNyayaBotSession(sid || activeSessionId)),
    [activeSessionId, dispatch]
  );

  // ── Share session ───────────────────────────────────────────────────────
  const shareSession = useCallback(
    (options = {}) => {
      if (!activeSessionId) return;
      return dispatch(shareNyayaBotSession({ sessionId: activeSessionId, ...options }));
    },
    [activeSessionId, dispatch]
  );

  // ── Refresh quota ───────────────────────────────────────────────────────
  const refreshQuota = useCallback(() => dispatch(getNyayaBotQuota()), [dispatch]);

  // ── Toggle widget ───────────────────────────────────────────────────────
  const toggle = useCallback(() => dispatch(toggleWidget()), [dispatch]);

  const clear = useCallback(() => dispatch(clearError()), [dispatch]);

  return {
    sessionId: activeSessionId,
    messages,
    quota,
    loading,
    creating,
    isStreaming,
    error,
    isWidgetOpen,

    initialize,
    sendMessage,
    rateMessage,
    archiveSession,
    deleteSession,
    shareSession,
    refreshQuota,
    toggleWidget: toggle,
    clearError: clear,

    canSend: !!activeSessionId && !isStreaming && (quota.unlimited || quota.remaining > 0),
    isQuotaExhausted: !quota.unlimited && quota.remaining <= 0,
  };
}

// ─── useVoiceInput hook ───────────────────────────────────────────────────────

export function useVoiceInput({ onTranscript, sessionId }) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [error, setError] = useState(null);

  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);

  const start = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunksRef.current = [];
      recorderRef.current = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });

      recorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorderRef.current.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const file = new File([blob], `voice_${Date.now()}.webm`, { type: 'audio/webm' });

        // Upload for transcription
        try {
          const form = new FormData();
          form.append('audio', file);
          const { data } = await api.post(
            `/nyayabot/sessions/${sessionId}/voice`,
            form,
            { headers: { 'Content-Type': 'multipart/form-data' } }
          );
          if (data.transcript) onTranscript?.(data.transcript);
        } catch (err) {
          setError('Transcription failed. Please type your message instead.');
        }
      };

      recorderRef.current.start(200); // collect in 200ms chunks
      setIsRecording(true);
      setRecordingSeconds(0);
      timerRef.current = setInterval(() => setRecordingSeconds((s) => s + 1), 1000);
    } catch (err) {
      const msg =
        err.name === 'NotAllowedError'
          ? 'Microphone access denied. Please allow microphone permissions and try again.'
          : 'Could not access microphone.';
      setError(msg);
    }
  }, [sessionId, onTranscript]);

  const stop = useCallback(() => {
    recorderRef.current?.stop();
    clearInterval(timerRef.current);
    setIsRecording(false);
  }, []);

  const cancel = useCallback(() => {
    if (recorderRef.current?.state !== 'inactive') {
      recorderRef.current.ondataavailable = null;
      recorderRef.current.onstop = null;
      recorderRef.current.stop();
    }
    clearInterval(timerRef.current);
    setIsRecording(false);
    chunksRef.current = [];
  }, []);

  // Cleanup on unmount
  useEffect(() => () => { clearInterval(timerRef.current); }, []);

  const formatTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return { isRecording, recordingSeconds, error, start, stop, cancel, formatTime };
}
