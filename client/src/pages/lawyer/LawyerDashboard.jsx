/**
 * client/src/pages/lawyer/LawyerDashboard.jsx
 *
 * Multi-step lawyer profile setup / onboarding form.
 */

import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import Chip from '@mui/material/Chip';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import LinearProgress from '@mui/material/LinearProgress';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Switch from '@mui/material/Switch';
import Slider from '@mui/material/Slider';

import { applyAsLawyer, updateLawyerProfile, selectMyLawyerProfile } from '../../store/slices/lawyerSlice';
import AnimatedPage from '../../components/ui/AnimatedPage';
import { RADIUS, SHADOWS } from '../../theme/tokens';

// ─── Constants ────────────────────────────────────────────────────────────────

const INDIAN_STATES = [
  'Andhra Pradesh','Bihar','Delhi','Gujarat','Karnataka','Kerala',
  'Madhya Pradesh','Maharashtra','Punjab','Rajasthan','Tamil Nadu',
  'Telangana','Uttar Pradesh','West Bengal','Assam','Odisha',
];

const SPECIALISATIONS = [
  { id: 'family',        icon: '👨‍👩‍👧', label: 'Family Law' },
  { id: 'criminal',      icon: '⚖️',    label: 'Criminal Law' },
  { id: 'consumer',      icon: '🛒',    label: 'Consumer Protection' },
  { id: 'property',      icon: '🏠',    label: 'Property Law' },
  { id: 'labour',        icon: '👷',    label: 'Labour Law' },
  { id: 'corporate',     icon: '🏢',    label: 'Corporate Law' },
  { id: 'civil',         icon: '🏛️',   label: 'Civil Litigation' },
  { id: 'ip',            icon: '💡',    label: 'Intellectual Property' },
  { id: 'tax',           icon: '📊',    label: 'Taxation' },
  { id: 'banking',       icon: '🏦',    label: 'Banking & Finance' },
  { id: 'constitutional',icon: '📜',    label: 'Constitutional Law' },
  { id: 'rti',           icon: '📑',    label: 'RTI & Transparency' },
];

const CONSULTATION_MODES = ['chat', 'video', 'phone', 'in_person'];

const STEP_LABELS = [
  'Bar Council', 'Specialisations', 'Practice Details', 'Availability', 'Documents',
];

// ─── Step forms ───────────────────────────────────────────────────────────────

function StepBarCouncil({ control, errors }) {
  const { t } = useTranslation();
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      <Typography variant="h6" sx={{ fontFamily: "'Playfair Display',serif", fontWeight: 700, color: 'var(--color-text)' }}>
        {t('lawyerSetup.s1.title', 'Bar Council Details')}
      </Typography>
      <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)', mt: -1.5 }}>
        {t('lawyerSetup.s1.desc', 'Your enrollment details are used for verification.')}
      </Typography>

      <Controller name="barCouncilNumber" control={control} render={({ field }) => (
        <TextField {...field} fullWidth label={t('lawyerSetup.barCouncil', 'Bar Council Enrollment Number')}
          placeholder="e.g. MH/5432/2015"
          error={!!errors.barCouncilNumber} helperText={errors.barCouncilNumber?.message}
          inputProps={{ style: { fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.06em' } }} />
      )} />

      <Controller name="barCouncilState" control={control} render={({ field }) => (
        <TextField {...field} select fullWidth label={t('lawyerSetup.barCouncilState', 'State Bar Council')}
          error={!!errors.barCouncilState} helperText={errors.barCouncilState?.message}>
          {INDIAN_STATES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
        </TextField>
      )} />

      <Controller name="experience" control={control} render={({ field }) => (
        <TextField {...field} type="number" fullWidth label={t('lawyerSetup.experience', 'Years of Experience')}
          inputProps={{ min: 0, max: 60 }}
          error={!!errors.experience} helperText={errors.experience?.message} />
      )} />
    </Box>
  );
}

function StepSpecialisations({ specialisations, onToggle, error }) {
  const { t } = useTranslation();
  return (
    <Box>
      <Typography variant="h6" sx={{ fontFamily: "'Playfair Display',serif", fontWeight: 700, color: 'var(--color-text)', mb: 0.5 }}>
        {t('lawyerSetup.s2.title', 'Areas of Practice')}
      </Typography>
      <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)', mb: 2.5 }}>
        {t('lawyerSetup.s2.desc', 'Select all areas you practise in. This helps clients find you.')}
      </Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)' }, gap: 1.25 }}>
        {SPECIALISATIONS.map((spec) => {
          const active = specialisations.includes(spec.id);
          return (
            <motion.div key={spec.id} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Box
                onClick={() => onToggle(spec.id)}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 1, p: 1.5,
                  borderRadius: `${RADIUS.lg}px`,
                  border: active ? '2px solid var(--color-primary)' : '1.5px solid var(--color-border)',
                  background: active ? 'var(--color-primary-alpha)' : 'var(--color-surface)',
                  cursor: 'pointer', transition: 'all 0.18s',
                }}
              >
                <Typography sx={{ fontSize: 20, lineHeight: 1 }}>{spec.icon}</Typography>
                <Typography variant="caption" sx={{ fontWeight: active ? 700 : 500, color: active ? 'var(--color-primary)' : 'var(--color-text)' }}>
                  {spec.label}
                </Typography>
                {active && <Typography sx={{ ml: 'auto', color: 'var(--color-primary)', fontSize: 14 }}>✓</Typography>}
              </Box>
            </motion.div>
          );
        })}
      </Box>
      {error && <Typography variant="caption" sx={{ color: 'var(--color-error)', mt: 1, display: 'block' }}>{error}</Typography>}
    </Box>
  );
}

