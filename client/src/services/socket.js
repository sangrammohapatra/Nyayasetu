/**
 * client/src/services/socket.js
 *
 * Singleton Socket.IO client.
 * Call connect(token) once on login; disconnect() on logout.
 * Import { socketService } wherever you need to emit or subscribe.
 */

import { io } from 'socket.io-client';

const SERVER_URL = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace('/v1', '')
  : 'http://localhost:5000';

const AUTH_ERRORS = new Set(['SOCKET_INVALID_TOKEN', 'SOCKET_AUTH_REQUIRED', 'SOCKET_USER_NOT_FOUND']);

class SocketService {
  constructor() {
    this.socket = null;
    this.listeners = new Map();
    this.joinedConsultations = new Set();
  }

  connect(token) {
    if (!token) return;

    if (this.socket) {
      this.socket.auth = { token };
      if (!this.socket.connected) this.socket.connect();
      return;
    }

    this.socket = io(SERVER_URL, {
      path: '/socket.io',
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2000,
    });

    this.socket.on('connect', () => {
      console.debug('[Socket] Connected:', this.socket.id);
      for (const consultationId of this.joinedConsultations) {
        this.socket.emit('consultation:join', { consultationId });
      }
    });

    this.socket.on('connect_error', (err) => {
      console.warn('[Socket] Connection error:', err.message);
      // A rejected handshake will not succeed until the access token changes.
      // connect(newToken) starts it again.
      if (AUTH_ERRORS.has(err.message)) this.socket.disconnect();
    });

    this.socket.on('disconnect', (reason) => {
      console.debug('[Socket] Disconnected:', reason);
    });

    for (const [event, handlers] of this.listeners) {
      for (const handler of handlers) this.socket.on(event, handler);
    }
  }

  disconnect() {
    this.joinedConsultations.clear();
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  // ── Consultation chat ────────────────────────────────────────────────────────

  joinConsultation(consultationId) {
    if (!consultationId) return;
    this.joinedConsultations.add(consultationId);
    this.socket?.emit('consultation:join', { consultationId });
  }

  leaveConsultation(consultationId) {
    if (!consultationId) return;
    this.joinedConsultations.delete(consultationId);
    this.socket?.emit('consultation:leave', { consultationId });
  }

  sendMessage(consultationId, content, opts = {}) {
    this.socket?.emit('consultation:message', {
      consultationId,
      content,
      messageType:  opts.messageType  || 'text',
      documentRef:  opts.documentRef  || null,
    });
  }

  sendTyping(consultationId, isTyping) {
    this.socket?.emit('consultation:typing', { consultationId, isTyping });
  }

  // ── Generic event subscriptions ───────────────────────────────────────────────

  on(event, handler) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event).add(handler);
    this.socket?.on(event, handler);
  }

  off(event, handler) {
    this.listeners.get(event)?.delete(handler);
    this.socket?.off(event, handler);
  }

  get isConnected() {
    return !!this.socket?.connected;
  }
}

export const socketService = new SocketService();
export default socketService;
