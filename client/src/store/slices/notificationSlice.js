/**
 * client/src/store/slices/notificationSlice.js
 */

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';

export const fetchNotifications = createAsyncThunk(
  'notification/fetch',
  async ({ page = 1, limit = 20, unread } = {}, { rejectWithValue }) => {
    try {
      const { data } = await api.get('/notifications', { params: { page, limit, ...(unread ? { unread: 'true' } : {}) } });
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || 'Failed to load notifications');
    }
  }
);

export const markNotificationRead = createAsyncThunk(
  'notification/markRead',
  async (notificationId, { rejectWithValue }) => {
    try {
      const { data } = await api.patch(`/notifications/${notificationId}/read`);
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || 'Failed to mark read');
    }
  }
);

export const markAllNotificationsRead = createAsyncThunk(
  'notification/markAllRead',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.post('/notifications/read-all');
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || 'Failed to mark all read');
    }
  }
);

const notificationSlice = createSlice({
  name: 'notification',
  initialState: {
    items: [],
    unreadTotal: 0,
    total: 0,
    loading: false,
    error: null,
  },
  reducers: {
    pushRealtimeNotification(state, action) {
      state.items.unshift(action.payload);
      state.unreadTotal += 1;
      state.total += 1;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchNotifications.pending, (state) => { state.loading = true; })
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload.items || [];
        state.total = action.payload.total || 0;
        state.unreadTotal = action.payload.unreadTotal || 0;
      })
      .addCase(fetchNotifications.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      .addCase(markNotificationRead.fulfilled, (state, action) => {
        const id = action.meta.arg;
        const item = state.items.find((n) => n._id === id);
        // Only decrement the badge if this item was actually unread before —
        // a double-click / race on an already-read notification would
        // otherwise decrement twice and under-count unread notifications.
        const wasUnread = item ? !item.isRead : true;
        if (item) item.isRead = true;
        if (action.payload.unreadTotal !== undefined) {
          state.unreadTotal = action.payload.unreadTotal;
        } else if (wasUnread) {
          state.unreadTotal = Math.max(0, state.unreadTotal - 1);
        }
      })

      .addCase(markAllNotificationsRead.fulfilled, (state) => {
        state.items.forEach((n) => { n.isRead = true; });
        state.unreadTotal = 0;
      });
  },
});

export const { pushRealtimeNotification } = notificationSlice.actions;

export const selectNotifications = (state) => state.notification.items;
export const selectUnreadTotal = (state) => state.notification.unreadTotal;
export const selectNotificationLoading = (state) => state.notification.loading;

export default notificationSlice.reducer;
