/**
 * nyayabotSlice.js
 * Redux state for NyayaBot.
 *
 * State shape:
 *   nyayabot.sessions[]          — list of sessions (sidebar)
 *   nyayabot.activeSessionId     — currently open session
 *   nyayabot.messages{}          — { [sessionId]: Message[] }
 *   nyayabot.quota               — daily usage info
 *   nyayabot.isWidgetOpen        — is the floating widget open?
 *   nyayabot.streamingSessionId  — sessionId currently receiving SSE stream
 *   nyayabot.streamBuffer        — partial text being streamed
 *   nyayabot.loading / error
 */

import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../services/api";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Parse Server-Sent Events from a Fetch ReadableStream */
async function parseSSEStream(response, onEvent) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop(); // last line may be incomplete

    let currentEvent = null;
    for (const line of lines) {
      if (line.startsWith("event: ")) {
        currentEvent = line.slice(7).trim();
      } else if (line.startsWith("data: ") && currentEvent) {
        try {
          const data = JSON.parse(line.slice(6));
          onEvent(currentEvent, data);
        } catch (_) {
          /* ignore */
        }
        currentEvent = null;
      }
    }
  }
}

// ─── Thunks ───────────────────────────────────────────────────────────────────

export const createNyayaBotSession = createAsyncThunk(
  "nyayabot/createSession",
  async (payload = {}, { rejectWithValue }) => {
    try {
      const { data } = await api.post("/nyayabot/sessions", payload);
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data || { error: err.message });
    }
  },
);

export const getNyayaBotSession = createAsyncThunk(
  "nyayabot/getSession",
  async (sessionId, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`/nyayabot/sessions/${sessionId}`);
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data || { error: err.message });
    }
  },
);

export const listNyayaBotSessions = createAsyncThunk(
  "nyayabot/listSessions",
  async (
    { archived = false, limit = 15, skip = 0 } = {},
    { rejectWithValue },
  ) => {
    try {
      const { data } = await api.get("/nyayabot/sessions", {
        params: { archived, limit, skip },
      });
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data || { error: err.message });
    }
  },
);

/**
 * sendNyayaBotMessage — uses fetch() with ReadableStream for SSE.
 * We cannot use axios here because axios buffers SSE.
 * We dispatch intermediate Redux actions via the thunkAPI.dispatch.
 */
export const sendNyayaBotMessage = createAsyncThunk(
  "nyayabot/sendMessage",
  async ({ sessionId, content }, { dispatch, rejectWithValue, getState }) => {
    // Optimistically add user message
    dispatch(addOptimisticUserMessage({ sessionId, content }));

    try {
      const token = localStorage.getItem('nyayasetu_token');
      const baseURL = import.meta.env.VITE_API_URL || '/v1';

      const response = await fetch(
        `${baseURL}/nyayabot/sessions/${sessionId}/message`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ content }),
        },
      );

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        return rejectWithValue(errBody);
      }

      let botContent = "";
      let botMeta = {};

      await parseSSEStream(response, (event, data) => {
        if (event === "status") {
          dispatch(setStreamingStatus({ sessionId, status: data.status }));
        } else if (event === "message") {
          botContent = data.content;
          botMeta = {
            messageId: data.messageId,
            citations: data.citations || [],
            suggestedTemplates: data.suggestedTemplates || [],
            followUpQuestions: data.followUpQuestions || [],
            disclaimer: data.disclaimer || "",
          };
          dispatch(
            appendBotMessage({ sessionId, content: botContent, ...botMeta }),
          );
        } else if (event === "quota") {
          dispatch(updateQuota(data));
        } else if (event === "error") {
          dispatch(setStreamError({ sessionId, error: data.message }));
        }
      });

      return { sessionId, botContent, ...botMeta };
    } catch (err) {
      return rejectWithValue({ error: err.message });
    }
  },
);

export const rateNyayaBotMessage = createAsyncThunk(
  "nyayabot/rateMessage",
  async ({ sessionId, messageId, thumbsUp }, { rejectWithValue }) => {
    try {
      await api.post(
        `/nyayabot/sessions/${sessionId}/messages/${messageId}/rate`,
        { thumbsUp },
      );
      return { sessionId, messageId, thumbsUp };
    } catch (err) {
      return rejectWithValue(err.response?.data || { error: err.message });
    }
  },
);

export const rateNyayaBotSession = createAsyncThunk(
  "nyayabot/rateSession",
  async ({ sessionId, rating, feedback }, { rejectWithValue }) => {
    try {
      await api.post(`/nyayabot/sessions/${sessionId}/rate`, {
        rating,
        feedback,
      });
      return { sessionId, rating };
    } catch (err) {
      return rejectWithValue(err.response?.data || { error: err.message });
    }
  },
);

