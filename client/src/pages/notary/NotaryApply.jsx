/**
 * Notary application. Registration only records the role; this form
 * submits the credentials the verification gate is waiting for.
 */

import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';

import AnimatedPage from '../../components/ui/AnimatedPage';
import GradientHeading from '../../components/ui/GradientHeading';
import { RADIUS, SHADOWS, TYPOGRAPHY } from '../../theme/tokens';
import api from '../../services/api';
import { INDIAN_STATES } from '../../constants/indianStates';
import { getMe, setToken } from '../../store/slices/authSlice';

const LANG_OPTIONS = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'Hindi' },
  { code: 'bn', label: 'Bengali' },
  { code: 'mr', label: 'Marathi' },
  { code: 'ta', label: 'Tamil' },
  { code: 'te', label: 'Telugu' },
  { code: 'gu', label: 'Gujarati' },
  { code: 'kn', label: 'Kannada' },
  { code: 'ml', label: 'Malayalam' },
  { code: 'pa', label: 'Punjabi' },
  { code: 'ur', label: 'Urdu' },
];

export default function NotaryApply() {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    notaryRegistrationNumber: '',
    registrationState: '',
    appointingAuthority: '',
    appointmentYear: '',
    experience: '',
    bio: '',
  });
  const [languages, setLanguages] = useState(['en']);
  const [practicingStates, setPracticingStates] = useState([]);
  const [certificate, setCertificate] = useState(null);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [saving, setSaving] = useState(false);

  const setField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const toggle = (list, setList, value) => {
    setList((prev) => (prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]));
  };

  const validate = () => {
    const next = {};
    if (!form.notaryRegistrationNumber.trim()) next.notaryRegistrationNumber = 'Registration number is required';
    if (!form.registrationState) next.registrationState = 'Registration state is required';
    if (form.experience === '' || Number(form.experience) < 0) next.experience = 'Years of experience is required';
    if (form.appointmentYear && (Number(form.appointmentYear) < 1960 || Number(form.appointmentYear) > new Date().getFullYear())) {
      next.appointmentYear = 'Enter a valid appointment year';
    }
    if (!certificate) next.certificate = 'Upload your notary certificate (PDF, JPG, or PNG)';
    return next;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length) return;

    setSaving(true);
    setSubmitError('');
    try {
      const body = new FormData();
      body.append('notaryRegistrationNumber', form.notaryRegistrationNumber.trim());
      body.append('registrationState', form.registrationState);
      body.append('experience', String(form.experience));
      body.append('languages', languages.join(','));
      body.append('practicingStates', practicingStates.join(','));
      if (form.appointingAuthority.trim()) body.append('appointingAuthority', form.appointingAuthority.trim());
      if (form.appointmentYear) body.append('appointmentYear', String(form.appointmentYear));
      if (form.bio.trim()) body.append('bio', form.bio.trim());
      body.append('certificate', certificate);

      const { data } = await api.post('/notaries/apply', body, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (data.accessToken) {
        localStorage.setItem('nyayasetu_token', data.accessToken);
        if (data.refreshToken) localStorage.setItem('nyayasetu_refresh_token', data.refreshToken);
        dispatch(setToken({ token: data.accessToken, refreshToken: data.refreshToken }));
      }
      await dispatch(getMe());
      navigate('/notary/home', { replace: true });
    } catch (err) {
      setSubmitError(err.response?.data?.message || err.response?.data?.error || 'Application failed. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatedPage>
      <Box sx={{ p: { xs: 2, sm: 3, md: 4 }, maxWidth: 720, mx: 'auto', pb: { xs: 10, md: 6 } }}>
        <GradientHeading variant="h4" sx={{ fontFamily: TYPOGRAPHY.fontFamily.display, fontWeight: 700, mb: 0.5 }}>
          Notary application
        </GradientHeading>
        <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)', mb: 3 }}>
          Submit your registration details and certificate so the profile can be verified.
        </Typography>

        <Box
          component="form"
          onSubmit={handleSubmit}
          sx={{
            display: 'flex', flexDirection: 'column', gap: 2.5,
            background: 'var(--color-surface)', borderRadius: `${RADIUS.xl}px`,
            border: '1px solid var(--color-border)', boxShadow: SHADOWS.lg,
            p: { xs: 3, sm: 4 },
          }}
        >
          <TextField
            fullWidth label="Notary registration number" value={form.notaryRegistrationNumber}
            onChange={(e) => setField('notaryRegistrationNumber', e.target.value)}
            error={!!errors.notaryRegistrationNumber} helperText={errors.notaryRegistrationNumber}
          />
          <TextField
            select fullWidth label="Registration state" value={form.registrationState}
            onChange={(e) => setField('registrationState', e.target.value)}
            error={!!errors.registrationState} helperText={errors.registrationState}
          >
            {INDIAN_STATES.map((state) => <MenuItem key={state} value={state}>{state}</MenuItem>)}
          </TextField>
          <TextField
            fullWidth label="Appointing authority" value={form.appointingAuthority}
            onChange={(e) => setField('appointingAuthority', e.target.value)}
          />
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
            <TextField
              type="number" fullWidth label="Appointment year" value={form.appointmentYear}
              onChange={(e) => setField('appointmentYear', e.target.value)}
              error={!!errors.appointmentYear} helperText={errors.appointmentYear}
              inputProps={{ min: 1960, max: new Date().getFullYear() }}
            />
            <TextField
              type="number" fullWidth label="Years of experience" value={form.experience}
              onChange={(e) => setField('experience', e.target.value)}
              error={!!errors.experience} helperText={errors.experience}
              inputProps={{ min: 0, max: 60 }}
            />
          </Box>

          <Box>
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>Languages</Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
              {LANG_OPTIONS.map((lang) => (
                <Chip
                  key={lang.code} label={lang.label} clickable
                  onClick={() => toggle(languages, setLanguages, lang.code)}
                  sx={{
                    fontWeight: languages.includes(lang.code) ? 700 : 500,
                    background: languages.includes(lang.code) ? 'var(--color-primary)' : 'var(--color-bg)',
                    color: languages.includes(lang.code) ? '#fff' : 'var(--color-text-secondary)',
                  }}
                />
              ))}
            </Box>
          </Box>

          <Box>
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>States you practise in</Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
              {INDIAN_STATES.map((state) => (
                <Chip
                  key={state} label={state} size="small" clickable
                  onClick={() => toggle(practicingStates, setPracticingStates, state)}
                  sx={{
                    fontWeight: practicingStates.includes(state) ? 700 : 400,
                    background: practicingStates.includes(state) ? 'var(--color-primary)' : 'var(--color-bg)',
                    color: practicingStates.includes(state) ? '#fff' : 'var(--color-text-secondary)',
                  }}
                />
              ))}
            </Box>
          </Box>

          <TextField
            fullWidth multiline rows={3} label="Bio" value={form.bio}
            onChange={(e) => setField('bio', e.target.value)}
          />

          <Box>
            <Button variant="outlined" component="label" sx={{ borderRadius: `${RADIUS.md}px` }}>
              {certificate ? certificate.name : 'Upload notary certificate'}
              <input
                hidden type="file" accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => {
                  setCertificate(e.target.files?.[0] || null);
                  setErrors((prev) => {
                    const nextErrors = { ...prev };
                    delete nextErrors.certificate;
                    return nextErrors;
                  });
                }}
              />
            </Button>
            {errors.certificate && (
              <Typography variant="caption" sx={{ display: 'block', mt: 0.75, color: 'var(--color-error, #d32f2f)' }}>
                {errors.certificate}
              </Typography>
            )}
          </Box>

          {submitError && <Alert severity="error">{submitError}</Alert>}

          <Button type="submit" variant="contained" disabled={saving} sx={{
            alignSelf: 'flex-start', borderRadius: `${RADIUS.md}px`, fontWeight: 700,
            background: 'var(--color-primary)', boxShadow: 'none',
          }}>
            {saving ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : 'Submit application'}
          </Button>
        </Box>
      </Box>
    </AnimatedPage>
  );
}
