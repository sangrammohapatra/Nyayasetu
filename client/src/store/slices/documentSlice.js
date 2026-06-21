/**
 * client/src/store/slices/documentSlice.js
 */

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';

// ─── Async thunks ────────────────────────────────────────────────────────────

export const generateDocument = createAsyncThunk(
  'document/generate',
  async ({ sessionId, templateId }, { rejectWithValue }) => {
    try {
      const { data } = await api.post('/documents/generate', { sessionId, templateId });
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || 'Document generation failed');
    }
  }
);

export const listDocuments = createAsyncThunk(
  'document/list',
  async ({ page = 1, limit = 20 } = {}, { rejectWithValue }) => {
    try {
      const { data } = await api.get('/documents', { params: { page, limit } });
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || 'Failed to load documents');
    }
  }
);

export const getDocument = createAsyncThunk(
  'document/get',
  async (documentId, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`/documents/${documentId}`);
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || 'Failed to load document');
    }
  }
);

export const getPDF = createAsyncThunk(
  'document/getPDF',
  async (documentId, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`/documents/${documentId}/pdf`);
      return data; // { pdfUrl: '...' } — signed 15-min URL
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || 'Failed to get PDF');
    }
  }
);

/**
 * explainClause — SSE streaming via fetch.
 * Dispatches addClauseExplanationDelta per chunk, clauseExplanationComplete when done.
 */
export const explainClause = createAsyncThunk(
  'document/explainClause',
  async ({ documentId, clauseIndex, clauseText }, { dispatch, rejectWithValue }) => {
    const token = localStorage.getItem('nyayasetu_token');
    const baseUrl = import.meta.env.VITE_API_URL || '/v1';

    dispatch(clauseExplanationStart({ clauseIndex }));

    let response;
    try {
      response = await fetch(`${baseUrl}/documents/${documentId}/explain-clause`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({ clauseIndex, clauseText }),
      });
    } catch (_) {
      dispatch(clauseExplanationFailed(clauseIndex));
      return rejectWithValue('Network error');
    }

    if (!response.ok) {
      dispatch(clauseExplanationFailed(clauseIndex));
      return rejectWithValue('Failed to explain clause');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullExplanation = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const payload = line.slice(6).trim();
            if (payload === '[DONE]') {
              dispatch(clauseExplanationComplete({ clauseIndex, explanation: fullExplanation }));
              return { clauseIndex, explanation: fullExplanation };
            }
            try {
              const parsed = JSON.parse(payload);
              if (parsed.delta) {
                fullExplanation += parsed.delta;
                dispatch(addClauseExplanationDelta({ clauseIndex, delta: parsed.delta }));
              }
            } catch (_) {
              fullExplanation += payload;
              dispatch(addClauseExplanationDelta({ clauseIndex, delta: payload }));
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    dispatch(clauseExplanationComplete({ clauseIndex, explanation: fullExplanation }));
    return { clauseIndex, explanation: fullExplanation };
  }
);

export const shareDocument = createAsyncThunk(
  'document/share',
  async (documentId, { rejectWithValue }) => {
    try {
      const { data } = await api.post(`/documents/${documentId}/share`);
      return { documentId, shareToken: data.shareToken, shareUrl: data.shareUrl };
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message || err.response?.data?.error || 'Failed to share document'
      );
    }
  }
);

export const regenerateDocument = createAsyncThunk(
  'document/regenerate',
  async (documentId, { rejectWithValue }) => {
    try {
      const { data } = await api.post(`/documents/${documentId}/regenerate`);
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || 'Regeneration failed');
    }
  }
);

export const deleteDocument = createAsyncThunk(
  'document/delete',
  async (documentId, { rejectWithValue }) => {
    try {
      await api.delete(`/documents/${documentId}`);
      return documentId;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || 'Failed to delete document');
    }
  }
);

// ─── Initial state ────────────────────────────────────────────────────────────

const initialState = {
  documents: [],
  currentDocument: null,
  generating: false,
  generationProgress: 0,
  pdfUrl: null,
  pdfUrlExpiresAt: null,
  error: null,
  // Clause explanation streaming state
  activeClauseIndex: null,
  clauseExplanationBuffer: '',
  clauseExplanations: {}, // { [clauseIndex]: string }
  explanationLoading: false,
  total: 0,
  page: 1,
};

// ─── Slice ───────────────────────────────────────────────────────────────────

