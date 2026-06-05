/**
 * client/src/pages/lawyer/ConsultationsPage.jsx
 */

import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';

import {
  fetchConsultations,
  acceptConsultation,
  rejectConsultation,
  selectConsultations,
  selectLawyerLoading,
} from '../../store/slices/lawyerSlice';
import AnimatedPage from '../../components/ui/AnimatedPage';
import { RADIUS, SHADOWS } from '../../theme/tokens';

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_TABS = ['all', 'requested', 'accepted', 'completed', 'cancelled'];

const MODE_META = {
  chat:      { label: 'Chat',      icon: '💬' },
  video:     { label: 'Video',     icon: '📹' },
  phone:     { label: 'Phone',     icon: '📞' },
  in_person: { label: 'In-Person', icon: '🤝' },
};

const STATUS_META = {
  requested:  { label: 'Requested',  bg: 'rgba(237,108,2,0.12)',  color: '#ed6c02' },
  accepted:   { label: 'Accepted',   bg: 'rgba(2,136,209,0.12)',  color: '#0288d1' },
  completed:  { label: 'Completed',  bg: 'rgba(46,125,50,0.1)',   color: '#2e7d32' },
  rejected:   { label: 'Rejected',   bg: 'rgba(211,47,47,0.1)',   color: '#d32f2f' },
  cancelled:  { label: 'Cancelled',  bg: 'rgba(211,47,47,0.1)',   color: '#d32f2f' },
  no_show:    { label: 'No-Show',    bg: 'rgba(117,117,117,0.12)', color: '#757575' },
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ConsultationRowSkeleton() {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 2, borderBottom: '1px solid var(--color-border)' }}>
      <Skeleton variant="circular" width={44} height={44} />
      <Box sx={{ flex: 1 }}>
        <Skeleton variant="text" width="35%" height={20} />
        <Skeleton variant="text" width="55%" height={16} sx={{ mt: 0.5 }} />
      </Box>
      <Skeleton variant="rounded" width={80} height={28} />
      <Skeleton variant="rounded" width={70} height={28} />
    </Box>
  );
}

// ─── Row ──────────────────────────────────────────────────────────────────────

