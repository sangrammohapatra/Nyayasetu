import { useState, useCallback } from 'react';

const STORAGE_KEY = 'nyayasetu_offline_docs';

function readPinned() {
  try { return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')); }
  catch { return new Set(); }
}

function writePinned(set) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
}

export function useOfflineDocuments() {
  const [pinned, setPinned] = useState(readPinned);

  const isPinned = useCallback((id) => pinned.has(id), [pinned]);

  const pin = useCallback(async (documentId) => {
    // Warm the Workbox runtime cache for this document
    const token = localStorage.getItem('nyayasetu_token');
    const base  = import.meta.env.VITE_API_URL || '/v1';
    try {
      await fetch(`${base}/documents/${documentId}`, {
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
    } catch {
      // Offline — cache will be warmed next time they open it online
    }

    setPinned((prev) => {
      const next = new Set(prev);
      next.add(documentId);
      writePinned(next);
      return next;
    });
  }, []);

  const unpin = useCallback((documentId) => {
    setPinned((prev) => {
      const next = new Set(prev);
      next.delete(documentId);
      writePinned(next);
      return next;
    });
  }, []);

  return { pinned, isPinned, pin, unpin };
}
