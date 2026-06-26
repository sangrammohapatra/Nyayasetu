/**
 * client/src/pages/auth/Login.jsx
 */

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import FormControl from '@mui/material/FormControl';
import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import Chip from '@mui/material/Chip';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import LinearProgress from '@mui/material/LinearProgress';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';

import {
  sendOTP, verifyOTP, loginWithPassword,
  register as registerUser,
  selectAuthLoading, selectAuthError, selectOtpSent,
  selectIsAuthenticated, selectUserPersona, clearError, resetOtpState,
} from '../../store/slices/authSlice';
import { setLanguage, setTheme } from '../../store/slices/uiSlice';
import { RADIUS, SHADOWS, TYPOGRAPHY } from '../../theme/tokens';
import GlassCard from '../../components/ui/GlassCard';
import GradientHeading from '../../components/ui/GradientHeading';
import LanguageSelector from '../../components/ui/LanguageSelector';
import { AuthVisualPanel } from './AuthShared';

// ─── Constants ────────────────────────────────────────────────────────────────

const UI_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'bn', label: 'বাংলা' },
  { code: 'mr', label: 'मराठी' },
  { code: 'ta', label: 'தமிழ்' },
  { code: 'te', label: 'తెలుగు' },
  { code: "od", label: "ଓଡ଼ିଆ" },
];

const ALL_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'bn', label: 'বাংলা' },
  { code: 'mr', label: 'मराठी' },
  { code: 'ta', label: 'தமிழ்' },
  { code: 'te', label: 'తెలుగు' },
  { code: 'gu', label: 'ગુજરાતી' },
  { code: 'kn', label: 'ಕನ್ನಡ' },
  { code: 'ml', label: 'മലയാളം' },
  { code: 'pa', label: 'ਪੰਜਾਬੀ' },
  { code: 'ur', label: 'اردو' },
  { code: 'od', label: 'ଓଡ଼ିଆ' },
];

const THEMES = [
  { id: 'default', label: 'Blue Justice', color: '#1565C0' },
  { id: 'saffron', label: 'Saffron', color: '#FF6F00' },
  { id: 'dark', label: 'Dark', color: '#0D1117' },
  { id: 'emerald', label: 'Emerald', color: '#00695C' },
  { id: 'highContrast', label: 'High Contrast', color: '#000000' },
];

const INDIAN_STATES = [
  'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa',
  'Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala',
  'Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland',
  'Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura',
  'Uttar Pradesh','Uttarakhand','West Bengal','Delhi','Jammu & Kashmir','Ladakh',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const looksLikeEmail = (val) => typeof val === 'string' && (val.includes('@') || /[a-zA-Z]/.test(val[0] || ''));
const looksLikePhone = (val) => typeof val === 'string' && /^\d{0,10}$/.test(val);


// ─── OTP Input ────────────────────────────────────────────────────────────────

function OTPInput({ value, onChange, disabled }) {
  const digits = Array.from({ length: 6 }, (_, i) => value[i] || '');
  const inputRefs = useRef([]);
  const prefersReducedMotion = useReducedMotion();

  const handleChange = (index, e) => {
    const val = e.target.value.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[index] = val;
    onChange(next.join(''));
    if (val && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) inputRefs.current[index - 1]?.focus();
    if (e.key === 'ArrowLeft' && index > 0) inputRefs.current[index - 1]?.focus();
    if (e.key === 'ArrowRight' && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handlePaste = (e) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted) onChange(pasted.padEnd(6, '').slice(0, 6));
  };

  return (
    <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
      {digits.map((digit, i) => (
        <motion.div key={i} initial={prefersReducedMotion ? false : { scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: i * 0.05 }}>
          <input
            ref={(el) => (inputRefs.current[i] = el)}
            type="text" inputMode="numeric" maxLength={1} value={digit} disabled={disabled}
            onChange={(e) => handleChange(i, e)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onPaste={handlePaste}
            style={{
              width: 44, height: 52, textAlign: 'center', fontSize: '1.375rem',
              fontWeight: 700, fontFamily: TYPOGRAPHY.fontFamily.mono,
              borderRadius: RADIUS.md,
              border: digit ? '2px solid var(--color-primary)' : '1.5px solid var(--color-border)',
              background: digit ? 'var(--color-primary-alpha)' : 'var(--color-surface)',
              color: 'var(--color-text)', outline: 'none',
              transition: 'border-color 0.2s, background 0.2s',
              cursor: disabled ? 'not-allowed' : 'text',
            }}
          />
        </motion.div>
      ))}
    </Box>
  );
}

// ─── Animation variants ───────────────────────────────────────────────────────

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.09 } } };
const fadeUp = { hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0, transition: { duration: 0.38, ease: 'easeOut' } } };
const slideVariants = {
  enter: (dir) => ({ x: dir > 0 ? 60 : -60, opacity: 0 }),
  center: { x: 0, opacity: 1, transition: { duration: 0.32, ease: 'easeOut' } },
  exit: (dir) => ({ x: dir > 0 ? -60 : 60, opacity: 0, transition: { duration: 0.22, ease: 'easeIn' } }),
};

// ─── Step progress indicator (register) ──────────────────────────────────────

