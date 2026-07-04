/**
 * client/src/components/lawyer/ConsultationBooking.jsx
 *
 * 4-step consultation booking drawer:
 *   Step 1 — Select mode (Chat / Video / Phone / In-Person)
 *   Step 2 — Date + time picker
 *   Step 3 — Notes + attach document
 *   Step 4 — Payment summary → Razorpay checkout
 */

import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

import Drawer from '@mui/material/Drawer';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import LinearProgress from '@mui/material/LinearProgress';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';

import { selectUser } from '../../store/slices/authSlice';
import { selectDocuments } from '../../store/slices/documentSlice';
import { openCheckout } from '../../services/razorpay';
import api from '../../services/api';
import { RADIUS, SHADOWS, TYPOGRAPHY } from '../../theme/tokens';
import GradientHeading from '../ui/GradientHeading';
import { useTheme } from '@mui/material/styles';

// ─── Mode options ─────────────────────────────────────────────────────────────

const MODES = [
  { id: 'chat',      icon: '💬', label: 'Online Chat',   desc: 'Text chat via platform' },
  { id: 'video',     icon: '📹', label: 'Video Call',     desc: 'Secure link sent on acceptance' },
  { id: 'phone',     icon: '📞', label: 'Phone Call',     desc: 'Direct call' },
  { id: 'in_person', icon: '🏛️', label: 'In Person',     desc: 'Visit the chamber' },
];

// ─── Time slots (fetched from API) ───────────────────────────────────────────

// ─── Steps ────────────────────────────────────────────────────────────────────

function Step1({ mode, onSelect, supportedModes }) {
  const { t } = useTranslation();
  return (
    <Box>
      <Typography variant="body1" sx={{ fontWeight: 700, color: 'var(--color-text)', mb: 1.75 }}>
        {t('lawyer.select_mode', 'How would you like to consult?')}
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
        {MODES.map((m) => {
          const available = supportedModes.includes(m.id);
          return (
            <motion.div key={m.id} whileHover={available ? { scale: 1.01 } : {}} whileTap={available ? { scale: 0.99 } : {}}>
              <Box onClick={() => available && onSelect(m.id)} sx={{
                display: 'flex', alignItems: 'center', gap: 2, p: 1.75,
                borderRadius: `${RADIUS.lg}px`,
                border: mode === m.id ? '2px solid var(--color-primary)' : '1.5px solid var(--color-border)',
                background: mode === m.id ? 'var(--color-primary-alpha)' : available ? 'var(--color-surface)' : 'var(--color-bg)',
                cursor: available ? 'pointer' : 'not-allowed',
                opacity: available ? 1 : 0.45,
                transition: 'all 0.18s',
              }}>
                <Typography sx={{ fontSize: 24, lineHeight: 1 }}>{m.icon}</Typography>
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: mode === m.id ? 'var(--color-primary)' : 'var(--color-text)' }}>
                    {m.label}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)' }}>
                    {available ? m.desc : t('lawyer.mode_unavailable', 'Not offered by this lawyer')}
                  </Typography>
                </Box>
                {mode === m.id && <Typography sx={{ ml: 'auto', color: 'var(--color-primary)', fontSize: 18 }}>✓</Typography>}
              </Box>
            </motion.div>
          );
        })}
      </Box>
    </Box>
  );
}