export const archiveNyayaBotSession = createAsyncThunk(
  "nyayabot/archiveSession",
  async ({ sessionId, archive }, { rejectWithValue }) => {
    try {
      await api.patch(`/nyayabot/sessions/${sessionId}/archive`, {
        archive,
      });
      return { sessionId, archive };
    } catch (err) {
      return rejectWithValue(err.response?.data || { error: err.message });
    }
  },
);

export const deleteNyayaBotSession = createAsyncThunk(
  "nyayabot/deleteSession",
  async (sessionId, { rejectWithValue }) => {
    try {
      await api.delete(`/nyayabot/sessions/${sessionId}`);
      return { sessionId };
    } catch (err) {
      return rejectWithValue(err.response?.data || { error: err.message });
    }
  },
);

export const pinSession = createAsyncThunk(
  "nyayabot/pinSession",
  async ({ sessionId, pinned }, { rejectWithValue }) => {
    try {
      await api.patch(`/nyayabot/sessions/${sessionId}/pin`, { pinned });
      return { sessionId, pinned };
    } catch (err) {
      return rejectWithValue(err.response?.data || { error: err.message });
    }
  },
);

export const shareNyayaBotSession = createAsyncThunk(
  "nyayabot/shareSession",
  async ({ sessionId, lawyerId, expiryDays }, { rejectWithValue }) => {
    try {
      const { data } = await api.post(
        `/nyayabot/sessions/${sessionId}/share`,
        {
          lawyerId,
          expiryDays,
        },
      );
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data || { error: err.message });
    }
  },
);

export const getNyayaBotQuota = createAsyncThunk(
  "nyayabot/getQuota",
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get("/nyayabot/quota");
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data || { error: err.message });
    }
  },
);

// ─── Initial state ────────────────────────────────────────────────────────────

const initialState = {
  sessions: [],
  sessionsTotal: 0,
  activeSessionId: null,
  messages: {}, // { [sessionId]: Message[] }
  quota: {
    used: 0,
    limit: 5,
    remaining: 5,
    unlimited: false,
  },

  // Widget state
  isWidgetOpen: false,
  widgetSessionId: null, // the session used inside the floating widget

  // Streaming
  streamingSessionId: null,
  streamError: null,

  // Async
  loading: false,
  creating: false,
  error: null,
};

// ─── Slice ────────────────────────────────────────────────────────────────────

