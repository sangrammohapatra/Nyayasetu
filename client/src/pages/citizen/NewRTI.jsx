/**
 * client/src/pages/citizen/NewRTI.jsx
 *
 * Multi-step wizard to file a new RTI application.
 * Steps:
 *   1. Describe what you need (plain language) → AI draft
 *   2. Review & edit questions + ministry/PIO details
 *   3. Your details (applicant info)
 *   4. Preview & save / download PDF
 */

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import CircularProgress from '@mui/material/CircularProgress';
import Chip from '@mui/material/Chip';
import Autocomplete from '@mui/material/Autocomplete';
import Divider from '@mui/material/Divider';
import Alert from '@mui/material/Alert';
import Stepper from '@mui/material/Stepper';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import IconButton from '@mui/material/IconButton';

import AnimatedPage from '../../components/ui/AnimatedPage';
import GlassCard from '../../components/ui/GlassCard';
import GradientHeading from '../../components/ui/GradientHeading';
import { RADIUS, SHADOWS, TYPOGRAPHY } from '../../theme/tokens';

import {
  aiDraftRTI,
  createRTI,
  getMinistries,
  selectAIDraft,
  selectRTIAILoading,
  selectRTILoading,
  selectMinistries,
  selectStateDepts,
  selectRTIError,
  clearAIDraft,
} from '../../store/slices/rtiSlice';
import { selectUser } from '../../store/slices/authSlice';
import { pushSnackbar } from '../../store/slices/uiSlice';

const STEPS = ['Describe', 'Review Questions', 'Your Details', 'Preview'];

// ─── Step 1: Describe ─────────────────────────────────────────────────────────

function StepDescribe({ description, setDescription, onAIDraft, aiLoading }) {
  const examples = [
    'I want to know the status of my PF withdrawal application filed in March. No response received.',
    'I need copies of the road construction tender awarded in our village panchayat last year.',
    'I want information about how many complaints were registered against my district police station in 2024.',
    'I need details about the criteria used to select beneficiaries for the PM Awas Yojana housing scheme in my ward.',
  ];

  return (
    <Box>
      <GradientHeading variant="h6" sx={{ mb: 0.5, fontFamily: TYPOGRAPHY.fontFamily.display, fontWeight: 700 }}>
        What information do you need?
      </GradientHeading>
      <Typography sx={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem', mb: 2.5, lineHeight: 1.6 }}>
        Describe in plain language — our AI will convert it into a properly formatted RTI application. You can write in Hindi, English, or any Indian language.
      </Typography>

      <TextField
        fullWidth
        multiline
        rows={5}
        placeholder="E.g. I applied for a ration card 3 months ago but have not received any response. I want to know the current status of my application and the reason for delay..."
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        sx={{
          mb: 2,
          '& .MuiOutlinedInput-root': {
            borderRadius: `${RADIUS.lg}px`,
            fontSize: '0.9rem',
          },
        }}
      />

      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 3 }}>
        <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)', alignSelf: 'center', mr: 0.5 }}>
          Examples:
        </Typography>
        {examples.map((ex, i) => (
          <Chip
            key={i}
            label={ex.substring(0, 45) + '...'}
            size="small"
            onClick={() => setDescription(ex)}
            sx={{
              cursor: 'pointer',
              fontSize: '0.7rem',
              background: 'var(--color-primary-alpha)',
              color: 'var(--color-primary)',
              border: '1px solid var(--color-primary)',
              '&:hover': { background: 'var(--color-primary)', color: '#fff' },
            }}
          />
        ))}
      </Box>

      <Button
        fullWidth
        variant="contained"
        disabled={description.trim().length < 10 || aiLoading}
        onClick={onAIDraft}
        sx={{
          background: 'var(--color-primary)',
          borderRadius: `${RADIUS.md}px`,
          py: 1.5,
          fontWeight: 700,
          fontSize: '0.95rem',
        }}
      >
        {aiLoading ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <CircularProgress size={18} sx={{ color: '#fff' }} />
            AI is drafting your RTI questions...
          </Box>
        ) : (
          '✨ Generate RTI with AI →'
        )}
      </Button>
    </Box>
  );
}

// ─── Step 2: Review Questions ─────────────────────────────────────────────────

