/**
 * client/src/store/slices/chatSlice.js
 *
 * SSE streaming: sendMessage uses fetch() with a ReadableStream reader
 * rather than the browser's EventSource API because the endpoint is a
 * POST and EventSource only supports GET. Each SSE line is dispatched
 * as addStreamDelta until the server sends [DONE].
 */

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';

// ─── Async thunks ────────────────────────────────────────────────────────────

export const createSession = createAsyncThunk(
  'chat/createSession',
  async ({ templateSlug, language }, { rejectWithValue }) => {
    try {
      const { data } = await api.post('/chat/sessions', { templateSlug, language });
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || 'Failed to create session');
    }
  }
);

export const loadSession = createAsyncThunk(
  'chat/loadSession',
  async (sessionId, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`/chat/sessions/${sessionId}`);
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || 'Failed to load session');
    }
  }
);

export const listSessions = createAsyncThunk(
  'chat/listSessions',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get('/chat/sessions');
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || 'Failed to list sessions');
    }
  }
);

export const abandonSession = createAsyncThunk(
  'chat/abandonSession',
  async (sessionId, { rejectWithValue }) => {
    try {
      await api.post(`/chat/sessions/${sessionId}/abandon`);
      return sessionId;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || 'Failed to abandon session');
    }
  }
);

/**
 * sendMessage — SSE streaming via fetch + ReadableStream.
 *
 * Dispatches:
 *   addStreamDelta(chunk)  on each SSE data line
 *   streamComplete(text)   when the stream ends
 *
 * We use thunkAPI.dispatch directly inside the thunk so the streaming
 * updates reach the store immediately without waiting for the thunk to
 * settle.
 */
