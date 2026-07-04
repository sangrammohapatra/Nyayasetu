/**
 * client/src/store/slices/subscriptionSlice.js
 */

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';
import { setToken } from './authSlice';

export const getCurrentSubscription = createAsyncThunk(
  'subscription/getCurrent',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get('/subscriptions/current');
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || 'Failed to load subscription');
    }
  }
);

export const createOrder = createAsyncThunk(
  'subscription/createOrder',
  async ({ plan, billingCycle, persona }, { rejectWithValue }) => {
    try {
      const { data } = await api.post('/subscriptions/create', { plan, billingCycle, persona });
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || 'Failed to create order');
    }
  }
);

export const verifyPayment = createAsyncThunk(
  'subscription/verifyPayment',
  async ({ orderId, paymentId, signature, plan, billingCycle, persona }, { dispatch, rejectWithValue }) => {
    try {
      const { data } = await api.post('/subscriptions/verify', {
        orderId, paymentId, signature, plan, billingCycle, persona,
      });
      // The upgraded plan is embedded in a fresh JWT — apply it immediately so
      // quota checks (which read req.user.plan from the token) don't stay
      // stale until the old access token expires.
      if (data.accessToken) {
        localStorage.setItem('nyayasetu_token', data.accessToken);
        if (data.refreshToken) localStorage.setItem('nyayasetu_refresh_token', data.refreshToken);
        dispatch(setToken({ token: data.accessToken, refreshToken: data.refreshToken }));
      }
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || 'Payment verification failed');
    }
  }
);

export const cancelSubscription = createAsyncThunk(
  'subscription/cancel',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.post('/subscriptions/cancel');
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || 'Failed to cancel subscription');
    }
  }
);

const PLAN_DISPLAY = {
  citizen: {
    free: { label: 'Free', price: 0 },
    basic: { label: 'Basic', price: 99, annualPrice: 999 },
    pro: { label: 'Pro', price: 199, annualPrice: 1999 },
  },
  lawyer: {
    free: { label: 'Free', price: 0 },
    professional: { label: 'Professional', price: 499, annualPrice: 4999 },
    firm: { label: 'Firm', price: 1499, annualPrice: 14999 },
  },
};

const subscriptionSlice = createSlice({
  name: 'subscription',
  initialState: {
    currentPlan: 'free',
    subscription: null,
    freeUsage: null,
    validUntil: null,
    autoRenew: false,
    pendingOrder: null,   // { orderId, amount, currency, plan, billingCycle }
    plans: PLAN_DISPLAY,
    loading: false,
    error: null,
  },
  reducers: {
    clearSubscriptionError(state) { state.error = null; },
    clearPendingOrder(state) { state.pendingOrder = null; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(getCurrentSubscription.pending, (state) => { state.loading = true; })
      .addCase(getCurrentSubscription.fulfilled, (state, action) => {
        state.loading = false;
        state.currentPlan = action.payload.plan || 'free';
        state.subscription = action.payload.subscription || null;
        state.freeUsage = action.payload.freeUsage || null;
        state.validUntil = action.payload.validUntil || null;
        state.autoRenew = action.payload.autoRenew || false;
      })
      .addCase(getCurrentSubscription.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      .addCase(createOrder.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(createOrder.fulfilled, (state, action) => {
        state.loading = false;
        state.pendingOrder = action.payload;
      })
      .addCase(createOrder.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      .addCase(verifyPayment.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(verifyPayment.fulfilled, (state, action) => {
        state.loading = false;
        state.currentPlan = action.payload.subscription?.plan || state.currentPlan;
        state.subscription = action.payload.subscription || state.subscription;
        state.pendingOrder = null;
        state.autoRenew = true;
      })
      .addCase(verifyPayment.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      .addCase(cancelSubscription.fulfilled, (state) => {
        state.autoRenew = false;
        if (state.subscription) state.subscription.isActive = false;
      });
  },
});

export const { clearSubscriptionError, clearPendingOrder } = subscriptionSlice.actions;

export const selectCurrentPlan = (state) => state.subscription.currentPlan;
export const selectSubscription = (state) => state.subscription.subscription;
export const selectFreeUsage = (state) => state.subscription.freeUsage;
export const selectPendingOrder = (state) => state.subscription.pendingOrder;
export const selectSubscriptionLoading = (state) => state.subscription.loading;
export const selectPlans = (state) => state.subscription.plans;

export default subscriptionSlice.reducer;
