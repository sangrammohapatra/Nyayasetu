import React from "react";
import { useSelector } from "react-redux";
import { Snackbar, Alert } from "@mui/material";
import {
  selectErrorNotification,
  hideErrorNotification,
} from "../store/slices/errorSlice";
import { useCallback } from "react";
import { useDispatch } from "react-redux";
import { showErrorNotification } from "../store/slices/errorSlice";
import { useTranslation } from "react-i18next";

/**
 * useErrorNotification Hook
 *
 * Provides a simple interface for showing error/warning/info notifications
 * throughout the application.
 *
 * Usage:
 *   const { showError, showWarning, showInfo } = useErrorNotification();
 *   showError('Something went wrong');
 *   showWarning('This action cannot be undone');
 *   showInfo('Your document has been saved');
 *
 * Features:
 * - Multilingual error messages via i18n
 * - Automatic error logging to Redux
 * - Customizable duration
 * - Type-safe severity levels
 */
export function useErrorNotification() {
  const dispatch = useDispatch();
  const { t } = useTranslation();

  const show = useCallback(
    (message, severity = "error", duration = 5000) => {
      // If message is a translation key (starts with 'error.' or 'common.'),
      // translate it; otherwise use as-is
      const finalMessage =
        typeof message === "string" && message.includes(".")
          ? t(message, message)
          : message;

      dispatch(
        showErrorNotification({
          message: finalMessage,
          severity,
          duration,
        }),
      );
    },
    [dispatch, t],
  );

  const showError = useCallback(
    (message, duration = 5000) => {
      show(message, "error", duration);
    },
    [show],
  );

  const showWarning = useCallback(
    (message, duration = 5000) => {
      show(message, "warning", duration);
    },
    [show],
  );

  const showInfo = useCallback(
    (message, duration = 5000) => {
      show(message, "info", duration);
    },
    [show],
  );

  const showSuccess = useCallback(
    (message, duration = 4000) => {
      show(message, "success", duration);
    },
    [show],
  );

  return {
    show,
    showError,
    showWarning,
    showInfo,
    showSuccess,
  };
}

/**
 * useApiErrorHandler Hook
 *
 * Handles common API error responses and shows appropriate notifications.
 *
 * Usage:
 *   const { handleApiError } = useApiErrorHandler();
 *
 *   try {
 *     await generateDocument(data);
 *   } catch (error) {
 *     handleApiError(error);
 *   }
 */
export function useApiErrorHandler() {
  const { showError, showWarning, showInfo } = useErrorNotification();
  const { t } = useTranslation();

  const handleApiError = useCallback(
    (error, options = {}) => {
      const { defaultMessage = "error.api.unknown", showDetail = false } =
        options;

      // Network error
      if (!error.response) {
        showError(t("error.api.network_error"));
        return;
      }

      const status = error.response.status;
      const data = error.response.data;

      // Map status codes to i18n keys
      switch (status) {
        case 400:
          showWarning(data?.message || t("error.form.validation_failed"));
          break;
        case 401:
          showError(t("error.api.unauthorized"));
          // Optionally redirect to login
          window.location.href = "/login";
          break;
        case 403:
          showError(t("error.api.forbidden"));
          break;
        case 404:
          showError(t("error.api.not_found"));
          break;
        case 429:
          showWarning(t("common.rate_limited"));
          break;
        case 500:
        case 502:
        case 503:
        case 504:
          showError(t("error.api.server_error"));
          break;
        default:
          showError(t(defaultMessage));
      }

      // In development, log full error
      if (process.env.NODE_ENV === "development" && showDetail) {
        console.error("API Error:", {
          status,
          data,
          message: error.message,
        });
      }
    },
    [showError, showWarning, t],
  );

  return { handleApiError };
}

/**
 * useAsyncWithErrorHandling Hook
 *
 * Wraps async operations with automatic error handling and loading state.
 *
 * Usage:
 *   const { execute, isLoading, error } = useAsyncWithErrorHandling(
 *     async (data) => generateDocument(data)
 *   );
 *
 *   const handleGenerate = async () => {
 *     const result = await execute(formData);
 *     if (result) {
 *       // Success - result contains the data
 *       console.log('Document created:', result);
 *     }
 *   };
 *
 *   return (
 *     <>
 *       <button onClick={handleGenerate} disabled={isLoading}>
 *         {isLoading ? 'Generating...' : 'Generate'}
 *       </button>
 *       {error && <ErrorAlert error={error} />}
 *     </>
 *   );
 */
