/**
 * client/src/store/slices/lawyerSlice.js
 *
 * loading/error are split per operation group (search, profile, apply,
 * clients, consultations, consultationAction) instead of one shared flag —
 * otherwise, e.g., accepting a consultation while the list re-fetches would
 * stomp on the list's own loading/error state.
 */

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';

export const searchLawyers = createAsyncThunk(
  'lawyer/search',
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await api.get('/lawyers', { params });
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || 'Failed to search lawyers');
    }
  }
);

export const getLawyerProfile = createAsyncThunk(
  'lawyer/getProfile',
  async (lawyerId, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`/lawyers/${lawyerId}`);
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || 'Failed to load lawyer');
    }
  }
);

export const applyAsLawyer = createAsyncThunk(
  'lawyer/apply',
  async (formData, { rejectWithValue }) => {
    try {
      const { data } = await api.post('/lawyers/apply', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || 'Application failed');
    }
  }
);

export const updateLawyerProfile = createAsyncThunk(
  'lawyer/updateProfile',
  async (updates, { rejectWithValue }) => {
    try {
      const { data } = await api.put('/lawyers/profile', updates);
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || 'Update failed');
    }
  }
);

export const fetchMyClients = createAsyncThunk(
  'lawyer/myClients',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get('/lawyers/me/clients');
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || 'Failed to load clients');
    }
  }
);

export const createConsultation = createAsyncThunk(
  'lawyer/createConsultation',
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await api.post('/consultations', payload);
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || 'Failed to create consultation');
    }
  }
);

export const fetchConsultations = createAsyncThunk(
  'lawyer/fetchConsultations',
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await api.get('/consultations', { params });
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || 'Failed to load consultations');
    }
  }
);

export const acceptConsultation = createAsyncThunk(
  'lawyer/acceptConsultation',
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await api.patch(`/consultations/${id}/accept`);
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || 'Failed to accept consultation');
    }
  }
);

export const rejectConsultation = createAsyncThunk(
  'lawyer/rejectConsultation',
  async ({ id, reason }, { rejectWithValue }) => {
    try {
      const { data } = await api.patch(`/consultations/${id}/reject`, { reason });
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || 'Failed to reject consultation');
    }
  }
);

export const completeConsultation = createAsyncThunk(
  'lawyer/completeConsultation',
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await api.patch(`/consultations/${id}/complete`);
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || 'Failed to complete consultation');
    }
  }
);

export const markNoShow = createAsyncThunk(
  'lawyer/markNoShow',
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await api.patch(`/consultations/${id}/no-show`);
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || 'Failed to mark no-show');
    }
  }
);

export const cancelConsultation = createAsyncThunk(
  'lawyer/cancelConsultation',
  async ({ id, reason }, { rejectWithValue }) => {
    try {
      const { data } = await api.patch(`/consultations/${id}/cancel`, { reason });
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || 'Failed to cancel consultation');
    }
  }
);

const LOADING_KEYS = ['search', 'profile', 'apply', 'clients', 'consultations', 'consultationAction'];

