/**
 * client/src/pages/auth/Login.jsx
 */

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import FormControl from '@mui/material/FormControl';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';

import {
  sendOTP, verifyOTP,
  selectAuthLoading, selectAuthError, selectOtpSent,
  selectIsAuthenticated, selectUserPersona, clearError, resetOtpState,
} from '../../store/slices/authSlice';
import { setLanguage } from '../../store/slices/uiSlice';
import { RADIUS, SHADOWS } from '../../theme/tokens';

// ─── Constants ────────────────────────────────────────────────────────────────

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'bn', label: 'বাংলা' },
  { code: 'mr', label: 'मराठी' },
  { code: 'ta', label: 'தமிழ்' },
  { code: 'te', label: 'తెలుగు' },
];

// ─── Scales of Justice SVG ────────────────────────────────────────────────────

function ScalesOfJusticeSVG() {
  return (
    <svg viewBox="0 0 260 280" fill="none" xmlns="http://www.w3.org/2000/svg"
      style={{ width: '100%', maxWidth: 260, filter: 'drop-shadow(0 8px 24px var(--color-primary-alpha))' }}>
      {/* Pillar */}
      <rect x="127" y="60" width="6" height="160" rx="3" fill="var(--color-primary)" opacity="0.9" />
      {/* Base */}
      <rect x="90" y="218" width="80" height="10" rx="5" fill="var(--color-primary)" opacity="0.8" />
      <rect x="108" y="228" width="44" height="6" rx="3" fill="var(--color-primary)" opacity="0.6" />
      {/* Top crossbar */}
      <rect x="60" y="80" width="140" height="6" rx="3" fill="var(--color-primary)" opacity="0.9" />
      {/* Crown */}
      <circle cx="130" cy="64" r="10" fill="var(--color-primary)" opacity="0.9" />
      <circle cx="130" cy="64" r="5" fill="var(--color-surface)" opacity="0.9" />
      {/* Left chain */}
      <line x1="72" y1="86" x2="72" y2="136" stroke="var(--color-primary)" strokeWidth="2.5"
        strokeDasharray="4 3" opacity="0.7" />
      {/* Right chain */}
      <line x1="188" y1="86" x2="188" y2="116" stroke="var(--color-primary)" strokeWidth="2.5"
        strokeDasharray="4 3" opacity="0.7" />
      {/* Left pan — tilted down (justice weighing) */}
      <motion.g
        animate={{ rotate: [-3, 3, -3] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        style={{ transformOrigin: '72px 136px' }}
      >
        <ellipse cx="72" cy="158" rx="30" ry="8" fill="var(--color-primary)" opacity="0.15"
          stroke="var(--color-primary)" strokeWidth="2" />
        <path d="M44 138 Q72 132 100 138" stroke="var(--color-primary)" strokeWidth="2"
          fill="none" opacity="0.6" />
        <line x1="44" y1="138" x2="44" y2="158" stroke="var(--color-primary)" strokeWidth="1.5" opacity="0.5" />
        <line x1="100" y1="138" x2="100" y2="158" stroke="var(--color-primary)" strokeWidth="1.5" opacity="0.5" />
      </motion.g>
      {/* Right pan */}
      <motion.g
        animate={{ rotate: [3, -3, 3] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        style={{ transformOrigin: '188px 116px' }}
      >
        <ellipse cx="188" cy="138" rx="30" ry="8" fill="var(--color-primary)" opacity="0.15"
          stroke="var(--color-primary)" strokeWidth="2" />
        <path d="M160 118 Q188 112 216 118" stroke="var(--color-primary)" strokeWidth="2"
          fill="none" opacity="0.6" />
        <line x1="160" y1="118" x2="160" y2="138" stroke="var(--color-primary)" strokeWidth="1.5" opacity="0.5" />
        <line x1="216" y1="118" x2="216" y2="138" stroke="var(--color-primary)" strokeWidth="1.5" opacity="0.5" />
      </motion.g>
      {/* Decorative stars */}
      {[
        [40, 50], [210, 40], [230, 180], [28, 190],
      ].map(([cx, cy], i) => (
        <motion.circle key={i} cx={cx} cy={cy} r="3"
          fill="var(--color-primary)" opacity="0.3"
          animate={{ opacity: [0.2, 0.6, 0.2], scale: [0.8, 1.2, 0.8] }}
          transition={{ duration: 2.5 + i * 0.4, repeat: Infinity, delay: i * 0.5 }}
          style={{ transformOrigin: `${cx}px ${cy}px` }}
        />
      ))}
    </svg>
  );
}

// ─── OTP Input ────────────────────────────────────────────────────────────────

function OTPInput({ value, onChange, disabled }) {
  const digits = Array.from({ length: 6 }, (_, i) => value[i] || '');
  const inputRefs = useRef([]);

  const handleChange = (index, e) => {
    const val = e.target.value.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[index] = val;
    onChange(next.join(''));
    if (val && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === 'ArrowLeft' && index > 0) inputRefs.current[index - 1]?.focus();
    if (e.key === 'ArrowRight' && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handlePaste = (e) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted) { onChange(pasted.padEnd(6, '').slice(0, 6)); }
  };

  return (
    <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
      {digits.map((digit, i) => (
        <motion.div key={i}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: i * 0.05 }}
        >
          <input
            ref={(el) => (inputRefs.current[i] = el)}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            disabled={disabled}
            onChange={(e) => handleChange(i, e)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onPaste={handlePaste}
            style={{
              width: 44,
              height: 52,
              textAlign: 'center',
              fontSize: '1.375rem',
              fontWeight: 700,
              fontFamily: "'JetBrains Mono', monospace",
              borderRadius: RADIUS.md,
              border: digit
                ? '2px solid var(--color-primary)'
                : '1.5px solid var(--color-border)',
              background: digit ? 'var(--color-primary-alpha)' : 'var(--color-surface)',
              color: 'var(--color-text)',
              outline: 'none',
              transition: 'border-color 0.2s, background 0.2s',
              cursor: disabled ? 'not-allowed' : 'text',
            }}
          />
        </motion.div>
      ))}
    </Box>
  );
}

// ─── Stagger container ────────────────────────────────────────────────────────

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09 } },
};
const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.38, ease: 'easeOut' } },
};

