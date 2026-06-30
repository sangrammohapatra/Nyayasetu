/**
 * AdminSessionGate
 *
 * Wraps the entire admin layout. Provides two layers of protection:
 *
 * 1. Client-side idle timer — after 15 minutes of no mouse/key/scroll activity,
 *    proactively shows the re-auth dialog (before the server rejects any request).
 *
 * 2. API interceptor integration — if a request fails with ADMIN_SESSION_EXPIRED
 *    (server-enforced), the axios interceptor in api.js calls the subscriber
 *    registered here. The dialog resolves the pending promise on successful
 *    re-auth so the original request is automatically retried transparently.
 *
 * After 3 consecutive wrong passwords the admin is force-logged out.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import Alert from '@mui/material/Alert';

import api, { subscribeAdminReauth } from '../../services/api';
import { forceLogout } from '../../store/slices/authSlice';
import { RADIUS, TYPOGRAPHY } from '../../theme/tokens';

const IDLE_TIMEOUT_MS   = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS      = 3;

export default function AdminSessionGate({ children }) {
  const dispatch = useDispatch();

  const [open, setOpen]           = useState(false);
  const [password, setPassword]   = useState('');
  const [error, setError]         = useState('');
  const [loading, setLoading]     = useState(false);
  const [attempts, setAttempts]   = useState(0);

  // Refs avoid stale closures inside the idle-timer callback.
  const openRef     = useRef(false);
  const timerRef    = useRef(null);
  const pendingRef  = useRef(null); // { resolve, reject } from the api interceptor

  // ── Idle timer ─────────────────────────────────────────────────────────────

  const triggerSessionExpiry = useCallback(() => {
    if (openRef.current) return;
    openRef.current = true;
    setOpen(true);
  }, []);

  const scheduleIdle = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(triggerSessionExpiry, IDLE_TIMEOUT_MS);
  }, [triggerSessionExpiry]);

  const handleActivity = useCallback(() => {
    if (!openRef.current) scheduleIdle();
  }, [scheduleIdle]);

  useEffect(() => {
    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach((e) => window.addEventListener(e, handleActivity, { passive: true }));
    scheduleIdle(); // Arm the timer on mount.
    return () => {
      events.forEach((e) => window.removeEventListener(e, handleActivity));
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [handleActivity, scheduleIdle]);

  // ── API interceptor subscription ───────────────────────────────────────────

  useEffect(() => {
    const unsub = subscribeAdminReauth(({ resolve, reject }) => {
      pendingRef.current = { resolve, reject };
      openRef.current = true;
      setOpen(true);
    });
    return unsub;
  }, []);

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleSignOut = useCallback(() => {
    if (pendingRef.current) pendingRef.current.reject(new Error('Signed out'));
    pendingRef.current = null;
    dispatch(forceLogout());
    window.location.href = '/login';
  }, [dispatch]);

  const handleSubmit = useCallback(async () => {
    if (!password.trim() || loading) return;
    setLoading(true);
    setError('');

    try {
      await api.post('/admin/reauth', { password });

      // Re-auth succeeded — resolve the pending interceptor promise (if any).
      if (pendingRef.current) {
        pendingRef.current.resolve();
        pendingRef.current = null;
      }

      // Reset dialog state and restart idle timer.
      openRef.current = false;
      setOpen(false);
      setPassword('');
      setAttempts(0);
      scheduleIdle();
    } catch (err) {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);

      if (newAttempts >= MAX_ATTEMPTS) {
        if (pendingRef.current) pendingRef.current.reject(err);
        handleSignOut();
        return;
      }

      setError(
        err.response?.data?.message ||
        `Incorrect password. ${MAX_ATTEMPTS - newAttempts} attempt${MAX_ATTEMPTS - newAttempts !== 1 ? 's' : ''} remaining.`
      );
    } finally {
      setLoading(false);
    }
  }, [password, loading, attempts, handleSignOut, scheduleIdle]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSubmit();
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      {children}

      <Dialog
        open={open}
        disableEscapeKeyDown
        // Prevent backdrop click from dismissing — admin must explicitly re-auth or sign out.
        onClose={() => {}}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
          },
        }}
      >
        <DialogContent sx={{ p: 3.5 }}>
          {/* Lock icon */}
          <Box sx={{ textAlign: 'center', mb: 2.5 }}>
            <Box sx={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 56, height: 56, borderRadius: '50%',
              background: 'rgba(211,47,47,0.1)', fontSize: 28, mb: 1.5,
            }}>
              🔒
            </Box>
            <Typography variant="h6" sx={{ fontWeight: 700, fontFamily: TYPOGRAPHY.fontFamily.display, color: 'var(--color-text)', lineHeight: 1.3 }}>
              Session timed out
            </Typography>
            <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)', mt: 0.75, lineHeight: 1.55 }}>
              Your admin session expired after 15 minutes of inactivity. Enter your password to continue.
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: 2, fontSize: '0.8rem' }}>
              {error}
            </Alert>
          )}

          <TextField
            autoFocus
            fullWidth
            type="password"
            label="Password"
            size="small"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            sx={{
              mb: 2,
              '& .MuiOutlinedInput-root': { borderRadius: `${RADIUS.md}px` },
            }}
          />

          <Button
            fullWidth
            variant="contained"
            disabled={!password.trim() || loading}
            onClick={handleSubmit}
            sx={{
              borderRadius: `${RADIUS.md}px`,
              fontWeight: 700,
              py: 1.1,
              background: 'var(--color-primary)',
              mb: 1.25,
              '&:hover': { background: 'var(--color-primary-dark, var(--color-primary))' },
            }}
          >
            {loading
              ? <CircularProgress size={20} sx={{ color: '#fff' }} />
              : 'Continue Working'}
          </Button>

          <Button
            fullWidth
            variant="text"
            onClick={handleSignOut}
            disabled={loading}
            sx={{ color: 'var(--color-text-secondary)', fontSize: '0.8rem', fontWeight: 500 }}
          >
            Sign out instead
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
