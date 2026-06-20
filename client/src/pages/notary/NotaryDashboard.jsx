/**
 * NotaryDashboard.jsx
 *
 * Notary's own profile setup / edit page.
 * Similar pattern to LawyerDashboard.
 */

import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';

import {
  updateNotaryProfile as updateNotaryProfileAction,
  selectNotaryError,
  selectNotaryLoading,
} from '../../store/slices/notarySlice';
import { selectUser } from '../../store/slices/authSlice';
import AnimatedPage from '../../components/ui/AnimatedPage';
import GlassCard from '../../components/ui/GlassCard';
import GradientHeading from '../../components/ui/GradientHeading';
import { RADIUS, TYPOGRAPHY } from '../../theme/tokens';
import api from '../../services/api';

const LANG_OPTIONS = ['en', 'hi', 'bn', 'mr', 'ta', 'te', 'gu', 'kn', 'ml', 'pa', 'ur'];
const STATES = [
  'Delhi', 'Maharashtra', 'Karnataka', 'Tamil Nadu', 'Uttar Pradesh',
  'West Bengal', 'Gujarat', 'Rajasthan', 'Telangana', 'Kerala',
  'Punjab', 'Haryana', 'Bihar', 'Odisha', 'Madhya Pradesh',
  'Andhra Pradesh', 'Assam', 'Chhattisgarh', 'Goa', 'Jharkhand',
  'Himachal Pradesh', 'Uttarakhand', 'Jammu & Kashmir',
];

function updateNotaryProfile(updates) {
  return async (dispatch) => {
    try {
      const { data } = await api.put('/notaries/profile', updates);
      return { payload: data };
    } catch (err) {
      return { error: err.response?.data?.message || 'Update failed' };
    }
  };
}

