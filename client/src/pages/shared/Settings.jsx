/**
 * client/src/pages/shared/Settings.jsx
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { useForm, Controller } from 'react-hook-form';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import Divider from '@mui/material/Divider';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import MenuItem from '@mui/material/MenuItem';
import MuiAccordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import Alert from '@mui/material/Alert';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme as useMuiTheme } from '@mui/material/styles';
import Snackbar from '@mui/material/Snackbar';

import { selectUser, selectUserPlan, updateMe, logout } from '../../store/slices/authSlice';
import { selectFreeUsage, getCurrentSubscription, cancelSubscription } from '../../store/slices/subscriptionSlice';
import { selectTheme, selectLanguage, setTheme, setLanguage } from '../../store/slices/uiSlice';
import AnimatedPage from '../../components/ui/AnimatedPage';
import { RADIUS, SHADOWS } from '../../theme/tokens';

// ─── Constants ────────────────────────────────────────────────────────────────

const INDIAN_STATES = [
  'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat',
  'Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh',
  'Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab',
  'Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh',
  'Uttarakhand','West Bengal','Delhi','Jammu & Kashmir','Ladakh',
];

const THEMES = [
  { id: 'default',      label: 'Blue Justice',  primary: '#1565C0', bg: '#F8FAFF', desc: 'Professional' },
  { id: 'saffron',      label: 'Saffron India', primary: '#FF6F00', bg: '#FFFBF0', desc: 'Patriotic' },
  { id: 'dark',         label: 'Dark Mode',     primary: '#5C9BF5', bg: '#0D1117', desc: 'Developer' },
  { id: 'highContrast', label: 'High Contrast', primary: '#0000CC', bg: '#FFFFFF', desc: 'Accessible' },
  { id: 'emerald',      label: 'Emerald',       primary: '#00695C', bg: '#F0FDF4', desc: 'Calm' },
];

const LANGUAGES = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'hi', label: 'Hindi', native: 'हिन्दी' },
  { code: 'bn', label: 'Bengali', native: 'বাংলা' },
  { code: 'mr', label: 'Marathi', native: 'मराठी' },
  { code: 'ta', label: 'Tamil', native: 'தமிழ்' },
  { code: 'te', label: 'Telugu', native: 'తెలుగు' },
  { code: 'gu', label: 'Gujarati', native: 'ગુજરાતી' },
  { code: 'kn', label: 'Kannada', native: 'ಕನ್ನಡ' },
  { code: 'ml', label: 'Malayalam', native: 'മലയാളം' },
  { code: 'pa', label: 'Punjabi', native: 'ਪੰਜਾਬੀ' },
  { code: 'ur', label: 'Urdu', native: 'اردو' },
];

const SAMPLE_TEXTS = {
  en: 'Welcome to NyayaSetu — your bridge to justice.',
  hi: 'न्यायसेतु में आपका स्वागत है — न्याय का सेतु।',
  bn: 'NyayaSetu-এ স্বাগতম — ন্যায়বিচারের সেতু।',
  mr: 'न्यायसेतु मध्ये आपले स्वागत आहे — न्यायाचा सेतू।',
  ta: 'NyayaSetu-ல் வரவேற்கிறோம் — நீதிக்கான பாலம்.',
  te: 'NyayaSetu కు స్వాగతం — న్యాయానికి వారధి.',
  gu: 'NyayaSetu માં આપનું સ્વાગત છે — ન્યાયનો સેતુ.',
  kn: 'NyayaSetu ಗೆ ಸ್ವಾಗತ — ನ್ಯಾಯಕ್ಕೆ ಸೇತುವೆ.',
  ml: 'NyayaSetu-ൽ സ്വാഗതം — നീതിക്കുള്ള പാലം.',
  pa: 'NyayaSetu ਵਿੱਚ ਜੀ ਆਇਆਂ — ਇਨਸਾਫ਼ ਦਾ ਪੁੱਲ.',
  ur: '.نیایاسیتو میں خوش آمدید — انصاف کا پل',
};

// ─── Section components ───────────────────────────────────────────────────────

function AccountSection({ user, onSave }) {
  const { t } = useTranslation();
  const { control, handleSubmit, formState: { errors, isDirty } } = useForm({
    defaultValues: {
      name: user?.name || '',
      email: user?.email || '',
      state: user?.state || '',
      district: user?.district || '',
    },
  });

  return (
    <Box component="form" onSubmit={handleSubmit(onSave)} sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      <Typography variant="h6" sx={{ fontFamily: "'Playfair Display',serif", fontWeight: 700, color: 'var(--color-text)' }}>
        {t('settings.account', 'Account Information')}
      </Typography>

      <Controller name="name" control={control}
        rules={{ required: 'Name is required', minLength: { value: 2, message: 'Min 2 characters' } }}
        render={({ field }) => (
          <TextField {...field} label={t('settings.name', 'Full Name')} fullWidth
            error={!!errors.name} helperText={errors.name?.message} />
        )} />

      <Controller name="email" control={control} render={({ field }) => (
        <TextField {...field} label={t('settings.email', 'Email (optional)')} type="email" fullWidth />
      )} />

      <Box sx={{ display: 'flex', gap: 2 }}>
        <Controller name="state" control={control} render={({ field }) => (
          <TextField {...field} select label={t('settings.state', 'State')} fullWidth>
            {INDIAN_STATES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
          </TextField>
        )} />
        <Controller name="district" control={control} render={({ field }) => (
          <TextField {...field} label={t('settings.district', 'District')} fullWidth />
        )} />
      </Box>

      <Box sx={{ display: 'flex', gap: 2, pt: 1 }}>
        <Button type="submit" variant="contained" disabled={!isDirty}
          sx={{ borderRadius: `${RADIUS.md}px`, fontWeight: 700, background: 'var(--color-primary)' }}>
          {t('settings.saveChanges', 'Save Changes')}
        </Button>
      </Box>
    </Box>
  );
}

function AppearanceSection() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const activeTheme = useSelector(selectTheme);

  return (
    <Box>
      <Typography variant="h6" sx={{ fontFamily: "'Playfair Display',serif", fontWeight: 700, color: 'var(--color-text)', mb: 2 }}>
        {t('settings.appearance', 'Appearance')}
      </Typography>
      <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)', mb: 2.5 }}>
        {t('settings.themeDesc', 'Choose a theme that suits you. Changes take effect immediately.')}
      </Typography>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
        {THEMES.map((th) => {
          const isActive = activeTheme === th.id;
          return (
            <motion.div key={th.id} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
              <Box
                onClick={() => dispatch(setTheme(th.id))}
                sx={{
                  width: { xs: 130, sm: 150 }, cursor: 'pointer',
                  borderRadius: `${RADIUS.lg}px`,
                  border: isActive ? '2.5px solid var(--color-primary)' : '1.5px solid var(--color-border)',
                  overflow: 'hidden',
                  boxShadow: isActive ? SHADOWS.md : 'none',
                  transition: 'border-color 0.2s, box-shadow 0.2s',
                }}
              >
                {/* Preview */}
                <Box sx={{
                  height: 70, background: th.bg,
                  display: 'flex', flexDirection: 'column', gap: 0.75, p: 1.5,
                }}>
                  <Box sx={{ width: '100%', height: 8, borderRadius: 4, background: th.primary }} />
                  <Box sx={{ width: '70%', height: 5, borderRadius: 4, background: th.primary, opacity: 0.4 }} />
                  <Box sx={{ width: '85%', height: 5, borderRadius: 4, background: th.primary, opacity: 0.25 }} />
                </Box>
                <Box sx={{ p: 1, background: 'var(--color-surface)', borderTop: `1px solid ${isActive ? 'var(--color-primary)' : 'var(--color-border)'}` }}>
                  <Typography variant="caption" sx={{ fontWeight: isActive ? 700 : 500, color: isActive ? 'var(--color-primary)' : 'var(--color-text)' }}>
                    {th.label}
                    {isActive && ' ✓'}
                  </Typography>
                  <Typography variant="caption" sx={{ display: 'block', color: 'var(--color-text-secondary)', fontSize: '0.65rem' }}>
                    {th.desc}
                  </Typography>
                </Box>
              </Box>
            </motion.div>
          );
        })}
      </Box>
    </Box>
  );
}