export function useAsyncWithErrorHandling(asyncFn, options = {}) {
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState(null);
  const { handleApiError } = useApiErrorHandler();
  const { showError } = useErrorNotification();

  const execute = useCallback(
    async (...args) => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await asyncFn(...args);
        if (options.onSuccess) {
          options.onSuccess(result);
        }
        return result;
      } catch (err) {
        setError(err);
        if (err.response) {
          // API error
          handleApiError(err, options);
        } else {
          // Other error
          showError(err.message || "An unexpected error occurred");
        }
        if (options.onError) {
          options.onError(err);
        }
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [asyncFn, handleApiError, showError, options],
  );

  const reset = useCallback(() => {
    setError(null);
    setIsLoading(false);
  }, []);

  return { execute, isLoading, error, reset };
}

/**
 * useFormErrorHandler Hook
 *
 * Handles form validation errors and displays them appropriately.
 *
 * Usage:
 *   const { getErrorMessage, showFormErrors } = useFormErrorHandler();
 *
 *   // In form submission:
 *   try {
 *     await submitForm(formData);
 *   } catch (err) {
 *     if (err.fieldErrors) {
 *       showFormErrors(err.fieldErrors);
 *     }
 *   }
 *
 *   // In field error display:
 *   <TextField
 *     error={!!errors.email}
 *     helperText={getErrorMessage(errors.email)}
 *   />
 */
export function useFormErrorHandler() {
  const { t } = useTranslation();
  const { showError } = useErrorNotification();

  const getErrorMessage = useCallback(
    (fieldError) => {
      if (!fieldError) return "";

      // If fieldError is an i18n key
      if (typeof fieldError === "string" && fieldError.includes(".")) {
        return t(fieldError, fieldError);
      }

      // If fieldError has type property (React Hook Form error object)
      if (fieldError.type) {
        const errorKey = `error.form.${fieldError.type}`;
        return t(errorKey, fieldError.message || "Invalid field");
      }

      // If it's just a string message
      return String(fieldError);
    },
    [t],
  );

  const showFormErrors = useCallback(
    (fieldErrors) => {
      // fieldErrors is an object: { email: {...}, password: {...} }
      const firstError = Object.values(fieldErrors).find((err) => !!err);
      if (firstError) {
        showError(getErrorMessage(firstError));
      }
    },
    [getErrorMessage, showError],
  );

  return { getErrorMessage, showFormErrors };
}

/**
 * Error Display Notification Component
 *
 * Shows error notifications at the top of the page.
 * Add this to your main layout:
 *
 * import ErrorNotificationSnackbar from './components/ui/ErrorNotificationSnackbar';
 *
 * function MainLayout() {
 *   return (
 *     <>
 *       <Header />
 *       <ErrorNotificationSnackbar />
 *       <Outlet />
 *       <Footer />
 *     </>
 *   );
 * }
 */

export function ErrorNotificationSnackbar() {
  const dispatch = useDispatch();
  const notification = useSelector(selectErrorNotification);
  const [isOpen, setIsOpen] = React.useState(false);

  React.useEffect(() => {
    if (notification) {
      setIsOpen(true);
      const timer = setTimeout(() => {
        setIsOpen(false);
        dispatch(hideErrorNotification());
      }, notification.duration || 5000);
      return () => clearTimeout(timer);
    }
  }, [notification, dispatch]);

  if (!notification) return null;

  return (
    <Snackbar
      open={isOpen}
      autoHideDuration={notification.duration || 5000}
      onClose={() => {
        setIsOpen(false);
        dispatch(hideErrorNotification());
      }}
      anchorOrigin={{ vertical: "top", horizontal: "right" }}
      sx={{
        "& .MuiSnackbar-root": {
          zIndex: 9999,
        },
      }}
    >
      <Alert
        onClose={() => {
          setIsOpen(false);
          dispatch(hideErrorNotification());
        }}
        severity={notification.severity || "error"}
        sx={{
          width: "100%",
          bgcolor: `var(--color-${notification.severity === "error" ? "error" : notification.severity})`,
          color: "white",
          fontWeight: 500,
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
        }}
      >
        {notification.message}
      </Alert>
    </Snackbar>
  );
}

export default {
  useErrorNotification,
  useApiErrorHandler,
  useAsyncWithErrorHandling,
  useFormErrorHandler,
  ErrorNotificationSnackbar,
};