function StepReview({ form, setForm, ministries, stateDepts, aiDraft }) {
  const [govLevel, setGovLevel] = useState(form.govLevel || 'central');

  const handleSubjectChange = (idx, val) => {
    const updated = [...form.subjects];
    updated[idx] = val;
    setForm((prev) => ({ ...prev, subjects: updated }));
  };

  const addSubject = () => {
    if (form.subjects.length >= 15) return;
    setForm((prev) => ({ ...prev, subjects: [...prev.subjects, ''] }));
  };

  const removeSubject = (idx) => {
    if (form.subjects.length <= 1) return;
    setForm((prev) => ({ ...prev, subjects: prev.subjects.filter((_, i) => i !== idx) }));
  };

  return (
    <Box>
      <GradientHeading variant="h6" sx={{ mb: 0.5, fontFamily: TYPOGRAPHY.fontFamily.display, fontWeight: 700 }}>
        Review Your RTI Application
      </GradientHeading>
      <Typography sx={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem', mb: 2.5 }}>
        Edit the AI-generated questions and verify ministry details.
      </Typography>

      {aiDraft?.tipsForUser && (
        <Alert severity="info" sx={{ mb: 2, borderRadius: `${RADIUS.md}px` }}>
          <strong>Tip:</strong> {aiDraft.tipsForUser}
        </Alert>
      )}
      {aiDraft?.urgencyNote && (
        <Alert severity="warning" sx={{ mb: 2, borderRadius: `${RADIUS.md}px` }}>
          {aiDraft.urgencyNote}
        </Alert>
      )}

      {/* Title */}
      <TextField
        fullWidth
        label="RTI Title (short description)"
        value={form.title}
        onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
        sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: `${RADIUS.md}px` } }}
      />

      {/* Ministry / Department */}
      <Box sx={{ mb: 2 }}>
        <FormControl fullWidth sx={{ mb: 1.5 }}>
          <InputLabel>Government Level</InputLabel>
          <Select
            value={govLevel}
            label="Government Level"
            onChange={(e) => { setGovLevel(e.target.value); setForm((p) => ({ ...p, govLevel: e.target.value })); }}
            sx={{ borderRadius: `${RADIUS.md}px` }}
          >
            <MenuItem value="central">Central Government</MenuItem>
            <MenuItem value="state">State Government</MenuItem>
          </Select>
        </FormControl>

        {govLevel === 'central' ? (
          <Autocomplete
            options={ministries}
            getOptionLabel={(o) => o.name || o}
            value={ministries.find((m) => m.name === form.ministry) || null}
            onChange={(_, val) => {
              if (val) {
                setForm((p) => ({
                  ...p,
                  ministry:       val.name,
                  pioDesignation: val.pioDesignation || 'Public Information Officer',
                  pioAddress:     val.address || '',
                  pioEmail:       val.email || '',
                }));
              }
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Ministry / Department"
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: `${RADIUS.md}px` } }}
              />
            )}
            sx={{ mb: 1.5 }}
          />
        ) : (
          <>
            <TextField
              fullWidth
              label="State"
              value={form.state || ''}
              onChange={(e) => setForm((p) => ({ ...p, state: e.target.value }))}
              sx={{ mb: 1.5, '& .MuiOutlinedInput-root': { borderRadius: `${RADIUS.md}px` } }}
            />
            <Autocomplete
              freeSolo
              options={stateDepts}
              value={form.ministry}
              onInputChange={(_, val) => setForm((p) => ({ ...p, ministry: val }))}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Department"
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: `${RADIUS.md}px` } }}
                />
              )}
              sx={{ mb: 1.5 }}
            />
          </>
        )}

        <TextField
          fullWidth
          label="PIO Address"
          multiline
          rows={2}
          value={form.pioAddress || ''}
          onChange={(e) => setForm((p) => ({ ...p, pioAddress: e.target.value }))}
          sx={{ mb: 1.5, '& .MuiOutlinedInput-root': { borderRadius: `${RADIUS.md}px` } }}
        />
        <TextField
          fullWidth
          label="PIO Email (optional)"
          value={form.pioEmail || ''}
          onChange={(e) => setForm((p) => ({ ...p, pioEmail: e.target.value }))}
          sx={{ '& .MuiOutlinedInput-root': { borderRadius: `${RADIUS.md}px` } }}
        />
      </Box>

      <Divider sx={{ my: 2, borderColor: 'var(--color-border)' }} />

      {/* Questions */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
        <Typography variant="body2" sx={{ fontWeight: 700, color: 'var(--color-text)' }}>
          RTI Questions ({form.subjects.length}/15)
        </Typography>
        <Chip
          label="+ Add Question"
          size="small"
          onClick={addSubject}
          disabled={form.subjects.length >= 15}
          sx={{
            cursor: 'pointer',
            background: 'var(--color-primary-alpha)',
            color: 'var(--color-primary)',
            fontWeight: 600,
          }}
        />
      </Box>

      {form.subjects.map((subject, idx) => (
        <Box key={idx} sx={{ display: 'flex', gap: 1, mb: 1.5, alignItems: 'flex-start' }}>
          <Box
            sx={{
              width: 28, height: 28, borderRadius: '50%',
              background: 'var(--color-primary)',
              color: '#fff', fontWeight: 700, fontSize: '0.75rem',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, mt: 1,
            }}
          >
            {idx + 1}
          </Box>
          <TextField
            fullWidth
            multiline
            rows={2}
            value={subject}
            onChange={(e) => handleSubjectChange(idx, e.target.value)}
            placeholder={`RTI Question ${idx + 1}`}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: `${RADIUS.md}px`, fontSize: '0.87rem' } }}
          />
          {form.subjects.length > 1 && (
            <IconButton size="small" onClick={() => removeSubject(idx)} sx={{ color: 'var(--color-error)', mt: 0.5 }}>
              ✕
            </IconButton>
          )}
        </Box>
      ))}
    </Box>
  );
}