function LanguageSection() {
  const { t, i18n } = useTranslation();
  const dispatch = useDispatch();
  const activeLanguage = useSelector(selectLanguage);
  const [preview, setPreview] = useState(false);

  return (
    <Box>
      <Typography variant="h6" sx={{ fontFamily: "'Playfair Display',serif", fontWeight: 700, color: 'var(--color-text)', mb: 2 }}>
        {t('settings.language', 'Language')}
      </Typography>

      {preview && (
        <Box sx={{ mb: 2.5, p: 2, borderRadius: `${RADIUS.md}px`, background: 'var(--color-primary-alpha)', border: '1px solid var(--color-primary)' }}>
          <Typography variant="body2" sx={{ color: 'var(--color-primary)', fontStyle: 'italic' }}>
            {SAMPLE_TEXTS[activeLanguage] || SAMPLE_TEXTS.en}
          </Typography>
        </Box>
      )}

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.25, mb: 2 }}>
        {LANGUAGES.map((lang) => {
          const isActive = activeLanguage === lang.code;
          return (
            <Chip
              key={lang.code}
              label={<Box sx={{ textAlign: 'center' }}><span style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700 }}>{lang.native}</span><span style={{ fontSize: '0.65rem', opacity: 0.75 }}>{lang.label}</span></Box>}
              onClick={() => dispatch(setLanguage(lang.code))}
              sx={{
                height: 48, px: 0.5, cursor: 'pointer',
                background: isActive ? 'var(--color-primary)' : 'var(--color-surface)',
                color: isActive ? '#fff' : 'var(--color-text)',
                border: isActive ? 'none' : '1px solid var(--color-border)',
                '&:hover': { background: isActive ? 'var(--color-primary)' : 'var(--color-overlay)' },
              }}
            />
          );
        })}
      </Box>

      <Button variant="outlined" size="small" onClick={() => setPreview((v) => !v)}
        sx={{ borderRadius: `${RADIUS.md}px`, borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>
        {preview ? 'Hide preview' : '👁 Preview text'}
      </Button>
    </Box>
  );
}

