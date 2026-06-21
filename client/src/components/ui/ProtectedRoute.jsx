/**
 * client/src/components/ui/ProtectedRoute.jsx
 */

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import { selectIsAuthenticated, selectUserPersona, selectAuthLoading } from '../../store/slices/authSlice';
import tokenStore from '../../services/tokenStore';

/**
 * @param {object}   props
 * @param {React.ReactNode} props.children
 * @param {string|string[]} [props.allowedPersonas]  If set, only these personas may access the route.
 */
function ProtectedRoute({ children, allowedPersonas }) {
  const location = useLocation();
  const theme = useTheme();
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const persona = useSelector(selectUserPersona);
  const loading = useSelector(selectAuthLoading);

  // Guard against stale redux-persist rehydration: if the access token was cleared
  // from localStorage (e.g. on logout) but the Redux snapshot still carries the old
  // token + user, treat the session as expired immediately without waiting for an
  // effect to run.
  const hasLiveToken = !!tokenStore.get();
  const effectiveAuth = isAuthenticated && hasLiveToken;

  // Block ONLY on the initial auth check: token exists but user hasn't loaded yet.
  // Do NOT block on subsequent getMe refreshes (loading=true with user already present)
  // — that would unmount children, triggering another getMe call and looping forever.
  const initializing = loading && !effectiveAuth;

  if (initializing) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
          background: 'var(--color-bg)',
        }}
      >
        <Box sx={{ position: 'relative', display: 'inline-flex' }}>
          {/* Track ring */}
          <CircularProgress
            variant="determinate"
            value={100}
            size={52}
            thickness={3}
            sx={{ color: 'var(--color-border)', position: 'absolute' }}
          />
          {/* Animated ring with brand gradient via SVG linearGradient */}
          <CircularProgress
            size={52}
            thickness={3}
            sx={{
              '& .MuiCircularProgress-circle': {
                stroke: `url(#brand-gradient-spinner)`,
              },
            }}
          />
          {/* Inline SVG gradient definition */}
          <svg width="0" height="0" style={{ position: 'absolute' }}>
            <defs>
              <linearGradient id="brand-gradient-spinner" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={theme.palette.primary.main} />
                <stop offset="100%" stopColor={theme.palette.info?.main || theme.palette.primary.light} />
              </linearGradient>
            </defs>
          </svg>
        </Box>
        <Typography
          variant="overline"
          sx={{
            color: 'var(--color-text-secondary)',
            letterSpacing: '0.1em',
            fontSize: '0.7rem',
          }}
        >
          Verifying…
        </Typography>
      </Box>
    );
  }

  // Not logged in → /login, preserving the attempted URL as returnUrl
  if (!effectiveAuth) {
    const returnUrl = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?returnUrl=${returnUrl}`} replace />;
  }

  // Wrong persona → redirect to the correct home
  if (allowedPersonas) {
    const allowed = Array.isArray(allowedPersonas) ? allowedPersonas : [allowedPersonas];
    if (!allowed.includes(persona)) {
      return <Navigate to={persona === 'admin' ? '/admin/dashboard' : `/${persona}/home`} replace />;
    }
  }

  return <>{children}</>;
}

export default ProtectedRoute;
