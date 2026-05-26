/**
 * client/src/store/slices/authSlice.js
 */

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';

// ─── Async thunks ────────────────────────────────────────────────────────────

export const sendOTP = createAsyncThunk(
  'auth/sendOTP',
  async (phone, { rejectWithValue }) => {
    try {
      const { data } = await api.post('/auth/send-otp', { phone });
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || 'Failed to send OTP');
    }
  }
);

export const verifyOTP = createAsyncThunk(
  'auth/verifyOTP',
  async ({ phone, otp }, { rejectWithValue }) => {
    try {
      const { data } = await api.post('/auth/verify-otp', { phone, otp });
      // Persist tokens
      if (data.accessToken) localStorage.setItem('nyayasetu_token', data.accessToken);
      if (data.refreshToken) localStorage.setItem('nyayasetu_refresh_token', data.refreshToken);
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || 'OTP verification failed');
    }
  }
);

export const register = createAsyncThunk(
  'auth/register',
  async (profileData, { rejectWithValue }) => {
    try {
      const { data } = await api.post('/auth/register', profileData);
      if (data.accessToken) localStorage.setItem('nyayasetu_token', data.accessToken);
      if (data.refreshToken) localStorage.setItem('nyayasetu_refresh_token', data.refreshToken);
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || 'Registration failed');
    }
  }
);

export const getMe = createAsyncThunk(
  'auth/getMe',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get('/auth/me');
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || 'Failed to fetch profile');
    }
  }
);

export const updateMe = createAsyncThunk(
  'auth/updateMe',
  async (profileData, { rejectWithValue }) => {
    try {
      const { data } = await api.patch('/auth/me', profileData);
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || 'Failed to update profile');
    }
  }
);

export const logout = createAsyncThunk(
  'auth/logout',
  async (_, { rejectWithValue }) => {
    try {
      await api.post('/auth/logout');
    } catch (_err) {
      // Always clear local state even if server call fails
    } finally {
      localStorage.removeItem('nyayasetu_token');
      localStorage.removeItem('nyayasetu_refresh_token');
    }
    return null;
  }
);

// ─── Initial state ────────────────────────────────────────────────────────────

const initialState = {
  user: null,
  token: localStorage.getItem('nyayasetu_token') || null,
  refreshToken: localStorage.getItem('nyayasetu_refresh_token') || null,
  loading: false,
  error: null,
  otpSent: false,
};

// ─── Slice ───────────────────────────────────────────────────────────────────

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError(state) {
      state.error = null;
    },
    setUser(state, action) {
      state.user = action.payload;
    },
    setToken(state, action) {
      state.token = action.payload.token;
      if (action.payload.refreshToken) {
        state.refreshToken = action.payload.refreshToken;
      }
    },
    /** Dispatched by the Axios interceptor on unrecoverable 401 */
    forceLogout(state) {
      state.user = null;
      state.token = null;
      state.refreshToken = null;
      state.error = null;
      state.otpSent = false;
    },
    resetOtpState(state) {
      state.otpSent = false;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // sendOTP
    builder
      .addCase(sendOTP.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(sendOTP.fulfilled, (state) => {
        state.loading = false;
        state.otpSent = true;
      })
      .addCase(sendOTP.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // verifyOTP
    builder
      .addCase(verifyOTP.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(verifyOTP.fulfilled, (state, action) => {
        state.loading = false;
        state.token = action.payload.accessToken;
        state.refreshToken = action.payload.refreshToken || state.refreshToken;
        state.user = action.payload.user || null;
        state.otpSent = false;
      })
      .addCase(verifyOTP.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // register
    builder
      .addCase(register.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(register.fulfilled, (state, action) => {
        state.loading = false;
        state.token = action.payload.accessToken;
        state.refreshToken = action.payload.refreshToken || state.refreshToken;
        state.user = action.payload.user || null;
      })
      .addCase(register.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // getMe
    builder
      .addCase(getMe.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getMe.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.user || action.payload;
      })
      .addCase(getMe.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // updateMe
    builder
      .addCase(updateMe.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateMe.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.user || action.payload;
      })
      .addCase(updateMe.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // logout
    builder
      .addCase(logout.fulfilled, (state) => {
        state.user = null;
        state.token = null;
        state.refreshToken = null;
        state.error = null;
        state.otpSent = false;
      });
  },
});

export const { clearError, setUser, setToken, forceLogout, resetOtpState } = authSlice.actions;

// ─── Selectors ───────────────────────────────────────────────────────────────

export const selectUser = (state) => state.auth.user;
export const selectIsAuthenticated = (state) => !!state.auth.token && !!state.auth.user;
export const selectUserPlan = (state) =>
  state.auth.user?.subscription?.plan || 'free';
export const selectUserPersona = (state) => (state.auth.user?.persona || 'citizen').toLowerCase();
export const selectAuthLoading = (state) => state.auth.loading;
export const selectAuthError = (state) => state.auth.error;
export const selectOtpSent = (state) => state.auth.otpSent;

export default authSlice.reducer;
