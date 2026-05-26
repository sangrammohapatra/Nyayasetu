/**
 * Redux Chat Slice — manages chat sessions, messages, and quota state
 * Synced with backend MongoDB Chat collection
 */

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';

// ============================================================================
// ASYNC THUNKS
// ============================================================================

export const createChatSession = createAsyncThunk(
  'chat/createSession',
  async (payload, { rejectWithValue }) => {
    try {
      const response = await api.post('/v1/chat/sessions', payload);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data);
    }
  }
);

export const getChatSession = createAsyncThunk(
  'chat/getSession',
  async (sessionId, { rejectWithValue }) => {
    try {
      const response = await api.get(`/v1/chat/sessions/${sessionId}`);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data);
    }
  }
);

export const listChats = createAsyncThunk(
  'chat/listSessions',
  async ({ status = 'active', limit = 10, skip = 0 } = {}, { rejectWithValue }) => {
    try {
      const response = await api.get('/v1/chat/sessions', {
        params: { status, limit, skip },
      });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data);
    }
  }
);

export const sendMessage = createAsyncThunk(
  'chat/sendMessage',
  async ({ sessionId, content, audioUrl }, { rejectWithValue }) => {
    try {
      const response = await api.post(
        `/v1/chat/sessions/${sessionId}/message`,
        { content, audioUrl },
        {
          headers: { 'Content-Type': 'application/json' },
        }
      );

      // Parse SSE stream
      return new Promise((resolve, reject) => {
        const reader = response.data.getReader();
        let aiResponse = '';
        let citations = [];
        let suggestions = [];
        let nextQuestions = [];

        const pump = () => {
          reader
            .read()
            .then(({ done, value }) => {
              if (done) {
                resolve({
                  sessionId,
                  response: aiResponse,
                  citations,
                  suggestions,
                  nextQuestions,
                });
                return;
              }

              const chunk = new TextDecoder().decode(value);
              const lines = chunk.split('\n');

              lines.forEach((line) => {
                if (line.startsWith('data: ')) {
                  try {
                    const data = JSON.parse(line.slice(6));
                    if (data.type === 'response') {
                      aiResponse = data.response;
                      citations = data.citations;
                      suggestions = data.suggestedDocuments;
                      nextQuestions = data.nextQuestions;
                    }
                  } catch (e) {
                    // Ignore parse errors
                  }
                }
              });

              pump();
            })
            .catch(reject);
        };

        pump();
      });
    } catch (error) {
      return rejectWithValue(error.response?.data || { error: error.message });
    }
  }
);

export const sendVoiceMessage = createAsyncThunk(
  'chat/sendVoiceMessage',
  async ({ sessionId, audioFile }, { rejectWithValue }) => {
    try {
      const formData = new FormData();
      formData.append('audio', audioFile);

      const response = await api.post(
        `/v1/chat/sessions/${sessionId}/voice`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
        }
      );

      // Parse SSE stream
      return new Promise((resolve, reject) => {
        const reader = response.data.getReader();
        let transcript = '';
        let aiResponse = '';
        let citations = [];

        const pump = () => {
          reader
            .read()
            .then(({ done, value }) => {
              if (done) {
                resolve({ sessionId, transcript, response: aiResponse, citations });
                return;
              }

              const chunk = new TextDecoder().decode(value);
              const lines = chunk.split('\n');

              lines.forEach((line) => {
                if (line.startsWith('data: ')) {
                  try {
                    const data = JSON.parse(line.slice(6));
                    if (data.type === 'voiceTranscript') {
                      transcript = data.transcript;
                    } else if (data.type === 'response') {
                      aiResponse = data.response;
                      citations = data.citations;
                    }
                  } catch (e) {
                    // Ignore parse errors
                  }
                }
              });

              pump();
            })
            .catch(reject);
        };

        pump();
      });
    } catch (error) {
      return rejectWithValue(error.response?.data || { error: error.message });
    }
  }
);

export const shareChat = createAsyncThunk(
  'chat/shareSession',
  async ({ sessionId, lawyerId, expiryDays }, { rejectWithValue }) => {
    try {
      const response = await api.post(`/v1/chat/sessions/${sessionId}/share`, {
        lawyerId,
        expiryDays,
      });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data);
    }
  }
);

export const archiveChat = createAsyncThunk(
  'chat/archiveSession',
  async (sessionId, { rejectWithValue }) => {
    try {
      const response = await api.patch(`/v1/chat/sessions/${sessionId}/archive`);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data);
    }
  }
);

export const deleteChat = createAsyncThunk(
  'chat/deleteSession',
  async (sessionId, { rejectWithValue }) => {
    try {
      const response = await api.delete(`/v1/chat/sessions/${sessionId}`);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data);
    }
  }
);

export const rateChat = createAsyncThunk(
  'chat/rateSession',
  async ({ sessionId, rating, feedback }, { rejectWithValue }) => {
    try {
      const response = await api.post(`/v1/chat/sessions/${sessionId}/rate`, {
        rating,
        feedback,
      });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data);
    }
  }
);

export const getQuotaStatus = createAsyncThunk(
  'chat/getQuotaStatus',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get('/v1/chat/quota/status');
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data);
    }
  }
);

// ============================================================================
// INITIAL STATE
// ============================================================================

