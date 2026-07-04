/**
 * client/src/pages/citizen/CaseDashboard.jsx
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import Chip from '@mui/material/Chip';

import { useCaseTracker } from '../../hooks/useCaseTracker';
import { selectUser } from '../../store/slices/authSlice';
import AnimatedPage from '../../components/ui/AnimatedPage';
import GradientHeading from '../../components/ui/GradientHeading';
import CNRInput, { CNR_REGEX } from '../../components/case/CNRInput';
import CaseCard, { CaseCardSkeleton } from '../../components/case/CaseCard';
import { RADIUS, TYPOGRAPHY } from '../../theme/tokens';

// ─── Add Case Modal ──────────────────────────────────────────────────────────

function AddCaseModal({ open, onClose, onAdd, whatsappOptIn }) {
  const { t } = useTranslation();
  const [cnr, setCnr] = useState('');
  const [alertWhatsapp, setAlertWhatsapp] = useState(!!whatsappOptIn);
  const [alertEmail, setAlertEmail] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Re-sync the default to the user's actual opt-in each time the modal
  // opens, rather than always pre-checking WhatsApp regardless of consent.
  useEffect(() => {
    if (open) setAlertWhatsapp(!!whatsappOptIn);
  }, [open, whatsappOptIn]);

  const handleSubmit = async () => {
    if (!CNR_REGEX.test(cnr)) {
      setError(t('case.invalid_cnr', 'Please enter a valid 16-character CNR number.'));
      return;
    }
    setError('');
    setLoading(true);
    try {
      const result = await onAdd({
        cnrNumber: cnr,
        alertChannels: { whatsapp: alertWhatsapp, email: alertEmail },
      });
      if (result.meta.requestStatus === 'fulfilled') {
        onClose(true);
        setCnr('');
      } else {
        setError(result.payload || t('case.fetch_error', 'Could not fetch case from eCourts. Please check the CNR.'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={() => onClose(false)} maxWidth="sm" fullWidth
      PaperProps={{
        sx: {
          borderRadius: `${RADIUS.xl}px`,
          border: '1px solid var(--color-border)',
          background: 'var(--color-surface)',
        },
      }}
    >
      <DialogTitle sx={{ fontFamily: "'Playfair Display',serif", fontWeight: 700, color: 'var(--color-text)' }}>
        ⚖️ {t('case.add_case', 'Track a New Case')}
      </DialogTitle>
      <DialogContent sx={{ pt: 1 }}>
        <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)', mb: 2.5 }}>
          {t('case.add_case_desc', 'Enter the CNR number from your court notice to start tracking hearings.')}
        </Typography>

        <CNRInput value={cnr} onChange={setCnr} disabled={loading} autoFocus />

        <Box sx={{ mt: 2.5 }}>
          <Typography variant="body2" sx={{ fontWeight: 600, color: 'var(--color-text)', mb: 1 }}>
            {t('case.alert_channels', 'Hearing Reminder Channels')}
          </Typography>
          <Box sx={{ display: 'flex', gap: 3 }}>
            <FormControlLabel
              control={
                <Switch checked={alertWhatsapp} onChange={(e) => setAlertWhatsapp(e.target.checked)}
                  sx={{ '& .MuiSwitch-thumb': { background: 'var(--color-primary)' } }} />
              }
              label={<Typography variant="body2">📱 WhatsApp</Typography>}
            />
            <FormControlLabel
              control={
                <Switch checked={alertEmail} onChange={(e) => setAlertEmail(e.target.checked)}
                  sx={{ '& .MuiSwitch-thumb': { background: 'var(--color-primary)' } }} />
              }
              label={<Typography variant="body2">📧 Email</Typography>}
            />
          </Box>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mt: 2, borderRadius: `${RADIUS.md}px` }}>
            {error}
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3, gap: 1.5 }}>
        <Button onClick={() => onClose(false)} disabled={loading}
          sx={{ borderRadius: `${RADIUS.md}px`, color: 'var(--color-text-secondary)' }}>
          {t('common.cancel', 'Cancel')}
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={loading || cnr.length < 16}
          sx={{
            borderRadius: `${RADIUS.md}px`, fontWeight: 700,
            background: 'var(--color-primary)', minWidth: 140,
            '&:hover': { background: 'var(--color-primary-dark, var(--color-primary))' },
          }}
        >
          {loading
            ? <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CircularProgress size={16} sx={{ color: '#fff' }} />
                {t('case.fetching', 'Fetching…')}
              </Box>
            : t('case.track_case', 'Track Case')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

function CaseDashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const prefersReducedMotion = useReducedMotion();
  const user = useSelector(selectUser);

  const {
    cases, loading,
    caseLimit, casesTracked, atLimit, slotsRemaining, disposedCount,
    load, add, refresh, remove, updateAlerts, upgradeOrAdd,
  } = useCaseTracker();

  const [modalOpen, setModalOpen] = useState(false);
  const [view, setView] = useState('active'); // 'active' | 'disposed'

  useEffect(() => {
    load({ caseStatus: view === 'disposed' ? 'disposed' : undefined });
  }, [load, view]);

  const handleModalClose = useCallback((added) => {
    setModalOpen(false);
    if (added) load({ caseStatus: view === 'disposed' ? 'disposed' : undefined });
  }, [load, view]);

  const handleDelete = useCallback(
    (id) => remove(id, t('case.confirm_delete', 'Remove this case from tracking?')),
    [remove, t],
  );

  return (
    <AnimatedPage>
      <Box sx={{ p: { xs: 2, sm: 3, md: 4 }, maxWidth: 1000, mx: 'auto', pb: { xs: 10, md: 4 } }}>
        {/* Header */}
        <motion.div initial={prefersReducedMotion ? false : { opacity: 0, y: -14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.38 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
            <Box>
              <GradientHeading variant="h4" sx={{ fontFamily: TYPOGRAPHY.fontFamily.display, fontWeight: 700 }}>
                {t('case.title', 'My Court Cases')}
              </GradientHeading>
              <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)', mt: 0.25 }}>
                {cases.length} {view === 'disposed' ? t('case.archived', 'archived cases') : t('case.tracked', 'cases tracked')}
                {view === 'active' && slotsRemaining !== null && ` · ${slotsRemaining} ${t('case.remaining', 'slots remaining')}`}
              </Typography>
            </Box>
            <Button
              variant="contained"
              onClick={() => upgradeOrAdd(() => setModalOpen(true))}
              sx={{
                borderRadius: `${RADIUS.md}px`, fontWeight: 700,
                background: atLimit ? 'var(--color-warning)' : 'var(--color-primary)',
                '&:hover': { background: atLimit ? 'var(--color-warning)' : 'var(--color-primary-dark, var(--color-primary))' },
              }}
            >
              {atLimit ? '🔒 Upgrade' : `+ ${t('case.add_case', 'Add Case')}`}
            </Button>
          </Box>
        </motion.div>

        {/* Active / Archived toggle */}
        <Box sx={{ display: 'flex', gap: 1, mb: 2.5 }}>
          <Chip
            label={t('case.view_active', 'Active')}
            onClick={() => setView('active')}
            variant={view === 'active' ? 'filled' : 'outlined'}
            sx={{
              fontWeight: 700,
              borderRadius: `${RADIUS.md}px`,
              background: view === 'active' ? 'var(--color-primary)' : 'transparent',
              color: view === 'active' ? '#fff' : 'var(--color-text-secondary)',
              borderColor: 'var(--color-border)',
            }}
          />
          <Chip
            label={`${t('case.view_archived', 'Archived')}${disposedCount ? ` (${disposedCount})` : ''}`}
            onClick={() => setView('disposed')}
            variant={view === 'disposed' ? 'filled' : 'outlined'}
            sx={{
              fontWeight: 700,
              borderRadius: `${RADIUS.md}px`,
              background: view === 'disposed' ? 'var(--color-primary)' : 'transparent',
              color: view === 'disposed' ? '#fff' : 'var(--color-text-secondary)',
              borderColor: 'var(--color-border)',
            }}
          />
        </Box>

        {/* Upgrade banner */}
        <AnimatePresence>
          {atLimit && (
            <motion.div
              initial={prefersReducedMotion ? false : { opacity: 0, y: -8, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={prefersReducedMotion ? undefined : { opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Alert
                severity="warning"
                action={
                  <Button size="small" onClick={() => navigate('/pricing')}
                    sx={{ fontWeight: 700, color: 'var(--color-warning)' }}>
                    {t('case.upgrade', 'Upgrade')}
                  </Button>
                }
                sx={{ mb: 2.5, borderRadius: `${RADIUS.lg}px`, border: '1px solid var(--color-warning)' }}
              >
                {t('case.limit_reached', 'You\'ve reached your case tracking limit. Upgrade to Basic (₹99/mo) to track up to 5 cases.')}
              </Alert>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Case grid */}
        {loading && cases.length === 0 ? (
          <Grid container spacing={2}>
            {Array.from({ length: 3 }).map((_, i) => (
              <Grid item xs={12} sm={6} key={i}><CaseCardSkeleton /></Grid>
            ))}
          </Grid>
        ) : cases.length === 0 ? (
          <motion.div initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Box sx={{
              textAlign: 'center', py: 8,
              borderRadius: `${RADIUS.xl}px`,
              border: '2px dashed var(--color-border)',
              background: 'var(--color-surface)',
            }}>
              <Typography sx={{ fontSize: 52, mb: 2 }}>{view === 'disposed' ? '🗄️' : '⚖️'}</Typography>
              <GradientHeading variant="h6" sx={{ fontFamily: TYPOGRAPHY.fontFamily.display, fontWeight: 700, mb: 1 }}>
                {view === 'disposed'
                  ? t('case.empty_archived', 'No archived cases')
                  : t('case.empty', 'No cases tracked yet')}
              </GradientHeading>
              <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)', mb: 3, maxWidth: 300, mx: 'auto' }}>
                {view === 'disposed'
                  ? t('case.empty_archived_desc', 'Cases move here automatically once the court marks them disposed.')
                  : t('case.empty_desc', 'Add your CNR number to start tracking your court hearings and get timely reminders.')}
              </Typography>
              {view === 'active' && (
                <Button variant="contained" onClick={() => setModalOpen(true)}
                  sx={{ borderRadius: `${RADIUS.md}px`, fontWeight: 700, background: 'var(--color-primary)' }}>
                  {t('case.track_first', '+ Track Your First Case')}
                </Button>
              )}
            </Box>
          </motion.div>
        ) : (
          <Grid container spacing={2}>
            <AnimatePresence>
              {cases.map((c) => (
                <Grid item xs={12} sm={6} key={c._id}>
                  <CaseCard caseData={c} onRefresh={refresh} onDelete={handleDelete} onUpdateAlerts={updateAlerts} />
                </Grid>
              ))}
            </AnimatePresence>
          </Grid>
        )}

        <AddCaseModal open={modalOpen} onClose={handleModalClose} onAdd={add} whatsappOptIn={user?.whatsappOptIn} />
      </Box>
    </AnimatedPage>
  );
}

export default CaseDashboard;