// ─── Step 3: Your Details ─────────────────────────────────────────────────────

function StepApplicant({ form, setForm }) {
  return (
    <Box>
      <GradientHeading variant="h6" sx={{ mb: 0.5, fontFamily: TYPOGRAPHY.fontFamily.display, fontWeight: 700 }}>
        Your Details
      </GradientHeading>
      <Typography sx={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem', mb: 2.5 }}>
        These appear in the RTI application. Pre-filled from your profile — edit if needed.
      </Typography>

      <TextField fullWidth label="Full Name" value={form.applicantName || ''} onChange={(e) => setForm((p) => ({ ...p, applicantName: e.target.value }))}
        sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: `${RADIUS.md}px` } }} />
      <TextField fullWidth multiline rows={2} label="Address" value={form.applicantAddress || ''} onChange={(e) => setForm((p) => ({ ...p, applicantAddress: e.target.value }))}
        sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: `${RADIUS.md}px` } }} />
      <TextField fullWidth label="Phone Number" value={form.applicantPhone || ''} onChange={(e) => setForm((p) => ({ ...p, applicantPhone: e.target.value }))}
        sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: `${RADIUS.md}px` } }} />
      <TextField fullWidth label="Email Address" value={form.applicantEmail || ''} onChange={(e) => setForm((p) => ({ ...p, applicantEmail: e.target.value }))}
        sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: `${RADIUS.md}px` } }} />

      <Divider sx={{ my: 1.5, borderColor: 'var(--color-border)' }} />

      <FormControlLabel
        control={
          <Checkbox
            checked={form.applicantBpl || false}
            onChange={(e) => setForm((p) => ({ ...p, applicantBpl: e.target.checked, feeAmount: e.target.checked ? 0 : 10, feeMode: e.target.checked ? 'free' : 'online' }))}
          />
        }
        label={
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>I am a BPL (Below Poverty Line) cardholder</Typography>
            <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)' }}>BPL citizens are exempt from the ₹10 RTI application fee</Typography>
          </Box>
        }
      />

      {!form.applicantBpl && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" sx={{ fontWeight: 700, mb: 1 }}>Fee: ₹{form.feeAmount || 10}</Typography>
          <FormControl fullWidth sx={{ mb: 1 }}>
            <InputLabel>Payment Mode</InputLabel>
            <Select
              value={form.feeMode || 'online'}
              label="Payment Mode"
              onChange={(e) => setForm((p) => ({ ...p, feeMode: e.target.value }))}
              sx={{ borderRadius: `${RADIUS.md}px` }}
            >
              <MenuItem value="online">Online (RTI Portal)</MenuItem>
              <MenuItem value="ipo">Indian Postal Order (IPO)</MenuItem>
              <MenuItem value="court_fee_stamp">Court Fee Stamp</MenuItem>
              <MenuItem value="demand_draft">Demand Draft</MenuItem>
            </Select>
          </FormControl>
        </Box>
      )}
    </Box>
  );
}

// ─── Step 4: Preview ──────────────────────────────────────────────────────────

