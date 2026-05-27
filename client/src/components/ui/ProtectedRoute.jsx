/**
 * client/src/components/ui/ProtectedRoute.jsx
 */

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import { selectIsAuthenticated, selectUserPersona, selectAuthLoading } from '../../store/slices/authSlice';

/**
 * @param {object}   props
 * @param {React.ReactNode} props.children
 * @param {string|string[]} [props.allowedPersonas]  If set, only these personas may access the route.
 */
function ProtectedRoute({ children, allowedPersonas }) {
  const location = useLocation();
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const persona = useSelector(selectUserPersona);
  const loading = useSelector(selectAuthLoading);

  // Block ONLY on the initial auth check: token exists but user hasn't loaded yet.
  // Do NOT block on subsequent getMe refreshes (loading=true with user already present)
  // — that would unmount children, triggering another getMe call and looping forever.
  const initializing = loading && !isAuthenticated;

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
        <CircularProgress sx={{ color: 'var(--color-primary)' }} size={48} />
        <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)' }}>
          Loading…
        </Typography>
      </Box>
    );
  }

  // Not logged in → /login, preserving the attempted URL as returnUrl
  if (!isAuthenticated) {
    const returnUrl = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?returnUrl=${returnUrl}`} replace />;
  }

  // Wrong persona → redirect to the correct home
  if (allowedPersonas) {
    const allowed = Array.isArray(allowedPersonas) ? allowedPersonas : [allowedPersonas];
    if (!allowed.includes(persona)) {
      return <Navigate to={`/${persona}/home`} replace />;
    }
  }

  return <>{children}</>;
}

export default ProtectedRoute;