function NotificationsSection({ user, onSave }) {
  const { t } = useTranslation();
  const [prefs, setPrefs] = useState({
    whatsapp: user?.whatsappOptIn || false,
    email: !!user?.email,
    hearingReminders: true,
    documentReady: true,
    weeklyDigest: false,
  });

  const toggle = (key) => setPrefs((p) => ({ ...p, [key]: !p[key] }));

  const items = [
    { key: 'hearingReminders', icon: '⚖️', label: t('settings.notif.hearings', 'Hearing Reminders'), desc: 'Get alerted 2 days before each scheduled hearing' },
    { key: 'documentReady',   icon: '📄', label: t('settings.notif.docReady', 'Document Ready'),    desc: 'When your generated document is ready' },
    { key: 'weeklyDigest',    icon: '📊', label: t('settings.notif.digest', 'Weekly Digest'),       desc: 'Summary of cases and upcoming hearings' },
  ];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      <Typography variant="h6" sx={{ fontFamily: "'Playfair Display',serif", fontWeight: 700, color: 'var(--color-text)' }}>
        {t('settings.notifications', 'Notifications')}
      </Typography>

      {/* Channels */}
      <Box sx={{ p: 2, borderRadius: `${RADIUS.lg}px`, border: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
        <Typography variant="body2" sx={{ fontWeight: 600, color: 'var(--color-text)', mb: 1.5 }}>
          {t('settings.channels', 'Alert Channels')}
        </Typography>
        <FormControlLabel
          control={<Switch checked={prefs.whatsapp} onChange={() => toggle('whatsapp')}
            sx={{ '& .MuiSwitch-thumb': { background: 'var(--color-primary)' } }} />}
          label={<Box><Typography variant="body2">📱 WhatsApp</Typography><Typography variant="caption" sx={{ color: 'var(--color-text-secondary)' }}>{user?.whatsappNumber || user?.phone}</Typography></Box>}
          sx={{ mb: 1.5, display: 'flex' }}
        />
        <FormControlLabel
          control={<Switch checked={prefs.email} onChange={() => toggle('email')}
            sx={{ '& .MuiSwitch-thumb': { background: 'var(--color-primary)' } }} />}
          label={<Box><Typography variant="body2">📧 Email</Typography><Typography variant="caption" sx={{ color: 'var(--color-text-secondary)' }}>{user?.email || 'Add email in Account settings'}</Typography></Box>}
          sx={{ display: 'flex' }}
        />
      </Box>

      {/* Notification types */}
      <Box sx={{ p: 2, borderRadius: `${RADIUS.lg}px`, border: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
        <Typography variant="body2" sx={{ fontWeight: 600, color: 'var(--color-text)', mb: 1.5 }}>
          {t('settings.notifTypes', 'What to notify me about')}
        </Typography>
        {items.map((item) => (
          <FormControlLabel key={item.key}
            control={<Switch checked={prefs[item.key]} onChange={() => toggle(item.key)}
              sx={{ '& .MuiSwitch-thumb': { background: 'var(--color-primary)' } }} />}
            label={<Box sx={{ mb: 0.25 }}><Typography variant="body2">{item.icon} {item.label}</Typography><Typography variant="caption" sx={{ color: 'var(--color-text-secondary)' }}>{item.desc}</Typography></Box>}
            sx={{ mb: 1.5, display: 'flex', alignItems: 'flex-start' }}
            labelPlacement="start"
          />
        ))}
      </Box>

      <Button variant="contained"
        onClick={() => onSave({ whatsappOptIn: prefs.whatsapp })}
        sx={{ borderRadius: `${RADIUS.md}px`, fontWeight: 700, background: 'var(--color-primary)', width: 'fit-content' }}>
        {t('settings.savePreferences', 'Save Preferences')}
      </Button>
    </Box>
  );
}

function SubscriptionSection() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const plan = useSelector(selectUserPlan);
  const freeUsage = useSelector(selectFreeUsage);

  useEffect(() => { dispatch(getCurrentSubscription()); }, [dispatch]);

  const meters = [
    { label: t('settings.docs', 'Documents'), used: freeUsage?.docsGenerated || 0, limit: freeUsage?.docsLimit || 3, icon: '📄' },
    { label: t('settings.cases', 'Cases'), used: freeUsage?.casesTracked || 0, limit: freeUsage?.casesLimit || 1, icon: '⚖️' },
    { label: t('settings.chats', 'AI Chats'), used: freeUsage?.aiChatsUsed || 0, limit: freeUsage?.aiChatsLimit || 5, icon: '💬' },
  ];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      <Typography variant="h6" sx={{ fontFamily: "'Playfair Display',serif", fontWeight: 700, color: 'var(--color-text)' }}>
        {t('settings.subscription', 'Subscription')}
      </Typography>

      <Box sx={{ p: 2.5, borderRadius: `${RADIUS.xl}px`, border: '2px solid var(--color-primary)', background: 'var(--color-primary-alpha)' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box>
            <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)' }}>{t('settings.currentPlan', 'Current Plan')}</Typography>
            <Typography variant="h5" sx={{ fontWeight: 800, color: 'var(--color-primary)', textTransform: 'capitalize' }}>{plan}</Typography>
          </Box>
          {plan === 'free' && (
            <Button variant="contained" size="small" onClick={() => navigate('/pricing')}
              sx={{ borderRadius: `${RADIUS.md}px`, fontWeight: 700, background: 'var(--color-primary)' }}>
              {t('settings.upgrade', 'Upgrade')} ↗
            </Button>
          )}
        </Box>

        {/* Usage meters */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.75 }}>
          {meters.map((m) => {
            const pct = m.limit === 999999 ? 5 : Math.min(100, (m.used / m.limit) * 100);
            const isUnlimited = m.limit >= 999999;
            return (
              <Box key={m.label}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="caption" sx={{ fontWeight: 600, color: 'var(--color-text)' }}>
                    {m.icon} {m.label}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)' }}>
                    {isUnlimited ? `${m.used} / ∞` : `${m.used} / ${m.limit}`}
                  </Typography>
                </Box>
                <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.8, ease: 'easeOut' }} style={{ transformOrigin: 'left' }}>
                  <LinearProgress variant="determinate" value={isUnlimited ? 10 : pct}
                    sx={{
                      height: 6, borderRadius: 3,
                      background: 'var(--color-border)',
                      '& .MuiLinearProgress-bar': {
                        background: pct >= 90 && !isUnlimited ? 'var(--color-error)' : pct >= 70 && !isUnlimited ? 'var(--color-warning)' : 'var(--color-primary)',
                        borderRadius: 3,
                      },
                    }} />
                </motion.div>
              </Box>
            );
          })}
        </Box>
      </Box>

      {plan !== 'free' && (
        <Box>
          <Button variant="outlined" size="small"
            onClick={async () => { if (window.confirm('Cancel subscription? You keep access until end of billing period.')) { await dispatch(cancelSubscription()); } }}
            sx={{ borderRadius: `${RADIUS.md}px`, borderColor: 'var(--color-error)', color: 'var(--color-error)', fontWeight: 600 }}>
            {t('settings.cancel', 'Cancel Subscription')}
          </Button>
        </Box>
      )}
    </Box>
  );
}

