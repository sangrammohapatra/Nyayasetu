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
      const { append, ...queryParams } = params;
      const { data } = await api.get('/notarizations', { params: queryParams });
      return { ...data, append: !!append };
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
    searchLoading: false,
    searchError: null,

    currentNotary: null,
    profileLoading: false,
    profileError: null,

    requests: [],
    requestsTotal: 0,
    requestsPage: 1,
    requestsHasMore: false,
    requestsLoading: false,
    requestsError: null,

    // createNotarizationRequest / verifyNotarizationPayment (booking + payment flow)
    pendingRequest: null,
    bookingLoading: false,
    bookingError: null,

    // accept / scheduleKYC / completeKYC / stamp / reject / dispatch
    actionLoading: false,
    actionError: null,

    documentNotarizationStatus: null,
  },
  reducers: {
    clearNotaryError(state) {
      state.searchError = null;
      state.profileError = null;
      state.requestsError = null;
      state.bookingError = null;
      state.actionError = null;
    },
    clearPendingRequest(state) { state.pendingRequest = null; },
    clearDocumentNotarizationStatus(state) { state.documentNotarizationStatus = null; },
  },
  extraReducers: (builder) => {
    const updateRequestInList = (state, updated) => {
      const r = updated?.request || updated;
      if (!r?._id) return;
      state.requests = state.requests.map((req) => req._id === r._id ? { ...req, ...r } : req);
    };

    builder
      .addCase(searchNotaries.pending, (state) => { state.searchLoading = true; state.searchError = null; })
      .addCase(searchNotaries.fulfilled, (state, action) => {
        state.searchLoading = false;
        state.results = action.payload.items || action.payload;
        state.total = action.payload.total || state.results.length;
      })
      .addCase(searchNotaries.rejected, (state, action) => { state.searchLoading = false; state.searchError = action.payload; })

      .addCase(getNotaryProfile.pending, (state) => { state.profileLoading = true; state.profileError = null; })
      .addCase(getNotaryProfile.fulfilled, (state, action) => {
        state.profileLoading = false;
        state.currentNotary = action.payload;
      })
      .addCase(getNotaryProfile.rejected, (state, action) => { state.profileLoading = false; state.profileError = action.payload; })

      .addCase(createNotarizationRequest.pending, (state) => { state.bookingLoading = true; state.bookingError = null; })
      .addCase(createNotarizationRequest.fulfilled, (state, action) => {
        state.bookingLoading = false;
        state.pendingRequest = action.payload;
      })
      .addCase(createNotarizationRequest.rejected, (state, action) => { state.bookingLoading = false; state.bookingError = action.payload; })

      .addCase(verifyNotarizationPayment.pending, (state) => { state.bookingLoading = true; state.bookingError = null; })
      .addCase(verifyNotarizationPayment.fulfilled, (state) => { state.bookingLoading = false; })
      .addCase(verifyNotarizationPayment.rejected, (state, action) => { state.bookingLoading = false; state.bookingError = action.payload; })

      .addCase(fetchNotarizationRequests.pending, (state) => { state.requestsLoading = true; state.requestsError = null; })
      .addCase(fetchNotarizationRequests.fulfilled, (state, action) => {
        state.requestsLoading = false;
        const items = action.payload.items || action.payload;
        const total = action.payload.total ?? items.length;
        const page = action.payload.page ?? 1;
        if (action.payload.append) {
          const existingIds = new Set(state.requests.map((r) => r._id));
          state.requests = [...state.requests, ...items.filter((r) => !existingIds.has(r._id))];
        } else {
          state.requests = items;
        }
        state.requestsTotal = total;
        state.requestsPage = page;
        state.requestsHasMore = state.requests.length < total;
      })
      .addCase(fetchNotarizationRequests.rejected, (state, action) => { state.requestsLoading = false; state.requestsError = action.payload; })

      .addCase(acceptNotarizationRequest.pending, (state) => { state.actionLoading = true; state.actionError = null; })
      .addCase(acceptNotarizationRequest.fulfilled, (state, action) => { state.actionLoading = false; updateRequestInList(state, action.payload); })
      .addCase(acceptNotarizationRequest.rejected, (state, action) => { state.actionLoading = false; state.actionError = action.payload; })

      .addCase(scheduleKYC.pending, (state) => { state.actionLoading = true; state.actionError = null; })
      .addCase(scheduleKYC.fulfilled, (state, action) => { state.actionLoading = false; updateRequestInList(state, action.payload); })
      .addCase(scheduleKYC.rejected, (state, action) => { state.actionLoading = false; state.actionError = action.payload; })

      .addCase(completeKYC.pending, (state) => { state.actionLoading = true; state.actionError = null; })
      .addCase(completeKYC.fulfilled, (state, action) => { state.actionLoading = false; updateRequestInList(state, action.payload); })
      .addCase(completeKYC.rejected, (state, action) => { state.actionLoading = false; state.actionError = action.payload; })

      .addCase(stampDocument.pending, (state) => { state.actionLoading = true; state.actionError = null; })
      .addCase(stampDocument.fulfilled, (state, action) => { state.actionLoading = false; updateRequestInList(state, action.payload); })
      .addCase(stampDocument.rejected, (state, action) => { state.actionLoading = false; state.actionError = action.payload; })

      .addCase(rejectNotarizationRequest.pending, (state) => { state.actionLoading = true; state.actionError = null; })
      .addCase(rejectNotarizationRequest.fulfilled, (state, action) => { state.actionLoading = false; updateRequestInList(state, action.payload); })
      .addCase(rejectNotarizationRequest.rejected, (state, action) => { state.actionLoading = false; state.actionError = action.payload; })

      .addCase(markDispatched.pending, (state) => { state.actionLoading = true; state.actionError = null; })
      .addCase(markDispatched.fulfilled, (state, action) => { state.actionLoading = false; updateRequestInList(state, action.payload); })
      .addCase(markDispatched.rejected, (state, action) => { state.actionLoading = false; state.actionError = action.payload; })

      .addCase(getDocumentNotarizationStatus.fulfilled, (state, action) => {
        state.documentNotarizationStatus = action.payload.notarizationRequest || null;
      });
  },
});

export const { clearNotaryError, clearPendingRequest, clearDocumentNotarizationStatus } = notarySlice.actions;

export const selectNotaryResults = (state) => state.notary.results;
export const selectCurrentNotary = (state) => state.notary.currentNotary;
export const selectNotarizationRequests = (state) => state.notary.requests;
export const selectNotarizationRequestsTotal = (state) => state.notary.requestsTotal;
export const selectNotarizationRequestsPage = (state) => state.notary.requestsPage;
export const selectNotarizationRequestsHasMore = (state) => state.notary.requestsHasMore;
export const selectPendingNotarizationRequest = (state) => state.notary.pendingRequest;
export const selectDocumentNotarizationStatus = (state) => state.notary.documentNotarizationStatus;

export const selectNotarySearchLoading = (state) => state.notary.searchLoading;
export const selectNotarySearchError = (state) => state.notary.searchError;
export const selectNotaryProfileLoading = (state) => state.notary.profileLoading;
export const selectNotaryProfileError = (state) => state.notary.profileError;
export const selectNotaryRequestsLoading = (state) => state.notary.requestsLoading;
export const selectNotaryRequestsError = (state) => state.notary.requestsError;
export const selectNotaryBookingLoading = (state) => state.notary.bookingLoading;
export const selectNotaryBookingError = (state) => state.notary.bookingError;
export const selectNotaryActionLoading = (state) => state.notary.actionLoading;
export const selectNotaryActionError = (state) => state.notary.actionError;

export default notarySlice.reducer;
