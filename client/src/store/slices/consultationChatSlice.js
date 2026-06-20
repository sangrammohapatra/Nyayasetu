/**
 * client/src/store/slices/consultationChatSlice.js
 *
 * State for the in-app consultation chat panel.
 * Messages are loaded from REST (history) then updated in real-time via socket.
 */

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';

// ─── Async thunks ─────────────────────────────────────────────────────────────

export const fetchMessages = createAsyncThunk(
  'consultationChat/fetchMessages',
  async ({ consultationId, page = 1 }, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`/consultations/${consultationId}/messages`, {
        params: { page, limit: 30 },
      });
      return { consultationId, messages: data.messages, pagination: data.pagination, page };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to load messages');
    }
  }
);

export const sendMessageRest = createAsyncThunk(
  'consultationChat/sendMessageRest',
  async ({ consultationId, content, messageType = 'text', documentRef }, { rejectWithValue }) => {
    try {
      const { data } = await api.post(`/consultations/${consultationId}/messages`, {
        content,
        messageType,
        documentRef,
      });
      return { consultationId, message: data.message };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to send message');
    }
  }
);

export const fetchUnreadCount = createAsyncThunk(
  'consultationChat/fetchUnreadCount',
  async (consultationId, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`/consultations/${consultationId}/unread-count`);
      return { consultationId, count: data.unreadCount };
    } catch {
      return rejectWithValue(null);
    }
  }
);

// ─── Slice ────────────────────────────────────────────────────────────────────

const consultationChatSlice = createSlice({
  name: 'consultationChat',
  initialState: {
    // messages keyed by consultationId
    messagesByConsultation: {},
    // unread counts keyed by consultationId
    unreadCounts: {},
    // currently open consultation id
    activeChatConsultationId: null,
    loading: false,
    sending: false,
    error: null,
  },
  reducers: {
    setActiveChatConsultation(state, action) {
      state.activeChatConsultationId = action.payload;
    },

    clearActiveChatConsultation(state) {
      state.activeChatConsultationId = null;
    },

    // Called by the socket listener when a real-time message arrives
    receiveMessage(state, action) {
      const { consultationId, message } = action.payload;
      if (!state.messagesByConsultation[consultationId]) {
        state.messagesByConsultation[consultationId] = [];
      }
      // Avoid duplicate if REST sendMessage already appended it
      const exists = state.messagesByConsultation[consultationId].some(
        (m) => m._id === message._id
      );
      if (!exists) {
        state.messagesByConsultation[consultationId].push(message);
      }
    },

    // Increment unread count for a consultation (from socket notification)
    incrementUnread(state, action) {
      const { consultationId } = action.payload;
      if (state.activeChatConsultationId === consultationId) return; // panel is open
      state.unreadCounts[consultationId] = (state.unreadCounts[consultationId] || 0) + 1;
    },

    clearUnread(state, action) {
      state.unreadCounts[action.payload] = 0;
    },
  },
  extraReducers: (builder) => {
    builder
      // fetchMessages
      .addCase(fetchMessages.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchMessages.fulfilled, (state, action) => {
        state.loading = false;
        const { consultationId, messages, page } = action.payload;
        if (page === 1) {
          state.messagesByConsultation[consultationId] = messages;
        } else {
          // Prepend older messages (page > 1 = scroll-up history)
          const existing = state.messagesByConsultation[consultationId] || [];
          state.messagesByConsultation[consultationId] = [...messages, ...existing];
        }
        // Clear unread when we load messages for the active chat
        state.unreadCounts[consultationId] = 0;
      })
      .addCase(fetchMessages.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // sendMessageRest
      .addCase(sendMessageRest.pending, (state) => {
        state.sending = true;
      })
      .addCase(sendMessageRest.fulfilled, (state, action) => {
        state.sending = false;
        const { consultationId, message } = action.payload;
        if (!state.messagesByConsultation[consultationId]) {
          state.messagesByConsultation[consultationId] = [];
        }
        const exists = state.messagesByConsultation[consultationId].some(
          (m) => m._id === message._id
        );
        if (!exists) {
          state.messagesByConsultation[consultationId].push(message);
        }
      })
      .addCase(sendMessageRest.rejected, (state, action) => {
        state.sending = false;
        state.error = action.payload;
      })
      // fetchUnreadCount
      .addCase(fetchUnreadCount.fulfilled, (state, action) => {
        const { consultationId, count } = action.payload;
        state.unreadCounts[consultationId] = count;
      });
  },
});

export const {
  setActiveChatConsultation,
  clearActiveChatConsultation,
  receiveMessage,
  incrementUnread,
  clearUnread,
} = consultationChatSlice.actions;

// ─── Selectors ────────────────────────────────────────────────────────────────

export const selectMessages = (consultationId) => (state) =>
  state.consultationChat.messagesByConsultation[consultationId] || [];

export const selectChatLoading = (state) => state.consultationChat.loading;
export const selectChatSending = (state) => state.consultationChat.sending;
export const selectUnreadCount = (consultationId) => (state) =>
  state.consultationChat.unreadCounts[consultationId] || 0;
export const selectActiveChatId = (state) =>
  state.consultationChat.activeChatConsultationId;

export default consultationChatSlice.reducer;