function StepPracticeDetails({ control, errors, practicingStates, setPracticingStates }) {
  const { t } = useTranslation();
  const toggleState = (s) => setPracticingStates((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      <Typography variant="h6" sx={{ fontFamily: "'Playfair Display',serif", fontWeight: 700, color: 'var(--color-text)' }}>
        {t('lawyerSetup.s3.title', 'Practice Details')}
      </Typography>

      <Box>
        <Typography variant="body2" sx={{ fontWeight: 600, color: 'var(--color-text)', mb: 1.25 }}>
          {t('lawyerSetup.practicingStates', 'States you practise in')}
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
          {INDIAN_STATES.map((s) => (
            <Chip key={s} label={s} size="small" clickable onClick={() => toggleState(s)}
              sx={{
                fontWeight: practicingStates.includes(s) ? 700 : 400,
                background: practicingStates.includes(s) ? 'var(--color-primary)' : 'var(--color-surface)',
                color: practicingStates.includes(s) ? '#fff' : 'var(--color-text-secondary)',
                border: practicingStates.includes(s) ? 'none' : '1px solid var(--color-border)',
              }} />
          ))}
        </Box>
      </Box>

      <Controller name="district" control={control} render={({ field }) => (
        <TextField {...field} fullWidth label={t('lawyerSetup.district', 'Primary District / City')} />
      )} />

      <Controller name="bio" control={control} render={({ field }) => (
        <TextField {...field} fullWidth multiline rows={4}
          label={t('lawyerSetup.bio', 'Professional Bio')}
          placeholder="Describe your practice, notable cases, and areas of expertise…"
          error={!!errors.bio} helperText={errors.bio?.message} />
      )} />
    </Box>
  );
}

function StepAvailability({ control, modes, setModes }) {
  const { t } = useTranslation();
  const toggleMode = (m) => setModes((prev) => prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]);
  const modeLabels = { chat: '💬 Chat', video: '📹 Video', phone: '📞 Phone', in_person: '🏛️ In-Person' };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      <Typography variant="h6" sx={{ fontFamily: "'Playfair Display',serif", fontWeight: 700, color: 'var(--color-text)' }}>
        {t('lawyerSetup.s4.title', 'Availability & Fees')}
      </Typography>

      <Controller name="consultationFee" control={control} render={({ field }) => (
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 600, color: 'var(--color-text)', mb: 0.5 }}>
            {t('lawyerSetup.fee', 'Consultation Fee (₹)')}
          </Typography>
          <TextField {...field} type="number" fullWidth inputProps={{ min: 0, step: 50 }}
            InputProps={{ startAdornment: <Typography sx={{ mr: 1, color: 'var(--color-text-secondary)' }}>₹</Typography> }} />
        </Box>
      )} />

      <Box>
        <Typography variant="body2" sx={{ fontWeight: 600, color: 'var(--color-text)', mb: 1.25 }}>
          {t('lawyerSetup.modes', 'Consultation Modes Available')}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {CONSULTATION_MODES.map((m) => (
            <Chip key={m} label={modeLabels[m]} size="small" clickable onClick={() => toggleMode(m)}
              sx={{
                fontWeight: modes.includes(m) ? 700 : 500, height: 30, fontSize: '0.8rem',
                background: modes.includes(m) ? 'var(--color-primary)' : 'var(--color-surface)',
                color: modes.includes(m) ? '#fff' : 'var(--color-text)',
                border: modes.includes(m) ? 'none' : '1px solid var(--color-border)',
              }} />
          ))}
        </Box>
      </Box>

      <Controller name="isAvailableForConsultation" control={control} render={({ field }) => (
        <FormControlLabel
          control={<Switch {...field} checked={!!field.value}
            sx={{ '& .MuiSwitch-thumb': { background: 'var(--color-primary)' } }} />}
          label={
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>{t('lawyerSetup.available', 'Currently accepting consultations')}</Typography>
              <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)' }}>You can toggle this anytime from your dashboard</Typography>
            </Box>
          }
        />
      )} />
    </Box>
  );
}

