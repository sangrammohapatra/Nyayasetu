/**
 * client/src/pages/citizen/CitizenProfile.jsx
 */
import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';

import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Avatar from '@mui/material/Avatar';
import LinearProgress from '@mui/material/LinearProgress';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Alert from '@mui/material/Alert';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import InputLabel from '@mui/material/InputLabel';
import FormControl from '@mui/material/FormControl';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import CircularProgress from '@mui/material/CircularProgress';
import Snackbar from '@mui/material/Snackbar';
import Divider from '@mui/material/Divider';

import AnimatedPage from '../../components/ui/AnimatedPage';
import GradientHeading from '../../components/ui/GradientHeading';
import { useTheme } from '@mui/material/styles';
import { TYPOGRAPHY } from '../../theme/tokens';
import {
  selectUser,
  updateMe, setPassword, deactivateAccount,
} from '../../store/slices/authSlice';

// ─── Static data ──────────────────────────────────────────────────────────────

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman & Nicobar Islands', 'Chandigarh',
  'Dadra & Nagar Haveli and Daman & Diu',
  'Delhi', 'Jammu & Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
];

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिंदी' },
  { code: 'bn', label: 'বাংলা' },
  { code: 'mr', label: 'मराठी' },
  { code: 'ta', label: 'தமிழ்' },
  { code: 'te', label: 'తెలుగు' },
  { code: 'gu', label: 'ગુજરાતી' },
  { code: 'kn', label: 'ಕನ್ನಡ' },
  { code: 'ml', label: 'മലയാളം' },
  { code: 'pa', label: 'ਪੰਜਾਬੀ' },
  { code: 'ur', label: 'اردو' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name) {
  if (!name) return '?';
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

function getAvatarColor(name) {
  const palette = ['#1565C0', '#00695C', '#4A148C', '#BF360C', '#1B5E20', '#880E4F'];
  if (!name) return palette[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return palette[Math.abs(hash) % palette.length];
}

function formatMemberSince(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IN', { year: 'numeric', month: 'long' });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Section({ title, icon, children, delay = 0 }) {
  const prefersReducedMotion = useReducedMotion();
  return (
    <motion.div
      initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
    >
      <Box sx={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 3,
        p: { xs: 2.5, sm: 3 },
        mb: 3,
      }}>
        {title && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2.5 }}>
            <Typography sx={{ fontSize: 20, lineHeight: 1 }}>{icon}</Typography>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: 'var(--color-text)' }}>
              {title}
            </Typography>
          </Box>
        )}
        {children}
      </Box>
    </motion.div>
  );
}

function SaveButton({ saving, label = 'Save Changes', onClick, disabled }) {
  return (
    <Button
      variant="contained"
      onClick={onClick}
      disabled={saving || disabled}
      sx={{
        mt: 2.5, borderRadius: 2,
        background: 'var(--color-primary)',
        fontWeight: 700, px: 4,
        '&:hover': { background: 'var(--color-primary)', filter: 'brightness(0.9)' },
      }}
    >
      {saving ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : label}
    </Button>
  );
}

