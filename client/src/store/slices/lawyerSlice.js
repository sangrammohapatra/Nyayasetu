/**
 * client/src/store/slices/lawyerSlice.js
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

const lawyerSlice = createSlice({
  name: 'lawyer',
  initialState: {
    results: [],
    currentLawyer: null,
    myProfile: null,
    clients: [],
    consultations: [],
    pendingConsultation: null,
    loading: false,
    error: null,
    total: 0,
    searchFilters: {},
  },
  reducers: {
    setSearchFilters(state, action) {
      state.searchFilters = action.payload;
    },
    clearLawyerError(state) { state.error = null; },
    clearPendingConsultation(state) { state.pendingConsultation = null; },
  },
  extraReducers: (builder) => {
    const pending = (state) => { state.loading = true; state.error = null; };
    const rejected = (state, action) => { state.loading = false; state.error = action.payload; };

    builder
      .addCase(searchLawyers.pending, pending)
      .addCase(searchLawyers.fulfilled, (state, action) => {
        state.loading = false;
        state.results = action.payload.items || action.payload;
        state.total = action.payload.total || state.results.length;
      })
      .addCase(searchLawyers.rejected, rejected)

      .addCase(getLawyerProfile.pending, pending)
      .addCase(getLawyerProfile.fulfilled, (state, action) => {
        state.loading = false;
        state.currentLawyer = action.payload;
      })
      .addCase(getLawyerProfile.rejected, rejected)

      .addCase(applyAsLawyer.pending, pending)
      .addCase(applyAsLawyer.fulfilled, (state, action) => {
        state.loading = false;
        state.myProfile = action.payload;
      })
      .addCase(applyAsLawyer.rejected, rejected)

      .addCase(updateLawyerProfile.fulfilled, (state, action) => {
        state.myProfile = action.payload.profile || action.payload;
      })

      .addCase(fetchMyClients.fulfilled, (state, action) => {
        state.clients = action.payload.clients || action.payload;
      })

      .addCase(createConsultation.pending, pending)
      .addCase(createConsultation.fulfilled, (state, action) => {
        state.loading = false;
        state.pendingConsultation = action.payload;
      })
      .addCase(createConsultation.rejected, rejected)

      .addCase(fetchConsultations.fulfilled, (state, action) => {
        state.consultations = action.payload.items || action.payload;
      });
  },
});

export const { setSearchFilters, clearLawyerError, clearPendingConsultation } = lawyerSlice.actions;

export const selectLawyerResults = (state) => state.lawyer.results;
export const selectCurrentLawyer = (state) => state.lawyer.currentLawyer;
export const selectMyLawyerProfile = (state) => state.lawyer.myProfile;
export const selectClients = (state) => state.lawyer.clients;
export const selectConsultations = (state) => state.lawyer.consultations;
export const selectLawyerLoading = (state) => state.lawyer.loading;
export const selectPendingConsultation = (state) => state.lawyer.pendingConsultation;

export default lawyerSlice.reducer;