function StepDocuments({ file, setFile, error }) {
  const { t } = useTranslation();
  const inputRef = useRef(null);

  return (
    <Box>
      <Typography variant="h6" sx={{ fontFamily: "'Playfair Display',serif", fontWeight: 700, color: 'var(--color-text)', mb: 0.5 }}>
        {t('lawyerSetup.s5.title', 'Upload Documents')}
      </Typography>
      <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)', mb: 2.5 }}>
        {t('lawyerSetup.s5.desc', 'Upload your Bar Council enrollment certificate for verification. PDF, JPEG or PNG, max 5MB.')}
      </Typography>

      <input ref={inputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: 'none' }}
        onChange={(e) => setFile(e.target.files[0] || null)} />

      <Box
        onClick={() => inputRef.current?.click()}
        sx={{
          p: 4, borderRadius: `${RADIUS.xl}px`,
          border: '2px dashed var(--color-border)',
          background: 'var(--color-bg)',
          cursor: 'pointer', textAlign: 'center',
          transition: 'border-color 0.2s, background 0.2s',
          '&:hover': { borderColor: 'var(--color-primary)', background: 'var(--color-primary-alpha)' },
        }}
      >
        <Typography sx={{ fontSize: 36, mb: 1.5 }}>📎</Typography>
        {file ? (
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 700, color: 'var(--color-success)' }}>✅ {file.name}</Typography>
            <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)' }}>{(file.size / 1024).toFixed(0)} KB</Typography>
          </Box>
        ) : (
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 600, color: 'var(--color-text)', mb: 0.5 }}>
              {t('lawyerSetup.uploadClick', 'Click to upload or drag and drop')}
            </Typography>
            <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)' }}>PDF, JPEG or PNG · Max 5MB</Typography>
          </Box>
        )}
      </Box>
      {error && <Typography variant="caption" sx={{ color: 'var(--color-error)', mt: 1, display: 'block' }}>{error}</Typography>}

      <Alert severity="info" sx={{ mt: 2, borderRadius: `${RADIUS.md}px` }}>
        {t('lawyerSetup.reviewNote', 'Your profile will be reviewed by our team within 2–3 business days.')}
      </Alert>
    </Box>
  );
}

