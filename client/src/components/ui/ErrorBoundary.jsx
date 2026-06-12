import React from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import { motion, useReducedMotion } from 'framer-motion';
import {
  Box,
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
  Refresh as RefreshIcon,
  Home as HomeIcon,
  BugReport as BugReportIcon,
  Phone as PhoneIcon,
} from '@mui/icons-material';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { logError } from '../../store/slices/errorSlice';
import GlassCard from './GlassCard';
import GradientHeading from './GradientHeading';
import { TYPOGRAPHY } from '../../theme/tokens';

/**
 * ErrorBoundary — class component that catches JS errors in the entire child tree.
 * Displays a GlassCard fallback UI with recovery options.
 * All error-catching logic is preserved exactly; only the visual layer is restyled.
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
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    this.setState({ error, errorInfo, errorId });

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

    if (process.env.NODE_ENV === 'production' && window.errorTracker) {
      window.errorTracker.captureException(error, {
        contexts: { react: { componentStack: errorInfo.componentStack } },
        tags: { errorId },
      });
    }

    if (process.env.NODE_ENV === 'development') {
      console.error('ErrorBoundary caught an error:', error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null, errorId: null });
  };

  handleReload = () => { window.location.reload(); };
  handleGoHome = () => { window.location.href = '/'; };

  render() {
    const { hasError, error, errorInfo, errorId } = this.state;
    const { children } = this.props;

    if (!hasError) return children;

    return (
      <ErrorFallbackUI
        error={error}
        errorInfo={errorInfo}
        errorId={errorId}
        onReset={this.handleReset}
      />
    );
  }
}

// ─── ErrorFallbackUI ─────────────────────────────────────────────────────────

function ErrorFallbackUI({ error, errorInfo, errorId, onReset }) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const prefersReducedMotion = useReducedMotion();

  const isDevelopment = process.env.NODE_ENV === 'development';
  const isNetworkError =
    error?.message?.toLowerCase().includes('fetch') ||
    error?.message?.toLowerCase().includes('network');

  const fadeIn = prefersReducedMotion
    ? {}
    : { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.45, ease: 'easeOut' } };

  const iconAnim = prefersReducedMotion
    ? {}
    : { initial: { scale: 0, rotate: -180 }, animate: { scale: 1, rotate: 0 }, transition: { duration: 0.55, ease: 'easeOut', delay: 0.05 } };

  const stagger = (delay) =>
    prefersReducedMotion
      ? {}
      : { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.4, ease: 'easeOut', delay } };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'var(--color-bg)',
        p: isMobile ? 2 : 4,
      }}
    >
      <Container maxWidth="sm">
        <motion.div {...fadeIn}>
          <GlassCard>
            <Box sx={{ p: isMobile ? 3 : 4 }}>

              {/* Error icon — secondary-tinted circle */}
              <motion.div {...iconAnim} style={{ textAlign: 'center', marginBottom: 24 }}>
                <Box
                  sx={{
                    display: 'inline-flex',
                    p: 2,
                    borderRadius: '50%',
                    bgcolor: 'secondary.light',
                    opacity: 0.9,
                  }}
                >
                  <ErrorOutlineIcon
                    sx={{ fontSize: 48, color: 'secondary.main' }}
                  />
                </Box>
              </motion.div>

              {/* Heading via GradientHeading */}
              <motion.div {...stagger(0.1)}>
                <GradientHeading
                  variant="h4"
                  component="h1"
                  sx={{ textAlign: 'center', mb: 1.5 }}
                >
                  {t('errors.boundary_title', 'Something went wrong')}
                </GradientHeading>
              </motion.div>

              {/* Description */}
              <motion.div {...stagger(0.18)}>
                <Typography
                  variant="body1"
                  sx={{ textAlign: 'center', color: 'var(--color-text-secondary)', mb: 2, lineHeight: 1.65 }}
                >
                  {isNetworkError
                    ? t('errors.boundary_network_desc', 'A network error occurred. Please check your connection and try again.')
                    : t('errors.boundary_generic_desc', 'An unexpected error occurred. Our team has been notified.')}
                </Typography>
              </motion.div>

              {/* Error ID */}
              <motion.div {...stagger(0.24)}>
                <Alert
                  severity="info"
                  icon={<BugReportIcon />}
                  sx={{ mb: 2, bgcolor: 'var(--color-info-light)', border: '1px solid var(--color-info)' }}
                >
                  <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)' }}>
                    {t('errors.boundary_error_id', 'Error ID')}: <strong>{errorId}</strong>
                  </Typography>
                </Alert>
              </motion.div>

              {/* Dev-mode stack trace */}
              {isDevelopment && error && (
                <motion.div {...stagger(0.28)}>
                  <Box
                    sx={{
                      mb: 2,
                      p: 2,
                      bgcolor: 'rgba(0,0,0,0.04)',
                      borderRadius: 1,
                      border: '1px solid var(--color-border)',
                      fontFamily: TYPOGRAPHY.fontFamily.mono,
                      fontSize: '0.75rem',
                      overflow: 'auto',
                      maxHeight: 200,
                    }}
                  >
                    <Typography
                      variant="caption"
                      component="div"
                      sx={{ color: 'var(--color-error)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                    >
                      {error.toString()}
                    </Typography>
                    {errorInfo && (
                      <Typography
                        variant="caption"
                        component="div"
                        sx={{ color: 'var(--color-text-secondary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', mt: 1 }}
                      >
                        {errorInfo.componentStack}
                      </Typography>
                    )}
                  </Box>
                </motion.div>
              )}

              <Divider sx={{ my: 2.5, borderColor: 'var(--color-border)' }} />

              {/* Action buttons */}
              <motion.div {...stagger(0.32)}>
                <Stack
                  direction={isMobile ? 'column' : 'row'}
                  spacing={1.5}
                  justifyContent="center"
                >
                  <Button
                    variant="contained"
                    startIcon={<RefreshIcon />}
                    onClick={() => window.location.reload()}
                    fullWidth={isMobile}
                    sx={{
                      bgcolor: 'var(--color-primary)',
                      color: 'white',
                      borderRadius: '999px',
                      boxShadow: theme.custom?.glowPrimary,
                      '&:hover': { bgcolor: 'var(--color-primary-dark, var(--color-primary))' },
                      fontWeight: 700,
                    }}
                  >
                    {t('common.retry', 'Reload')}
                  </Button>

                  <Button
                    variant="outlined"
                    startIcon={<HomeIcon />}
                    onClick={() => (window.location.href = '/')}
                    fullWidth={isMobile}
                    sx={{
                      borderColor: 'var(--color-primary)',
                      color: 'var(--color-primary)',
                      borderRadius: '999px',
                      '&:hover': {
                        borderColor: 'var(--color-primary)',
                        bgcolor: 'var(--color-primary-alpha)',
                      },
                      fontWeight: 600,
                    }}
                  >
                    {t('common.go_home', 'Go Home')}
                  </Button>
                </Stack>
              </motion.div>

              {/* Support contact */}
              <motion.div {...stagger(0.38)}>
                <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid var(--color-border)', textAlign: 'center' }}>
                  <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)', mb: 1 }}>
                    {t('errors.boundary_need_help', 'Need help?')}
                  </Typography>
                  <Button
                    size="small"
                    startIcon={<PhoneIcon sx={{ fontSize: 16 }} />}
                    href="tel:+919999999999"
                    sx={{
                      color: 'var(--color-primary)',
                      '&:hover': { bgcolor: 'var(--color-primary-alpha)' },
                    }}
                  >
                    {t('errors.boundary_call_support', 'Call Support')}
                  </Button>
                </Box>
              </motion.div>

            </Box>
          </GlassCard>
        </motion.div>

        {/* Footer note */}
        <motion.div {...stagger(0.44)}>
          <Typography
            variant="caption"
            sx={{ textAlign: 'center', display: 'block', mt: 3, color: 'var(--color-text-secondary)' }}
          >
            {t('errors.boundary_error_reference', 'Error reference')}: <strong>{errorId}</strong>
            {isDevelopment && <><br />{error?.message}</>}
          </Typography>
        </motion.div>
      </Container>
    </Box>
  );
}

// HOC to inject dispatch into ErrorBoundary
export default function ErrorBoundaryWithDispatch({ children }) {
  const dispatch = useDispatch();
  return <ErrorBoundary dispatch={dispatch}>{children}</ErrorBoundary>;
}