function Step2({ lawyerId, date, setDate, time, setTime }) {
  const { t } = useTranslation();
  const today = new Date().toISOString().split('T')[0];
  const [slots, setSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsReason, setSlotsReason] = useState('');

  useEffect(() => {
    if (!date || !lawyerId) return;
    setSlotsLoading(true);
    setSlotsReason('');
    setSlots([]);
    setTime('');
    api.get(`/lawyers/${lawyerId}/slots?date=${date}`)
      .then(({ data }) => {
        setSlots(data.slots || []);
        if (!data.slots?.length) setSlotsReason(data.reason || 'No slots available for this date.');
      })
      .catch(() => setSlotsReason('Could not load available slots. Please try again.'))
      .finally(() => setSlotsLoading(false));
  }, [date, lawyerId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Box>
      <Typography variant="body1" sx={{ fontWeight: 700, color: 'var(--color-text)', mb: 1.75 }}>
        {t('lawyer.select_date_time', 'Choose a date and time')}
      </Typography>
      <TextField type="date" fullWidth label={t('lawyer.date', 'Date')} value={date}
        onChange={(e) => { setDate(e.target.value); }}
        inputProps={{ min: today }}
        sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: `${RADIUS.md}px` } }}
        InputLabelProps={{ shrink: true }}
      />
      {date && (
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 600, color: 'var(--color-text)', mb: 1.25 }}>
            {t('lawyer.available_slots', 'Available Slots')}
          </Typography>
          {slotsLoading ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1 }}>
              <CircularProgress size={16} sx={{ color: 'var(--color-primary)' }} />
              <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)' }}>
                Loading available slots…
              </Typography>
            </Box>
          ) : slots.length === 0 ? (
            <Alert severity="info" sx={{ borderRadius: `${RADIUS.md}px`, fontSize: '0.8rem' }}>
              {slotsReason}
            </Alert>
          ) : (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
              {slots.map((slot) => {
                const isActive = time === slot.iso;
                return (
                  <Chip key={slot.iso} label={slot.time} size="small" clickable onClick={() => setTime(slot.iso)}
                    sx={{
                      fontWeight: isActive ? 700 : 500, height: 28, fontSize: '0.78rem',
                      background: isActive ? 'var(--color-primary)' : 'var(--color-surface)',
                      color: isActive ? '#fff' : 'var(--color-text)',
                      border: isActive ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                      boxShadow: isActive ? '0 0 0 3px var(--color-primary-alpha)' : 'none',
                      transition: 'all 0.15s',
                      '&:hover': { background: isActive ? 'var(--color-primary)' : 'var(--color-overlay)', borderColor: 'var(--color-primary)' },
                    }} />
                );
              })}
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}

function Step3({ notes, setNotes, documentId, setDocumentId, documents }) {
  const { t } = useTranslation();
  return (
    <Box>
      <Typography variant="body1" sx={{ fontWeight: 700, color: 'var(--color-text)', mb: 1.75 }}>
        {t('lawyer.add_details', 'Add notes (optional)')}
      </Typography>
      <TextField fullWidth multiline rows={4} label={t('lawyer.notes', 'Notes for the lawyer')}
        value={notes} onChange={(e) => setNotes(e.target.value)}
        placeholder="Briefly describe your legal issue so the lawyer can prepare…"
        sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: `${RADIUS.md}px` } }} />

      {documents.length > 0 && (
        <TextField select fullWidth label={t('lawyer.attach_doc', 'Attach a document (optional)')}
          value={documentId} onChange={(e) => setDocumentId(e.target.value)}
          sx={{ '& .MuiOutlinedInput-root': { borderRadius: `${RADIUS.md}px` } }}>
          <MenuItem value="">— No document —</MenuItem>
          {documents.map((d) => <MenuItem key={d._id} value={d._id}>{d.title}</MenuItem>)}
        </TextField>
      )}
    </Box>
  );
}

function Step4({ lawyer, mode, date, time, notes, fee, feeLoading }) {
  const { t } = useTranslation();
  const modeObj = MODES.find((m) => m.id === mode) || MODES[0];
  const feeRupees = Math.round(fee / 100);
  const scheduledStr = time
    ? new Date(time).toLocaleString('en-IN', { dateStyle: 'long', timeStyle: 'short' })
    : `${date}`;

  return (
    <Box>
      <Typography variant="body1" sx={{ fontWeight: 700, color: 'var(--color-text)', mb: 2 }}>
        {t('lawyer.summary', 'Booking Summary')}
      </Typography>
      <Box sx={{ p: 2.5, borderRadius: `${RADIUS.xl}px`, border: '1.5px solid var(--color-primary)', background: 'var(--color-primary-alpha)', mb: 2.5 }}>
        {[
          { label: 'Lawyer', value: lawyer?.name || 'Advocate' },
          { label: 'Mode', value: `${modeObj.icon} ${modeObj.label}` },
          { label: 'Schedule', value: scheduledStr },
          { label: 'Fee', value: feeLoading ? '…' : `₹${feeRupees}`, bold: true },
        ].map((row) => (
          <Box key={row.label} sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)' }}>{row.label}</Typography>
            <Typography variant="body2" sx={{ fontWeight: row.bold ? 800 : 600, color: row.bold ? 'var(--color-primary)' : 'var(--color-text)' }}>
              {row.value}
            </Typography>
          </Box>
        ))}
        {notes && (
          <>
            <Divider sx={{ my: 1, borderColor: 'var(--color-border)' }} />
            <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>{notes}</Typography>
          </>
        )}
      </Box>
      <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)', lineHeight: 1.6, display: 'block' }}>
        💳 You will be redirected to Razorpay to complete payment. Your booking is confirmed only after payment.
      </Typography>
    </Box>
  );
}