function StepPreview({ form, onDownload, saving }) {
  return (
    <Box>
      <GradientHeading variant="h6" sx={{ mb: 0.5, fontFamily: TYPOGRAPHY.fontFamily.display, fontWeight: 700 }}>
        Preview & Submit
      </GradientHeading>
      <Typography sx={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem', mb: 2.5 }}>
        Review your RTI application, then save it to the tracker or download as PDF.
      </Typography>

      <GlassCard elevation={0} sx={{ p: 2.5, mb: 2, border: '1.5px solid var(--color-border)' }}>
        <Typography sx={{ fontWeight: 700, fontSize: '1rem', mb: 0.5 }}>{form.title}</Typography>
        <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)', display: 'block', mb: 1.5 }}>
          {form.govLevel === 'central' ? 'Central Government' : `State — ${form.state || ''}`} · {form.ministry}
        </Typography>
        <Typography variant="caption" sx={{ fontWeight: 700, color: 'var(--color-text-secondary)', display: 'block', mb: 0.5 }}>
          PIO Address
        </Typography>
        <Typography sx={{ fontSize: '0.82rem', mb: 1.5 }}>{form.pioAddress}</Typography>

        <Divider sx={{ mb: 1.5, borderColor: 'var(--color-border)' }} />

        <Typography variant="caption" sx={{ fontWeight: 700, color: 'var(--color-text-secondary)', display: 'block', mb: 1 }}>
          QUESTIONS ({form.subjects.length})
        </Typography>
        {form.subjects.filter(Boolean).map((s, i) => (
          <Box key={i} sx={{ display: 'flex', gap: 1, mb: 1 }}>
            <Typography sx={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--color-primary)', flexShrink: 0 }}>
              {i + 1}.
            </Typography>
            <Typography sx={{ fontSize: '0.82rem', lineHeight: 1.5 }}>{s}</Typography>
          </Box>
        ))}

        <Divider sx={{ my: 1.5, borderColor: 'var(--color-border)' }} />
        <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)' }}>
          Applicant: <strong>{form.applicantName}</strong> · Fee: <strong>{form.applicantBpl ? 'Exempt (BPL)' : `₹${form.feeAmount} via ${form.feeMode}`}</strong>
        </Typography>
      </GlassCard>

      <Alert severity="info" sx={{ mb: 2, borderRadius: `${RADIUS.md}px` }}>
        <strong>How to file:</strong> After saving, download the PDF and submit it at{' '}
        <a href="https://rtionline.gov.in" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', fontWeight: 700 }}>
          rtionline.gov.in
        </a>{' '}
        (Central Govt) or your state RTI portal. We'll track the 30-day deadline for you.
      </Alert>

      <Button
        variant="outlined"
        fullWidth
        onClick={onDownload}
        sx={{
          borderRadius: `${RADIUS.md}px`,
          fontWeight: 700,
          py: 1.25,
          borderColor: 'var(--color-primary)',
          color: 'var(--color-primary)',
        }}
      >
        📥 Download PDF to File
      </Button>
    </Box>
  );
}

// ─── Main Wizard ──────────────────────────────────────────────────────────────