function ConsultationRow({ consultation, delay, onAccept, onReject, actionLoading }) {
  const { t } = useTranslation();
  const citizen = consultation.citizen || {};
  const initials = citizen.name?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || '?';
  const modeMeta = MODE_META[consultation.mode] || { icon: '📋', label: consultation.mode };
  const statusMeta = STATUS_META[consultation.status] || { label: consultation.status, bg: 'transparent', color: 'inherit' };
  const isRequested = consultation.status === 'requested';

  const scheduledDate = consultation.scheduledAt
    ? new Date(consultation.scheduledAt).toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true,
      })
    : '—';

  const feeFormatted = consultation.fee != null
    ? `₹${(consultation.fee / 100).toFixed(0)}`
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ delay, duration: 0.3 }}
    >
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 2, p: 2,
        borderBottom: '1px solid var(--color-border)',
        transition: 'background 0.15s',
        '&:hover': { background: 'var(--color-overlay)' },
        flexWrap: { xs: 'wrap', sm: 'nowrap' },
      }}>
        {/* Avatar */}
        <Avatar sx={{
          width: 44, height: 44, background: 'var(--color-primary)',
          fontWeight: 700, fontSize: '1rem', flexShrink: 0,
        }}>
          {initials}
        </Avatar>

        {/* Client info */}
        <Box sx={{ flex: 1, minWidth: 120 }}>
          <Typography variant="body2" sx={{ fontWeight: 700, color: 'var(--color-text)' }}>
            {citizen.name || t('consultations.unknownClient', 'Client')}
          </Typography>
          <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)' }}>
            {citizen.phone || citizen.email || ''}
            {consultation.subject && ` · ${consultation.subject}`}
          </Typography>
        </Box>

        {/* Mode chip */}
        <Chip
          size="small"
          label={`${modeMeta.icon} ${modeMeta.label}`}
          sx={{
            height: 24, fontSize: '0.7rem', fontWeight: 600,
            background: 'var(--color-primary-alpha)', color: 'var(--color-primary)',
          }}
        />

        {/* Scheduled time */}
        <Typography variant="caption" sx={{
          color: 'var(--color-text-secondary)', flexShrink: 0,
          minWidth: 140, display: { xs: 'none', md: 'block' },
        }}>
          📅 {scheduledDate}
        </Typography>

        {/* Fee */}
        {feeFormatted && (
          <Typography variant="caption" sx={{
            fontWeight: 700, color: 'var(--color-text)', flexShrink: 0,
            display: { xs: 'none', sm: 'block' },
          }}>
            {feeFormatted}
          </Typography>
        )}

        {/* Status chip */}
        <Chip
          size="small"
          label={statusMeta.label}
          sx={{
            height: 24, fontSize: '0.7rem', fontWeight: 700,
            background: statusMeta.bg, color: statusMeta.color,
            flexShrink: 0,
          }}
        />

        {/* Actions for pending requests */}
        {isRequested && (
          <Box sx={{ display: 'flex', gap: 1, flexShrink: 0 }}>
            <Button
              size="small" variant="contained" disabled={actionLoading}
              onClick={() => onAccept(consultation._id)}
              sx={{
                fontSize: '0.72rem', fontWeight: 600,
                borderRadius: `${RADIUS.md}px`, py: 0.4,
                background: 'var(--color-primary)',
                '&:hover': { background: 'var(--color-primary-dark, var(--color-primary))' },
              }}
            >
              {t('consultations.accept', 'Accept')}
            </Button>
            <Button
              size="small" variant="outlined" disabled={actionLoading}
              onClick={() => onReject(consultation._id)}
              sx={{
                fontSize: '0.72rem', fontWeight: 600,
                borderRadius: `${RADIUS.md}px`, py: 0.4,
                borderColor: '#d32f2f', color: '#d32f2f',
                '&:hover': { background: 'rgba(211,47,47,0.06)', borderColor: '#d32f2f' },
              }}
            >
              {t('consultations.reject', 'Decline')}
            </Button>
          </Box>
        )}
      </Box>
    </motion.div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

