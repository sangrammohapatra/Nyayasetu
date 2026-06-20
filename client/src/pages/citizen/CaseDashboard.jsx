/**
 * client/src/pages/citizen/CaseDashboard.jsx
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
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
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Collapse from '@mui/material/Collapse';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Skeleton from '@mui/material/Skeleton';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import Snackbar from '@mui/material/Snackbar';

import { useCaseTracker } from '../../hooks/useCaseTracker';
import AnimatedPage from '../../components/ui/AnimatedPage';
import GlassCard from '../../components/ui/GlassCard';
import GradientHeading from '../../components/ui/GradientHeading';
import HearingTimeline from '../../components/case/HearingTimeline';
import CNRInput, { CNR_REGEX } from '../../components/case/CNRInput';
import { RADIUS, SHADOWS, TYPOGRAPHY } from '../../theme/tokens';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function daysUntil(date) {
  if (!date) return null;
  return Math.ceil((new Date(date) - new Date()) / 86400000);
}

function isWithinDays(date, days) {
  const d = daysUntil(date);
  return d !== null && d >= 0 && d <= days;
}

const STATUS_MAP = {
  active:      { label: 'Active',      bg: 'rgba(46,125,50,0.1)',   color: 'var(--color-success)' },
  disposed:    { label: 'Disposed',    bg: 'var(--color-border)',    color: 'var(--color-text-secondary)' },
  transferred: { label: 'Transferred', bg: 'rgba(2,119,189,0.1)',   color: 'var(--color-info)' },
};

// ─── Add Case Modal ───────────────────────────────────────────────────────────

function AddCaseModal({ open, onClose, onAdd }) {
  const { t } = useTranslation();
  const [cnr, setCnr] = useState('');
  const [alertWhatsapp, setAlertWhatsapp] = useState(true);
  const [alertEmail, setAlertEmail] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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

// ─── Case Card ────────────────────────────────────────────────────────────────

function CaseCardSkeleton() {
  return (
    <Box sx={{ p: 2.5, borderRadius: `${RADIUS.lg}px`, border: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
        <Skeleton variant="text" width="60%" height={22} />
        <Skeleton variant="rounded" width={60} height={20} />
      </Box>
      <Skeleton variant="text" width="40%" height={16} />
      <Skeleton variant="text" width="75%" height={32} sx={{ mt: 1.5 }} />
      <Box sx={{ display: 'flex', gap: 1, mt: 1.5 }}>
        <Skeleton variant="rounded" width={50} height={22} />
        <Skeleton variant="rounded" width={50} height={22} />
      </Box>
    </Box>
  );
}

function CaseCard({ caseData, onRefresh, onDelete, onUpdateAlerts }) {
  const { t } = useTranslation();
  const prefersReducedMotion = useReducedMotion();
  const [expanded, setExpanded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [remindSnack, setRemindSnack] = useState(null); // 'success' | 'error' | null

  const handleRemind = useCallback(async () => {
    try {
      await onUpdateAlerts(caseData._id, { alertsEnabled: true });
      setRemindSnack('success');
    } catch {
      setRemindSnack('error');
    }
  }, [caseData._id, onUpdateAlerts]);

  const statusStyle = STATUS_MAP[caseData.status?.toLowerCase()] || STATUS_MAP.active;
  const nextDate = caseData.nextHearingDate;
  const daysLeft = daysUntil(nextDate);
  const isUrgent = isWithinDays(nextDate, 7);

  const handleRefresh = async (e) => {
    e.stopPropagation();
    setRefreshing(true);
    await onRefresh(caseData._id);
    setRefreshing(false);
  };

  return (
    <motion.div
      layout
      initial={prefersReducedMotion ? false : { opacity: 0, y: 20, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={prefersReducedMotion ? undefined : { opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
    >
      <Box sx={{
        borderRadius: `${RADIUS.xl}px`,
        border: isUrgent ? '1.5px solid var(--color-warning)' : '1px solid var(--color-border)',
        background: 'var(--color-surface)',
        boxShadow: expanded ? SHADOWS.md : SHADOWS.sm,
        overflow: 'hidden',
        transition: 'box-shadow 0.25s',
      }}>
        {/* Urgent top strip */}
        {isUrgent && (
          <Box sx={{
            height: 3,
            background: 'linear-gradient(90deg, var(--color-warning), var(--color-error))',
          }} />
        )}

        {/* Card header — clickable to expand */}
        <Box
          onClick={() => setExpanded((v) => !v)}
          sx={{ p: 2.5, cursor: 'pointer', userSelect: 'none' }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
            <Box sx={{ flex: 1, minWidth: 0, pr: 1 }}>
              <Typography variant="body2" sx={{
                fontWeight: 700, color: 'var(--color-text)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {caseData.caseTitle || caseData.cnrNumber}
              </Typography>
              {caseData.court && (
                <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)' }}>
                  🏛️ {caseData.court}
                  {caseData.district && ` · ${caseData.district}`}
                </Typography>
              )}
            </Box>
            <Chip size="small" label={statusStyle.label}
              sx={{
                height: 20, fontSize: '0.67rem', fontWeight: 700,
                background: statusStyle.bg, color: statusStyle.color,
                flexShrink: 0,
              }} />
          </Box>

          {/* CNR */}
          <Typography sx={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '0.78rem', letterSpacing: '0.08em',
            color: 'var(--color-text-secondary)', mb: 1.25,
          }}>
            {caseData.cnrNumber}
          </Typography>

          {/* Next hearing */}
          {nextDate && (
            <Box sx={{
              p: 1.5, borderRadius: `${RADIUS.md}px`,
              background: isUrgent ? 'rgba(230,81,0,0.08)' : 'var(--color-primary-alpha)',
              border: `1px solid ${isUrgent ? 'var(--color-warning)' : 'var(--color-primary)'}`,
              mb: 1.5,
            }}>
              <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)', display: 'block' }}>
                {t('case.next_hearing', 'Next Hearing')}
              </Typography>
              <Typography variant="body1" sx={{
                fontWeight: 800,
                color: isUrgent ? 'var(--color-warning)' : 'var(--color-primary)',
                lineHeight: 1.2,
              }}>
                {new Date(nextDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', weekday: 'short' })}
              </Typography>
              {daysLeft !== null && daysLeft >= 0 && (
                <Typography variant="caption" sx={{ fontWeight: 600, color: isUrgent ? 'var(--color-warning)' : 'var(--color-text-secondary)' }}>
                  {daysLeft === 0 ? '🔴 Today!' : daysLeft === 1 ? '⚠️ Tomorrow!' : `in ${daysLeft} days`}
                </Typography>
              )}
            </Box>
          )}

          {/* Action row */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', gap: 0.75 }}>
              {caseData.alertChannels?.whatsapp && (
                <Tooltip title="WhatsApp alerts on"><Chip size="small" label="📱 WA" sx={{ height: 20, fontSize: '0.65rem', background: 'rgba(37,211,102,0.1)', color: '#25D366' }} /></Tooltip>
              )}
              {caseData.alertChannels?.email && (
                <Tooltip title="Email alerts on"><Chip size="small" label="📧" sx={{ height: 20, fontSize: '0.65rem', background: 'var(--color-primary-alpha)', color: 'var(--color-primary)' }} /></Tooltip>
              )}
            </Box>
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              <Tooltip title={t('case.refresh', 'Sync with eCourts')}>
                <IconButton size="small" onClick={handleRefresh} disabled={refreshing}
                  sx={{ color: 'var(--color-text-secondary)', '&:hover': { color: 'var(--color-primary)' } }}>
                  <motion.span
                    animate={prefersReducedMotion ? {} : refreshing ? { rotate: 360 } : {}}
                    transition={{ duration: 1, repeat: refreshing ? Infinity : 0, ease: 'linear' }}
                    style={{ display: 'inline-block', fontSize: 16 }}>
                    🔄
                  </motion.span>
                </IconButton>
              </Tooltip>
              <Tooltip title={t('case.delete', 'Remove')}>
                <IconButton size="small" onClick={(e) => { e.stopPropagation(); onDelete(caseData._id); }}
                  sx={{ color: 'var(--color-error)', '&:hover': { background: 'var(--color-error-light, #FFEBEE)' } }}>
                  🗑
                </IconButton>
              </Tooltip>
              <Typography sx={{ fontSize: 14, color: 'var(--color-text-secondary)', ml: 0.5, mt: 0.25, transition: 'transform 0.25s', transform: expanded ? 'rotate(180deg)' : 'none' }}>
                ▾
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* Hearing timeline (expanded) */}
        <Collapse in={expanded} timeout={300}>
          <Box sx={{ px: 2.5, pb: 2.5, borderTop: '1px solid var(--color-border)', pt: 2 }}>
            <Typography variant="caption" sx={{ fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', mb: 1.5 }}>
              {t('case.hearing_history', 'Hearing Timeline')}
            </Typography>
            <HearingTimeline hearings={caseData.hearings || []} onRemind={handleRemind} />
          </Box>
        </Collapse>
      </Box>

      <Snackbar
        open={remindSnack !== null}
        autoHideDuration={3500}
        onClose={() => setRemindSnack(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={remindSnack === 'success' ? 'success' : 'error'}
          onClose={() => setRemindSnack(null)}
          sx={{ borderRadius: `${RADIUS.md}px` }}
        >
          {remindSnack === 'success'
            ? t('hearing.remind_set', '🔔 Reminder enabled — you\'ll be alerted before the hearing.')
            : t('hearing.remind_error', 'Failed to set reminder. Please try again.')}
        </Alert>
      </Snackbar>
    </motion.div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

function CaseDashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const prefersReducedMotion = useReducedMotion();

  const {
    cases, loading,
    caseLimit, casesTracked, atLimit, slotsRemaining,
    load, add, refresh, remove, updateAlerts, upgradeOrAdd,
  } = useCaseTracker();

  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => { load(); }, [load]);

  const handleModalClose = useCallback((added) => {
    setModalOpen(false);
    if (added) load();
  }, [load]);

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
                {cases.length} {t('case.tracked', 'cases tracked')}
                {slotsRemaining !== null && ` · ${slotsRemaining} ${t('case.remaining', 'slots remaining')}`}
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
              <Typography sx={{ fontSize: 52, mb: 2 }}>⚖️</Typography>
              <GradientHeading variant="h6" sx={{ fontFamily: TYPOGRAPHY.fontFamily.display, fontWeight: 700, mb: 1 }}>
                {t('case.empty', 'No cases tracked yet')}
              </GradientHeading>
              <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)', mb: 3, maxWidth: 300, mx: 'auto' }}>
                {t('case.empty_desc', 'Add your CNR number to start tracking your court hearings and get timely reminders.')}
              </Typography>
              <Button variant="contained" onClick={() => setModalOpen(true)}
                sx={{ borderRadius: `${RADIUS.md}px`, fontWeight: 700, background: 'var(--color-primary)' }}>
                {t('case.track_first', '+ Track Your First Case')}
              </Button>
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

        <AddCaseModal open={modalOpen} onClose={handleModalClose} onAdd={add} />
      </Box>
    </AnimatedPage>
  );
}

export default CaseDashboard;
