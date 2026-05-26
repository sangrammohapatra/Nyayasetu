/**
 * useChat Hook — encapsulates chat logic for reuse across components
 * Handles:
 * - Session creation/loading
 * - Message sending (text + voice)
 * - Quota tracking
 * - Error handling
 */

import { useCallback, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  createChatSession,
  getChatSession,
  sendMessage,
  sendVoiceMessage,
  getQuotaStatus,
  addUserMessage,
} from '../store/slices/chatSlice';

export const useChat = (sessionId = null) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const [isInitialized, setIsInitialized] = useState(false);
  const [sessionCreated, setSessionCreated] = useState(false);

  // Redux state
  const currentSessionId = useSelector((state) => state.chat.currentSessionId);
  const messages = useSelector((state) => state.chat.messages[sessionId || currentSessionId] || []);
  const quota = useSelector((state) => state.chat.quota);
  const loading = useSelector((state) => state.chat.loading);
  const streaming = useSelector((state) => state.chat.streaming);
  const error = useSelector((state) => state.chat.error);

  // ============================================================================
  // INITIALIZE: CREATE OR LOAD SESSION
  // ============================================================================
  useEffect(() => {
    const initialize = async () => {
      if (!sessionId) {
        // Create new session
        const result = await dispatch(
          createChatSession({
            title: `Legal Chat ${new Date().toLocaleDateString()}`,
          })
        );

        if (result.payload?.sessionId) {
          setSessionCreated(true);
        }
      } else {
        // Load existing session
        const result = await dispatch(getChatSession(sessionId));
        if (result.payload?.sessionId) {
          setSessionCreated(true);
        }
      }

      // Load quota
      await dispatch(getQuotaStatus());
      setIsInitialized(true);
    };

    initialize();
  }, [sessionId, dispatch]);

  // ============================================================================
  // SEND MESSAGE (with quota check)
  // ============================================================================
  const handleSendMessage = useCallback(
    async (content, audioUrl = null) => {
      const activeSessionId = sessionId || currentSessionId;

      if (!activeSessionId) {
        throw new Error('No active chat session');
      }

      // Check quota
      if (quota.remainingMessages <= 0 && !quota.unlimited) {
        throw new Error('QUOTA_EXCEEDED');
      }

      // Optimistically add message
      dispatch(
        addUserMessage({
          sessionId: activeSessionId,
          message: { content, audioUrl },
        })
      );

      // Send to backend
      const result = await dispatch(
        sendMessage({
          sessionId: activeSessionId,
          content,
          audioUrl,
        })
      );

      return result.payload;
    },
    [sessionId, currentSessionId, quota, dispatch]
  );

  // ============================================================================
  // SEND VOICE MESSAGE
  // ============================================================================
  const handleSendVoiceMessage = useCallback(
    async (audioFile) => {
      const activeSessionId = sessionId || currentSessionId;

      if (!activeSessionId) {
        throw new Error('No active chat session');
      }

      // Check quota
      if (quota.remainingMessages <= 0 && !quota.unlimited) {
        throw new Error('QUOTA_EXCEEDED');
      }

      const result = await dispatch(
        sendVoiceMessage({
          sessionId: activeSessionId,
          audioFile,
        })
      );

      return result.payload;
    },
    [sessionId, currentSessionId, quota, dispatch]
  );

  // ============================================================================
  // REFRESH QUOTA
  // ============================================================================
  const refreshQuota = useCallback(async () => {
    await dispatch(getQuotaStatus());
  }, [dispatch]);

  // ============================================================================
  // GET ACTIVE SESSION ID
  // ============================================================================
  const activeSessionId = sessionId || currentSessionId;

  return {
    // State
    sessionId: activeSessionId,
    messages,
    quota,
    loading,
    streaming,
    error,
    isInitialized,
    sessionCreated,

    // Methods
    sendMessage: handleSendMessage,
    sendVoiceMessage: handleSendVoiceMessage,
    refreshQuota,

    // Utility
    canSendMessage: quota.remainingMessages > 0 || quota.unlimited,
    isQuotaExceeded: quota.remainingMessages <= 0 && !quota.unlimited,
  };
};

// ============================================================================
// useVoiceRecording HOOK — abstracts voice recording logic
// ============================================================================

export const useVoiceRecording = (onRecordingComplete) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordingError, setRecordingError] = useState(null);

  const mediaRecorderRef = React.useRef(null);
  const recordingIntervalRef = React.useRef(null);
  const audioChunksRef = React.useRef([]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        audioChunksRef.current.push(e.data);
      };

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        const audioFile = new File([audioBlob], 'recording.wav', { type: 'audio/wav' });

        if (onRecordingComplete) {
          onRecordingComplete(audioFile);
        }

        // Cleanup
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setRecordingTime(0);
      setRecordingError(null);

      // Update time
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      setRecordingError(
        error.name === 'NotAllowedError'
          ? 'Microphone access denied'
          : error.message
      );
      setIsRecording(false);
    }
  }, [onRecordingComplete]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(recordingIntervalRef.current);
    }
  }, [isRecording]);

  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.abort();
      setIsRecording(false);
      clearInterval(recordingIntervalRef.current);
      audioChunksRef.current = [];
    }
  }, [isRecording]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  return {
    isRecording,
    recordingTime,
    recordingError,
    startRecording,
    stopRecording,
    cancelRecording,
    formatTime,
  };
};

export default useChat;