function UsageMeter({ label, icon, used, limit }) {
  const unlimited = limit >= 999_999;
  const pct = unlimited ? 0 : Math.min(100, Math.round((used / limit) * 100));
  const barColor = pct >= 90
    ? 'var(--color-error, #f44336)'
    : pct >= 70
      ? 'var(--color-warning, #ff9800)'
      : 'var(--color-primary)';

  return (
    <Box sx={{ mb: 2.5 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
        <Typography variant="body2" sx={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <span>{icon}</span> {label}
        </Typography>
        <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)' }}>
          {unlimited ? '∞ Unlimited' : `${used} / ${limit}`}
        </Typography>
      </Box>
      {!unlimited && (
        <LinearProgress
          variant="determinate"
          value={pct}
          sx={{
            height: 6, borderRadius: 3,
            background: 'var(--color-border)',
            '& .MuiLinearProgress-bar': { background: barColor, borderRadius: 3 },
          }}
        />
      )}
    </Box>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CitizenProfile() {
  const dispatch  = useDispatch();
  const navigate  = useNavigate();
  const user      = useSelector(selectUser);
  const muiTheme  = useTheme();
  const prefersReducedMotion = useReducedMotion();

  // ── Personal info ──────────────────────────────────────────────────────────
  const [personal, setPersonal]     = useState({ name: '', email: '' });
  const [personalBusy, setPersonalBusy] = useState(false);

  // ── Location ───────────────────────────────────────────────────────────────
  const [location, setLocation]     = useState({ state: '', district: '', pincode: '' });
  const [locationBusy, setLocationBusy] = useState(false);

  // ── Preferences ────────────────────────────────────────────────────────────
  const [prefs, setPrefs]           = useState({ preferredLanguage: 'en', whatsappOptIn: false, whatsappNumber: '' });
  const [prefsBusy, setPrefsBusy]   = useState(false);

  // ── Password ───────────────────────────────────────────────────────────────
  const [pw, setPw]                 = useState({ current: '', next: '', confirm: '' });
  const [pwBusy, setPwBusy]         = useState(false);
  const [pwError, setPwError]       = useState('');
  const [showPw, setShowPw]         = useState({ current: false, next: false, confirm: false });

  // ── Deactivate dialog ──────────────────────────────────────────────────────
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [deactivateBusy, setDeactivateBusy] = useState(false);

  // ── Toast ──────────────────────────────────────────────────────────────────
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' });
  const showToast = (message, severity = 'success') =>
    setToast({ open: true, message, severity });

  // Sync form state when Redux user arrives / updates
  useEffect(() => {
    if (!user) return;
    setPersonal({
      name:  user.name  || '',
      email: user.email || '',
    });
    setLocation({
      state:    user.state    || '',
      district: user.district || '',
      pincode:  user.pincode  || '',
    });
    setPrefs({
      preferredLanguage: user.preferredLanguage || 'en',
      whatsappOptIn:     user.whatsappOptIn     || false,
      whatsappNumber:    user.whatsappNumber?.replace('+91', '') || '',
    });
  }, [user]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleSavePersonal = async () => {
    setPersonalBusy(true);
    const payload = { name: personal.name };
    if (personal.email) payload.email = personal.email;
    const result = await dispatch(updateMe(payload));
    setPersonalBusy(false);
    updateMe.fulfilled.match(result)
      ? showToast('Personal information updated.')
      : showToast(result.payload || 'Failed to update.', 'error');
  };

  const handleSaveLocation = async () => {
    setLocationBusy(true);
    const payload = {};
    if (location.state)    payload.state    = location.state;
    if (location.district) payload.district = location.district;
    if (location.pincode)  payload.pincode  = location.pincode;
    const result = await dispatch(updateMe(payload));
    setLocationBusy(false);
    updateMe.fulfilled.match(result)
      ? showToast('Location updated.')
      : showToast(result.payload || 'Failed to update.', 'error');
  };

  const handleSavePrefs = async () => {
    setPrefsBusy(true);
    const payload = {
      preferredLanguage: prefs.preferredLanguage,
      whatsappOptIn: prefs.whatsappOptIn,
    };
    if (prefs.whatsappOptIn && prefs.whatsappNumber) {
      payload.whatsappNumber = prefs.whatsappNumber;
    }
    const result = await dispatch(updateMe(payload));
    setPrefsBusy(false);
    updateMe.fulfilled.match(result)
      ? showToast('Preferences saved.')
      : showToast(result.payload || 'Failed to save.', 'error');
  };

  const handleChangePassword = async () => {
    setPwError('');
    if (pw.next.length < 8)        { setPwError('Password must be at least 8 characters.'); return; }
    if (pw.next !== pw.confirm)    { setPwError('Passwords do not match.'); return; }
    setPwBusy(true);
    const payload = { password: pw.next };
    if (pw.current) payload.currentPassword = pw.current;
    const result = await dispatch(setPassword(payload));
    setPwBusy(false);
    if (setPassword.fulfilled.match(result)) {
      setPw({ current: '', next: '', confirm: '' });
      showToast('Password updated successfully.');
    } else {
      setPwError(result.payload || 'Failed to change password.');
    }
  };

  const handleDeactivate = async () => {
    setDeactivateBusy(true);
    const result = await dispatch(deactivateAccount());
    setDeactivateBusy(false);
    setDeactivateOpen(false);
    if (deactivateAccount.fulfilled.match(result)) {
      navigate('/login');
    } else {
      showToast(result.payload || 'Failed to deactivate account.', 'error');
    }
  };

  // ── Derived display values ─────────────────────────────────────────────────
  const plan        = user?.subscription?.plan || 'free';
  const freeUsage   = user?.freeUsage || {};
  const memberSince = formatMemberSince(user?.createdAt);
  const planLabel   = plan.charAt(0).toUpperCase() + plan.slice(1);

  return (
    <AnimatedPage>
      <Box sx={{ maxWidth: 940, mx: 'auto', px: { xs: 2, sm: 3 }, py: 3 }}>

        {/* Page heading */}
        <GradientHeading
          variant="h5"
          sx={{ fontFamily: TYPOGRAPHY.fontFamily.display, fontWeight: 700, mb: 3 }}
        >
          My Profile
        </GradientHeading>

        {/* ── Profile hero ──────────────────────────────────────────────────── */}
        <motion.div initial={prefersReducedMotion ? false : { opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
          <Box sx={{
            background: 'linear-gradient(135deg, var(--color-primary-alpha) 0%, var(--color-surface) 100%)',
            border: '1px solid var(--color-border)',
            borderRadius: 3,
            p: { xs: 2.5, sm: 3.5 },
            mb: 3,
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            alignItems: { xs: 'flex-start', sm: 'center' },
            gap: 3,
          }}>
            <Avatar sx={{
              width: 84, height: 84,
              background: getAvatarColor(user?.name),
              fontSize: '2rem', fontWeight: 700,
              border: '3px solid var(--color-surface)',
              boxShadow: muiTheme.custom?.glowPrimary || '0 4px 18px rgba(0,0,0,0.14)',
              flexShrink: 0,
            }}>
              {getInitials(user?.name)}
            </Avatar>

            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="h5" sx={{ fontWeight: 700, color: 'var(--color-text)', mb: 0.5, lineHeight: 1.25 }}>
                {user?.name || user?.displayName || 'Your Profile'}
              </Typography>
              <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)', mb: 1.25 }}>
                {user?.phone || ''}{user?.phone && user?.email ? ' · ' : ''}{user?.email || ''}
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                <Chip
                  label="Citizen"
                  size="small"
                  sx={{ background: 'var(--color-primary)', color: '#fff', fontWeight: 600, fontSize: '0.72rem' }}
                />
                <Chip
                  label={`${planLabel} Plan`}
                  size="small"
                  variant="outlined"
                  sx={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)', fontSize: '0.72rem' }}
                />
                <Chip
                  label={`Member since ${memberSince}`}
                  size="small"
                  variant="outlined"
                  sx={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)', fontSize: '0.72rem' }}
                />
              </Box>
            </Box>
          </Box>
        </motion.div>

        {/* ── Two-column grid ───────────────────────────────────────────────── */}
        <Grid container spacing={3} alignItems="flex-start">

          {/* ── Left column ─────────────────────────────────────────────────── */}
          <Grid item xs={12} md={5}>

            {/* Monthly usage */}
            <Section title="Monthly Usage" icon="📊" delay={0.05}>
              <UsageMeter label="Documents" icon="📄"
                used={freeUsage.docsGenerated  || 0} limit={freeUsage.docsLimit     || 3} />
              <UsageMeter label="Cases Tracked" icon="⚖️"
                used={freeUsage.casesTracked   || 0} limit={freeUsage.casesLimit    || 1} />
              <UsageMeter label="AI Chats" icon="🤖"
                used={freeUsage.aiChatsUsed    || 0} limit={freeUsage.aiChatsLimit  || 5} />

              {freeUsage.resetDate && (
                <Typography variant="caption" sx={{ display: 'block', color: 'var(--color-text-secondary)', mt: 0.5 }}>
                  Resets on {new Date(freeUsage.resetDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </Typography>
              )}

              {plan === 'free' && (
                <Button
                  fullWidth variant="contained" size="small"
                  onClick={() => navigate('/pricing')}
                  sx={{
                    mt: 2, borderRadius: 2, fontWeight: 700,
                    background: 'var(--color-primary)',
                    '&:hover': { filter: 'brightness(0.9)' },
                  }}
                >
                  Upgrade Plan →
                </Button>
              )}
            </Section>

            {/* Preferences */}
            <Section title="Preferences" icon="🌐" delay={0.1}>
              <FormControl fullWidth size="small" sx={{ mb: 2.5 }}>
                <InputLabel>Language</InputLabel>
                <Select
                  value={prefs.preferredLanguage}
                  label="Language"
                  onChange={(e) => setPrefs((p) => ({ ...p, preferredLanguage: e.target.value }))}
                  sx={{ borderRadius: 2 }}
                >
                  {LANGUAGES.map((l) => (
                    <MenuItem key={l.code} value={l.code}>{l.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControlLabel
                control={
                  <Switch
                    checked={prefs.whatsappOptIn}
                    onChange={(e) => setPrefs((p) => ({ ...p, whatsappOptIn: e.target.checked }))}
                    color="primary"
                    size="small"
                  />
                }
                label={<Typography variant="body2" sx={{ fontWeight: 500 }}>WhatsApp Notifications</Typography>}
                sx={{ mb: prefs.whatsappOptIn ? 1.5 : 0 }}
              />

              {prefs.whatsappOptIn && (
                <TextField
                  fullWidth size="small"
                  label="WhatsApp Number"
                  value={prefs.whatsappNumber}
                  onChange={(e) => setPrefs((p) => ({
                    ...p,
                    whatsappNumber: e.target.value.replace(/\D/g, '').slice(0, 10),
                  }))}
                  inputProps={{ maxLength: 10, inputMode: 'numeric' }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)' }}>+91</Typography>
                      </InputAdornment>
                    ),
                  }}
                  sx={{ mb: 0.5, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                />
              )}

              <SaveButton saving={prefsBusy} label="Save Preferences" onClick={handleSavePrefs} />
            </Section>

          </Grid>

          {/* ── Right column ────────────────────────────────────────────────── */}
          <Grid item xs={12} md={7}>

            {/* Personal information */}
            <Section title="Personal Information" icon="👤" delay={0.05}>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth size="small" label="Full Name"
                    value={personal.name}
                    onChange={(e) => setPersonal((p) => ({ ...p, name: e.target.value }))}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth size="small" label="Email Address" type="email"
                    value={personal.email}
                    onChange={(e) => setPersonal((p) => ({ ...p, email: e.target.value }))}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth size="small" label="Phone Number"
                    value={user?.phone || '—'}
                    disabled
                    helperText="Phone number cannot be changed"
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Typography sx={{ fontSize: 15 }}>📱</Typography>
                        </InputAdornment>
                      ),
                    }}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                  />
                </Grid>
              </Grid>
              <SaveButton saving={personalBusy} onClick={handleSavePersonal} />
            </Section>

            {/* Location */}
            <Section title="Location" icon="📍" delay={0.1}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth size="small">
                    <InputLabel>State</InputLabel>
                    <Select
                      value={location.state}
                      label="State"
                      onChange={(e) => setLocation((p) => ({ ...p, state: e.target.value }))}
                      sx={{ borderRadius: 2 }}
                    >
                      <MenuItem value=""><em>Select State</em></MenuItem>
                      {INDIAN_STATES.map((s) => (
                        <MenuItem key={s} value={s}>{s}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth size="small" label="District"
                    value={location.district}
                    onChange={(e) => setLocation((p) => ({ ...p, district: e.target.value }))}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth size="small" label="Pincode"
                    value={location.pincode}
                    onChange={(e) => setLocation((p) => ({
                      ...p,
                      pincode: e.target.value.replace(/\D/g, '').slice(0, 6),
                    }))}
                    inputProps={{ maxLength: 6, inputMode: 'numeric' }}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                  />
                </Grid>
              </Grid>
              <SaveButton saving={locationBusy} label="Save Location" onClick={handleSaveLocation} />
            </Section>

            {/* Security */}
            <Section title="Security" icon="🔒" delay={0.15}>
              {pwError && (
                <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{pwError}</Alert>
              )}
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth size="small"
                    label="Current Password (leave blank if not set)"
                    type={showPw.current ? 'text' : 'password'}
                    value={pw.current}
                    onChange={(e) => setPw((p) => ({ ...p, current: e.target.value }))}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton size="small" onClick={() => setShowPw((p) => ({ ...p, current: !p.current }))}>
                            <Typography sx={{ fontSize: 16 }}>{showPw.current ? '🙈' : '👁️'}</Typography>
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth size="small" label="New Password"
                    type={showPw.next ? 'text' : 'password'}
                    value={pw.next}
                    onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))}
                    helperText="Min. 8 characters"
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton size="small" onClick={() => setShowPw((p) => ({ ...p, next: !p.next }))}>
                            <Typography sx={{ fontSize: 16 }}>{showPw.next ? '🙈' : '👁️'}</Typography>
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth size="small" label="Confirm New Password"
                    type={showPw.confirm ? 'text' : 'password'}
                    value={pw.confirm}
                    onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton size="small" onClick={() => setShowPw((p) => ({ ...p, confirm: !p.confirm }))}>
                            <Typography sx={{ fontSize: 16 }}>{showPw.confirm ? '🙈' : '👁️'}</Typography>
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                  />
                </Grid>
              </Grid>
              <SaveButton
                saving={pwBusy}
                label="Change Password"
                onClick={handleChangePassword}
                disabled={!pw.next}
              />
            </Section>

            {/* Account management */}
            <Section title="Account" icon="⚠️" delay={0.2}>
              <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)', mb: 2, lineHeight: 1.7 }}>
                Deactivating your account will sign you out and prevent future logins.
                Your data is retained for 30 days — contact support to reactivate before then.
              </Typography>
              <Divider sx={{ mb: 2, borderColor: 'var(--color-border)' }} />
              <Button
                variant="outlined"
                color="error"
                size="small"
                onClick={() => setDeactivateOpen(true)}
                sx={{ borderRadius: 2, fontWeight: 600 }}
              >
                Deactivate Account
              </Button>
            </Section>

          </Grid>
        </Grid>

        {/* ── Deactivate confirmation dialog ──────────────────────────────────── */}
        <Dialog
          open={deactivateOpen}
          onClose={() => !deactivateBusy && setDeactivateOpen(false)}
          maxWidth="xs"
          fullWidth
          PaperProps={{ sx: { borderRadius: 3, background: 'var(--color-surface)' } }}
        >
          <DialogTitle sx={{ fontWeight: 700, color: 'var(--color-text)', pb: 1 }}>
            ⚠️ Deactivate Account?
          </DialogTitle>
          <DialogContent>
            <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>
              This will immediately sign you out and prevent future logins.
              Your documents and case data will be retained for 30 days.
              Contact <strong>support@nyayasetu.in</strong> to reverse this.
            </Typography>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
            <Button
              onClick={() => setDeactivateOpen(false)}
              disabled={deactivateBusy}
              sx={{ borderRadius: 2 }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              color="error"
              onClick={handleDeactivate}
              disabled={deactivateBusy}
              sx={{ borderRadius: 2, fontWeight: 700 }}
            >
              {deactivateBusy
                ? <CircularProgress size={18} sx={{ color: '#fff' }} />
                : 'Yes, Deactivate'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* ── Toast notifications ──────────────────────────────────────────────── */}
        <Snackbar
          open={toast.open}
          autoHideDuration={3500}
          onClose={() => setToast((t) => ({ ...t, open: false }))}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
          sx={{ mb: { xs: 8, md: 2 } }}
        >
          <Alert
            severity={toast.severity}
            onClose={() => setToast((t) => ({ ...t, open: false }))}
            sx={{ borderRadius: 2, background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
          >
            {toast.message}
          </Alert>
        </Snackbar>

      </Box>
    </AnimatedPage>
  );
}