// ─── Main Component ───────────────────────────────────────────────────────────

function Login() {
  const { t, i18n } = useTranslation();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const loading = useSelector(selectAuthLoading);
  const error = useSelector(selectAuthError);
  const otpSent = useSelector(selectOtpSent);
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const persona = useSelector(selectUserPersona);

  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [localLang, setLocalLang] = useState(i18n.language || 'en');

  const returnUrl = searchParams.get('returnUrl') || `/${persona || 'citizen'}/home`;

  // Only redirect users who arrive at /login already authenticated (e.g. back button after session restore).
  // Post-login navigation is handled explicitly in handleVerifyOTP to support new-user → /register flow.
  const alreadyAuthed = useRef(isAuthenticated);
  useEffect(() => {
    if (alreadyAuthed.current) {
      navigate(decodeURIComponent(returnUrl), { replace: true });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (otpSent) setCountdown(30);
  }, [otpSent]);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  useEffect(() => () => { dispatch(clearError()); }, [dispatch]);

  const handleLangChange = (e) => {
    const lang = e.target.value;
    setLocalLang(lang);
    dispatch(setLanguage(lang));
  };

  const handleSendOTP = async (e) => {
    e.preventDefault();
    if (phone.length !== 10) return;
    dispatch(clearError());
    await dispatch(sendOTP(`+91${phone}`));
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    if (otp.length !== 6) return;
    dispatch(clearError());
    const result = await dispatch(verifyOTP({ phone: `+91${phone}`, otp }));
    console.log(result,",.,.,.")
    if (result.meta.requestStatus === 'fulfilled') {
      if (result.payload.isNewUser) {
        navigate('/register', { state: { phone: `+91${phone}` } });
      } else {
        const userPersona = (result.payload.user?.persona || 'citizen').toLowerCase();
        navigate(`/${userPersona}/home`);
      }
    }
  };

  const handleResend = () => {
    setOtp('');
    dispatch(sendOTP(`+91${phone}`));
  };

  const FEATURES = [
    { icon: '📄', key: 'login.feature1', fallback: 'AI-generated legal documents in minutes' },
    { icon: '⚖️', key: 'login.feature2', fallback: 'Court case tracking with real-time alerts' },
    { icon: '🌐', key: 'login.feature3', fallback: 'Available in 11 Indian languages' },
  ];

  return (
    <Box sx={{
      minHeight: '100vh',
      display: 'flex',
      background: 'var(--color-bg)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Left decorative panel — desktop only */}
      {!isMobile && (
        <Box sx={{
          width: { md: '46%' },
          flexShrink: 0,
          background: 'linear-gradient(150deg, var(--color-primary) 0%, var(--color-primary-dark, #0D47A1) 100%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          p: 6,
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Subtle radial glow */}
          <Box sx={{
            position: 'absolute', inset: 0,
            background: 'radial-gradient(ellipse at 60% 40%, rgba(255,255,255,0.08) 0%, transparent 70%)',
            pointerEvents: 'none',
          }} />

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
            style={{ width: '100%', maxWidth: 320, textAlign: 'center' }}
          >
            <ScalesOfJusticeSVG />

            <Typography variant="h3" sx={{
              fontFamily: "'Playfair Display', serif",
              color: '#FFFFFF',
              fontWeight: 700,
              mt: 4,
              mb: 1.5,
              lineHeight: 1.25,
              textShadow: '0 2px 8px rgba(0,0,0,0.2)',
            }}>
              {t('login.tagline', 'न्याय सबके लिए')}
            </Typography>

            <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.78)', mb: 4, lineHeight: 1.65 }}>
              {t('login.taglineSub', 'Justice for every Indian, in every language')}
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, alignItems: 'flex-start' }}>
              {FEATURES.map((f, i) => (
                <motion.div key={i}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + i * 0.12, duration: 0.4 }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Box sx={{
                      width: 36, height: 36, borderRadius: '50%',
                      background: 'rgba(255,255,255,0.15)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 18, flexShrink: 0,
                    }}>
                      {f.icon}
                    </Box>
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.88)', fontWeight: 500 }}>
                      {t(f.key, f.fallback)}
                    </Typography>
                  </Box>
                </motion.div>
              ))}
            </Box>
          </motion.div>
        </Box>
      )}

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
      }}>
        {/* Language selector */}
        <Box sx={{ position: 'absolute', top: 20, right: 20 }}>
          <FormControl size="small">
            <Select
              value={localLang}
              onChange={handleLangChange}
              sx={{
                fontSize: '0.8rem',
                color: 'var(--color-text-secondary)',
                '& .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--color-border)' },
                '& .MuiSelect-select': { py: 0.75, px: 1.5 },
              }}
            >
              {LANGUAGES.map((l) => (
                <MenuItem key={l.code} value={l.code}>{l.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        <Box sx={{ width: '100%', maxWidth: 400 }}>
          {/* Logo */}
          <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 4 }}>
              <Box sx={{
                width: 42, height: 42, borderRadius: `${RADIUS.md}px`,
                background: 'var(--color-primary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 22, boxShadow: SHADOWS.md,
              }}>⚖️</Box>
              <Box>
                <Typography variant="h5" sx={{
                  fontFamily: "'Playfair Display', serif",
                  fontWeight: 700, color: 'var(--color-primary)', lineHeight: 1.1,
                }}>
                  NyayaSetu
                </Typography>
                <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)' }}>
                  {t('login.bridgeToJustice', 'Bridge to Justice')}
                </Typography>
              </Box>
            </Box>
          </motion.div>

          <AnimatePresence mode="wait">
            {!otpSent ? (
              /* ── Phone input step ── */
              <motion.div key="phone"
                variants={stagger} initial="hidden" animate="show"
                exit={{ opacity: 0, x: -30, transition: { duration: 0.22 } }}
              >
                <motion.div variants={fadeUp}>
                  <Typography variant="h4" sx={{
                    fontFamily: "'Playfair Display', serif",
                    fontWeight: 700, color: 'var(--color-text)', mb: 0.75, lineHeight: 1.25,
                  }}>
                    {t('login.welcome', 'Welcome back')}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)', mb: 3 }}>
                    {t('login.enterPhone', 'Enter your phone number to receive an OTP')}
                  </Typography>
                </motion.div>

                <motion.form variants={stagger} onSubmit={handleSendOTP}>
                  <motion.div variants={fadeUp}>
                    <TextField
                      fullWidth
                      label={t('login.phoneLabel', 'Mobile Number')}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      inputMode="numeric"
                      autoComplete="tel"
                      autoFocus
                      required
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <Typography sx={{ color: 'var(--color-text)', fontWeight: 600, fontSize: '0.95rem' }}>
                              🇮🇳 +91
                            </Typography>
                          </InputAdornment>
                        ),
                      }}
                      sx={{
                        mb: 2.5,
                        '& input': { fontFamily: "'JetBrains Mono', monospace", letterSpacing: 2 },
                      }}
                    />
                  </motion.div>

                  {error && (
                    <motion.div variants={fadeUp}>
                      <Alert severity="error" sx={{ mb: 2, borderRadius: `${RADIUS.md}px` }}
                        onClose={() => dispatch(clearError())}>
                        {error}
                      </Alert>
                    </motion.div>
                  )}

                  <motion.div variants={fadeUp}>
                    <Button fullWidth variant="contained" type="submit"
                      disabled={loading || phone.length !== 10}
                      sx={{
                        py: 1.5, fontWeight: 700, fontSize: '1rem',
                        background: 'var(--color-primary)',
                        borderRadius: `${RADIUS.md}px`,
                        boxShadow: SHADOWS.md,
                        '&:hover': { background: 'var(--color-primary-dark, var(--color-primary))' },
                      }}>
                      {loading
                        ? <CircularProgress size={22} sx={{ color: '#fff' }} />
                        : t('login.sendOTP', 'Send OTP')}
                    </Button>
                  </motion.div>
                </motion.form>

                <motion.div variants={fadeUp}>
                  <Typography variant="caption" sx={{
                    display: 'block', textAlign: 'center', mt: 3,
                    color: 'var(--color-text-secondary)',
                  }}>
                    {t('login.terms', 'By continuing, you agree to our Terms of Service and Privacy Policy.')}
                  </Typography>
                </motion.div>
              </motion.div>
            ) : (
              /* ── OTP verification step ── */
              <motion.div key="otp"
                variants={stagger} initial="hidden" animate="show"
                exit={{ opacity: 0, x: 30, transition: { duration: 0.22 } }}
              >
                <motion.div variants={fadeUp}>
                  <Typography variant="h4" sx={{
                    fontFamily: "'Playfair Display', serif",
                    fontWeight: 700, color: 'var(--color-text)', mb: 0.75,
                  }}>
                    {t('login.enterOTP', 'Enter OTP')}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)', mb: 3 }}>
                    {t('login.otpSentTo', 'Code sent to')} {' '}
                    <strong style={{ color: 'var(--color-primary)' }}>+91 {phone}</strong>
                    {' '}
                    <Typography component="span" variant="body2"
                      sx={{ color: 'var(--color-primary)', cursor: 'pointer', textDecoration: 'underline' }}
                      onClick={() => { setOtp(''); dispatch(resetOtpState()); }}>
                      {t('login.change', 'Change')}
                    </Typography>
                  </Typography>
                </motion.div>

                <motion.form variants={stagger} onSubmit={handleVerifyOTP}>
                  <motion.div variants={fadeUp} style={{ marginBottom: 24 }}>
                    <OTPInput value={otp} onChange={setOtp} disabled={loading} />
                  </motion.div>

                  {error && (
                    <motion.div variants={fadeUp}>
                      <Alert severity="error" sx={{ mb: 2, borderRadius: `${RADIUS.md}px` }}
                        onClose={() => dispatch(clearError())}>
                        {error}
                      </Alert>
                    </motion.div>
                  )}

                  <motion.div variants={fadeUp}>
                    <Button fullWidth variant="contained" type="submit"
                      disabled={loading || otp.length !== 6}
                      sx={{
                        py: 1.5, fontWeight: 700, fontSize: '1rem',
                        background: 'var(--color-primary)',
                        borderRadius: `${RADIUS.md}px`,
                        boxShadow: SHADOWS.md,
                        '&:hover': { background: 'var(--color-primary-dark, var(--color-primary))' },
                      }}>
                      {loading
                        ? <CircularProgress size={22} sx={{ color: '#fff' }} />
                        : t('login.verify', 'Verify & Continue')}
                    </Button>
                  </motion.div>

                  <motion.div variants={fadeUp} style={{ textAlign: 'center', marginTop: 20 }}>
                    {countdown > 0 ? (
                      <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)' }}>
                        {t('login.resendIn', 'Resend OTP in')} {countdown}s
                      </Typography>
                    ) : (
                      <Button variant="text" size="small" onClick={handleResend}
                        sx={{ color: 'var(--color-primary)', fontWeight: 600 }}>
                        {t('login.resend', 'Resend OTP')}
                      </Button>
                    )}
                  </motion.div>
                </motion.form>
              </motion.div>
            )}
          </AnimatePresence>
        </Box>
      </Box>
    </Box>
  );
}

export default Login;