const nyayabotSlice = createSlice({
  name: "nyayabot",
  initialState,

  reducers: {
    // Toggle the floating widget open/closed
    toggleWidget: (state) => {
      state.isWidgetOpen = !state.isWidgetOpen;
    },
    openWidget: (state) => {
      state.isWidgetOpen = true;
    },
    closeWidget: (state) => {
      state.isWidgetOpen = false;
    },

    setActiveSession: (state, action) => {
      state.activeSessionId = action.payload;
    },

    // Optimistic user message
    addOptimisticUserMessage: (state, action) => {
      const { sessionId, content } = action.payload;
      if (!state.messages[sessionId]) state.messages[sessionId] = [];
      state.messages[sessionId].push({
        _id: `optimistic_${Date.now()}`,
        role: "user",
        content,
        createdAt: new Date().toISOString(),
        isOptimistic: true,
      });
    },

    // Streaming status
    setStreamingStatus: (state, action) => {
      const { sessionId, status } = action.payload;
      state.streamingSessionId = status === "thinking" ? sessionId : null;
    },

    // Append incoming bot message
    appendBotMessage: (state, action) => {
      const {
        sessionId,
        content,
        messageId,
        citations,
        suggestedTemplates,
        followUpQuestions,
        disclaimer,
      } = action.payload;
      if (!state.messages[sessionId]) state.messages[sessionId] = [];
      state.messages[sessionId].push({
        _id: messageId,
        role: "nyayabot",
        content,
        citations: citations || [],
        suggestedTemplates: suggestedTemplates || [],
        followUpQuestions: followUpQuestions || [],
        disclaimer: disclaimer || "",
        createdAt: new Date().toISOString(),
        thumbsUp: null,
      });
      state.streamingSessionId = null;
    },

    // Quota update from SSE
    updateQuota: (state, action) => {
      state.quota = { ...state.quota, ...action.payload };
    },

    setStreamError: (state, action) => {
      const { sessionId, error } = action.payload;
      state.streamingSessionId = null;
      state.streamError = error;
    },

    // Update thumbs on a specific message
    updateMessageThumb: (state, action) => {
      const { sessionId, messageId, thumbsUp } = action.payload;
      const msgs = state.messages[sessionId];
      if (!msgs) return;
      const msg = msgs.find((m) => m._id === messageId);
      if (msg) msg.thumbsUp = thumbsUp;
    },

    clearError: (state) => {
      state.error = null;
      state.streamError = null;
    },
  },

  extraReducers: (builder) => {
    // CREATE SESSION
    builder
      .addCase(createNyayaBotSession.pending, (state) => {
        state.creating = true;
        state.error = null;
      })
      .addCase(createNyayaBotSession.fulfilled, (state, { payload }) => {
        state.creating = false;
        state.activeSessionId = payload.sessionId;
        state.widgetSessionId = payload.sessionId;
        // Seed greeting message
        state.messages[payload.sessionId] = [
          {
            _id: `greeting_${payload.sessionId}`,
            role: "nyayabot",
            content: payload.greeting,
            citations: [],
            suggestedTemplates: [],
            followUpQuestions: [],
            disclaimer: "",
            createdAt: new Date().toISOString(),
          },
        ];
        state.quota = payload.quota || state.quota;
      })
      .addCase(createNyayaBotSession.rejected, (state, { payload }) => {
        state.creating = false;
        state.error = payload?.error || "Failed to start NyayaBot";
      });

    // GET SESSION
    builder
      .addCase(getNyayaBotSession.pending, (state) => {
        state.loading = true;
      })
      .addCase(getNyayaBotSession.fulfilled, (state, { payload }) => {
        state.loading = false;
        state.activeSessionId = payload.sessionId;
        state.messages[payload.sessionId] = payload.messages || [];
        if (payload.quota) state.quota = payload.quota;
      })
      .addCase(getNyayaBotSession.rejected, (state, { payload }) => {
        state.loading = false;
        state.error = payload?.error || "Failed to load session";
      });

    // LIST SESSIONS
    builder
      .addCase(listNyayaBotSessions.pending, (state) => {
        state.loading = true;
      })
      .addCase(listNyayaBotSessions.fulfilled, (state, { payload }) => {
        state.loading = false;
        state.sessions = payload.sessions;
        state.sessionsTotal = payload.total;
      })
      .addCase(listNyayaBotSessions.rejected, (state, { payload }) => {
        state.loading = false;
        state.error = payload?.error || "Failed to load sessions";
      });

    // SEND MESSAGE — handled by inline reducers (addOptimisticUserMessage, appendBotMessage)
    builder.addCase(sendNyayaBotMessage.rejected, (state, { payload }) => {
      state.streamingSessionId = null;
      state.error = payload?.message || payload?.error || "Message failed";
    });

    // RATE MESSAGE
    builder.addCase(rateNyayaBotMessage.fulfilled, (state, { payload }) => {
      const { sessionId, messageId, thumbsUp } = payload;
      const msgs = state.messages[sessionId];
      if (msgs) {
        const msg = msgs.find((m) => m._id === messageId);
        if (msg) msg.thumbsUp = thumbsUp;
      }
    });

    // DELETE SESSION
    builder.addCase(deleteNyayaBotSession.fulfilled, (state, { payload }) => {
      const { sessionId } = payload;
      state.sessions = state.sessions.filter((s) => s.sessionId !== sessionId);
      delete state.messages[sessionId];
      if (state.activeSessionId === sessionId) state.activeSessionId = null;
      if (state.widgetSessionId === sessionId) state.widgetSessionId = null;
    });

    // ARCHIVE SESSION
    builder.addCase(archiveNyayaBotSession.fulfilled, (state, { payload }) => {
      const { sessionId } = payload;
      state.sessions = state.sessions.filter((s) => s.sessionId !== sessionId);
      if (state.activeSessionId === sessionId) state.activeSessionId = null;
    });

    // PIN SESSION
    builder.addCase(pinSession.fulfilled, (state, { payload }) => {
      const { sessionId, pinned } = payload;
      const session = state.sessions.find((s) => s.sessionId === sessionId);
      if (session) session.isPinned = pinned;
    });

    // GET QUOTA
    builder.addCase(getNyayaBotQuota.fulfilled, (state, { payload }) => {
      if (payload?.quota) state.quota = payload.quota;
    });
  },
});

export const {
  toggleWidget,
  openWidget,
  closeWidget,
  setActiveSession,
  addOptimisticUserMessage,
  setStreamingStatus,
  appendBotMessage,
  updateQuota,
  setStreamError,
  updateMessageThumb,
  clearError,
} = nyayabotSlice.actions;

export default nyayabotSlice.reducer;