// ─── Under review status ──────────────────────────────────────────────────────
function UnderReview() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const steps = [
    { label: t('lawyerSetup.r1', 'Application submitted'), done: true },
    { label: t('lawyerSetup.r2', 'Document review'), done: false },
    { label: t('lawyerSetup.r3', 'Bar Council verification'), done: false },
    { label: t('lawyerSetup.r4', 'Profile approved & live'), done: false },
  ];

  return (
    <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }}>
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <motion.div animate={{ rotate: [0, 10, -10, 0] }} transition={{ duration: 1.2, repeat: Infinity, repeatDelay: 3 }}>
          <Typography sx={{ fontSize: 64, mb: 2 }}>⚖️</Typography>
        </motion.div>
        <Typography variant="h5" sx={{ fontFamily: "'Playfair Display',serif", fontWeight: 700, color: 'var(--color-text)', mb: 1 }}>
          {t('lawyerSetup.underReview', 'Application Under Review')}
        </Typography>
        <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)', mb: 4, maxWidth: 340, mx: 'auto' }}>
          {t('lawyerSetup.underReviewDesc', 'Our team is reviewing your application. We will notify you within 2–3 business days.')}
        </Typography>

        <Box sx={{ maxWidth: 340, mx: 'auto', textAlign: 'left', mb: 4 }}>
          {steps.map((s, i) => (
            <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.75 }}>
              <Box sx={{
                width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                background: s.done ? 'var(--color-success)' : i === 1 ? 'var(--color-primary)' : 'var(--color-border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: s.done || i === 1 ? '#fff' : 'var(--color-text-secondary)',
                fontSize: 13, fontWeight: 700,
              }}>
                {s.done ? '✓' : i === 1 ? '…' : i + 1}
              </Box>
              <Typography variant="body2" sx={{ fontWeight: s.done ? 600 : 400, color: s.done ? 'var(--color-text)' : 'var(--color-text-secondary)' }}>
                {s.label}
              </Typography>
            </Box>
          ))}
        </Box>

        <Button variant="outlined" onClick={() => navigate('/lawyer/home')}
          sx={{ borderRadius: `${RADIUS.md}px`, fontWeight: 600, borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>
          {t('lawyerSetup.goHome', 'Go to Dashboard')}
        </Button>
      </Box>
    </motion.div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
const STEP_COUNT = 5;

const schema = yup.object({
  barCouncilNumber: yup.string().required('Enrollment number is required'),
  barCouncilState: yup.string().required('State is required'),
  experience: yup.number().min(0).required('Experience is required'),
  consultationFee: yup.number().min(0).required('Fee is required'),
  bio: yup.string().min(30, 'Bio must be at least 30 characters'),
});

function LawyerDashboard() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const existingProfile = useSelector(selectMyLawyerProfile);

  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [specialisations, setSpecialisations] = useState([]);
  const [practicingStates, setPracticingStates] = useState([]);
  const [modes, setModes] = useState(['chat', 'video', 'phone']);
  const [certFile, setCertFile] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [specError, setSpecError] = useState('');

  const { control, handleSubmit, watch, formState: { errors } } = useForm({
    resolver: yupResolver(schema),
    defaultValues: {
      barCouncilNumber: existingProfile?.barCouncilNumber || '',
      barCouncilState: existingProfile?.practicingStates?.[0] || '',
      experience: existingProfile?.experience || '',
      consultationFee: existingProfile?.consultationFee ? Math.round(existingProfile.consultationFee / 100) : '',
      bio: existingProfile?.bio || '',
      district: existingProfile?.district || '',
      isAvailableForConsultation: existingProfile?.isAvailableForConsultation ?? true,
    },
    mode: 'onTouched',
  });

  const toggleSpec = (id) => {
    setSpecialisations((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
    setSpecError('');
  };

  const goNext = async () => {
    if (step === 1 && specialisations.length === 0) { setSpecError('Select at least one specialisation'); return; }
    if (step < STEP_COUNT - 1) { setDirection(1); setStep((s) => s + 1); }
  };

  const goBack = () => { setDirection(-1); setStep((s) => s - 1); };

  const onFinalSubmit = async (values) => {
    if (specialisations.length === 0) { setStep(1); setSpecError('Select at least one specialisation'); return; }
    setSubmitting(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('barCouncilNumber', values.barCouncilNumber);
      fd.append('specialisations', specialisations.join(','));
      fd.append('practicingStates', [...new Set([values.barCouncilState, ...practicingStates])].join(','));
      fd.append('experience', String(values.experience));
      fd.append('bio', values.bio || '');
      fd.append('consultationFee', String(values.consultationFee * 100));
      fd.append('district', values.district || '');
      if (certFile) fd.append('certificate', certFile);

      const result = await dispatch(applyAsLawyer(fd));
      if (result.meta.requestStatus === 'fulfilled') {
        setSubmitted(true);
      } else {
        setError(result.payload || 'Submission failed. Please try again.');
      }
    } finally { setSubmitting(false); }
  };

  if (submitted || existingProfile?.isVerified === false) {
    return <AnimatedPage><Box sx={{ p: { xs: 2, sm: 4 }, maxWidth: 600, mx: 'auto' }}><UnderReview /></Box></AnimatedPage>;
  }

  const stepComponents = [
    <StepBarCouncil key={0} control={control} errors={errors} />,
    <StepSpecialisations key={1} specialisations={specialisations} onToggle={toggleSpec} error={specError} />,
    <StepPracticeDetails key={2} control={control} errors={errors} practicingStates={practicingStates} setPracticingStates={setPracticingStates} />,
    <StepAvailability key={3} control={control} modes={modes} setModes={setModes} />,
    <StepDocuments key={4} file={certFile} setFile={setCertFile} />,
  ];

  return (
    <AnimatedPage>
      <Box sx={{ p: { xs: 2, sm: 3, md: 4 }, maxWidth: 640, mx: 'auto', pb: { xs: 10, md: 6 } }}>
        <motion.div initial={{ opacity: 0, y: -14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.38 }}>
          <Typography variant="h4" sx={{ fontFamily: "'Playfair Display',serif", fontWeight: 700, color: 'var(--color-text)', mb: 0.5 }}>
            ⚖️ {t('lawyerSetup.title', 'Set Up Your Lawyer Profile')}
          </Typography>
          <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)', mb: 3 }}>
            {t('lawyerSetup.subtitle', 'Complete your profile to start accepting consultations on NyayaSetu.')}
          </Typography>
        </motion.div>

        <Box sx={{ background: 'var(--color-surface)', borderRadius: `${RADIUS.xl}px`, border: '1px solid var(--color-border)', boxShadow: SHADOWS.lg, p: { xs: 3, sm: 4 }, overflow: 'hidden' }}>
          {/* Step indicator */}
          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              {STEP_LABELS.map((label, i) => (
                <Typography key={label} variant="caption" sx={{
                  fontWeight: i === step ? 700 : 400,
                  color: i <= step ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                  display: { xs: i === step ? 'block' : 'none', sm: 'block' },
                }}>
                  {i < step ? '✓ ' : `${i + 1}. `}{label}
                </Typography>
              ))}
            </Box>
            <LinearProgress variant="determinate" value={((step + 1) / STEP_COUNT) * 100}
              sx={{ height: 5, borderRadius: 3, background: 'var(--color-border)', '& .MuiLinearProgress-bar': { background: 'var(--color-primary)', borderRadius: 3 } }} />
          </Box>

          {/* Step content */}
          <Box sx={{ minHeight: 340 }}>
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={step}
                custom={direction}
                initial={{ opacity: 0, x: direction > 0 ? 40 : -40 }}
                animate={{ opacity: 1, x: 0, transition: { duration: 0.32, ease: 'easeOut' } }}
                exit={{ opacity: 0, x: direction > 0 ? -40 : 40, transition: { duration: 0.22 } }}
              >
                {stepComponents[step]}
              </motion.div>
            </AnimatePresence>
          </Box>

          {error && <Alert severity="error" sx={{ mt: 2, borderRadius: `${RADIUS.md}px` }} onClose={() => setError('')}>{error}</Alert>}

          {/* Navigation */}
          <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
            {step > 0 && (
              <Button variant="outlined" onClick={goBack} disabled={submitting}
                sx={{ flex: 1, borderRadius: `${RADIUS.md}px`, fontWeight: 600, borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>
                {t('common.back', 'Back')}
              </Button>
            )}
            {step < STEP_COUNT - 1 ? (
              <Button variant="contained" onClick={goNext}
                sx={{ flex: 2, borderRadius: `${RADIUS.md}px`, fontWeight: 700, background: 'var(--color-primary)' }}>
                {t('common.continue', 'Continue')} →
              </Button>
            ) : (
              <Button variant="contained" onClick={handleSubmit(onFinalSubmit)} disabled={submitting}
                sx={{ flex: 2, borderRadius: `${RADIUS.md}px`, fontWeight: 700, background: 'var(--color-primary)', py: 1.25 }}>
                {submitting ? <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><CircularProgress size={18} sx={{ color: '#fff' }} />{t('lawyerSetup.submitting', 'Submitting…')}</Box>
                  : t('lawyerSetup.submit', 'Submit Application')}
              </Button>
            )}
          </Box>
        </Box>
      </Box>
    </AnimatedPage>
  );
}

export default LawyerDashboard;
