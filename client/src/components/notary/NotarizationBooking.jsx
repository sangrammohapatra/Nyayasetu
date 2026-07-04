/**
 * NotarizationBooking.jsx
 *
 * 2-step drawer for citizens to request notarization:
 *   Step 1 — Pick a notary
 *   Step 2 — Notes + optional courier address → submit (no payment here)
 *
 * Payment happens separately in DocumentPreview once the notary accepts.
 */

import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';

import Drawer from '@mui/material/Drawer';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import LinearProgress from '@mui/material/LinearProgress';
import Chip from '@mui/material/Chip';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';

import {
  createNotarizationRequest,
  clearPendingRequest,
  clearNotaryError,
  selectNotaryBookingLoading,
  selectNotaryBookingError,
} from '../../store/slices/notarySlice';
import { RADIUS, TYPOGRAPHY } from '../../theme/tokens';
import GradientHeading from '../ui/GradientHeading';
import NotarySearch from './NotarySearch';
import { NOTARIZATION_FEE_DISPLAY } from '../../constants/notarization';

const STEPS = ['Select Notary', 'Details'];

const slideVariants = {
  enter: (dir) => ({ x: dir > 0 ? 60 : -60, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir) => ({ x: dir < 0 ? 60 : -60, opacity: 0 }),
};

export default function NotarizationBooking({ open, onClose, document, onSuccess }) {
  const dispatch = useDispatch();
  const loading = useSelector(selectNotaryBookingLoading);
  const error = useSelector(selectNotaryBookingError);

  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [selectedNotary, setSelectedNotary] = useState(null);
  const [notes, setNotes] = useState('');
  const [wantCourier, setWantCourier] = useState(false);
  const [courierAddress, setCourierAddress] = useState({
    name: '', line1: '', line2: '', city: '', state: '', pincode: '', phone: '',
  });
  const [done, setDone] = useState(false);

  const goTo = (next) => {
    setDir(next > step ? 1 : -1);
    setStep(next);
  };

  const handleClose = () => {
    if (!loading) {
      setStep(0); setSelectedNotary(null); setNotes('');
      setWantCourier(false); setDone(false);
      dispatch(clearPendingRequest());
      dispatch(clearNotaryError());
      onClose();
    }
  };

  const handleSubmit = async () => {
    const result = await dispatch(createNotarizationRequest({
      notaryId: selectedNotary._id,
      documentId: document._id,
      notes: notes.trim() || undefined,
      courierRequested: wantCourier,
      courierAddress: wantCourier ? courierAddress : undefined,
    }));

    if (result.meta?.requestStatus === 'fulfilled') {
      setDone(true);
      onSuccess && onSuccess();
    }
  };

  const canProceedStep1 = !!selectedNotary;
  const canSubmit = !wantCourier || (
    courierAddress.name && courierAddress.line1 && courierAddress.city &&
    courierAddress.state && courierAddress.pincode && courierAddress.phone
  );

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={handleClose}
      PaperProps={{
        sx: {
          width: { xs: '100vw', sm: 420 },
          background: 'var(--color-bg)',
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      {/* Header */}
      <Box sx={{
        px: 2.5, py: 2,
        borderBottom: '1px solid var(--color-border)',
        display: 'flex', alignItems: 'center', gap: 1.5,
      }}>
        <Box onClick={handleClose} sx={{ cursor: 'pointer', color: 'var(--color-text-secondary)', fontSize: '1.1rem', lineHeight: 1 }}>←</Box>
        <Box sx={{ flex: 1 }}>
          <GradientHeading variant="h6" sx={{ fontFamily: TYPOGRAPHY.fontFamily.display, fontWeight: 700, fontSize: '1rem' }}>
            🔏 Request Notarization
          </GradientHeading>
          <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)' }}>
            {document?.title}
          </Typography>
        </Box>
      </Box>

      {/* Step indicator */}
      <Box sx={{ px: 2.5, pt: 2, pb: 1 }}>
        <Box sx={{ display: 'flex', gap: 1, mb: 1.5 }}>
          {STEPS.map((label, i) => (
            <Box key={i} sx={{ flex: 1, textAlign: 'center' }}>
              <Box sx={{
                height: 3, borderRadius: 2, mb: 0.5,
                background: i <= step ? 'var(--color-primary)' : 'var(--color-border)',
                transition: 'background 0.3s',
              }} />
              <Typography variant="caption" sx={{
                fontWeight: i === step ? 700 : 400,
                color: i === step ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                fontSize: '0.68rem',
              }}>
                {label}
              </Typography>
            </Box>
          ))}
        </Box>
        {loading && <LinearProgress sx={{ borderRadius: 4, height: 2, mb: 1 }} />}
      </Box>

      {/* Step content */}
      <Box sx={{ flex: 1, overflowY: 'auto', px: 2.5, pb: 3 }}>
        {done ? (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <Typography sx={{ fontSize: 56, mb: 2 }}>📬</Typography>
            <Typography variant="h6" sx={{ fontWeight: 700, color: 'var(--color-text)', mb: 1 }}>
              Request Sent!
            </Typography>
            <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)', mb: 3, lineHeight: 1.6 }}>
              Your request has been sent to <strong>{selectedNotary?.user?.name}</strong>.
              Once they accept, you'll be prompted to pay <strong>{NOTARIZATION_FEE_DISPLAY}</strong> to proceed.
            </Typography>
            <Chip
              label="📋 Awaiting notary acceptance"
              sx={{ background: 'rgba(237,108,2,0.1)', color: '#ed6c02', fontWeight: 700, mb: 2 }}
            />
            <br />
            <Button
              variant="contained" onClick={handleClose}
              sx={{ mt: 1, borderRadius: `${RADIUS.md}px`, fontWeight: 700, background: 'var(--color-primary)' }}
            >
              Done
            </Button>
          </Box>
        ) : (
          <AnimatePresence mode="wait" custom={dir}>
            <motion.div
              key={step}
              custom={dir}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.22 }}
            >
              {step === 0 && (
                <NotarySearch selectedNotary={selectedNotary} onSelect={setSelectedNotary} />
              )}

              {step === 1 && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {/* Selected notary summary */}
                  <Box sx={{
                    p: 1.5, borderRadius: `${RADIUS.lg}px`,
                    background: 'var(--color-primary-alpha)', border: '1.5px solid var(--color-primary)',
                    display: 'flex', alignItems: 'center', gap: 1.5,
                  }}>
                    <Typography sx={{ fontSize: 20 }}>⚖️</Typography>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 700, color: 'var(--color-text)' }}>
                        {selectedNotary?.user?.name}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)' }}>
                        {selectedNotary?.registrationState} • {selectedNotary?.experience} yrs exp
                      </Typography>
                    </Box>
                    <Chip label={NOTARIZATION_FEE_DISPLAY} size="small" sx={{ ml: 'auto', fontWeight: 800, color: 'var(--color-primary)', background: 'transparent', border: '1.5px solid var(--color-primary)' }} />
                  </Box>

                  {/* How it works */}
                  <Box sx={{
                    p: 1.5, borderRadius: `${RADIUS.md}px`,
                    background: 'rgba(2,136,209,0.07)', border: '1px solid rgba(2,136,209,0.2)',
                  }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: '#0288d1', display: 'block', mb: 0.5 }}>
                      How it works
                    </Typography>
                    {[
                      '1. You send this request (free)',
                      '2. Notary reviews and accepts',
                      `3. You pay ${NOTARIZATION_FEE_DISPLAY} to confirm`,
                      '4. Video KYC session is scheduled',
                      '5. Notarized PDF delivered',
                    ].map((s) => (
                      <Typography key={s} variant="caption" sx={{ color: 'var(--color-text-secondary)', display: 'block', lineHeight: 1.8 }}>
                        {s}
                      </Typography>
                    ))}
                  </Box>

                  <TextField
                    multiline rows={3} label="Notes for the notary (optional)"
                    value={notes} onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g., This is a property sale agreement for my home in Delhi..."
                    inputProps={{ maxLength: 1000 }}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: `${RADIUS.md}px` } }}
                  />

                  <FormControlLabel
                    control={<Switch checked={wantCourier} onChange={(e) => setWantCourier(e.target.checked)} />}
                    label={
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>Request physical copy via courier</Typography>
                        <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)' }}>
                          Original dispatched to your address (courier charges apply separately)
                        </Typography>
                      </Box>
                    }
                  />

                  {wantCourier && (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                      <Typography variant="body2" sx={{ fontWeight: 700, color: 'var(--color-text)' }}>
                        📦 Delivery Address
                      </Typography>
                      {[
                        { key: 'name',    label: 'Full Name' },
                        { key: 'line1',   label: 'Address Line 1' },
                        { key: 'line2',   label: 'Address Line 2 (Apartment, Floor, etc.)', required: false },
                        { key: 'city',    label: 'City' },
                        { key: 'state',   label: 'State' },
                        { key: 'pincode', label: 'PIN Code' },
                        { key: 'phone',   label: 'Mobile Number' },
                      ].map(({ key, label, required: req = true }) => (
                        <TextField
                          key={key} size="small" label={label} required={req}
                          value={courierAddress[key]}
                          onChange={(e) => setCourierAddress((a) => ({ ...a, [key]: e.target.value }))}
                          sx={{ '& .MuiOutlinedInput-root': { borderRadius: `${RADIUS.md}px` } }}
                        />
                      ))}
                    </Box>
                  )}

                  {error && (
                    <Alert severity="error" sx={{ borderRadius: `${RADIUS.md}px` }}>{error}</Alert>
                  )}
                </Box>
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </Box>

      {/* Footer CTA */}
      {!done && (
        <Box sx={{
          px: 2.5, py: 2,
          borderTop: '1px solid var(--color-border)',
          display: 'flex', gap: 1.25,
        }}>
          {step > 0 && (
            <Button
              variant="outlined" onClick={() => goTo(0)}
              disabled={loading}
              sx={{ flex: 1, borderRadius: `${RADIUS.md}px`, fontWeight: 600,
                borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
            >
              Back
            </Button>
          )}

          {step === 0 ? (
            <Button
              variant="contained" fullWidth
              onClick={() => goTo(1)}
              disabled={!canProceedStep1}
              sx={{
                borderRadius: `${RADIUS.md}px`, fontWeight: 700,
                background: 'var(--color-primary)',
                '&.Mui-disabled': { opacity: 0.5 },
              }}
            >
              Continue
            </Button>
          ) : (
            <Button
              variant="contained"
              onClick={handleSubmit}
              disabled={loading || !canSubmit}
              startIcon={loading ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : null}
              sx={{
                flex: 2,
                borderRadius: `${RADIUS.md}px`, fontWeight: 700,
                background: 'linear-gradient(135deg, #1A237E 0%, #283593 100%)',
                '&:hover': { background: 'linear-gradient(135deg, #0d1b6e 0%, #1a237e 100%)' },
                '&.Mui-disabled': { opacity: 0.6 },
              }}
            >
              {loading ? 'Sending…' : 'Send Request'}
            </Button>
          )}
        </Box>
      )}
    </Drawer>
  );
}
