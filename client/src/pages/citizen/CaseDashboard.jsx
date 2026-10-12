/**
 * client/src/pages/citizen/CaseDashboard.jsx
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
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
import CircularProgress from '@mui/material/CircularProgress';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import Chip from '@mui/material/Chip';

import { useCaseTracker } from '../../hooks/useCaseTracker';
import { selectUser, selectUserPersona } from '../../store/slices/authSlice';
import { pushSnackbar } from '../../store/slices/uiSlice';
import { useNotificationFocus } from '../../utils/notificationRoutes';
import AnimatedPage from '../../components/ui/AnimatedPage';
import GradientHeading from '../../components/ui/GradientHeading';
import CNRInput, { CNR_REGEX } from '../../components/case/CNRInput';
import CaseCard, { CaseCardSkeleton } from '../../components/case/CaseCard';
import ShareCaseDialog from '../../components/case/ShareCaseDialog';
import { RADIUS, TYPOGRAPHY } from '../../theme/tokens';

// ─── Add Case Modal ──────────────────────────────────────────────────────────

function noticeText(t, notice) {
  if (notice?.code === 'CNR_NOT_FOUND') {
    return t('case.cnr_not_found', 'No case data was found for CNR {{cnr}}.', { cnr: notice.cnr });
  }
  if (notice?.code === 'MOCK_DATA') {
    return t('case.mock_data_info', 'Showing mock data. This is sample data for development, not a real court record.');
  }
  return notice?.message || '';
}

function toastNotices(dispatch, t, notices) {
  (notices || []).forEach((notice) => {
    dispatch(pushSnackbar({
      message: noticeText(t, notice),
      severity: notice.type === 'error' ? 'error' : 'info',
      duration: 5500,
    }));
  });
}

function AddCaseModal({ open, onClose, onAdd, whatsappOptIn }) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const [cnr, setCnr] = useState('');
  const [alertWhatsapp, setAlertWhatsapp] = useState(!!whatsappOptIn);
  const [alertEmail, setAlertEmail] = useState(false);
  const [loading, setLoading] = useState(false);

  // Re-sync the default to the user's actual opt-in each time the modal
  // opens, rather than always pre-checking WhatsApp regardless of consent.
  useEffect(() => {
    if (open) setAlertWhatsapp(!!whatsappOptIn);
  }, [open, whatsappOptIn]);

  const handleSubmit = async () => {
    if (!CNR_REGEX.test(cnr)) {
      dispatch(pushSnackbar({
        message: t('case.invalid_cnr', 'Please enter a valid 16-character CNR number.'),
        severity: 'error',
      }));
      return;
    }
    setLoading(true);
    try {
      const result = await onAdd({
        cnrNumber: cnr,
        alertChannels: { whatsapp: alertWhatsapp, email: alertEmail },
      });
      if (result.meta.requestStatus === 'fulfilled') {
        if (result.payload?._isMock && result.payload.notices?.length) {
          toastNotices(dispatch, t, result.payload.notices);
        } else if (result.payload?.restored || result.payload?.inArchive) {
          dispatch(pushSnackbar({
            message: result.payload.message,
            severity: result.payload.inArchive ? 'info' : 'success',
          }));
        }
        onClose(true, { switchToArchive: !!result.payload?.inArchive });
        setCnr('');
      } else {
        dispatch(pushSnackbar({
          message: result.payload || t('case.fetch_error', 'Could not fetch case from eCourts. Please check the CNR.'),
          severity: 'error',
        }));
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

function CaseDashboard({ embedded = false }) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const prefersReducedMotion = useReducedMotion();
  const user = useSelector(selectUser);
  const isLawyer = useSelector(selectUserPersona) === 'lawyer';

  const {
    cases, loading,
    atLimit, slotsRemaining, disposedCount, activeCount,
    load, add, refresh, remove, archive, updateAlerts, upgradeOrAdd,
  } = useCaseTracker();

  const [modalOpen, setModalOpen] = useState(false);
  const [shareTarget, setShareTarget] = useState(null);
  const [view, setView] = useState('active'); // 'active' | 'disposed'
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const toastedLimit = useRef(false);
  const focusCaseId = useNotificationFocus('case', !loading, cases.length);

  useEffect(() => {
    load(view === 'disposed' ? { archived: true } : undefined);
  }, [load, view]);

  useEffect(() => {
    if (!atLimit) {
      toastedLimit.current = false;
      return;
    }
    if (toastedLimit.current) return;
    toastedLimit.current = true;
    dispatch(pushSnackbar({
      message: isLawyer
        ? t('case.limit_reached_lawyer', 'You\'ve reached the free limit of 5 tracked cases. Upgrade to Professional for unlimited tracking.')
        : t('case.limit_reached', 'You\'ve reached your case tracking limit. Upgrade to Basic (₹99/mo) to track up to 5 cases.'),
      severity: 'warning',
      duration: 6000,
    }));
  }, [atLimit, isLawyer, dispatch, t]);

  const handleModalClose = useCallback((added, opts) => {
    setModalOpen(false);
    if (opts?.switchToArchive) {
      setView('disposed');
      return;
    }
    if (added) load(view === 'disposed' ? { archived: true } : undefined);
  }, [load, view]);

  const handleRefresh = useCallback(async (caseId) => {
    const result = await refresh(caseId);
    const notices = result?.payload?.notices;
    if (result?.meta?.requestStatus === 'fulfilled' && result.payload?._isMock && notices?.length) {
      toastNotices(dispatch, t, notices);
    } else if (result?.meta?.requestStatus === 'rejected') {
      dispatch(pushSnackbar({
        message: result.payload || t('case.fetch_error', 'Could not fetch case from eCourts. Please check the CNR.'),
        severity: 'error',
      }));
    }
    return result;
  }, [refresh, dispatch, t]);

  const requestDelete = useCallback((id) => setPendingDelete(id), []);

  const handleShared = useCallback((lawyerName) => {
    setShareTarget(null);
    dispatch(pushSnackbar({
      message: t('case.share_success', 'Case shared with {{name}}.', { name: lawyerName || t('case.lawyer_general', 'your lawyer') }),
      severity: 'success',
    }));
    load(view === 'disposed' ? { archived: true } : undefined);
  }, [dispatch, t, load, view]);

  const handleArchive = useCallback(async (id) => {
    const shouldArchive = view !== 'disposed';
    const result = await archive(id, shouldArchive);
    if (result?.meta?.requestStatus === 'rejected') {
      dispatch(pushSnackbar({
        message: result.payload || t('case.fetch_error', 'Could not update this case.'),
        severity: 'error',
      }));
      return;
    }
    dispatch(pushSnackbar({
      message: result.payload?.message || (shouldArchive
        ? t('case.archived_toast', 'Case moved to your archive.')
        : t('case.restored_toast', 'Case restored to your tracker.')),
      severity: 'success',
    }));
    load(view === 'disposed' ? { archived: true } : undefined);
  }, [archive, view, dispatch, t, load]);

  const confirmDelete = useCallback(async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      const result = await remove(pendingDelete);
      if (result?.meta?.requestStatus === 'rejected') {
        dispatch(pushSnackbar({
          message: result.payload || t('case.remove_error', 'Could not remove this case. Please try again.'),
          severity: 'error',
        }));
      } else {
        dispatch(pushSnackbar({
          message: t('case.removed', 'Case removed from tracking.'),
          severity: 'success',
        }));
      }
    } finally {
      setDeleting(false);
      setPendingDelete(null);
    }
  }, [pendingDelete, remove, dispatch, t]);

  const page = (
      <Box sx={embedded
        ? { pb: 1 }
        : { p: { xs: 2, sm: 3, md: 4 }, maxWidth: 1000, mx: 'auto', pb: { xs: 10, md: 4 } }}>
        {/* Header */}
        <motion.div initial={prefersReducedMotion ? false : { opacity: 0, y: -14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.38 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: embedded ? 2 : 3 }}>
            <Box>
              {!embedded && (
                <GradientHeading variant="h4" sx={{ fontFamily: TYPOGRAPHY.fontFamily.display, fontWeight: 700 }}>
                  {isLawyer
                    ? t('case.lawyer_title', 'Cases I Track')
                    : t('case.title', 'My Court Cases')}
                </GradientHeading>
              )}
              <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)', mt: embedded ? 0 : 0.25 }}>
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
            label={`${t('case.view_active', 'Active')} (${activeCount})`}
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
            label={`${t('case.view_archived', 'Archived')} (${disposedCount})`}
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
                  : (isLawyer
                    ? t('case.empty_desc_lawyer', 'Add a CNR number to track hearings for matters you are handling.')
                    : t('case.empty_desc', 'Add your CNR number to start tracking your court hearings and get timely reminders.'))}
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
                  <CaseCard
                    caseData={c}
                    focused={focusCaseId && String(c._id) === String(focusCaseId)}
                    onRefresh={handleRefresh}
                    onDelete={requestDelete}
                    onArchive={handleArchive}
                    archived={view === 'disposed'}
                    onUpdateAlerts={updateAlerts}
                    onShare={isLawyer ? undefined : setShareTarget}
                  />
                </Grid>
              ))}
            </AnimatePresence>
          </Grid>
        )}

        <AddCaseModal open={modalOpen} onClose={handleModalClose} onAdd={add} whatsappOptIn={user?.whatsappOptIn} />

        {!isLawyer && (
          <ShareCaseDialog
            open={!!shareTarget}
            caseData={shareTarget}
            onClose={() => { if (shareTarget) setShareTarget(null); }}
            onShared={handleShared}
          />
        )}

        <Dialog
          open={!!pendingDelete}
          onClose={() => { if (!deleting) setPendingDelete(null); }}
          maxWidth="xs"
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: `${RADIUS.xl}px`,
              border: '1px solid var(--color-border)',
              background: 'var(--color-surface)',
            },
          }}
        >
          <DialogTitle sx={{ fontFamily: TYPOGRAPHY.fontFamily.display, fontWeight: 700, color: 'var(--color-text)' }}>
            {t('case.confirm_delete_title', 'Remove this case?')}
          </DialogTitle>
          <DialogContent>
            <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)' }}>
              {t('case.confirm_delete_desc', 'It will disappear from your tracker. You can add the same CNR again later.')}
            </Typography>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
            <Button
              onClick={() => setPendingDelete(null)}
              disabled={deleting}
              sx={{ borderRadius: `${RADIUS.md}px`, color: 'var(--color-text-secondary)' }}
            >
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button
              variant="contained"
              onClick={confirmDelete}
              disabled={deleting}
              sx={{
                borderRadius: `${RADIUS.md}px`,
                fontWeight: 700,
                background: 'var(--color-error)',
                '&:hover': { background: 'var(--color-error)' },
              }}
            >
              {deleting ? t('case.fetching', '…') : t('case.delete', 'Remove')}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
  );

  return embedded ? page : <AnimatedPage>{page}</AnimatedPage>;
}

export default CaseDashboard;