const initialState = {
  sessions: [], // list of chat sessions
  currentSessionId: null, // active chat
  messages: {}, // { [sessionId]: Message[] }
  quota: {
    totalDailyQuota: 5,
    remainingMessages: 5,
    unlimited: false,
    resetTime: null,
  },
  loading: false,
  streaming: false, // true while AI response is streaming
  error: null,
  successMessage: null,
};

// ============================================================================
// SLICE
// ============================================================================

const chatSlice = createSlice({
  name: 'chat',
  initialState,

  reducers: {
    // Sync with localStorage or session
    setCurrentSession: (state, action) => {
      state.currentSessionId = action.payload;
    },

    // Optimistically add user message
    addUserMessage: (state, action) => {
      const { sessionId, message } = action.payload;
      if (!state.messages[sessionId]) {
        state.messages[sessionId] = [];
      }
      state.messages[sessionId].push({
        role: 'user',
        content: message.content,
        timestamp: new Date().toISOString(),
        audioUrl: message.audioUrl || null,
      });
    },

    // Clear current session
    clearCurrentSession: (state) => {
      state.currentSessionId = null;
    },

    // Clear error
    clearError: (state) => {
      state.error = null;
    },

    // Clear success message
    clearSuccess: (state) => {
      state.successMessage = null;
    },
  },

  extraReducers: (builder) => {
    // CREATE SESSION
    builder
      .addCase(createChatSession.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createChatSession.fulfilled, (state, action) => {
        state.loading = false;
        state.currentSessionId = action.payload.sessionId;
        state.messages[action.payload.sessionId] = [];
        state.quota = {
          ...state.quota,
          remainingMessages: action.payload.messageQuotaRemaining,
        };
        state.successMessage = 'Chat session created';
      })
      .addCase(createChatSession.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.error || 'Failed to create chat';
      });

    // GET SESSION
    builder
      .addCase(getChatSession.pending, (state) => {
        state.loading = true;
      })
      .addCase(getChatSession.fulfilled, (state, action) => {
        state.loading = false;
        state.currentSessionId = action.payload.sessionId;
        state.messages[action.payload.sessionId] = action.payload.messages;
        state.quota = {
          ...state.quota,
          remainingMessages: action.payload.quotaRemaining,
        };
      })
      .addCase(getChatSession.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.error || 'Failed to load chat';
      });

    // LIST SESSIONS
    builder
      .addCase(listChats.pending, (state) => {
        state.loading = true;
      })
      .addCase(listChats.fulfilled, (state, action) => {
        state.loading = false;
        state.sessions = action.payload.chats;
      })
      .addCase(listChats.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.error || 'Failed to load chats';
      });

    // SEND MESSAGE
    builder
      .addCase(sendMessage.pending, (state) => {
        state.streaming = true;
      })
      .addCase(sendMessage.fulfilled, (state, action) => {
        state.streaming = false;
        const { sessionId, response, citations, suggestions, nextQuestions } =
          action.payload;
        if (!state.messages[sessionId]) {
          state.messages[sessionId] = [];
        }
        state.messages[sessionId].push({
          role: 'assistant',
          content: response,
          timestamp: new Date().toISOString(),
          citations,
          suggestions,
          nextQuestions,
        });
        state.quota.remainingMessages = Math.max(0, state.quota.remainingMessages - 1);
      })
      .addCase(sendMessage.rejected, (state, action) => {
        state.streaming = false;
        state.error = action.payload?.error || 'Failed to send message';
      });

    // SEND VOICE MESSAGE
    builder
      .addCase(sendVoiceMessage.pending, (state) => {
        state.streaming = true;
      })
      .addCase(sendVoiceMessage.fulfilled, (state, action) => {
        state.streaming = false;
        const { sessionId, transcript, response, citations } = action.payload;
        if (!state.messages[sessionId]) {
          state.messages[sessionId] = [];
        }
        // Add transcript as user message
        state.messages[sessionId].push({
          role: 'user',
          content: transcript,
          timestamp: new Date().toISOString(),
        });
        // Add AI response
        state.messages[sessionId].push({
          role: 'assistant',
          content: response,
          timestamp: new Date().toISOString(),
          citations,
        });
        state.quota.remainingMessages = Math.max(0, state.quota.remainingMessages - 1);
      })
      .addCase(sendVoiceMessage.rejected, (state, action) => {
        state.streaming = false;
        state.error = action.payload?.error || 'Voice message failed';
      });

    // ARCHIVE CHAT
    builder.addCase(archiveChat.fulfilled, (state, action) => {
      state.successMessage = 'Chat archived';
    });

    // DELETE CHAT
    builder.addCase(deleteChat.fulfilled, (state, action) => {
      state.sessions = state.sessions.filter(
        (s) => s._id !== action.payload.sessionId
      );
      if (state.currentSessionId === action.payload.sessionId) {
        state.currentSessionId = null;
      }
      state.successMessage = 'Chat deleted';
    });

    // SHARE CHAT
    builder.addCase(shareChat.fulfilled, (state, action) => {
      state.successMessage = `Chat shared. Link: ${action.payload.shareUrl}`;
    });

    // GET QUOTA
    builder
      .addCase(getQuotaStatus.fulfilled, (state, action) => {
        state.quota = action.payload;
      })
      .addCase(getQuotaStatus.rejected, (state, action) => {
        state.error = action.payload?.error || 'Failed to load quota';
      });
  },
});

export const { setCurrentSession, addUserMessage, clearCurrentSession, clearError, clearSuccess } =
  chatSlice.actions;

export default chatSlice.reducer;