function ConsultationsPage() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const consultations = useSelector(selectConsultations);
  const loading = useSelector(selectLawyerLoading);

  const [activeTab, setActiveTab] = useState('all');
  const [actionLoading, setActionLoading] = useState(false);

  // Reject dialog state
  const [rejectDialog, setRejectDialog] = useState({ open: false, id: null });
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    const params = activeTab !== 'all' ? { status: activeTab } : {};
    dispatch(fetchConsultations(params));
  }, [dispatch, activeTab]);

  const handleAccept = async (id) => {
    setActionLoading(true);
    await dispatch(acceptConsultation(id));
    setActionLoading(false);
  };

  const openRejectDialog = (id) => {
    setRejectReason('');
    setRejectDialog({ open: true, id });
  };

  const handleRejectConfirm = async () => {
    if (!rejectDialog.id) return;
    setActionLoading(true);
    await dispatch(rejectConsultation({ id: rejectDialog.id, reason: rejectReason }));
    setRejectDialog({ open: false, id: null });
    setActionLoading(false);
  };

  const displayed = consultations;
  const requestedCount = consultations.filter((c) => c.status === 'requested').length;

  return (
    <AnimatedPage>
      <Box sx={{ p: { xs: 2, sm: 3, md: 4 }, maxWidth: 1000, mx: 'auto', pb: { xs: 10, md: 4 } }}>

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.38 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
            <Box>
              <Typography variant="h4" sx={{ fontFamily: "'Playfair Display',serif", fontWeight: 700, color: 'var(--color-text)' }}>
                {t('consultations.title', 'Consultations')}
              </Typography>
              <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)', mt: 0.25 }}>
                {displayed.length} {t('consultations.total', 'consultations')}
                {requestedCount > 0 && (
                  <Box component="span" sx={{ ml: 1, fontWeight: 700, color: '#ed6c02' }}>
                    · {requestedCount} {t('consultations.pendingAction', 'awaiting action')}
                  </Box>
                )}
              </Typography>
            </Box>
          </Box>
        </motion.div>

        {/* Status tabs */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.08 }}>
          <Tabs
            value={activeTab}
            onChange={(_, v) => setActiveTab(v)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              mb: 2.5,
              '& .MuiTab-root': {
                textTransform: 'capitalize', fontWeight: 600,
                fontSize: '0.82rem', minHeight: 40, py: 0.5,
                color: 'var(--color-text-secondary)',
              },
              '& .Mui-selected': { color: 'var(--color-primary) !important' },
              '& .MuiTabs-indicator': { background: 'var(--color-primary)' },
              borderBottom: '1px solid var(--color-border)',
            }}
          >
            {STATUS_TABS.map((tab) => (
              <Tab key={tab} value={tab} label={t(`consultations.tab.${tab}`, tab.charAt(0).toUpperCase() + tab.slice(1))} />
            ))}
          </Tabs>
        </motion.div>

        {/* List */}
        <Box sx={{
          borderRadius: `${RADIUS.xl}px`,
          border: '1px solid var(--color-border)',
          background: 'var(--color-surface)',
          boxShadow: SHADOWS.sm,
          overflow: 'hidden',
        }}>
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => <ConsultationRowSkeleton key={i} />)
          ) : displayed.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 7 }}>
              <Typography sx={{ fontSize: 48, mb: 1.5 }}>📅</Typography>
              <Typography variant="h6" sx={{ fontFamily: "'Playfair Display',serif", fontWeight: 700, color: 'var(--color-text)', mb: 1 }}>
                {activeTab === 'all'
                  ? t('consultations.empty', 'No consultations yet')
                  : t('consultations.emptyStatus', `No ${activeTab} consultations`)}
              </Typography>
              <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)' }}>
                {t('consultations.emptyDesc', 'Consultations booked by clients will appear here.')}
              </Typography>
            </Box>
          ) : (
            <AnimatePresence>
              {displayed.map((c, i) => (
                <ConsultationRow
                  key={c._id}
                  consultation={c}
                  delay={i * 0.04}
                  onAccept={handleAccept}
                  onReject={openRejectDialog}
                  actionLoading={actionLoading}
                />
              ))}
            </AnimatePresence>
          )}
        </Box>
      </Box>

      {/* Reject dialog */}
      <Dialog
        open={rejectDialog.open}
        onClose={() => setRejectDialog({ open: false, id: null })}
        maxWidth="xs" fullWidth
        PaperProps={{ sx: { borderRadius: `${RADIUS.xl}px`, background: 'var(--color-surface)' } }}
      >
        <DialogTitle sx={{ fontFamily: "'Playfair Display',serif", fontWeight: 700, color: 'var(--color-text)' }}>
          {t('consultations.rejectTitle', 'Decline Consultation')}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)', mb: 2 }}>
            {t('consultations.rejectDesc', 'Optionally let the client know why you\'re declining.')}
          </Typography>
          <TextField
            fullWidth multiline rows={3}
            placeholder={t('consultations.rejectPlaceholder', 'Reason (optional)…')}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            size="small"
            sx={{
              '& .MuiOutlinedInput-root': {
                background: 'var(--color-bg)',
                '& fieldset': { borderColor: 'var(--color-border)' },
              },
            }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button
            onClick={() => setRejectDialog({ open: false, id: null })}
            sx={{ color: 'var(--color-text-secondary)', fontWeight: 600 }}
          >
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button
            variant="contained" onClick={handleRejectConfirm} disabled={actionLoading}
            sx={{
              background: '#d32f2f', fontWeight: 600,
              borderRadius: `${RADIUS.md}px`,
              '&:hover': { background: '#b71c1c' },
            }}
          >
            {t('consultations.confirmDecline', 'Decline')}
          </Button>
        </DialogActions>
      </Dialog>
    </AnimatedPage>
  );
}

export default ConsultationsPage;