const documentSlice = createSlice({
  name: 'document',
  initialState,
  reducers: {
    setGenerationProgress(state, action) {
      state.generationProgress = action.payload;
    },
    clearDocumentError(state) {
      state.error = null;
    },
    clearCurrentDocument(state) {
      state.currentDocument = null;
      state.pdfUrl = null;
      state.pdfUrlExpiresAt = null;
      state.clauseExplanations = {};
    },
    clauseExplanationStart(state, action) {
      state.activeClauseIndex = action.payload.clauseIndex;
      state.clauseExplanationBuffer = '';
      state.explanationLoading = true;
    },
    addClauseExplanationDelta(state, action) {
      const { clauseIndex, delta } = action.payload;
      if (state.activeClauseIndex === clauseIndex) {
        state.clauseExplanationBuffer += delta;
      }
    },
    clauseExplanationComplete(state, action) {
      const { clauseIndex, explanation } = action.payload;
      state.clauseExplanations[clauseIndex] = explanation;
      state.activeClauseIndex = null;
      state.clauseExplanationBuffer = '';
      state.explanationLoading = false;
    },
    clauseExplanationFailed(state, action) {
      state.activeClauseIndex = null;
      state.clauseExplanationBuffer = '';
      state.explanationLoading = false;
    },
  },
  extraReducers: (builder) => {
    // generateDocument
    builder
      .addCase(generateDocument.pending, (state) => {
        state.generating = true;
        state.generationProgress = 0;
        state.error = null;
      })
      .addCase(generateDocument.fulfilled, (state, action) => {
        state.generating = false;
        state.generationProgress = 100;
        const doc = action.payload.document || action.payload;
        if (doc && doc._id) {
          state.currentDocument = doc;
          const idx = state.documents.findIndex((d) => d._id === doc._id);
          if (idx >= 0) state.documents[idx] = doc;
          else state.documents.unshift(doc);
        }
      })
      .addCase(generateDocument.rejected, (state, action) => {
        state.generating = false;
        state.error = action.payload;
      });

    // listDocuments
    builder
      .addCase(listDocuments.fulfilled, (state, action) => {
        state.documents = action.payload.documents || action.payload.items || action.payload;
        state.total = action.payload.total || state.documents.length;
        state.page = action.payload.page || 1;
      });

    // getDocument
    builder
      .addCase(getDocument.fulfilled, (state, action) => {
        const doc = action.payload.document || action.payload;
        state.currentDocument = doc;
        const idx = state.documents.findIndex((d) => d._id === doc._id);
        if (idx >= 0) state.documents[idx] = doc;
      })
      .addCase(getDocument.rejected, (state, action) => {
        state.error = action.payload;
      });

    // getPDF
    builder
      .addCase(getPDF.fulfilled, (state, action) => {
        state.pdfUrl = action.payload.pdfUrl;
        state.pdfUrlExpiresAt = action.payload.expiresAt || null;
      })
      .addCase(getPDF.rejected, (state, action) => {
        state.error = action.payload;
      });

    // shareDocument
    builder
      .addCase(shareDocument.fulfilled, (state, action) => {
        const { documentId, shareToken, shareUrl } = action.payload;
        const doc = state.documents.find((d) => d._id === documentId);
        if (doc) doc.shareToken = shareToken;
        if (state.currentDocument?._id === documentId) {
          state.currentDocument.shareToken = shareToken;
          state.currentDocument.shareUrl = shareUrl;
        }
      });

    // deleteDocument
    builder
      .addCase(deleteDocument.fulfilled, (state, action) => {
        state.documents = state.documents.filter((d) => d._id !== action.payload);
        if (state.currentDocument?._id === action.payload) state.currentDocument = null;
      });
  },
});

export const {
  setGenerationProgress,
  clearDocumentError,
  clearCurrentDocument,
  clauseExplanationStart,
  addClauseExplanationDelta,
  clauseExplanationComplete,
  clauseExplanationFailed,
} = documentSlice.actions;

// ─── Selectors ───────────────────────────────────────────────────────────────

export const selectDocuments = (state) => state.document.documents;
export const selectCurrentDocument = (state) => state.document.currentDocument;
export const selectIsGenerating = (state) => state.document.generating;
export const selectGenerationProgress = (state) => state.document.generationProgress;
export const selectPdfUrl = (state) => state.document.pdfUrl;
export const selectPdfUrlExpiresAt = (state) => state.document.pdfUrlExpiresAt;
export const selectDocumentError = (state) => state.document.error;
export const selectClauseExplanations = (state) => state.document.clauseExplanations;
export const selectClauseBuffer = (state) => state.document.clauseExplanationBuffer;
export const selectExplanationLoading = (state) => state.document.explanationLoading;

export default documentSlice.reducer;
