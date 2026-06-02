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
import { motion, AnimatePresence } from 'framer-motion';

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
import { RADIUS, SHADOWS } from '../../theme/tokens';

// ─── Mode options ─────────────────────────────────────────────────────────────

const MODES = [
  { id: 'chat',      icon: '💬', label: 'Online Chat',   desc: 'Text chat via platform' },
  { id: 'video',     icon: '📹', label: 'Video Call',     desc: 'Zoom / Google Meet' },
  { id: 'phone',     icon: '📞', label: 'Phone Call',     desc: 'Direct call' },
  { id: 'in_person', icon: '🏛️', label: 'In Person',     desc: 'Visit the chamber' },
];

// ─── Time slots (generated) ───────────────────────────────────────────────────

function generateSlots(dateStr) {
  const slots = [];
  const base = new Date(dateStr);
  for (let h = 9; h <= 17; h++) {
    for (let m = 0; m < 60; m += 30) {
      const d = new Date(base);
      d.setHours(h, m, 0, 0);
      if (d > new Date()) slots.push(d);
    }
  }
  return slots;
}

// ─── Steps ────────────────────────────────────────────────────────────────────

function Step1({ mode, onSelect }) {
  const { t } = useTranslation();
  return (
    <Box>
      <Typography variant="body1" sx={{ fontWeight: 700, color: 'var(--color-text)', mb: 1.75 }}>
        {t('lawyer.select_mode', 'How would you like to consult?')}
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
        {MODES.map((m) => (
          <motion.div key={m.id} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
            <Box onClick={() => onSelect(m.id)} sx={{
              display: 'flex', alignItems: 'center', gap: 2, p: 1.75,
              borderRadius: `${RADIUS.lg}px`,
              border: mode === m.id ? '2px solid var(--color-primary)' : '1.5px solid var(--color-border)',
              background: mode === m.id ? 'var(--color-primary-alpha)' : 'var(--color-surface)',
              cursor: 'pointer', transition: 'all 0.18s',
            }}>
              <Typography sx={{ fontSize: 24, lineHeight: 1 }}>{m.icon}</Typography>
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 700, color: mode === m.id ? 'var(--color-primary)' : 'var(--color-text)' }}>
                  {m.label}
                </Typography>
                <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)' }}>{m.desc}</Typography>
              </Box>
              {mode === m.id && <Typography sx={{ ml: 'auto', color: 'var(--color-primary)', fontSize: 18 }}>✓</Typography>}
            </Box>
          </motion.div>
        ))}
      </Box>
    </Box>
  );
}

function Step2({ date, setDate, time, setTime }) {
  const { t } = useTranslation();
  const today = new Date().toISOString().split('T')[0];
  const slots = date ? generateSlots(date) : [];

  return (
    <Box>
      <Typography variant="body1" sx={{ fontWeight: 700, color: 'var(--color-text)', mb: 1.75 }}>
        {t('lawyer.select_date_time', 'Choose a date and time')}
      </Typography>
      <TextField type="date" fullWidth label={t('lawyer.date', 'Date')} value={date}
        onChange={(e) => { setDate(e.target.value); setTime(''); }}
        inputProps={{ min: today }}
        sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: `${RADIUS.md}px` } }}
        InputLabelProps={{ shrink: true }}
      />
      {date && (
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 600, color: 'var(--color-text)', mb: 1.25 }}>
            {t('lawyer.available_slots', 'Available Slots')}
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
            {slots.map((slot) => {
              const val = slot.toISOString();
              const label = slot.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
              const isActive = time === val;
              return (
                <Chip key={val} label={label} size="small" clickable onClick={() => setTime(val)}
                  sx={{
                    fontWeight: isActive ? 700 : 500, height: 28, fontSize: '0.78rem',
                    background: isActive ? 'var(--color-primary)' : 'var(--color-surface)',
                    color: isActive ? '#fff' : 'var(--color-text)',
                    border: isActive ? 'none' : '1px solid var(--color-border)',
                    '&:hover': { background: isActive ? 'var(--color-primary)' : 'var(--color-overlay)' },
                  }} />
              );
            })}
          </Box>
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

