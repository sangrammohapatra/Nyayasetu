/**
 * client/src/hooks/useDocumentStream.js
 *
 * Manages a Server-Sent Events (EventSource) connection for document generation
 * progress updates. The backend emits events on a GET SSE channel keyed by
 * document ID once generation is queued.
 *
 * Unlike the chat SSE (which uses POST + fetch), document generation status
 * uses a GET SSE endpoint that can use the native EventSource API.
 *
 * Events emitted by the server:
 *   event: progress  data: { percent: number, stage: string }
 *   event: complete  data: { documentId, pdfUrl }
 *   event: error     data: { message: string }
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { setGenerationProgress, getDocument } from '../store/slices/documentSlice';

const BASE_URL = import.meta.env.VITE_API_URL || '/v1';

/**
 * @param {string|null} documentId  The document ID to stream progress for.
 *                                  Pass null to not open a connection.
 * @returns {{
 *   isStreaming: boolean,
 *   progress: number,
 *   stage: string,
 *   buffer: string,
 *   error: string|null,
 *   startStream: (docId: string) => void,
 *   stopStream: () => void,
 * }}
 */
export function useDocumentStream(documentId = null) {
  const dispatch = useDispatch();
  const esRef = useRef(null);

  const [isStreaming, setIsStreaming] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState('');
  const [buffer, setBuffer] = useState('');
  const [error, setError] = useState(null);
  const [activeDocId, setActiveDocId] = useState(documentId);

  const stopStream = useCallback(() => {
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  const startStream = useCallback(
    (docId) => {
      if (!docId) return;
      stopStream();

      const token = localStorage.getItem('nyayasetu_token');
      // EventSource doesn't support custom headers — append token as query param
      // (backend must accept token via query param on SSE endpoints)
      const url = `${BASE_URL}/documents/${docId}/stream?token=${encodeURIComponent(token || '')}`;

      const es = new EventSource(url, { withCredentials: true });
      esRef.current = es;
      setActiveDocId(docId);
      setIsStreaming(true);
      setProgress(0);
      setStage('');
      setBuffer('');
      setError(null);

      es.addEventListener('progress', (e) => {
        try {
          const payload = JSON.parse(e.data);
          const pct = payload.percent ?? 0;
          const stageLabel = payload.stage || '';
          setProgress(pct);
          setStage(stageLabel);
          dispatch(setGenerationProgress(pct));
        } catch (_) {}
      });

      es.addEventListener('delta', (e) => {
        setBuffer((prev) => prev + (e.data || ''));
      });

      es.addEventListener('complete', (e) => {
        try {
          const payload = JSON.parse(e.data);
          setProgress(100);
          setStage('complete');
          setIsStreaming(false);
          dispatch(setGenerationProgress(100));
          // Refresh document record in the store so PDF URL is up to date
          if (payload.documentId) {
            dispatch(getDocument(payload.documentId));
          }
        } catch (_) {}
        es.close();
        esRef.current = null;
      });

      es.addEventListener('error', (e) => {
        let msg = 'Document generation failed';
        if (e.data) {
          try { msg = JSON.parse(e.data).message || msg; } catch (_) {}
        }
        setError(msg);
        setIsStreaming(false);
        es.close();
        esRef.current = null;
      });

      // Native onerror (connection dropped)
      es.onerror = () => {
        if (es.readyState === EventSource.CLOSED) {
          setIsStreaming(false);
          esRef.current = null;
        }
      };
    },
    [dispatch, stopStream]
  );

  // Auto-connect when documentId prop is provided
  useEffect(() => {
    if (documentId && documentId !== activeDocId) {
      startStream(documentId);
    }
    return () => {
      stopStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId]);

  return {
    isStreaming,
    progress,
    stage,
    buffer,
    error,
    startStream,
    stopStream,
  };
}

export default useDocumentStream;
