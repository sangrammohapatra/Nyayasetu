/**
 * client/src/services/socket.js
 *
 * Singleton Socket.IO client.
 * Call connect(token) once on login; disconnect() on logout.
 * Import { socketService } wherever you need to emit or subscribe.
 */

import { io } from 'socket.io-client';

const SERVER_URL = import.meta.env.VITE_API_BASE_URL
  ? import.meta.env.VITE_API_BASE_URL.replace('/v1', '')
  : 'http://localhost:5000';

class SocketService {
  constructor() {
    this.socket = null;
  }

  connect(token) {
    if (this.socket?.connected) return;

    this.socket = io(SERVER_URL, {
      path: '/socket.io',
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    this.socket.on('connect', () => {
      console.debug('[Socket] Connected:', this.socket.id);
    });

    this.socket.on('connect_error', (err) => {
      console.warn('[Socket] Connection error:', err.message);
    });

    this.socket.on('disconnect', (reason) => {
      console.debug('[Socket] Disconnected:', reason);
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  // ── Consultation chat ────────────────────────────────────────────────────────

  joinConsultation(consultationId) {
    this.socket?.emit('consultation:join', { consultationId });
  }

  leaveConsultation(consultationId) {
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
    this.socket?.on(event, handler);
  }

  off(event, handler) {
    this.socket?.off(event, handler);
  }

  get isConnected() {
    return !!this.socket?.connected;
  }
}

export const socketService = new SocketService();
export default socketService;