export default function NotaryDashboard() {
  const dispatch = useDispatch();
  const user = useSelector(selectUser);
  const loading = useSelector(selectNotaryLoading);
  const storeError = useSelector(selectNotaryError);

  const [profile, setProfile] = useState(null);
  const [fetching, setFetching] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);

  const [form, setForm] = useState({
    bio: '',
    languages: ['en'],
    practicingStates: [],
    experience: '',
    isAcceptingRequests: true,
  });

  useEffect(() => {
    api.get('/notaries/me/profile')
      .then(({ data }) => {
        setProfile(data);
        setForm({
          bio: data.bio || '',
          languages: data.languages || ['en'],
          practicingStates: data.practicingStates || [],
          experience: data.experience ?? '',
          isAcceptingRequests: data.isAcceptingRequests ?? true,
        });
      })
      .catch(() => {})
      .finally(() => setFetching(false));
  }, []);

  const toggleLang = (lang) => {
    setForm((f) => ({
      ...f,
      languages: f.languages.includes(lang)
        ? f.languages.filter((l) => l !== lang)
        : [...f.languages, lang],
    }));
  };

  const toggleState = (state) => {
    setForm((f) => ({
      ...f,
      practicingStates: f.practicingStates.includes(state)
        ? f.practicingStates.filter((s) => s !== state)
        : [...f.practicingStates, state],
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      await api.put('/notaries/profile', form);
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Update failed. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (fetching) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
        <CircularProgress sx={{ color: 'var(--color-primary)' }} />
      </Box>
    );
  }

  return (
    <AnimatedPage>
      <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: 760, mx: 'auto', pb: { xs: 10, md: 4 } }}>
        <GradientHeading variant="h5" sx={{ fontFamily: TYPOGRAPHY.fontFamily.display, fontWeight: 800, mb: 0.5 }}>
          ⚙️ Notary Profile
        </GradientHeading>
        <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)', mb: 3 }}>
          Keep your profile up to date to get more notarization requests.
        </Typography>

        {/* Verification status banner */}
        {profile && (
          <Box sx={{
            p: 1.75, mb: 3, borderRadius: `${RADIUS.lg}px`,
            background: profile.isVerified ? 'rgba(27,94,32,0.08)' : 'rgba(237,108,2,0.08)',
            border: `1px solid ${profile.isVerified ? 'rgba(27,94,32,0.3)' : 'rgba(237,108,2,0.3)'}`,
            display: 'flex', alignItems: 'center', gap: 1.5,
          }}>
            <Typography sx={{ fontSize: 22 }}>{profile.isVerified ? '✅' : '⏳'}</Typography>
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 700, color: profile.isVerified ? '#1b5e20' : '#ed6c02' }}>
                {profile.isVerified ? 'Profile Verified' : `Verification ${profile.verificationStatus}`}
              </Typography>
              <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)' }}>
                Reg. No: {profile.notaryRegistrationNumber} • {profile.registrationState}
              </Typography>
            </Box>
          </Box>
        )}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>

          {/* Accept toggle */}
          <GlassCard sx={{ p: 2 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={form.isAcceptingRequests}
                  onChange={(e) => setForm((f) => ({ ...f, isAcceptingRequests: e.target.checked }))}
                />
              }
              label={
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {form.isAcceptingRequests ? '🟢 Accepting Requests' : '🔴 Not Accepting Requests'}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)' }}>
                    Toggle off when you need a break
                  </Typography>
                </Box>
              }
            />
          </GlassCard>

          {/* Bio */}
          <GlassCard sx={{ p: 2 }}>
            <Typography variant="body2" sx={{ fontWeight: 700, color: 'var(--color-text)', mb: 1.5 }}>
              About You
            </Typography>
            <TextField
              fullWidth multiline rows={4} label="Professional Bio"
              value={form.bio}
              onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
              inputProps={{ maxLength: 2000 }}
              helperText={`${form.bio.length}/2000`}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: `${RADIUS.md}px` } }}
            />
          </GlassCard>

          {/* Experience */}
          <GlassCard sx={{ p: 2 }}>
            <Typography variant="body2" sx={{ fontWeight: 700, color: 'var(--color-text)', mb: 1.5 }}>
              Experience
            </Typography>
            <TextField
              type="number" label="Years of Experience" fullWidth
              value={form.experience}
              onChange={(e) => setForm((f) => ({ ...f, experience: e.target.value }))}
              inputProps={{ min: 0, max: 60 }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: `${RADIUS.md}px` } }}
            />
          </GlassCard>

          {/* Languages */}
          <GlassCard sx={{ p: 2 }}>
            <Typography variant="body2" sx={{ fontWeight: 700, color: 'var(--color-text)', mb: 1.25 }}>
              Languages
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
              {LANG_OPTIONS.map((l) => (
                <Chip
                  key={l} label={l.toUpperCase()} size="small"
                  onClick={() => toggleLang(l)}
                  sx={{
                    fontWeight: 700, cursor: 'pointer',
                    background: form.languages.includes(l) ? 'var(--color-primary)' : 'var(--color-bg)',
                    color: form.languages.includes(l) ? '#fff' : 'var(--color-text-secondary)',
                    border: form.languages.includes(l) ? 'none' : '1px solid var(--color-border)',
                    '&:hover': { opacity: 0.85 },
                  }}
                />
              ))}
            </Box>
          </GlassCard>

          {/* Practicing States */}
          <GlassCard sx={{ p: 2 }}>
            <Typography variant="body2" sx={{ fontWeight: 700, color: 'var(--color-text)', mb: 1.25 }}>
              States You Practice In
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
              {STATES.map((s) => (
                <Chip
                  key={s} label={s} size="small"
                  onClick={() => toggleState(s)}
                  sx={{
                    cursor: 'pointer',
                    background: form.practicingStates.includes(s) ? 'var(--color-primary)' : 'var(--color-bg)',
                    color: form.practicingStates.includes(s) ? '#fff' : 'var(--color-text-secondary)',
                    border: form.practicingStates.includes(s) ? 'none' : '1px solid var(--color-border)',
                    '&:hover': { opacity: 0.85 },
                  }}
                />
              ))}
            </Box>
          </GlassCard>

          {/* Fee info */}
          <GlassCard sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Typography sx={{ fontSize: 24 }}>💰</Typography>
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 700, color: 'var(--color-text)' }}>
                  Platform Fee: ₹199 (fixed)
                </Typography>
                <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)' }}>
                  You receive 85% (₹169.15) after platform commission. Citizens always pay ₹199.
                </Typography>
              </Box>
            </Box>
          </GlassCard>

          {/* Feedback */}
          {success && (
            <Alert severity="success" sx={{ borderRadius: `${RADIUS.md}px` }}>
              Profile updated successfully!
            </Alert>
          )}
          {error && (
            <Alert severity="error" sx={{ borderRadius: `${RADIUS.md}px` }}>{error}</Alert>
          )}

          <Button
            variant="contained" onClick={handleSave} disabled={saving}
            startIcon={saving ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : null}
            sx={{
              py: 1.5, borderRadius: `${RADIUS.lg}px`, fontWeight: 700, fontSize: '0.9rem',
              background: 'var(--color-primary)',
              '&:hover': { background: 'var(--color-primary)' },
              '&.Mui-disabled': { opacity: 0.6 },
            }}
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </Button>
        </Box>
      </Box>
    </AnimatedPage>
  );
}