export default function NewRTI() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const prefersReducedMotion = useReducedMotion();

  const user       = useSelector(selectUser);
  const aiDraft    = useSelector(selectAIDraft);
  const aiLoading  = useSelector(selectRTIAILoading);
  const saving     = useSelector(selectRTILoading);
  const ministries = useSelector(selectMinistries);
  const stateDepts = useSelector(selectStateDepts);
  const error      = useSelector(selectRTIError);

  const [step, setStep] = useState(0);
  const [description, setDescription] = useState('');
  // Tracks the description the current aiDraft was generated from, so editing
  // the description after a draft exists forces regeneration instead of
  // silently reusing stale AI-generated questions/ministry.
  const [lastDraftedDescription, setLastDraftedDescription] = useState(null);
  const draftedDescriptionRef = useRef('');

  const [form, setForm] = useState({
    title:            '',
    govLevel:         'central',
    state:            '',
    ministry:         '',
    pioAddress:       '',
    pioEmail:         '',
    pioDesignation:   'Public Information Officer',
    subjects:         [''],
    applicantName:    user?.name || '',
    applicantAddress: '',
    applicantPhone:   user?.phone || '',
    applicantEmail:   user?.email || '',
    applicantBpl:     false,
    feeAmount:        10,
    feeMode:          'online',
    aiDrafted:        false,
  });

  useEffect(() => {
    if (ministries.length === 0) dispatch(getMinistries());
    return () => { dispatch(clearAIDraft()); };
  }, [dispatch]);

  useEffect(() => {
    if (aiDraft) {
      setForm((prev) => ({
        ...prev,
        title:          aiDraft.title || prev.title,
        govLevel:       aiDraft.govLevel || 'central',
        state:          aiDraft.stateName || '',
        ministry:       aiDraft.ministry || '',
        pioDesignation: aiDraft.pioDesignation || 'Public Information Officer',
        pioAddress:     aiDraft.pioAddress || '',
        pioEmail:       aiDraft.pioEmail || '',
        subjects:       aiDraft.subjects?.length ? aiDraft.subjects : [''],
        aiDrafted:      true,
      }));
      setLastDraftedDescription(draftedDescriptionRef.current);
      setStep(1);
    }
  }, [aiDraft]);

  const handleAIDraft = async () => {
    draftedDescriptionRef.current = description;
    await dispatch(aiDraftRTI({ description }));
  };

  const handleSave = async () => {
    const payload = { ...form, subjects: form.subjects.filter(Boolean) };
    const result = await dispatch(createRTI(payload));
    if (!result.error) {
      dispatch(pushSnackbar({ message: 'RTI application saved!', severity: 'success' }));
      navigate(`/citizen/rti/${result.payload.rti._id}`);
    }
  };

  const handleDownloadPreview = () => {
    // Save first, then redirect to download
    handleSave();
  };

  const canProceed = () => {
    if (step === 0) return description.trim().length >= 10 && !aiLoading;
    if (step === 1) return form.title.trim() && form.ministry.trim() && form.pioAddress.trim() && form.subjects.some(Boolean);
    if (step === 2) return form.applicantName.trim();
    return true;
  };

  return (
    <AnimatedPage>
      <Box sx={{ p: { xs: 2, sm: 3, md: 4 }, maxWidth: 720, mx: 'auto', pb: { xs: 10, md: 4 } }}>

        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
          <Button
            variant="text"
            onClick={() => navigate('/citizen/rti')}
            sx={{ color: 'var(--color-text-secondary)', minWidth: 0, px: 1 }}
          >
            ← Back
          </Button>
          <GradientHeading variant="h5" sx={{ fontFamily: TYPOGRAPHY.fontFamily.display, fontWeight: 700 }}>
            File New RTI
          </GradientHeading>
        </Box>

        {/* Stepper */}
        <Stepper activeStep={step} alternativeLabel sx={{ mb: 3 }}>
          {STEPS.map((label, i) => (
            <Step key={label} completed={i < step}>
              <StepLabel
                sx={{
                  '& .MuiStepLabel-label': { fontSize: '0.75rem', fontWeight: 600 },
                  '& .MuiStepIcon-root.Mui-active': { color: 'var(--color-primary)' },
                  '& .MuiStepIcon-root.Mui-completed': { color: 'var(--color-success)' },
                }}
              >
                {label}
              </StepLabel>
            </Step>
          ))}
        </Stepper>

        {/* Step content */}
        <GlassCard elevation={1} sx={{ p: { xs: 2, sm: 3 }, border: '1.5px solid var(--color-border)', mb: 3 }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={prefersReducedMotion ? false : { opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
            >
              {step === 0 && (
                <StepDescribe
                  description={description}
                  setDescription={setDescription}
                  onAIDraft={handleAIDraft}
                  aiLoading={aiLoading}
                />
              )}
              {step === 1 && (
                <StepReview
                  form={form}
                  setForm={setForm}
                  ministries={ministries}
                  stateDepts={stateDepts}
                  aiDraft={aiDraft}
                />
              )}
              {step === 2 && (
                <StepApplicant form={form} setForm={setForm} />
              )}
              {step === 3 && (
                <StepPreview form={form} onDownload={handleDownloadPreview} saving={saving} />
              )}
            </motion.div>
          </AnimatePresence>

          {error && (
            <Alert severity="error" sx={{ mt: 2, borderRadius: `${RADIUS.md}px` }}>{error}</Alert>
          )}
        </GlassCard>

        {/* Navigation */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
          <Button
            variant="outlined"
            disabled={step === 0}
            onClick={() => setStep((s) => s - 1)}
            sx={{ borderRadius: `${RADIUS.md}px`, fontWeight: 600, borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
          >
            ← Back
          </Button>

          {step < STEPS.length - 1 ? (
            <Button
              variant="contained"
              disabled={!canProceed() || aiLoading}
              onClick={() => {
                if (step === 0 && (!aiDraft || description !== lastDraftedDescription)) {
                  handleAIDraft();
                } else {
                  setStep((s) => s + 1);
                }
              }}
              sx={{
                background: 'var(--color-primary)',
                borderRadius: `${RADIUS.md}px`,
                fontWeight: 700,
                px: 3,
              }}
            >
              {step === 0 && aiLoading ? 'Generating...' : 'Next →'}
            </Button>
          ) : (
            <Button
              variant="contained"
              disabled={saving}
              onClick={handleSave}
              sx={{
                background: 'var(--color-primary)',
                borderRadius: `${RADIUS.md}px`,
                fontWeight: 700,
                px: 3,
              }}
            >
              {saving ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : '💾 Save & Track'}
            </Button>
          )}
        </Box>
      </Box>
    </AnimatedPage>
  );
}
