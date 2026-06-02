import React from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import { motion } from 'framer-motion';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Container,
  Stack,
  Alert,
  Divider,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  ErrorOutline as ErrorIcon,
  Home as HomeIcon,
  Refresh as RefreshIcon,
  BugReport as BugReportIcon,
  Phone as PhoneIcon,
} from '@mui/icons-material';
import { logError } from '../../store/slices/errorSlice';

/**
 * ErrorBoundary Component
 *
 * Class component that catches JavaScript errors in the entire child component tree.
 * Displays user-friendly error UI with recovery options and sends error telemetry to Redux.
 *
 * Features:
 * - Multilingual error messages (i18n)
 * - Theme-aware styling (light/dark/high-contrast)
 * - Framer Motion animations
 * - Error recovery actions (reload, home)
 * - Development vs production error display modes
 * - Error logging to Redux for analytics
 * - Responsive design (mobile-first)
 *
 * Usage:
 *   <ErrorBoundary>
 *     <YourApp />
 *   </ErrorBoundary>
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Generate unique error ID for tracking
    const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    this.setState({
      error,
      errorInfo,
      errorId,
    });

    // Log error to Redux store (for error analytics and debugging)
    if (this.props.dispatch) {
      this.props.dispatch(
        logError({
          id: errorId,
          message: error.toString(),
          stack: errorInfo.componentStack,
          timestamp: new Date().toISOString(),
          userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'unknown',
        })
      );
    }

    // In production, also send to external error tracking service
    if (process.env.NODE_ENV === 'production' && window.errorTracker) {
      window.errorTracker.captureException(error, {
        contexts: {
          react: {
            componentStack: errorInfo.componentStack,
          },
        },
        tags: {
          errorId,
        },
      });
    }

    // Console log in development
    if (process.env.NODE_ENV === 'development') {
      console.error('ErrorBoundary caught an error:', error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
    });
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    const { hasError, error, errorInfo, errorId } = this.state;
    const { children } = this.props;

    if (!hasError) {
      return children;
    }

    return <ErrorFallbackUI error={error} errorInfo={errorInfo} errorId={errorId} onReset={this.handleReset} />;
  }
}

/**
 * ErrorFallbackUI Component
 *
 * Functional component that renders the error UI.
 * Separated from ErrorBoundary class for cleaner hooks usage.
 */