// ─── Main drawer ──────────────────────────────────────────────────────────────
function ConsultationBooking({ open, onClose, lawyer }) {
  const { t } = useTranslation();
  const muiTheme = useTheme();
  const prefersReducedMotion = useReducedMotion();
  const user = useSelector(selectUser);
  const documents = useSelector(selectDocuments);

  const supportedModes = lawyer?.consultationModes?.length ? lawyer.consultationModes : ['chat'];

  const [step, setStep] = useState(0);
  const [mode, setMode] = useState(supportedModes[0]);

  useEffect(() => {
    if (open) setMode(supportedModes[0]);
  }, [open, lawyer?.id]);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [notes, setNotes] = useState('');
  const [documentId, setDocumentId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [currentFee, setCurrentFee] = useState(null);
  const [feeLoading, setFeeLoading] = useState(false);

  const STEPS = ['Mode', 'Date & Time', 'Notes', 'Payment'];

  const reset = () => {
    setStep(0); setMode(supportedModes[0]); setDate(''); setTime(''); setNotes('');
    setDocumentId(''); setError(''); setLoading(false); setConfirmed(false); setCurrentFee(null);
  };

  // Re-fetch the lawyer's current fee right before showing the payment summary —
  // the `lawyer` prop is whatever was cached from search results, which can be
  // stale if the lawyer changed their fee since. The order itself is always
  // priced server-side; this just keeps what's displayed in sync with it.
  const lawyerId = lawyer?.id || lawyer?._id;
  useEffect(() => {
    if (step !== 3 || !lawyerId) return;
    setFeeLoading(true);
    api.get(`/lawyers/${lawyerId}`)
      .then(({ data }) => setCurrentFee(typeof data.consultationFee === 'number' ? data.consultationFee : null))
      .catch(() => setCurrentFee(null))
      .finally(() => setFeeLoading(false));
  }, [step, lawyerId]);

  const handleClose = () => { reset(); onClose(); };

  const canNext = () => {
    if (step === 0) return !!mode;
    if (step === 1) return !!date && !!time;
    return true;
  };

  const handleNext = () => {
    if (step < 3) setStep((s) => s + 1);
  };

  const handlePay = async () => {
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/consultations', {
        lawyerId: lawyer.id || lawyer._id,
        mode,
        scheduledAt: time,
        notes,
        ...(documentId ? { documentId } : {}),
      });

      openCheckout({
        orderId: data.paymentOrder.orderId,
        amount: data.paymentOrder.amount,
        currency: 'INR',
        key: data.paymentOrder.keyId,
        name: 'NyayaSetu',
        description: `Consultation with ${lawyer.name}`,
        prefill: { name: user?.name, contact: user?.phone, email: user?.email },
        onSuccess: async (resp) => {
          await api.post('/payments/verify', {
            orderId: resp.razorpay_order_id,
            paymentId: resp.razorpay_payment_id,
            signature: resp.razorpay_signature,
            consultationId: data.consultationId,
          });
          setConfirmed(true);
          setLoading(false);
        },
        onDismiss: () => setLoading(false),
      });
    } catch (err) {
      setError(err.response?.data?.error || 'Booking failed. Please try again.');
      setLoading(false);
    }
  };

  const fee = currentFee ?? lawyer?.consultationFee ?? 0;

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={handleClose}
      PaperProps={{
        sx: {
          width: { xs: '100vw', sm: 440 },
          borderRadius: { sm: `${RADIUS.xl}px 0 0 ${RADIUS.xl}px` },
          background: 'var(--color-surface)',
          border: 'none',
          boxShadow: SHADOWS.xl,
        },
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Header */}
        <Box sx={{ px: 3, py: 2.5, borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <GradientHeading variant="h6" sx={{ fontFamily: TYPOGRAPHY.fontFamily.display, fontWeight: 700 }}>
              📅 {t('lawyer.booking_title', 'Book Consultation')}
            </GradientHeading>
            {lawyer && <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)' }}>with {lawyer.name}</Typography>}
          </Box>
          <IconButton onClick={handleClose} sx={{ color: 'var(--color-text-secondary)' }}>✕</IconButton>
        </Box>

        {!confirmed ? (
          <>
            {/* Step indicator */}
            <Box sx={{ px: 3, pt: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
                {STEPS.map((s, i) => (
                  <Typography key={s} variant="caption" sx={{
                    fontWeight: i === step ? 700 : 400,
                    color: i <= step ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                    display: { xs: i === step ? 'block' : 'none', sm: 'block' },
                  }}>
                    {i < step ? '✓ ' : `${i + 1}. `}{s}
                  </Typography>
                ))}
              </Box>
              <LinearProgress variant="determinate" value={((step + 1) / STEPS.length) * 100}
                sx={{ height: 4, borderRadius: 2, background: 'var(--color-border)', '& .MuiLinearProgress-bar': { background: 'var(--color-primary)', borderRadius: 2 } }} />
            </Box>

            {/* Step content */}
            <Box sx={{ flex: 1, overflowY: 'auto', px: 3, py: 2.5 }}>
              <AnimatePresence mode="wait">
                <motion.div
                  key={step}
                  initial={prefersReducedMotion ? false : { opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={prefersReducedMotion ? undefined : { opacity: 0, x: -24 }}
                  transition={{ duration: 0.28 }}
                >
                  {step === 0 && <Step1 mode={mode} onSelect={setMode} supportedModes={supportedModes} />}
                  {step === 1 && <Step2 lawyerId={lawyer?.id || lawyer?._id} date={date} setDate={setDate} time={time} setTime={setTime} />}
                  {step === 2 && <Step3 notes={notes} setNotes={setNotes} documentId={documentId} setDocumentId={setDocumentId} documents={documents} />}
                  {step === 3 && <Step4 lawyer={lawyer} mode={mode} date={date} time={time} notes={notes} fee={fee} feeLoading={feeLoading} />}
                </motion.div>
              </AnimatePresence>
              {error && <Alert severity="error" sx={{ mt: 2, borderRadius: `${RADIUS.md}px` }} onClose={() => setError('')}>{error}</Alert>}
            </Box>

            {/* Footer */}
            <Box sx={{ px: 3, py: 2.5, borderTop: '1px solid var(--color-border)', display: 'flex', gap: 1.5 }}>
              {step > 0 && (
                <Button variant="outlined" onClick={() => setStep((s) => s - 1)} disabled={loading}
                  sx={{ flex: 1, borderRadius: `${RADIUS.md}px`, borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>
                  {t('common.back', 'Back')}
                </Button>
              )}
              {step < 3 ? (
                <Button variant="contained" onClick={handleNext} disabled={!canNext()}
                  sx={{
                    flex: 2, borderRadius: `${RADIUS.full}px`, fontWeight: 700,
                    background: muiTheme.custom?.gradientBrand || 'var(--color-primary)',
                    boxShadow: muiTheme.custom?.glowPrimary,
                  }}>
                  {t('common.continue', 'Continue')} →
                </Button>
              ) : (
                <Button variant="contained" onClick={handlePay} disabled={loading || feeLoading}
                  sx={{
                    flex: 2, borderRadius: `${RADIUS.full}px`, fontWeight: 700, py: 1.25,
                    background: muiTheme.custom?.gradientBrand || 'var(--color-primary)',
                    boxShadow: muiTheme.custom?.glowPrimary,
                  }}>
                  {loading || feeLoading ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : `💳 ${t('lawyer.pay', 'Pay')} ₹${Math.round(fee / 100)} & Confirm`}
                </Button>
              )}
            </Box>
          </>
        ) : (
          /* Confirmation screen */
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', px: 3, textAlign: 'center' }}>
            <motion.div
              initial={prefersReducedMotion ? false : { scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 280, damping: 20 }}
            >
              <Typography sx={{ fontSize: 72, mb: 2 }}>🎉</Typography>
            </motion.div>
            <GradientHeading variant="h5" sx={{ fontFamily: TYPOGRAPHY.fontFamily.display, fontWeight: 800, mb: 1 }}>
              {t('lawyer.confirmed', 'Consultation Booked!')}
            </GradientHeading>
            <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)', mb: 3, lineHeight: 1.65, maxWidth: 300 }}>
              {mode === 'video'
                ? t('lawyer.confirmed_desc_video', `Your video consultation with ${lawyer?.name} is booked. Once the lawyer accepts, you'll receive a secure video link via WhatsApp and in-app notification.`, { lawyerName: lawyer?.name })
                : t('lawyer.confirmed_desc', `Your ${mode} consultation with ${lawyer?.name} has been confirmed. You will receive a WhatsApp reminder before the session.`, { mode, lawyerName: lawyer?.name })}
            </Typography>
            <Button variant="contained" onClick={handleClose}
              sx={{
                borderRadius: `${RADIUS.full}px`, fontWeight: 700, px: 4,
                background: muiTheme.custom?.gradientBrand || 'var(--color-primary)',
                boxShadow: muiTheme.custom?.glowPrimary,
              }}>
              {t('lawyer.done', 'Done')}
            </Button>
          </Box>
        )}
      </Box>
    </Drawer>
  );
}

export default ConsultationBooking;
