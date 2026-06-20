import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';

export const searchNotaries = createAsyncThunk(
  'notary/search',
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await api.get('/notaries', { params });
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || 'Failed to search notaries');
    }
  }
);

export const getNotaryProfile = createAsyncThunk(
  'notary/getProfile',
  async (notaryId, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`/notaries/${notaryId}`);
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || 'Failed to load notary');
    }
  }
);

export const createNotarizationRequest = createAsyncThunk(
  'notary/createRequest',
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await api.post('/notarizations', payload);
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || 'Failed to create request');
    }
  }
);

export const verifyNotarizationPayment = createAsyncThunk(
  'notary/verifyPayment',
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await api.post('/notarizations/verify-payment', payload);
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || 'Payment verification failed');
    }
  }
);

export const fetchNotarizationRequests = createAsyncThunk(
  'notary/fetchRequests',
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await api.get('/notarizations', { params });
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || 'Failed to load requests');
    }
  }
);

export const acceptNotarizationRequest = createAsyncThunk(
  'notary/acceptRequest',
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await api.patch(`/notarizations/${id}/accept`);
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || 'Failed to accept request');
    }
  }
);

export const scheduleKYC = createAsyncThunk(
  'notary/scheduleKYC',
  async ({ id, scheduledAt }, { rejectWithValue }) => {
    try {
      const { data } = await api.patch(`/notarizations/${id}/schedule-kyc`, { scheduledAt });
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || 'Failed to schedule KYC');
    }
  }
);

export const completeKYC = createAsyncThunk(
  'notary/completeKYC',
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await api.patch(`/notarizations/${id}/complete-kyc`);
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || 'Failed to complete KYC');
    }
  }
);

export const stampDocument = createAsyncThunk(
  'notary/stampDocument',
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await api.patch(`/notarizations/${id}/stamp`);
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || 'Failed to stamp document');
    }
  }
);

export const rejectNotarizationRequest = createAsyncThunk(
  'notary/rejectRequest',
  async ({ id, reason }, { rejectWithValue }) => {
    try {
      const { data } = await api.patch(`/notarizations/${id}/reject`, { reason });
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || 'Failed to reject request');
    }
  }
);

export const markDispatched = createAsyncThunk(
  'notary/markDispatched',
  async ({ id, courierTrackingId }, { rejectWithValue }) => {
    try {
      const { data } = await api.patch(`/notarizations/${id}/dispatch`, { courierTrackingId });
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || 'Failed to mark dispatched');
    }
  }
);

export const getDocumentNotarizationStatus = createAsyncThunk(
  'notary/docStatus',
  async (documentId, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`/notarizations/document/${documentId}`);
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || 'Failed to load status');
    }
  }
);

const notarySlice = createSlice({
  name: 'notary',
  initialState: {
    results: [],
    total: 0,
    currentNotary: null,
    requests: [],
    pendingRequest: null,
    documentNotarizationStatus: null,
    loading: false,
    error: null,
  },
  reducers: {
    clearNotaryError(state) { state.error = null; },
    clearPendingRequest(state) { state.pendingRequest = null; },
    clearDocumentNotarizationStatus(state) { state.documentNotarizationStatus = null; },
  },
  extraReducers: (builder) => {
    const pending = (state) => { state.loading = true; state.error = null; };
    const rejected = (state, action) => { state.loading = false; state.error = action.payload; };

    const updateRequestInList = (state, updated) => {
      const r = updated?.request || updated;
      if (!r?._id) return;
      state.requests = state.requests.map((req) => req._id === r._id ? { ...req, ...r } : req);
    };

    builder
      .addCase(searchNotaries.pending, pending)
      .addCase(searchNotaries.fulfilled, (state, action) => {
        state.loading = false;
        state.results = action.payload.items || action.payload;
        state.total = action.payload.total || state.results.length;
      })
      .addCase(searchNotaries.rejected, rejected)

      .addCase(getNotaryProfile.pending, pending)
      .addCase(getNotaryProfile.fulfilled, (state, action) => {
        state.loading = false;
        state.currentNotary = action.payload;
      })
      .addCase(getNotaryProfile.rejected, rejected)

      .addCase(createNotarizationRequest.pending, pending)
      .addCase(createNotarizationRequest.fulfilled, (state, action) => {
        state.loading = false;
        state.pendingRequest = action.payload;
      })
      .addCase(createNotarizationRequest.rejected, rejected)

      .addCase(fetchNotarizationRequests.pending, pending)
      .addCase(fetchNotarizationRequests.fulfilled, (state, action) => {
        state.loading = false;
        state.requests = action.payload.items || action.payload;
        state.total = action.payload.total || state.requests.length;
      })
      .addCase(fetchNotarizationRequests.rejected, rejected)

      .addCase(acceptNotarizationRequest.fulfilled, (state, action) => { updateRequestInList(state, action.payload); })
      .addCase(scheduleKYC.fulfilled, (state, action) => { updateRequestInList(state, action.payload); })
      .addCase(completeKYC.fulfilled, (state, action) => { updateRequestInList(state, action.payload); })
      .addCase(stampDocument.fulfilled, (state, action) => { updateRequestInList(state, action.payload); })
      .addCase(rejectNotarizationRequest.fulfilled, (state, action) => { updateRequestInList(state, action.payload); })
      .addCase(markDispatched.fulfilled, (state, action) => { updateRequestInList(state, action.payload); })

      .addCase(getDocumentNotarizationStatus.fulfilled, (state, action) => {
        state.documentNotarizationStatus = action.payload.notarizationRequest || null;
      });
  },
});

export const { clearNotaryError, clearPendingRequest, clearDocumentNotarizationStatus } = notarySlice.actions;

export const selectNotaryResults = (state) => state.notary.results;
export const selectCurrentNotary = (state) => state.notary.currentNotary;
export const selectNotarizationRequests = (state) => state.notary.requests;
export const selectPendingNotarizationRequest = (state) => state.notary.pendingRequest;
export const selectDocumentNotarizationStatus = (state) => state.notary.documentNotarizationStatus;
export const selectNotaryLoading = (state) => state.notary.loading;
export const selectNotaryError = (state) => state.notary.error;

export default notarySlice.reducer;