function ErrorFallbackUI({ error, errorInfo, errorId, onReset }) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const isDevelopment = process.env.NODE_ENV === 'development';

  // Determine error severity based on error message
  const isNetworkError = error?.message?.toLowerCase().includes('fetch') || error?.message?.toLowerCase().includes('network');
  const isCriticalError = !isNetworkError;

  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.5,
        ease: 'easeOut',
      },
    },
  };

  const iconVariants = {
    hidden: { scale: 0, rotate: -180 },
    visible: {
      scale: 1,
      rotate: 0,
      transition: {
        duration: 0.6,
        ease: 'easeOut',
        delay: 0.1,
      },
    },
  };

  const contentVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        duration: 0.5,
        ease: 'easeOut',
        delay: 0.2,
      },
    },
  };

  const buttonContainerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        duration: 0.5,
        ease: 'easeOut',
        delay: 0.4,
        staggerChildren: 0.1,
        delayChildren: 0.4,
      },
    },
  };

  const buttonVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.3, ease: 'easeOut' },
    },
  };

  return (
    <motion.div initial="hidden" animate="visible" variants={containerVariants}>
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'var(--color-bg)',
          padding: isMobile ? 2 : 4,
        }}
      >
        <Container maxWidth="sm">
          <Card
            elevation={4}
            sx={{
              bgcolor: 'var(--color-surface)',
              border: `2px solid var(--color-error)`,
            }}
          >
            <CardContent sx={{ p: isMobile ? 3 : 4 }}>
              {/* Error Icon */}
              <motion.div variants={iconVariants} style={{ textAlign: 'center', marginBottom: '24px' }}>
                <Box
                  sx={{
                    display: 'inline-flex',
                    p: 2,
                    borderRadius: '50%',
                    bgcolor: 'rgba(211, 47, 47, 0.1)',
                  }}
                >
                  <ErrorIcon
                    sx={{
                      fontSize: 48,
                      color: 'var(--color-error)',
                    }}
                  />
                </Box>
              </motion.div>

              {/* Error Heading */}
              <motion.div variants={contentVariants}>
                <Typography
                  variant="h4"
                  component="h1"
                  sx={{
                    textAlign: 'center',
                    color: 'var(--color-text)',
                    fontFamily: 'Playfair Display, serif',
                    fontWeight: 700,
                    mb: 1,
                  }}
                >
                  {t('errors.boundary_title', 'Something went wrong')}
                </Typography>
              </motion.div>

              {/* Error Description */}
              <motion.div variants={contentVariants}>
                <Typography
                  variant="body1"
                  sx={{
                    textAlign: 'center',
                    color: 'var(--color-text-secondary)',
                    mb: 2,
                  }}
                >
                  {isNetworkError
                    ? t('errors.boundary_network_desc', 'A network error occurred. Please check your connection and try again.')
                    : t('errors.boundary_generic_desc', 'An unexpected error occurred. Our team has been notified.')}
                </Typography>
              </motion.div>

              {/* Error ID for support */}
              <motion.div variants={contentVariants}>
                <Alert
                  severity="info"
                  sx={{
                    mb: 2,
                    bgcolor: 'rgba(25, 118, 210, 0.1)',
                    border: '1px solid var(--color-primary)',
                  }}
                  icon={<BugReportIcon />}
                >
                  <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)' }}>
                    {t('errors.boundary_error_id', 'Error ID')}: <strong>{errorId}</strong>
                  </Typography>
                </Alert>
              </motion.div>

              {/* Development Error Details */}
              {isDevelopment && error && (
                <motion.div variants={contentVariants}>
                  <Box
                    sx={{
                      mb: 2,
                      p: 2,
                      bgcolor: 'rgba(0, 0, 0, 0.05)',
                      borderRadius: 1,
                      border: '1px solid var(--color-border)',
                      fontFamily: 'JetBrains Mono, monospace',
                      fontSize: '0.75rem',
                      overflow: 'auto',
                      maxHeight: 200,
                    }}
                  >
                    <Typography
                      variant="caption"
                      component="div"
                      sx={{
                        color: 'var(--color-error)',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                      }}
                    >
                      {error.toString()}
                    </Typography>
                    {errorInfo && (
                      <Typography
                        variant="caption"
                        component="div"
                        sx={{
                          color: 'var(--color-text-secondary)',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                          mt: 1,
                        }}
                      >
                        {errorInfo.componentStack}
                      </Typography>
                    )}
                  </Box>
                </motion.div>
              )}

              <Divider sx={{ my: 2, borderColor: 'var(--color-border)' }} />

              {/* Action Buttons */}
              <motion.div variants={buttonContainerVariants}>
                <Stack
                  direction={isMobile ? 'column' : 'row'}
                  spacing={1.5}
                  justifyContent="center"
                  sx={{ mt: 3 }}
                >
                  {/* Retry Button */}
                  <motion.div variants={buttonVariants} style={{ flex: isMobile ? 1 : 'auto' }}>
                    <Button
                      variant="contained"
                      startIcon={<RefreshIcon />}
                      onClick={() => window.location.reload()}
                      fullWidth={isMobile}
                      sx={{
                        bgcolor: 'var(--color-primary)',
                        color: 'white',
                        '&:hover': {
                          bgcolor: 'var(--color-primary-light)',
                        },
                        textTransform: 'none',
                        fontWeight: 600,
                      }}
                    >
                      {t('common.retry', 'Try Again')}
                    </Button>
                  </motion.div>

                  {/* Go Home Button */}
                  <motion.div variants={buttonVariants} style={{ flex: isMobile ? 1 : 'auto' }}>
                    <Button
                      variant="outlined"
                      startIcon={<HomeIcon />}
                      onClick={() => (window.location.href = '/')}
                      fullWidth={isMobile}
                      sx={{
                        borderColor: 'var(--color-primary)',
                        color: 'var(--color-primary)',
                        '&:hover': {
                          borderColor: 'var(--color-primary-light)',
                          bgcolor: 'rgba(21, 101, 192, 0.05)',
                        },
                        textTransform: 'none',
                        fontWeight: 600,
                      }}
                    >
                      {t('common.go_home', 'Go Home')}
                    </Button>
                  </motion.div>
                </Stack>
              </motion.div>

              {/* Support Contact */}
              <motion.div variants={contentVariants}>
                <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid var(--color-border)' }}>
                  <Typography
                    variant="body2"
                    sx={{
                      textAlign: 'center',
                      color: 'var(--color-text-secondary)',
                      mb: 1,
                    }}
                  >
                    {t('errors.boundary_need_help', 'Need help?')}
                  </Typography>
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'center',
                      gap: 1,
                    }}
                  >
                    <Button
                      size="small"
                      startIcon={<PhoneIcon sx={{ fontSize: 16 }} />}
                      href="tel:+919999999999"
                      sx={{
                        color: 'var(--color-primary)',
                        textTransform: 'none',
                        '&:hover': {
                          bgcolor: 'rgba(21, 101, 192, 0.08)',
                        },
                      }}
                    >
                      {t('errors.boundary_call_support', 'Call Support')}
                    </Button>
                  </Box>
                </Box>
              </motion.div>
            </CardContent>
          </Card>

          {/* Footer Note */}
          <motion.div variants={contentVariants}>
            <Typography
              variant="caption"
              sx={{
                textAlign: 'center',
                display: 'block',
                mt: 3,
                color: 'var(--color-text-secondary)',
              }}
            >
              {t('errors.boundary_error_reference', 'Error reference')}: <strong>{errorId}</strong>
              <br />
              {isDevelopment && `Console: ${error?.message}`}
            </Typography>
          </motion.div>
        </Container>
      </Box>
    </motion.div>
  );
}

// HOC to inject dispatch into ErrorBoundary
export default function ErrorBoundaryWithDispatch({ children }) {
  const dispatch = useDispatch();
  return <ErrorBoundary dispatch={dispatch}>{children}</ErrorBoundary>;
}