export const sendMessage = createAsyncThunk(
  'chat/sendMessage',
  async ({ sessionId, message }, { dispatch, rejectWithValue, getState }) => {
    const token = localStorage.getItem('nyayasetu_token');
    const baseUrl = import.meta.env.VITE_API_URL || '/v1';

    dispatch(streamStart());

    let response;
    try {
      response = await fetch(`${baseUrl}/chat/sessions/${sessionId}/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({ message }),
      });
    } catch (networkErr) {
      dispatch(streamAbort());
      return rejectWithValue('Network error — could not reach the server');
    }

    if (!response.ok) {
      dispatch(streamAbort());
      let errorMsg = 'Failed to send message';
      try {
        const errData = await response.json();
        errorMsg = errData.error || errorMsg;
      } catch (_) {}
      return rejectWithValue(errorMsg);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let fullText = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // SSE lines are separated by '\n\n'
        const lines = buffer.split('\n');
        buffer = lines.pop(); // keep incomplete last line

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const payload = line.slice(6).trim();
            if (payload === '[DONE]') {
              dispatch(streamComplete(fullText));
              return { sessionId, fullText };
            }
            try {
              const parsed = JSON.parse(payload);
              if (parsed.delta) {
                fullText += parsed.delta;
                dispatch(addStreamDelta(parsed.delta));
              } else if (parsed.done) {
                // Server signals end of stream with { done: true, dataComplete: bool }
                if (parsed.dataComplete) {
                  dispatch(setDataComplete(true));
                }
                dispatch(streamComplete(fullText));
                return { sessionId, fullText };
              } else if (parsed.error) {
                dispatch(streamAbort());
                return rejectWithValue(parsed.message || 'AI response failed. Please try again.');
              }
            } catch (_) {
              // Non-JSON SSE line — treat as raw delta
              fullText += payload;
              dispatch(addStreamDelta(payload));
            }
          }
        }
      }
    } catch (streamErr) {
      dispatch(streamAbort());
      return rejectWithValue('Stream interrupted');
    } finally {
      reader.releaseLock();
    }

    dispatch(streamComplete(fullText));
    return { sessionId, fullText };
  }
);

// ─── Initial state ────────────────────────────────────────────────────────────

const initialState = {
  sessions: [],
  currentSession: null,
  messages: [],
  loading: false,
  streaming: false,
  streamBuffer: '',
  dataComplete: false,
  error: null,
};

// ─── Slice ───────────────────────────────────────────────────────────────────

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    addMessage(state, action) {
      state.messages.push(action.payload);
    },

    streamStart(state) {
      state.streaming = true;
      state.streamBuffer = '';
      state.error = null;
    },

    addStreamDelta(state, action) {
      state.streamBuffer += action.payload;
    },

    streamComplete(state, action) {
      state.streaming = false;
      const finalText = action.payload || state.streamBuffer;
      state.messages.push({ role: 'assistant', content: finalText, createdAt: new Date().toISOString() });
      state.streamBuffer = '';
    },

    streamAbort(state) {
      state.streaming = false;
      if (state.streamBuffer) {
        // Preserve partial response as a message
        state.messages.push({
          role: 'assistant',
          content: state.streamBuffer,
          partial: true,
          createdAt: new Date().toISOString(),
        });
      }
      state.streamBuffer = '';
    },

    setDataComplete(state, action) {
      state.dataComplete = action.payload;
    },

    setCurrentSession(state, action) {
      state.currentSession = action.payload;
      state.messages = action.payload?.messages || [];
      state.dataComplete = action.payload?.status === 'data_complete';
      state.streamBuffer = '';
      state.streaming = false;
    },

    clearChat(state) {
      state.currentSession = null;
      state.messages = [];
      state.streaming = false;
      state.streamBuffer = '';
      state.dataComplete = false;
      state.error = null;
    },

    clearChatError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // createSession
    builder
      .addCase(createSession.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createSession.fulfilled, (state, action) => {
        state.loading = false;
        const raw = action.payload;
        // Server returns { sessionId, firstMessage, template, progressPercent, ... }
        // Normalize to a consistent shape with _id so the rest of the UI can use session._id
        state.currentSession = raw.session
          ? raw.session
          : {
              _id: raw.sessionId,
              template: raw.template,
              templateSlug: raw.template?.slug,
              progressPercent: raw.progressPercent || 0,
              status: 'active',
            };
        // Server delivers the first AI question in firstMessage, not in messages[]
        state.messages = raw.firstMessage
          ? [{ role: 'assistant', content: raw.firstMessage, createdAt: new Date().toISOString() }]
          : (raw.session?.messages || []);
        state.dataComplete = false;
      })
      .addCase(createSession.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // loadSession
    builder
      .addCase(loadSession.pending, (state) => { state.loading = true; })
      .addCase(loadSession.fulfilled, (state, action) => {
        state.loading = false;
        const session = action.payload.session || action.payload;
        state.currentSession = session;
        state.messages = session.messages || [];
        state.dataComplete = session.status === 'data_complete' || session.status === 'generating';
      })
      .addCase(loadSession.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // listSessions
    builder
      .addCase(listSessions.fulfilled, (state, action) => {
        state.sessions = action.payload.sessions || action.payload;
      });

    // sendMessage
    builder
      .addCase(sendMessage.pending, (state, action) => {
        // Optimistically add user message
        const userMsg = action.meta.arg.message;
        state.messages.push({ role: 'user', content: userMsg, createdAt: new Date().toISOString() });
        state.error = null;
      })
      .addCase(sendMessage.rejected, (state, action) => {
        state.streaming = false;
        state.error = action.payload;
      });

    // abandonSession
    builder
      .addCase(abandonSession.fulfilled, (state, action) => {
        state.sessions = state.sessions.filter((s) => s._id !== action.payload);
        if (state.currentSession?._id === action.payload) {
          state.currentSession = null;
          state.messages = [];
        }
      });
  },
});

export const {
  addMessage,
  streamStart,
  addStreamDelta,
  streamComplete,
  streamAbort,
  setDataComplete,
  setCurrentSession,
  clearChat,
  clearChatError,
} = chatSlice.actions;

// ─── Selectors ───────────────────────────────────────────────────────────────

export const selectCurrentSession = (state) => state.chat.currentSession;
export const selectMessages = (state) => state.chat.messages;
export const selectIsStreaming = (state) => state.chat.streaming;
export const selectStreamBuffer = (state) => state.chat.streamBuffer;
export const selectDataComplete = (state) => state.chat.dataComplete;
export const selectChatLoading = (state) => state.chat.loading;
export const selectChatError = (state) => state.chat.error;
export const selectSessions = (state) => state.chat.sessions;

export default chatSlice.reducer;
