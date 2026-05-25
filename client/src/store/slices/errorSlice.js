import { createSlice } from "@reduxjs/toolkit";

/**
 * Error Slice
 *
 * Manages application-wide error state for:
 * - ErrorBoundary error logging
 * - API error tracking
 * - Error analytics and debugging
 *
 * State shape:
 * {
 *   errors: [],        // array of error logs
 *   lastError: null,   // most recent error for quick access
 *   isErrorVisible: false, // UI flag for showing error notifications
 * }
 */
const initialState = {
  errors: [],
  lastError: null,
  isErrorVisible: false,
  errorNotification: null, // { message, severity, id }
};

const errorSlice = createSlice({
  name: "error",
  initialState,
  reducers: {
    /**
     * Log error to the errors array
     * Called by ErrorBoundary.componentDidCatch()
     */
    logError: (state, action) => {
      const error = {
        id: action.payload.id,
        message: action.payload.message,
        stack: action.payload.stack,
        timestamp: action.payload.timestamp,
        userAgent: action.payload.userAgent,
        source: action.payload.source || "boundary", // 'boundary', 'api', 'validation'
      };

      state.errors.push(error);
      state.lastError = error;

      // Keep only last 50 errors to prevent memory bloat
      if (state.errors.length > 50) {
        state.errors.shift();
      }
    },

    /**
     * Log API error
     * Called by axios interceptor or fetch wrapper
     */
    logApiError: (state, action) => {
      const error = {
        id: `api_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        message: action.payload.message,
        status: action.payload.status,
        endpoint: action.payload.endpoint,
        method: action.payload.method,
        timestamp: new Date().toISOString(),
        source: "api",
      };

      state.errors.push(error);
      state.lastError = error;

      if (state.errors.length > 50) {
        state.errors.shift();
      }
    },

    /**
     * Show error notification to user
     */
    showErrorNotification: (state, action) => {
      state.errorNotification = {
        id: `notif_${Date.now()}`,
        message: action.payload.message,
        severity: action.payload.severity || "error", // 'error', 'warning', 'info'
        duration: action.payload.duration || 5000,
      };
      state.isErrorVisible = true;
    },

    /**
     * Hide error notification
     */
    hideErrorNotification: (state) => {
      state.isErrorVisible = false;
      state.errorNotification = null;
    },

    /**
     * Clear all errors (useful for debugging)
     */
    clearErrors: (state) => {
      state.errors = [];
      state.lastError = null;
    },

    /**
     * Clear specific error by ID
     */
    clearErrorById: (state, action) => {
      state.errors = state.errors.filter((err) => err.id !== action.payload);
    },
  },
});

export const {
  logError,
  logApiError,
  showErrorNotification,
  hideErrorNotification,
  clearErrors,
  clearErrorById,
} = errorSlice.actions;

// Selectors
export const selectAllErrors = (state) => state.error.errors;
export const selectLastError = (state) => state.error.lastError;
export const selectErrorNotification = (state) => state.error.errorNotification;
export const selectIsErrorVisible = (state) => state.error.isErrorVisible;
export const selectErrorCount = (state) => state.error.errors.length;

// Selector to get errors from a specific source
export const selectErrorsBySource = (source) => (state) =>
  state.error.errors.filter((err) => err.source === source);

// Selector to get errors in a time window (milliseconds)
export const selectErrorsInWindow = (windowMs) => (state) => {
  const cutoffTime = Date.now() - windowMs;
  return state.error.errors.filter(
    (err) => new Date(err.timestamp).getTime() > cutoffTime,
  );
};

// Async thunk alternative if needed for remote logging
export const logErrorToService = (error) => async (dispatch) => {
  try {
    // In production, send error to external service (Sentry, LogRocket, etc.)
    if (process.env.NODE_ENV === "production") {
      await fetch("https://your-error-tracking-service.com/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: error.id,
          message: error.message,
          stack: error.stack,
          timestamp: error.timestamp,
          userAgent: error.userAgent,
          userId: error.userId,
        }),
      });
    }
  } catch (err) {
    console.error("Failed to log error to service:", err);
  }
};

export default errorSlice.reducer;
