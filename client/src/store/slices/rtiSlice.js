/**
 * client/src/store/slices/rtiSlice.js
 *
 * RTI Tracker state — all async thunks for the /v1/rti API.
 */

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';

// ─── Async thunks ─────────────────────────────────────────────────────────────

export const listRTIs = createAsyncThunk(
  'rti/list',
  async ({ status, page = 1, limit = 20 } = {}, { rejectWithValue }) => {
    try {
      const params = { page, limit };
      if (status) params.status = status;
      const { data } = await api.get('/rti', { params });
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || 'Failed to load RTI applications');
    }
  }
);

export const getRTIDetail = createAsyncThunk(
  'rti/getDetail',
  async (rtiId, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`/rti/${rtiId}`);
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || 'Failed to load RTI');
    }
  }
);

export const aiDraftRTI = createAsyncThunk(
  'rti/aiDraft',
  async ({ description, language = 'en' }, { rejectWithValue }) => {
    try {
      const { data } = await api.post('/rti/ai-draft', { description, language });
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || 'AI draft failed');
    }
  }
);

export const createRTI = createAsyncThunk(
  'rti/create',
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await api.post('/rti', payload);
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || 'Failed to create RTI');
    }
  }
);

export const markRTIAsFiled = createAsyncThunk(
  'rti/markFiled',
  async ({ rtiId, filedDate, referenceNumber, feeMode, feeStatus }, { rejectWithValue }) => {
    try {
      const { data } = await api.patch(`/rti/${rtiId}/file`, { filedDate, referenceNumber, feeMode, feeStatus });
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || 'Failed to mark as filed');
    }
  }
);

export const updateRTIStatus = createAsyncThunk(
  'rti/updateStatus',
  async ({ rtiId, ...payload }, { rejectWithValue }) => {
    try {
      const { data } = await api.patch(`/rti/${rtiId}/status`, payload);
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || 'Failed to update status');
    }
  }
);

export const draftFirstAppeal = createAsyncThunk(
  'rti/draftFirstAppeal',
  async (rtiId, { rejectWithValue }) => {
    try {
      const { data } = await api.post(`/rti/${rtiId}/draft-first-appeal`);
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || 'Failed to draft first appeal');
    }
  }
);

export const draftCICAppeal = createAsyncThunk(
  'rti/draftCICAppeal',
  async (rtiId, { rejectWithValue }) => {
    try {
      const { data } = await api.post(`/rti/${rtiId}/draft-cic-appeal`);
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || 'Failed to draft CIC appeal');
    }
  }
);

export const deleteRTI = createAsyncThunk(
  'rti/delete',
  async (rtiId, { rejectWithValue }) => {
    try {
      await api.delete(`/rti/${rtiId}`);
      return rtiId;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || 'Failed to delete RTI');
    }
  }
);

export const getMinistries = createAsyncThunk(
  'rti/getMinistries',
  async (q = '', { rejectWithValue }) => {
    try {
      const { data } = await api.get('/rti/ministries', { params: q ? { q } : {} });
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || 'Failed to load ministries');
    }
  }
);

// ─── Slice ────────────────────────────────────────────────────────────────────