const lawyerSlice = createSlice({
  name: 'lawyer',
  initialState: {
    results: [],
    currentLawyer: null,
    myProfile: null,
    clients: [],
    consultations: [],
    pendingConsultation: null,
    total: 0,
    searchFilters: {},
    loading: {
      search: false,
      profile: false,
      apply: false,
      clients: false,
      consultations: false,
      consultationAction: false,
    },
    error: {
      search: null,
      profile: null,
      apply: null,
      clients: null,
      consultations: null,
      consultationAction: null,
    },
  },
  reducers: {
    setSearchFilters(state, action) {
      state.searchFilters = action.payload;
    },
    // Pass a specific key (e.g. 'search') to clear just that operation's error,
    // or omit it to clear all.
    clearLawyerError(state, action) {
      const key = action.payload;
      if (key) {
        state.error[key] = null;
      } else {
        LOADING_KEYS.forEach((k) => { state.error[k] = null; });
      }
    },
    clearPendingConsultation(state) { state.pendingConsultation = null; },
  },
  extraReducers: (builder) => {
    // Factory so each operation group gets its own loading/error slot instead
    // of clobbering a single shared `state.loading`/`state.error`.
    const pending = (key) => (state) => { state.loading[key] = true; state.error[key] = null; };
    const rejected = (key) => (state, action) => { state.loading[key] = false; state.error[key] = action.payload; };

    const applyConsultationUpdate = (state, action) => {
      state.loading.consultationAction = false;
      const updated = action.payload.consultation || action.payload;
      state.consultations = state.consultations.map((c) =>
        c._id === updated._id ? { ...c, ...updated } : c
      );
    };

    builder
      .addCase(searchLawyers.pending, pending('search'))
      .addCase(searchLawyers.fulfilled, (state, action) => {
        state.loading.search = false;
        state.results = action.payload.items || action.payload;
        state.total = action.payload.total || state.results.length;
      })
      .addCase(searchLawyers.rejected, rejected('search'))

      .addCase(getLawyerProfile.pending, pending('profile'))
      .addCase(getLawyerProfile.fulfilled, (state, action) => {
        state.loading.profile = false;
        state.currentLawyer = action.payload;
      })
      .addCase(getLawyerProfile.rejected, rejected('profile'))

      .addCase(applyAsLawyer.pending, pending('apply'))
      .addCase(applyAsLawyer.fulfilled, (state, action) => {
        state.loading.apply = false;
        state.myProfile = action.payload;
      })
      .addCase(applyAsLawyer.rejected, rejected('apply'))

      .addCase(updateLawyerProfile.fulfilled, (state, action) => {
        state.myProfile = action.payload.profile || action.payload;
      })

      .addCase(fetchMyClients.pending, pending('clients'))
      .addCase(fetchMyClients.fulfilled, (state, action) => {
        state.loading.clients = false;
        state.clients = action.payload.clients || action.payload;
      })
      .addCase(fetchMyClients.rejected, rejected('clients'))

      .addCase(createConsultation.pending, pending('consultationAction'))
      .addCase(createConsultation.fulfilled, (state, action) => {
        state.loading.consultationAction = false;
        state.pendingConsultation = action.payload;
      })
      .addCase(createConsultation.rejected, rejected('consultationAction'))

      .addCase(fetchConsultations.pending, pending('consultations'))
      .addCase(fetchConsultations.fulfilled, (state, action) => {
        state.loading.consultations = false;
        state.consultations = action.payload.items || action.payload;
      })
      .addCase(fetchConsultations.rejected, rejected('consultations'))

      .addCase(acceptConsultation.pending, pending('consultationAction'))
      .addCase(acceptConsultation.fulfilled, applyConsultationUpdate)
      .addCase(acceptConsultation.rejected, rejected('consultationAction'))

      .addCase(rejectConsultation.pending, pending('consultationAction'))
      .addCase(rejectConsultation.fulfilled, applyConsultationUpdate)
      .addCase(rejectConsultation.rejected, rejected('consultationAction'))

      .addCase(completeConsultation.pending, pending('consultationAction'))
      .addCase(completeConsultation.fulfilled, applyConsultationUpdate)
      .addCase(completeConsultation.rejected, rejected('consultationAction'))

      .addCase(markNoShow.pending, pending('consultationAction'))
      .addCase(markNoShow.fulfilled, applyConsultationUpdate)
      .addCase(markNoShow.rejected, rejected('consultationAction'))

      .addCase(cancelConsultation.pending, pending('consultationAction'))
      .addCase(cancelConsultation.fulfilled, applyConsultationUpdate)
      .addCase(cancelConsultation.rejected, rejected('consultationAction'));
  },
});

export const { setSearchFilters, clearLawyerError, clearPendingConsultation } = lawyerSlice.actions;

export const selectLawyerResults = (state) => state.lawyer.results;
export const selectCurrentLawyer = (state) => state.lawyer.currentLawyer;
export const selectMyLawyerProfile = (state) => state.lawyer.myProfile;
export const selectClients = (state) => state.lawyer.clients;
export const selectConsultations = (state) => state.lawyer.consultations;
export const selectPendingConsultation = (state) => state.lawyer.pendingConsultation;

export const selectSearchLoading = (state) => state.lawyer.loading.search;
export const selectLawyerProfileLoading = (state) => state.lawyer.loading.profile;
export const selectApplyLoading = (state) => state.lawyer.loading.apply;
export const selectClientsLoading = (state) => state.lawyer.loading.clients;
export const selectConsultationsLoading = (state) => state.lawyer.loading.consultations;
export const selectConsultationActionLoading = (state) => state.lawyer.loading.consultationAction;

export const selectSearchError = (state) => state.lawyer.error.search;
export const selectLawyerProfileError = (state) => state.lawyer.error.profile;
export const selectApplyError = (state) => state.lawyer.error.apply;
export const selectClientsError = (state) => state.lawyer.error.clients;
export const selectConsultationsError = (state) => state.lawyer.error.consultations;
export const selectConsultationActionError = (state) => state.lawyer.error.consultationAction;

export default lawyerSlice.reducer;