function RegStepIndicator({ step }) {
  const labels = ['Personal Info', 'Verify Email', 'Your Role', 'Preferences'];
  const displayStep = step;
  return (
    <Box sx={{ mb: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
        {labels.map((label, i) => (
          <Typography key={i} variant="caption" sx={{
            fontWeight: i === displayStep ? 700 : 400,
            color: i <= displayStep ? 'var(--color-primary)' : 'var(--color-text-secondary)',
            display: { xs: i === displayStep ? 'block' : 'none', sm: 'block' },
            fontSize: '0.68rem',
          }}>
            {i < displayStep ? '✓ ' : `${i + 1}. `}{label}
          </Typography>
        ))}
      </Box>
      <LinearProgress variant="determinate" value={((displayStep + 1) / labels.length) * 100} sx={{
        height: 4, borderRadius: 3, background: 'var(--color-border)',
        '& .MuiLinearProgress-bar': {
          background: 'linear-gradient(90deg, var(--color-primary), var(--color-primary-light))',
          borderRadius: 3,
        },
      }} />
    </Box>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

function Login() {
  const { t, i18n } = useTranslation();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const prefersReducedMotion = useReducedMotion();
  const [searchParams] = useSearchParams();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const loading = useSelector(selectAuthLoading);
  const error = useSelector(selectAuthError);
  const otpSent = useSelector(selectOtpSent);
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const persona = useSelector(selectUserPersona);

  // ── Page mode ────────────────────────────────────────────────────────────
  const [pageMode, setPageMode] = useState('login'); // 'login' | 'register'

  // ── Login state ───────────────────────────────────────────────────────────
  const [loginMode, setLoginMode] = useState('otp'); // 'otp' | 'password'
  const [identifier, setIdentifier] = useState(''); // phone digits or email
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [localLang, setLocalLang] = useState(i18n.language || 'en');

  // ── Register state ────────────────────────────────────────────────────────
  const [regStep, setRegStep] = useState(0);
  const [regDirection, setRegDirection] = useState(1);
  const [regData, setRegData] = useState({
    name: '', email: '', phone: '', state: '', district: '',
    persona: 'citizen', preferredLanguage: 'en', whatsappOptIn: true,
    password: '', confirmPassword: '',
  });
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirmPassword, setShowRegConfirmPassword] = useState(false);
  const [regOtp, setRegOtp] = useState('');
  const [regOtpSent, setRegOtpSent] = useState(false);
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState(null);
  const [regCountdown, setRegCountdown] = useState(0);
  const [regErrors, setRegErrors] = useState({});

  const [snackOpen, setSnackOpen] = useState(false);
  const [snackMsg, setSnackMsg] = useState({ message: '', severity: 'error' });

  // Derived for login identifier
  const identifierIsEmail = looksLikeEmail(identifier);
  const identifierIsPhone = looksLikePhone(identifier);
  const loginIdentifierForApi = identifierIsPhone ? `+91${identifier}` : identifier;

  // ── returnUrl handling ────────────────────────────────────────────────────
  const rawReturnUrl = searchParams.get('returnUrl') || `/${persona || 'citizen'}/home`;
  const safeReturnUrl = ['/login', '/register'].some((p) => decodeURIComponent(rawReturnUrl).startsWith(p))
    ? `/${persona || 'citizen'}/home`
    : rawReturnUrl;

  const alreadyAuthed = useRef(isAuthenticated);
  useEffect(() => {
    if (alreadyAuthed.current) navigate(decodeURIComponent(safeReturnUrl), { replace: true });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Countdown timers ──────────────────────────────────────────────────────
  useEffect(() => { if (otpSent) setCountdown(30); }, [otpSent]);
  useEffect(() => {
    if (countdown <= 0) return;
    const id = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [countdown]);

  useEffect(() => {
    if (regCountdown <= 0) return;
    const id = setTimeout(() => setRegCountdown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [regCountdown]);

  useEffect(() => () => { dispatch(clearError()); }, [dispatch]);

  useEffect(() => {
    if (error) {
      setSnackMsg({ message: error, severity: 'error' });
      setSnackOpen(true);
    }
  }, [error]);

  // ── Lang change ───────────────────────────────────────────────────────────
  const handleLangChange = (e) => {
    const lang = e.target.value;
    setLocalLang(lang);
    dispatch(setLanguage(lang));
  };

  // ── Switch page mode ──────────────────────────────────────────────────────
  const switchPageMode = (mode) => {
    setPageMode(mode);
    setRegStep(0);
    setRegDirection(1);
    setRegData({ name: '', email: '', phone: '', state: '', district: '', persona: 'citizen', preferredLanguage: 'en', whatsappOptIn: true, password: '', confirmPassword: '' });
    setShowRegPassword(false);
    setShowRegConfirmPassword(false);
    setRegOtp('');
    setRegOtpSent(false);
    setRegLoading(false);
    setRegError(null);
    setRegErrors({});
    setIdentifier('');
    setOtp('');
    setPassword('');
    dispatch(clearError());
    dispatch(resetOtpState());
  };

  // ── LOGIN handlers ────────────────────────────────────────────────────────

  const handleIdentifierChange = (e) => {
    const val = e.target.value;
    if (/^\d/.test(val) || val === '') {
      setIdentifier(val.replace(/\D/g, '').slice(0, 10));
    } else {
      setIdentifier(val);
    }
  };

  const handleSendOTP = async (e) => {
    e.preventDefault();
    if (identifierIsPhone && identifier.length !== 10) return;
    if (identifierIsEmail && !identifier.includes('@')) return;
    dispatch(clearError());
    await dispatch(sendOTP(loginIdentifierForApi));
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    if (otp.length !== 6) return;
    dispatch(clearError());
    const result = await dispatch(verifyOTP(
      identifierIsEmail
        ? { email: identifier, otp }
        : { phone: loginIdentifierForApi, otp }
    ));
    if (result.meta.requestStatus === 'fulfilled') {
      if (result.payload.isNewUser) {
        navigate('/register', { state: { phone: identifierIsPhone ? loginIdentifierForApi : undefined, email: identifierIsEmail ? identifier : undefined } });
      } else {
        const userPersona = (result.payload.user?.persona || 'citizen').toLowerCase();
        navigate(`/${userPersona}/home`);
      }
    }
  };

  const handleResend = () => {
    setOtp('');
    dispatch(sendOTP(loginIdentifierForApi));
  };

  const handleLoginWithPassword = async (e) => {
    e.preventDefault();
    if (identifierIsPhone && identifier.length !== 10) return;
    if (!password) return;
    dispatch(clearError());
    const result = await dispatch(loginWithPassword(
      identifierIsEmail
        ? { email: identifier, password }
        : { phone: loginIdentifierForApi, password }
    ));
    if (result.meta.requestStatus === 'fulfilled') {
      const userPersona = (result.payload.user?.persona || 'citizen').toLowerCase();
      navigate(userPersona === 'admin' ? '/admin/dashboard' : `/${userPersona}/home`);
    }
  };

  const handleModeSwitch = (mode) => {
    setLoginMode(mode);
    setOtp('');
    setPassword('');
    dispatch(clearError());
    if (mode === 'otp') dispatch(resetOtpState());
  };

  // ── REGISTER handlers ─────────────────────────────────────────────────────

  const validateRegStep0 = () => {
    const errs = {};
    if (!regData.name.trim() || regData.name.trim().length < 2) errs.name = 'Name must be at least 2 characters';
    if (!regData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(regData.email)) errs.email = 'Valid email is required';
    if (!regData.phone || regData.phone.length !== 10) errs.phone = 'Enter a valid 10-digit phone number';
    if (!regData.state) errs.state = 'State is required';
    if (!regData.district.trim()) errs.district = 'District is required';
    if (regData.password && regData.password.length < 8) errs.password = 'Password must be at least 8 characters';
    if (regData.password && regData.password !== regData.confirmPassword) errs.confirmPassword = 'Passwords do not match';
    return errs;
  };

  const handleRegNext0 = async () => {
    const errs = validateRegStep0();
    if (Object.keys(errs).length > 0) { setRegErrors(errs); return; }
    setRegErrors({});
    setRegLoading(true);
    setRegError(null);

    const result = await dispatch(sendOTP(regData?.email));
    if (result.meta.requestStatus === 'fulfilled') {
      setRegOtpSent(true);
      setRegCountdown(30);
      setRegDirection(1);
      setRegStep(1);
    } else {
      setRegError(result.payload || 'Failed to send OTP. Please check your email.');
    }
    setRegLoading(false);
  };

  const handleRegVerifyOTP = async () => {
    if (regOtp.length !== 6) return;
    setRegLoading(true);
    setRegError(null);
    const result = await dispatch(verifyOTP({ email: regData?.email, otp: regOtp }));
    if (result.meta.requestStatus === 'fulfilled') {
      setRegDirection(1);
      setRegStep(2);
    } else {
      setRegError(result.payload || 'OTP verification failed. Please try again.');
    }
    setRegLoading(false);
  };

  const handleRegResend = () => {
    setRegOtp('');
    dispatch(sendOTP(regData?.email));
    setRegCountdown(30);
  };

  const handleRegComplete = async () => {
    setRegLoading(true);
    setRegError(null);
    const result = await dispatch(registerUser({
      name: regData.name.trim(),
      email: regData.email.trim().toLowerCase(),
      state: regData.state,
      district: regData.district.trim(),
      persona: regData.persona,
      preferredLanguage: regData.preferredLanguage,
      whatsappOptIn: regData.whatsappOptIn,
      ...(regData.password && { password: regData.password }),
    }));
    if (result.meta.requestStatus === 'fulfilled') {
      const userPersona = (result.payload?.user?.persona || 'citizen').toLowerCase();
      navigate(`/${userPersona}/home`, { replace: true });
    } else {
      setRegError(result.payload || 'Registration failed. Please try again.');
    }
    setRegLoading(false);
  };

  const updateRegData = (field, value) => {
    setRegData((prev) => ({ ...prev, [field]: value }));
    if (regErrors[field]) setRegErrors((prev) => { const e = { ...prev }; delete e[field]; return e; });
  };

  // ── Render helpers ────────────────────────────────────────────────────────

  const primaryBtnSx = {
    py: 1.5, fontWeight: 700, fontSize: '1rem',
    background: 'var(--color-primary)', borderRadius: `${RADIUS.full}px`,
    boxShadow: theme.custom?.glowPrimary || SHADOWS.md,
    '&:hover': { background: 'var(--color-primary-dark, var(--color-primary))', transform: 'scale(1.01)' },
    transition: 'all 0.18s ease',
  };

  const outlinedBtnSx = {
    py: 1.4, borderRadius: `${RADIUS.full}px`, fontWeight: 600,
    borderColor: 'var(--color-border)', color: 'var(--color-text)',
    '&:hover': { borderColor: 'var(--color-primary)', background: 'var(--color-primary-alpha)' },
  };

  // ── JSX ───────────────────────────────────────────────────────────────────

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', background: 'var(--color-bg)' }}>

      {/* Left visual panel — 55%, desktop only */}
      <AuthVisualPanel step={pageMode === 'register' ? regStep : null} />

      {/* Right form panel */}
      <Box sx={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        p: { xs: 3, sm: 5 },
        position: 'relative',
        overflowY: 'auto',
        minHeight: '100vh',
      }}>

        {/* Language selector top-right */}
        <Box sx={{ position: 'absolute', top: 20, right: 20, zIndex: 1 }}>
          <FormControl size="small">
            <Select value={localLang} onChange={handleLangChange} sx={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', '& .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--color-border)' }, '& .MuiSelect-select': { py: 0.75, px: 1.5 } }}>
              {UI_LANGUAGES.map((l) => <MenuItem key={l.code} value={l.code}>{l.label}</MenuItem>)}
            </Select>
          </FormControl>
        </Box>

        <GlassCard sx={{ width: '100%', maxWidth: 480, p: { xs: 3, sm: 4 } }}>

          {/* Brand mark */}
          <motion.div initial={prefersReducedMotion ? false : { opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
              <Box sx={{ width: 42, height: 42, borderRadius: `${RADIUS.md}px`, background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, boxShadow: theme.custom?.glowPrimary || SHADOWS.md }}>⚖️</Box>
              <Box>
                <GradientHeading variant="h5" component="div" sx={{ lineHeight: 1.1 }}>NyayaSetu</GradientHeading>
                <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)' }}>{t('auth.bridge_to_justice', 'Bridge to Justice')}</Typography>
              </Box>
            </Box>
          </motion.div>


          {/* ═══════════════════════ LOGIN MODE ═══════════════════════ */}
          {pageMode === 'login' && (
            <AnimatePresence mode="wait">
              <motion.div key="login-panel" initial={prefersReducedMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={prefersReducedMotion ? undefined : { opacity: 0 }}>

                {/* Login method tabs */}
                <Box sx={{ display: 'flex', mb: 3, background: 'var(--color-surface)', borderRadius: `${RADIUS.md}px`, border: '1.5px solid var(--color-border)', overflow: 'hidden' }}>
                  {[
                    { key: 'otp', label: t('auth.tabOTP', 'OTP Login') },
                    { key: 'password', label: t('auth.tabPassword', 'Password Login') },
                  ].map((tab) => (
                    <Button key={tab.key} fullWidth disableElevation
                      variant={loginMode === tab.key ? 'contained' : 'text'}
                      onClick={() => handleModeSwitch(tab.key)}
                      sx={{
                        py: 1, borderRadius: 0, fontWeight: 600, fontSize: '0.875rem',
                        background: loginMode === tab.key ? 'var(--color-primary)' : 'transparent',
                        color: loginMode === tab.key ? '#fff' : 'var(--color-text-secondary)',
                        '&:hover': { background: loginMode === tab.key ? 'var(--color-primary)' : 'var(--color-primary-alpha)' },
                      }}>
                      {tab.label}
                    </Button>
                  ))}
                </Box>

                <AnimatePresence mode="wait">

                  {/* OTP — enter identifier */}
                  {loginMode === 'otp' && !otpSent && (
                    <motion.div key="login-phone" variants={stagger} initial={prefersReducedMotion ? false : "hidden"} animate="show" exit={prefersReducedMotion ? undefined : { opacity: 0, x: -30, transition: { duration: 0.22 } }}>
                      <motion.div variants={fadeUp}>
                        <Typography variant="h4" sx={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, color: 'var(--color-text)', mb: 0.75, lineHeight: 1.25 }}>
                          {t('auth.login_title', 'Welcome back')}
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)', mb: 3 }}>
                          {t('auth.identifier_hint', 'Enter your phone or email to receive an OTP')}
                        </Typography>
                      </motion.div>

                      <motion.form variants={stagger} onSubmit={handleSendOTP}>
                        <motion.div variants={fadeUp}>
                          <TextField fullWidth
                            label={t('auth.identifier_label', 'Phone Number or Email')}
                            value={identifier}
                            onChange={handleIdentifierChange}
                            inputMode={identifierIsEmail ? 'email' : 'numeric'}
                            autoComplete={identifierIsEmail ? 'email' : 'tel'}
                            autoFocus required
                            InputProps={identifierIsPhone ? {
                              startAdornment: (
                                <InputAdornment position="start">
                                  <Typography sx={{ color: 'var(--color-text)', fontWeight: 600, fontSize: '0.95rem' }}>🇮🇳 +91</Typography>
                                </InputAdornment>
                              ),
                            } : undefined}
                            sx={{ mb: 2.5, '& input': identifierIsPhone ? { fontFamily: TYPOGRAPHY.fontFamily.mono, letterSpacing: 2 } : {} }}
                          />
                        </motion.div>

                        <motion.div variants={fadeUp}>
                          <motion.div whileHover={prefersReducedMotion ? undefined : { scale: 1.02 }} whileTap={prefersReducedMotion ? undefined : { scale: 0.97 }}>
                            <Button fullWidth variant="contained" type="submit"
                              disabled={loading || (identifierIsPhone && identifier.length !== 10) || (identifierIsEmail && !identifier.includes('@')) || (!identifier)}
                              sx={primaryBtnSx}>
                              {loading ? <CircularProgress size={22} sx={{ color: '#fff' }} /> : t('auth.send_otp', 'Send OTP')}
                            </Button>
                          </motion.div>
                        </motion.div>
                      </motion.form>

                      <motion.div variants={fadeUp}>
                        <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', mt: 3, color: 'var(--color-text-secondary)' }}>
                          {t('auth.terms', 'By continuing, you agree to our Terms of Service and Privacy Policy.')}
                        </Typography>
                      </motion.div>
                    </motion.div>
                  )}

                  {/* OTP — verify */}
                  {loginMode === 'otp' && otpSent && (
                    <motion.div key="login-otp" variants={stagger} initial={prefersReducedMotion ? false : "hidden"} animate="show" exit={prefersReducedMotion ? undefined : { opacity: 0, x: 30, transition: { duration: 0.22 } }}>
                      <motion.div variants={fadeUp}>
                        <Typography variant="h4" sx={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, color: 'var(--color-text)', mb: 0.75 }}>
                          {t('auth.otp_title', 'Enter OTP')}
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)', mb: 3 }}>
                          {t('auth.otp_sent_to', 'Code sent to')}{' '}
                          <strong style={{ color: 'var(--color-primary)' }}>
                            {identifierIsPhone ? `+91 ${identifier}` : identifier}
                          </strong>{' '}
                          <Typography component="span" variant="body2"
                            sx={{ color: 'var(--color-primary)', cursor: 'pointer', textDecoration: 'underline' }}
                            onClick={() => { setOtp(''); dispatch(resetOtpState()); }}>
                            {t('auth.change', 'Change')}
                          </Typography>
                        </Typography>
                      </motion.div>

                      <motion.form variants={stagger} onSubmit={handleVerifyOTP}>
                        <motion.div variants={fadeUp} style={{ marginBottom: 24 }}>
                          <OTPInput value={otp} onChange={setOtp} disabled={loading} />
                        </motion.div>

                        <motion.div variants={fadeUp}>
                          <motion.div whileHover={prefersReducedMotion ? undefined : { scale: 1.02 }} whileTap={prefersReducedMotion ? undefined : { scale: 0.97 }}>
                            <Button fullWidth variant="contained" type="submit"
                              disabled={loading || otp.length !== 6} sx={primaryBtnSx}>
                              {loading ? <CircularProgress size={22} sx={{ color: '#fff' }} /> : t('auth.verify', 'Verify & Continue')}
                            </Button>
                          </motion.div>
                        </motion.div>

                        <motion.div variants={fadeUp} style={{ textAlign: 'center', marginTop: 20 }}>
                          {countdown > 0 ? (
                            <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)' }}>
                              {t('auth.resend_in', 'Resend OTP in')} {countdown}s
                            </Typography>
                          ) : (
                            <Button variant="text" size="small" onClick={handleResend} sx={{ color: 'var(--color-primary)', fontWeight: 600 }}>
                              {t('auth.resend_otp', 'Resend OTP')}
                            </Button>
                          )}
                        </motion.div>
                      </motion.form>
                    </motion.div>
                  )}

                  {/* Password login */}
                  {loginMode === 'password' && (
                    <motion.div key="login-password" variants={stagger} initial={prefersReducedMotion ? false : "hidden"} animate="show" exit={prefersReducedMotion ? undefined : { opacity: 0, x: 30, transition: { duration: 0.22 } }}>
                      <motion.div variants={fadeUp}>
                        <Typography variant="h4" sx={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, color: 'var(--color-text)', mb: 0.75, lineHeight: 1.25 }}>
                          {t('auth.login_title', 'Welcome back')}
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)', mb: 3 }}>
                          {t('auth.enter_phone_password', 'Enter your phone number or email, and password')}
                        </Typography>
                      </motion.div>

                      <motion.form variants={stagger} onSubmit={handleLoginWithPassword}>
                        <motion.div variants={fadeUp}>
                          <TextField fullWidth
                            label={t('auth.identifier_label', 'Phone Number or Email')}
                            value={identifier}
                            onChange={handleIdentifierChange}
                            inputMode={identifierIsEmail ? 'email' : 'numeric'}
                            autoComplete={identifierIsEmail ? 'email' : 'tel'}
                            autoFocus required
                            InputProps={identifierIsPhone ? {
                              startAdornment: (
                                <InputAdornment position="start">
                                  <Typography sx={{ color: 'var(--color-text)', fontWeight: 600, fontSize: '0.95rem' }}>🇮🇳 +91</Typography>
                                </InputAdornment>
                              ),
                            } : undefined}
                            sx={{ mb: 2, '& input': identifierIsPhone ? { fontFamily: TYPOGRAPHY.fontFamily.mono, letterSpacing: 2 } : {} }}
                          />
                        </motion.div>

                        <motion.div variants={fadeUp}>
                          <TextField fullWidth
                            label={t('auth.password_label', 'Password')}
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            autoComplete="current-password" required
                            InputProps={{
                              endAdornment: (
                                <InputAdornment position="end">
                                  <IconButton onClick={() => setShowPassword((s) => !s)} edge="end" size="small">
                                    {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                                  </IconButton>
                                </InputAdornment>
                              ),
                            }}
                            sx={{ mb: 2.5 }}
                          />
                        </motion.div>

                        <motion.div variants={fadeUp}>
                          <motion.div whileHover={prefersReducedMotion ? undefined : { scale: 1.02 }} whileTap={prefersReducedMotion ? undefined : { scale: 0.97 }}>
                            <Button fullWidth variant="contained" type="submit"
                              disabled={loading || (!identifier) || !password} sx={primaryBtnSx}>
                              {loading ? <CircularProgress size={22} sx={{ color: '#fff' }} /> : t('auth.login_btn', 'Login')}
                            </Button>
                          </motion.div>
                        </motion.div>

                        <motion.div variants={fadeUp}>
                          <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', mt: 2.5, color: 'var(--color-text-secondary)' }}>
                            {t('auth.no_password', "Don't have a password? Use OTP login first, then set one in your profile.")}
                          </Typography>
                        </motion.div>
                      </motion.form>
                    </motion.div>
                  )}

                </AnimatePresence>
              </motion.div>
            </AnimatePresence>
          )}

          {/* ═══════════════════════ REGISTER MODE ══════════════════════ */}
          {pageMode === 'register' && (
            <AnimatePresence mode="wait">
              <motion.div key="register-panel" initial={prefersReducedMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={prefersReducedMotion ? undefined : { opacity: 0 }}>

                <RegStepIndicator step={regStep} />

                <Box sx={{ position: 'relative', overflow: 'hidden', minHeight: 340 }}>
                  <AnimatePresence mode="wait" custom={regDirection}>

                    {/* Step 0 — Personal Information */}
                    {regStep === 0 && (
                      <motion.div key="reg-0" custom={prefersReducedMotion ? 0 : regDirection} variants={slideVariants} initial={prefersReducedMotion ? false : "enter"} animate="center" exit={prefersReducedMotion ? undefined : "exit"}>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <Box>
                            <Typography variant="h5" sx={{ fontFamily: "'Playfair Display',serif", fontWeight: 700, color: 'var(--color-text)', mb: 0.5 }}>
                              {t('register.step1_title', 'Personal Information')}
                            </Typography>
                            <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)' }}>
                              {t('register.step1_subtitle', 'This helps us tailor documents to your jurisdiction.')}
                            </Typography>
                          </Box>

                          <TextField fullWidth label={t('register.name', 'Full Name')}
                            value={regData.name} onChange={(e) => updateRegData('name', e.target.value)}
                            error={!!regErrors.name} helperText={regErrors.name} autoFocus />

                          <TextField fullWidth label={t('register.email', 'Email Address')}
                            type="email" inputMode="email" autoComplete="email"
                            value={regData.email} onChange={(e) => updateRegData('email', e.target.value)}
                            error={!!regErrors.email} helperText={regErrors.email} />

                          <TextField fullWidth label={t('register.phone', 'Phone Number')}
                            value={regData.phone}
                            onChange={(e) => updateRegData('phone', e.target.value.replace(/\D/g, '').slice(0, 10))}
                            inputMode="numeric" autoComplete="tel"
                            error={!!regErrors.phone} helperText={regErrors.phone}
                            InputProps={{
                              startAdornment: (
                                <InputAdornment position="start">
                                  <Typography sx={{ color: 'var(--color-text)', fontWeight: 600, fontSize: '0.95rem' }}>🇮🇳 +91</Typography>
                                </InputAdornment>
                              ),
                            }}
                            sx={{ '& input': { fontFamily: TYPOGRAPHY.fontFamily.mono, letterSpacing: 2 } }}
                          />

                          <TextField fullWidth select label={t('register.state', 'State')}
                            value={regData.state} onChange={(e) => updateRegData('state', e.target.value)}
                            error={!!regErrors.state} helperText={regErrors.state}>
                            {INDIAN_STATES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                          </TextField>

                          <TextField fullWidth label={t('register.district', 'District')}
                            value={regData.district} onChange={(e) => updateRegData('district', e.target.value)}
                            error={!!regErrors.district} helperText={regErrors.district} />

                          <TextField fullWidth
                            label={t('register.password', 'Password (optional)')}
                            type={showRegPassword ? 'text' : 'password'}
                            value={regData.password}
                            onChange={(e) => updateRegData('password', e.target.value)}
                            autoComplete="new-password"
                            error={!!regErrors.password}
                            helperText={regErrors.password || t('register.password_hint', 'Set a password to log in without OTP (min 8 characters)')}
                            InputProps={{
                              endAdornment: (
                                <InputAdornment position="end">
                                  <IconButton onClick={() => setShowRegPassword((s) => !s)} edge="end" size="small">
                                    {showRegPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                                  </IconButton>
                                </InputAdornment>
                              ),
                            }}
                          />

                          {regData.password.length > 0 && (
                            <TextField fullWidth
                              label={t('register.confirm_password', 'Confirm Password')}
                              type={showRegConfirmPassword ? 'text' : 'password'}
                              value={regData.confirmPassword}
                              onChange={(e) => updateRegData('confirmPassword', e.target.value)}
                              autoComplete="new-password"
                              error={!!regErrors.confirmPassword}
                              helperText={regErrors.confirmPassword}
                              InputProps={{
                                endAdornment: (
                                  <InputAdornment position="end">
                                    <IconButton onClick={() => setShowRegConfirmPassword((s) => !s)} edge="end" size="small">
                                      {showRegConfirmPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                                    </IconButton>
                                  </InputAdornment>
                                ),
                              }}
                            />
                          )}

                          {regError && (
                            <Alert severity="error" sx={{ borderRadius: `${RADIUS.md}px` }} onClose={() => setRegError(null)}>{regError}</Alert>
                          )}
                        </Box>
                      </motion.div>
                    )}

                    {/* Step 1 — Verify Email */}
                    {regStep === 1 && (
                      <motion.div key="reg-1" custom={prefersReducedMotion ? 0 : regDirection} variants={slideVariants} initial={prefersReducedMotion ? false : "enter"} animate="center" exit={prefersReducedMotion ? undefined : "exit"}>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                          <Box>
                            <Typography variant="h5" sx={{ fontFamily: "'Playfair Display',serif", fontWeight: 700, color: 'var(--color-text)', mb: 0.5 }}>
                              {t('register.verify_email_title', 'Verify Your Email')}
                            </Typography>
                            <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)' }}>
                              {t('register.verify_email_subtitle', 'Code sent to')}{' '}
                              <strong style={{ color: 'var(--color-primary)' }}>{regData.email}</strong>
                            </Typography>
                          </Box>
                          <OTPInput value={regOtp} onChange={setRegOtp} disabled={regLoading || loading} />
                          <Box sx={{ textAlign: 'center' }}>
                            {regCountdown > 0 ? (
                              <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)' }}>
                                {t('auth.resend_in', 'Resend OTP in')} {regCountdown}s
                              </Typography>
                            ) : (
                              <Button variant="text" size="small" onClick={handleRegResend} sx={{ color: 'var(--color-primary)', fontWeight: 600 }}>
                                {t('auth.resend_otp', 'Resend OTP')}
                              </Button>
                            )}
                          </Box>
                          {regError && (
                            <Alert severity="error" sx={{ borderRadius: `${RADIUS.md}px` }} onClose={() => setRegError(null)}>{regError}</Alert>
                          )}
                        </Box>
                      </motion.div>
                    )}

                    {/* Step 2 — Choose Role */}
                    {regStep === 2 && (
                      <motion.div key="reg-2" custom={prefersReducedMotion ? 0 : regDirection} variants={slideVariants} initial={prefersReducedMotion ? false : "enter"} animate="center" exit={prefersReducedMotion ? undefined : "exit"}>
                        <Box>
                          <Typography variant="h5" sx={{ fontFamily: "'Playfair Display',serif", fontWeight: 700, color: 'var(--color-text)', mb: 0.5 }}>
                            {t('register.step2_title', 'Choose Your Role')}
                          </Typography>
                          <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)', mb: 2.5 }}>
                            {t('register.step2_subtitle', 'You can change this later in settings.')}
                          </Typography>

                          <RadioGroup value={regData.persona} onChange={(e) => updateRegData('persona', e.target.value)} sx={{ gap: 2 }}>
                            {[
                              { value: 'citizen', icon: '🏠', title: 'Citizen', desc: 'I need legal documents, case tracking, and lawyer connections.', features: ['Legal documents', 'Case tracking', 'Find lawyers'] },
                              { value: 'lawyer', icon: '⚖️', title: 'Advocate / Lawyer', desc: 'I am a practising advocate looking to offer consultations.', features: ['Client portal', 'Consultations', 'Earnings dashboard'] },
                              { value: 'notary', icon: '📜', title: 'Notary', desc: 'I am a registered notary offering document notarization services.', features: ['Notarization requests', 'Video KYC', 'Earnings dashboard'] },
                            ].map((p) => {
                              const isSelected = regData.persona === p.value;
                              return (
                                <motion.div key={p.value} whileHover={prefersReducedMotion ? undefined : { scale: 1.01 }} whileTap={prefersReducedMotion ? undefined : { scale: 0.99 }}>
                                  <Box onClick={() => updateRegData('persona', p.value)} sx={{
                                    p: 2.5, borderRadius: `${RADIUS.lg}px`,
                                    border: isSelected ? '3px solid var(--color-primary)' : '1.5px solid var(--color-border)',
                                    background: isSelected ? 'var(--color-primary-alpha)' : theme.custom?.cardBg || 'var(--color-surface)',
                                    cursor: 'pointer', transition: 'all 0.2s ease',
                                    boxShadow: isSelected ? (theme.custom?.glowPrimary || SHADOWS.md) : 'none',
                                  }}>
                                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                                      <Radio value={p.value} sx={{ mt: -0.5, color: 'var(--color-primary)' }} />
                                      <Box sx={{ flex: 1 }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                                          <Typography sx={{ fontSize: 20 }}>{p.icon}</Typography>
                                          <Typography variant="h6" sx={{ fontWeight: 700, color: 'var(--color-text)' }}>{p.title}</Typography>
                                        </Box>
                                        <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)', mb: 1, lineHeight: 1.5 }}>{p.desc}</Typography>
                                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                                          {p.features.map((f) => (
                                            <Chip key={f} label={f} size="small" sx={{
                                              background: isSelected ? 'var(--color-primary)' : 'var(--color-bg)',
                                              color: isSelected ? '#fff' : 'var(--color-text-secondary)',
                                              fontWeight: 600, fontSize: '0.7rem',
                                              border: isSelected ? 'none' : '1px solid var(--color-border)',
                                            }} />
                                          ))}
                                        </Box>
                                      </Box>
                                    </Box>
                                  </Box>
                                </motion.div>
                              );
                            })}
                          </RadioGroup>
                        </Box>
                      </motion.div>
                    )}

                    {/* Step 3 — Preferences */}
                    {regStep === 3 && (
                      <motion.div key="reg-3" custom={prefersReducedMotion ? 0 : regDirection} variants={slideVariants} initial={prefersReducedMotion ? false : "enter"} animate="center" exit={prefersReducedMotion ? undefined : "exit"}>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                          <Box>
                            <Typography variant="h5" sx={{ fontFamily: "'Playfair Display',serif", fontWeight: 700, color: 'var(--color-text)', mb: 0.5 }}>
                              {t('register.step3_title', 'Your Preferences')}
                            </Typography>
                            <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)' }}>
                              {t('register.step3_subtitle', 'Customise your experience.')}
                            </Typography>
                          </Box>

                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 600, color: 'var(--color-text)', mb: 1.5 }}>
                              {t('register.language', 'Preferred Language')}
                            </Typography>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                              {ALL_LANGUAGES.map((l) => (
                                <Chip key={l.code} label={l.label} clickable
                                  onClick={() => { updateRegData('preferredLanguage', l.code); dispatch(setLanguage(l.code)); }}
                                  sx={{
                                    background: regData.preferredLanguage === l.code ? 'var(--color-primary)' : 'var(--color-surface)',
                                    color: regData.preferredLanguage === l.code ? '#fff' : 'var(--color-text)',
                                    border: regData.preferredLanguage === l.code ? 'none' : '1px solid var(--color-border)',
                                    fontWeight: 600, transition: 'all 0.18s',
                                  }} />
                              ))}
                            </Box>
                          </Box>

                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 600, color: 'var(--color-text)', mb: 1.5 }}>
                              {t('register.theme', 'Theme')}
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 1.5 }}>
                              {THEMES.map((th) => (
                                <Box key={th.id} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
                                  <motion.button whileHover={prefersReducedMotion ? undefined : { scale: 1.12 }} whileTap={prefersReducedMotion ? undefined : { scale: 0.95 }}
                                    onClick={() => dispatch(setTheme(th.id))} title={th.label}
                                    style={{ width: 32, height: 32, borderRadius: '50%', background: th.color, border: '2.5px solid var(--color-border)', cursor: 'pointer', outline: 'none' }} />
                                  <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)', fontSize: '0.62rem' }}>{th.label}</Typography>
                                </Box>
                              ))}
                            </Box>
                          </Box>

                          <Box sx={{ p: 2, borderRadius: `${RADIUS.lg}px`, background: 'var(--color-surface)', border: '1.5px solid var(--color-border)' }}>
                            <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
                              <Box>
                                <Typography variant="body2" sx={{ fontWeight: 600, color: 'var(--color-text)' }}>
                                  📱 {t('register.whatsapp', 'WhatsApp Notifications')}
                                </Typography>
                                <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)' }}>
                                  {t('register.whatsapp_desc', 'Get court hearing reminders and document updates on WhatsApp.')}
                                </Typography>
                              </Box>
                              <Switch checked={!!regData.whatsappOptIn}
                                onChange={(e) => updateRegData('whatsappOptIn', e.target.checked)}
                                sx={{ '& .MuiSwitch-thumb': { background: 'var(--color-primary)' } }} />
                            </Box>
                          </Box>

                          {regError && (
                            <Alert severity="error" sx={{ borderRadius: `${RADIUS.md}px` }} onClose={() => setRegError(null)}>{regError}</Alert>
                          )}
                        </Box>
                      </motion.div>
                    )}

                  </AnimatePresence>
                </Box>

                {/* Register navigation buttons */}
                <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
                  {(regStep === 1 || regStep === 3) && (
                    <Button variant="outlined"
                      onClick={() => { setRegDirection(-1); setRegStep((s) => s - 1); }}
                      disabled={regLoading || loading}
                      sx={{ flex: 1, ...outlinedBtnSx }}>
                      {t('register.back', 'Back')}
                    </Button>
                  )}

                  {regStep === 0 && (
                    <Button variant="contained" onClick={handleRegNext0}
                      disabled={regLoading || loading}
                      sx={{ flex: 2, ...primaryBtnSx }}>
                      {(regLoading || loading) ? <CircularProgress size={22} sx={{ color: '#fff' }} /> : `${t('register.continue', 'Continue')} →`}
                    </Button>
                  )}

                  {regStep === 1 && (
                    <Button variant="contained" onClick={handleRegVerifyOTP} disabled={regLoading || loading || regOtp.length !== 6} sx={{ flex: 2, ...primaryBtnSx }}>
                      {(regLoading || loading) ? <CircularProgress size={22} sx={{ color: '#fff' }} /> : t('register.verify_continue', 'Verify & Continue')}
                    </Button>
                  )}

                  {regStep === 2 && (
                    <Button variant="contained"
                      onClick={() => { setRegDirection(1); setRegStep(3); }}
                      sx={{ flex: 2, ...primaryBtnSx }}>
                      {`${t('register.continue', 'Continue')} →`}
                    </Button>
                  )}

                  {regStep === 3 && (
                    <Button variant="contained" onClick={handleRegComplete}
                      disabled={regLoading || loading}
                      sx={{ flex: 2, ...primaryBtnSx }}>
                      {(regLoading || loading) ? <CircularProgress size={22} sx={{ color: '#fff' }} /> : t('register.complete', 'Complete Registration')}
                    </Button>
                  )}
                </Box>

              </motion.div>
            </AnimatePresence>
          )}

          {/* Bottom mode switch link */}
          <Typography variant="body2" sx={{ textAlign: 'center', mt: 3, color: 'var(--color-text-secondary)' }}>
            {pageMode === 'login' ? (
              <>
                {t('auth.no_account', "Don't have an account?")}{' '}
                <Typography component="span" variant="body2"
                  onClick={() => switchPageMode('register')}
                  sx={{ color: 'var(--color-primary)', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}>
                  {t('auth.register_link', 'Register')}
                </Typography>
              </>
            ) : (
              <>
                {t('auth.already_have_account', 'Already have an account?')}{' '}
                <Typography component="span" variant="body2"
                  onClick={() => switchPageMode('login')}
                  sx={{ color: 'var(--color-primary)', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}>
                  {t('auth.sign_in', 'Sign In')}
                </Typography>
              </>
            )}
          </Typography>

          {/* Language quick-toggle */}
          <Box sx={{ mt: 2.5, display: 'flex', justifyContent: 'center' }}>
            <LanguageSelector variant="chips" size="small" />
          </Box>

        </GlassCard>
      </Box>

      <Snackbar
        open={snackOpen}
        autoHideDuration={5000}
        onClose={() => { setSnackOpen(false); dispatch(clearError()); }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={snackMsg.severity}
          variant="filled"
          onClose={() => { setSnackOpen(false); dispatch(clearError()); }}
          sx={{ minWidth: 280 }}
        >
          {snackMsg.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default Login;
