/**
 * client/src/store/slices/caseSlice.js
 */

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';

export const addCase = createAsyncThunk(
  'case/add',
  async ({ cnrNumber, alertDaysBefore = 2, alertChannels }, { rejectWithValue }) => {
    try {
      const { data } = await api.post('/cases', { cnrNumber, alertDaysBefore, alertChannels });
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || 'Failed to add case');
    }
  }
);

export const listCases = createAsyncThunk(
  'case/list',
  async ({ page = 1, limit = 20 } = {}, { rejectWithValue }) => {
    try {
      const { data } = await api.get('/cases', { params: { page, limit } });
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || 'Failed to load cases');
    }
  }
);

export const getCaseDetail = createAsyncThunk(
  'case/getDetail',
  async (caseId, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`/cases/${caseId}`);
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || 'Failed to load case');
    }
  }
);

export const refreshCase = createAsyncThunk(
  'case/refresh',
  async (caseId, { rejectWithValue }) => {
    try {
      const { data } = await api.post(`/cases/${caseId}/refresh`);
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || 'Failed to refresh case');
    }
  }
);

export const updateCaseAlerts = createAsyncThunk(
  'case/updateAlerts',
  async ({ caseId, ...alertOpts }, { rejectWithValue }) => {
    try {
      const { data } = await api.patch(`/cases/${caseId}/alerts`, alertOpts);
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || 'Failed to update alerts');
    }
  }
);

export const removeCase = createAsyncThunk(
  'case/remove',
  async (caseId, { rejectWithValue }) => {
    try {
      await api.delete(`/cases/${caseId}`);
      return caseId;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || 'Failed to remove case');
    }
  }
);

const caseSlice = createSlice({
  name: 'case',
  initialState: {
    cases: [],
    currentCase: null,
    loading: false,
    refreshing: false,
    error: null,
    total: 0,
  },
  reducers: {
    clearCaseError(state) { state.error = null; },
    clearCurrentCase(state) { state.currentCase = null; },
  },
  extraReducers: (builder) => {
    const pending = (state) => { state.loading = true; state.error = null; };
    const rejected = (state, action) => { state.loading = false; state.error = action.payload; };

    builder
      .addCase(addCase.pending, pending)
      .addCase(addCase.fulfilled, (state, action) => {
        state.loading = false;
        const c = action.payload.case || action.payload;
        state.cases.unshift(c);
        state.currentCase = c;
      })
      .addCase(addCase.rejected, rejected)

      .addCase(listCases.pending, pending)
      .addCase(listCases.fulfilled, (state, action) => {
        state.loading = false;
        state.cases = action.payload.cases || action.payload.items || action.payload;
        state.total = action.payload.total || state.cases.length;
      })
      .addCase(listCases.rejected, rejected)

      .addCase(getCaseDetail.pending, pending)
      .addCase(getCaseDetail.fulfilled, (state, action) => {
        state.loading = false;
        state.currentCase = action.payload.case || action.payload;
      })
      .addCase(getCaseDetail.rejected, rejected)

      .addCase(refreshCase.pending, (state) => { state.refreshing = true; })
      .addCase(refreshCase.fulfilled, (state, action) => {
        state.refreshing = false;
        const updated = action.payload.case || action.payload;
        state.currentCase = updated;
        const idx = state.cases.findIndex((c) => c._id === updated._id);
        if (idx >= 0) state.cases[idx] = updated;
      })
      .addCase(refreshCase.rejected, (state, action) => {
        state.refreshing = false;
        state.error = action.payload;
      })

      .addCase(removeCase.fulfilled, (state, action) => {
        state.cases = state.cases.filter((c) => c._id !== action.payload);
        if (state.currentCase?._id === action.payload) state.currentCase = null;
      });
  },
});

export const { clearCaseError, clearCurrentCase } = caseSlice.actions;

export const selectCases = (state) => state.case.cases;
export const selectCurrentCase = (state) => state.case.currentCase;
export const selectCaseLoading = (state) => state.case.loading;
export const selectCaseError = (state) => state.case.error;

export default caseSlice.reducer;