const rtiSlice = createSlice({
  name: 'rti',
  initialState: {
    rtis:           [],
    currentRTI:     null,
    aiDraft:        null,
    ministries:     [],
    stateDepts:     [],
    loading:        false,
    aiLoading:      false,
    appealLoading:  false,
    error:          null,
    total:          0,
  },
  reducers: {
    clearRTIError(state)     { state.error = null; },
    clearCurrentRTI(state)   { state.currentRTI = null; },
    clearAIDraft(state)      { state.aiDraft = null; },
    setAIDraft(state, action){ state.aiDraft = action.payload; },
  },
  extraReducers: (builder) => {
    const pending  = (state) => { state.loading = true;  state.error = null; };
    const rejected = (state, action) => { state.loading = false; state.error = action.payload; };

    builder
      // list
      .addCase(listRTIs.pending,  pending)
      .addCase(listRTIs.fulfilled, (state, action) => {
        state.loading = false;
        state.rtis    = action.payload.rtis || [];
        state.total   = action.payload.total || 0;
      })
      .addCase(listRTIs.rejected, rejected)

      // detail
      .addCase(getRTIDetail.pending,  pending)
      .addCase(getRTIDetail.fulfilled, (state, action) => {
        state.loading    = false;
        state.currentRTI = action.payload.rti;
      })
      .addCase(getRTIDetail.rejected, rejected)

      // AI draft
      .addCase(aiDraftRTI.pending,  (state) => { state.aiLoading = true; state.error = null; })
      .addCase(aiDraftRTI.fulfilled, (state, action) => {
        state.aiLoading = false;
        state.aiDraft   = action.payload.draft;
      })
      .addCase(aiDraftRTI.rejected,  (state, action) => { state.aiLoading = false; state.error = action.payload; })

      // create
      .addCase(createRTI.pending,  pending)
      .addCase(createRTI.fulfilled, (state, action) => {
        state.loading = false;
        const newRti  = action.payload.rti;
        state.rtis.unshift(newRti);
        state.currentRTI = newRti;
        state.aiDraft = null;
      })
      .addCase(createRTI.rejected, rejected)

      // mark filed
      .addCase(markRTIAsFiled.pending,  pending)
      .addCase(markRTIAsFiled.fulfilled, (state, action) => {
        state.loading    = false;
        const updated    = action.payload.rti;
        state.currentRTI = updated;
        const idx = state.rtis.findIndex((r) => r._id === updated._id);
        if (idx >= 0) state.rtis[idx] = updated;
      })
      .addCase(markRTIAsFiled.rejected, rejected)

      // update status
      .addCase(updateRTIStatus.pending,  pending)
      .addCase(updateRTIStatus.fulfilled, (state, action) => {
        state.loading    = false;
        const updated    = action.payload.rti;
        state.currentRTI = updated;
        const idx = state.rtis.findIndex((r) => r._id === updated._id);
        if (idx >= 0) state.rtis[idx] = updated;
      })
      .addCase(updateRTIStatus.rejected, rejected)

      // first appeal draft
      .addCase(draftFirstAppeal.pending,  (state) => { state.appealLoading = true; state.error = null; })
      .addCase(draftFirstAppeal.fulfilled, (state) => { state.appealLoading = false; })
      .addCase(draftFirstAppeal.rejected,  (state, action) => { state.appealLoading = false; state.error = action.payload; })

      // CIC appeal draft
      .addCase(draftCICAppeal.pending,  (state) => { state.appealLoading = true; state.error = null; })
      .addCase(draftCICAppeal.fulfilled, (state) => { state.appealLoading = false; })
      .addCase(draftCICAppeal.rejected,  (state, action) => { state.appealLoading = false; state.error = action.payload; })

      // delete
      .addCase(deleteRTI.fulfilled, (state, action) => {
        state.rtis = state.rtis.filter((r) => r._id !== action.payload);
        if (state.currentRTI?._id === action.payload) state.currentRTI = null;
      })

      // ministries
      .addCase(getMinistries.fulfilled, (state, action) => {
        state.ministries = action.payload.ministries || [];
        state.stateDepts = action.payload.stateDepartments || [];
      });
  },
});

export const { clearRTIError, clearCurrentRTI, clearAIDraft, setAIDraft } = rtiSlice.actions;

// ─── Selectors ────────────────────────────────────────────────────────────────

export const selectRTIs          = (state) => state.rti.rtis;
export const selectCurrentRTI    = (state) => state.rti.currentRTI;
export const selectAIDraft       = (state) => state.rti.aiDraft;
export const selectRTILoading    = (state) => state.rti.loading;
export const selectRTIAILoading  = (state) => state.rti.aiLoading;
export const selectRTIAppealLoading = (state) => state.rti.appealLoading;
export const selectRTIError      = (state) => state.rti.error;
export const selectMinistries    = (state) => state.rti.ministries;
export const selectStateDepts    = (state) => state.rti.stateDepts;
export const selectRTITotal      = (state) => state.rti.total;

// Active (filed/pending) RTIs for dashboard badge
export const selectActiveRTICount = (state) =>
  state.rti.rtis.filter((r) => ['filed', 'first_appeal_due', 'first_appeal_filed', 'cic_filed'].includes(r.status)).length;

export default rtiSlice.reducer;