function Step4({ lawyer, mode, date, time, notes, fee }) {
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
          { label: 'Fee', value: `₹${feeRupees}`, bold: true },
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
  const user = useSelector(selectUser);
  const documents = useSelector(selectDocuments);

  const [step, setStep] = useState(0);
  const [mode, setMode] = useState('chat');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [notes, setNotes] = useState('');
  const [documentId, setDocumentId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const STEPS = ['Mode', 'Date & Time', 'Notes', 'Payment'];

  const reset = () => {
    setStep(0); setMode('chat'); setDate(''); setTime(''); setNotes('');
    setDocumentId(''); setError(''); setLoading(false); setConfirmed(false);
  };

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
        scheduledAt: time || `${date}T10:00:00.000Z`,
        notes,
        ...(documentId ? { documentId } : {}),
      });

      openCheckout({
        orderId: data.paymentOrder.orderId,
        amount: data.paymentOrder.amount,
        currency: 'INR',
        name: 'NyayaSetu',
        description: `Consultation with ${lawyer.name}`,
        prefill: { name: user?.name, contact: user?.phone, email: user?.email },
        onSuccess: async (resp) => {
          await api.post('/payments/verify', {
            orderId: resp.razorpay_order_id,
            paymentId: resp.razorpay_payment_id,
            signature: resp.razorpay_signature,
            documentId: data.consultationId,
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

  const fee = lawyer?.consultationFee || 0;

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
            <Typography variant="h6" sx={{ fontFamily: "'Playfair Display',serif", fontWeight: 700, color: 'var(--color-text)' }}>
              📅 {t('lawyer.booking_title', 'Book Consultation')}
            </Typography>
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
                  initial={{ opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -24 }}
                  transition={{ duration: 0.28 }}
                >
                  {step === 0 && <Step1 mode={mode} onSelect={setMode} />}
                  {step === 1 && <Step2 date={date} setDate={setDate} time={time} setTime={setTime} />}
                  {step === 2 && <Step3 notes={notes} setNotes={setNotes} documentId={documentId} setDocumentId={setDocumentId} documents={documents} />}
                  {step === 3 && <Step4 lawyer={lawyer} mode={mode} date={date} time={time} notes={notes} fee={fee} />}
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
                  sx={{ flex: 2, borderRadius: `${RADIUS.md}px`, fontWeight: 700, background: 'var(--color-primary)' }}>
                  {t('common.continue', 'Continue')} →
                </Button>
              ) : (
                <Button variant="contained" onClick={handlePay} disabled={loading}
                  sx={{ flex: 2, borderRadius: `${RADIUS.md}px`, fontWeight: 700, background: 'var(--color-primary)', py: 1.25 }}>
                  {loading ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : `💳 ${t('lawyer.pay', 'Pay')} ₹${Math.round(fee / 100)} & Confirm`}
                </Button>
              )}
            </Box>
          </>
        ) : (
          /* Confirmation screen */
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', px: 3, textAlign: 'center' }}>
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 280, damping: 20 }}
            >
              <Typography sx={{ fontSize: 72, mb: 2 }}>🎉</Typography>
            </motion.div>
            <Typography variant="h5" sx={{ fontFamily: "'Playfair Display',serif", fontWeight: 800, color: 'var(--color-text)', mb: 1 }}>
              {t('lawyer.confirmed', 'Consultation Booked!')}
            </Typography>
            <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)', mb: 3, lineHeight: 1.65, maxWidth: 300 }}>
              {t('lawyer.confirmed_desc', `Your ${mode} consultation with ${lawyer?.name} has been confirmed. You will receive a WhatsApp reminder before the session.`, { mode, lawyerName: lawyer?.name })}
            </Typography>
            <Button variant="contained" onClick={handleClose}
              sx={{ borderRadius: `${RADIUS.md}px`, fontWeight: 700, background: 'var(--color-primary)', px: 4 }}>
              {t('lawyer.done', 'Done')}
            </Button>
          </Box>
        )}
      </Box>
    </Drawer>
  );
}

export default ConsultationBooking;