function SecuritySection({ onLogoutAll }) {
  const { t } = useTranslation();
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      <Typography variant="h6" sx={{ fontFamily: "'Playfair Display',serif", fontWeight: 700, color: 'var(--color-text)' }}>
        {t('settings.security', 'Security')}
      </Typography>
      <Box sx={{ p: 2.5, borderRadius: `${RADIUS.lg}px`, border: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
        <Typography variant="body2" sx={{ fontWeight: 600, color: 'var(--color-text)', mb: 1.5 }}>
          {t('settings.activeSessions', 'Active Sessions')}
        </Typography>
        <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)', display: 'block', mb: 2 }}>
          {t('settings.sessionsDesc', 'NyayaSetu keeps you logged in on up to 5 devices.')}
        </Typography>
        <Button variant="outlined" size="small" onClick={onLogoutAll}
          sx={{ borderRadius: `${RADIUS.md}px`, borderColor: 'var(--color-error)', color: 'var(--color-error)', fontWeight: 600 }}>
          🔒 {t('settings.logoutAll', 'Logout from All Devices')}
        </Button>
      </Box>
    </Box>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const SECTIONS = [
  { id: 'account',       icon: '👤', label: 'Account' },
  { id: 'appearance',    icon: '🎨', label: 'Appearance' },
  { id: 'language',      icon: '🌐', label: 'Language' },
  { id: 'notifications', icon: '🔔', label: 'Notifications' },
  { id: 'subscription',  icon: '💎', label: 'Subscription' },
  { id: 'security',      icon: '🔒', label: 'Security' },
];

function Settings() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const muiTheme = useMuiTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down('md'));

  const user = useSelector(selectUser);
  const [activeTab, setActiveTab] = useState('account');
  const [snack, setSnack] = useState({ open: false, msg: '', severity: 'success' });

  const showSnack = (msg, severity = 'success') => setSnack({ open: true, msg, severity });

  const handleSave = async (data) => {
    const result = await dispatch(updateMe(data));
    if (result.meta.requestStatus === 'fulfilled') {
      showSnack(t('settings.saved', 'Settings saved!'));
    } else {
      showSnack(t('settings.saveFailed', 'Failed to save. Please try again.'), 'error');
    }
  };

  const handleLogoutAll = async () => {
    if (window.confirm(t('settings.confirmLogoutAll', 'Log out from all devices?'))) {
      await dispatch(logout());
      navigate('/login', { replace: true });
    }
  };

  const sectionContent = {
    account:       <AccountSection user={user} onSave={handleSave} />,
    appearance:    <AppearanceSection />,
    language:      <LanguageSection />,
    notifications: <NotificationsSection user={user} onSave={handleSave} />,
    subscription:  <SubscriptionSection />,
    security:      <SecuritySection onLogoutAll={handleLogoutAll} />,
  };

  return (
    <AnimatedPage>
      <Box sx={{ p: { xs: 2, sm: 3, md: 4 }, maxWidth: 900, mx: 'auto', pb: { xs: 10, md: 6 } }}>
        <motion.div initial={{ opacity: 0, y: -14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.38 }}>
          <Typography variant="h4" sx={{ fontFamily: "'Playfair Display',serif", fontWeight: 700, color: 'var(--color-text)', mb: 3 }}>
            ⚙️ {t('settings.title', 'Settings')}
          </Typography>
        </motion.div>

        {isMobile ? (
          /* Mobile: accordions */
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {SECTIONS.map((sec) => (
              <MuiAccordion key={sec.id} elevation={0} sx={{
                borderRadius: `${RADIUS.lg}px !important`,
                border: '1px solid var(--color-border)',
                background: 'var(--color-surface)',
                '&:before': { display: 'none' },
                overflow: 'hidden',
              }}>
                <AccordionSummary expandIcon={<Typography sx={{ fontSize: 14 }}>▾</Typography>}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Typography sx={{ fontSize: 20 }}>{sec.icon}</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: 'var(--color-text)' }}>
                      {t(`settings.${sec.id}`, sec.label)}
                    </Typography>
                  </Box>
                </AccordionSummary>
                <AccordionDetails sx={{ borderTop: '1px solid var(--color-border)', pt: 2.5 }}>
                  {sectionContent[sec.id]}
                </AccordionDetails>
              </MuiAccordion>
            ))}
          </Box>
        ) : (
          /* Desktop: vertical tabs */
          <Box sx={{ display: 'flex', gap: 3 }}>
            <Box sx={{ width: 200, flexShrink: 0 }}>
              <Box sx={{
                borderRadius: `${RADIUS.xl}px`,
                border: '1px solid var(--color-border)',
                background: 'var(--color-surface)',
                overflow: 'hidden',
              }}>
                {SECTIONS.map((sec) => {
                  const isActive = activeTab === sec.id;
                  return (
                    <Box key={sec.id}
                      onClick={() => setActiveTab(sec.id)}
                      sx={{
                        display: 'flex', alignItems: 'center', gap: 1.5,
                        px: 2, py: 1.5, cursor: 'pointer',
                        borderLeft: isActive ? '3px solid var(--color-primary)' : '3px solid transparent',
                        background: isActive ? 'var(--color-primary-alpha)' : 'transparent',
                        color: isActive ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                        transition: 'all 0.18s',
                        '&:hover': { background: isActive ? undefined : 'var(--color-overlay)', color: 'var(--color-primary)' },
                      }}
                    >
                      <Typography sx={{ fontSize: 18 }}>{sec.icon}</Typography>
                      <Typography variant="body2" sx={{ fontWeight: isActive ? 700 : 500 }}>
                        {t(`settings.${sec.id}`, sec.label)}
                      </Typography>
                    </Box>
                  );
                })}
              </Box>
            </Box>

            <Box sx={{ flex: 1 }}>
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                  transition={{ duration: 0.25 }}
                >
                  <Box sx={{
                    p: 3.5,
                    borderRadius: `${RADIUS.xl}px`,
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-surface)',
                    boxShadow: SHADOWS.sm,
                  }}>
                    {sectionContent[activeTab]}
                  </Box>
                </motion.div>
              </AnimatePresence>
            </Box>
          </Box>
        )}
      </Box>

      <Snackbar open={snack.open} autoHideDuration={3500}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={snack.severity} onClose={() => setSnack((s) => ({ ...s, open: false }))}
          sx={{ borderRadius: 2 }}>
          {snack.msg}
        </Alert>
      </Snackbar>
    </AnimatedPage>
  );
}

export default Settings;
