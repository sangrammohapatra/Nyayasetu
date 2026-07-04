/**
 * NotarizationRequests.jsx
 *
 * Notary's queue of all notarization requests.
 * Each card shows the full state-machine action the notary can take.
 */

import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import CircularProgress from '@mui/material/CircularProgress';
import Avatar from '@mui/material/Avatar';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';

import {
  fetchNotarizationRequests,
  acceptNotarizationRequest,
  scheduleKYC,
  completeKYC,
  stampDocument,
  rejectNotarizationRequest,
  markDispatched,
  selectNotarizationRequests,
  selectNotarizationRequestsHasMore,
  selectNotarizationRequestsPage,
  selectNotaryRequestsLoading,
} from '../../store/slices/notarySlice';
import AnimatedPage from '../../components/ui/AnimatedPage';
import GlassCard from '../../components/ui/GlassCard';
import GradientHeading from '../../components/ui/GradientHeading';
import { RADIUS, TYPOGRAPHY } from '../../theme/tokens';
import { NOTARIZATION_FEE_DISPLAY } from '../../constants/notarization';

const STATUS_META = {
  pending:       { label: 'Pending',       color: '#ed6c02', bg: 'rgba(237,108,2,0.1)',    icon: '📬' },
  accepted:      { label: 'Accepted',      color: '#0288d1', bg: 'rgba(2,136,209,0.1)',   icon: '✅' },
  kyc_scheduled: { label: 'KYC Scheduled', color: '#7b1fa2', bg: 'rgba(123,31,162,0.1)',  icon: '📹' },
  kyc_completed: { label: 'KYC Done',      color: '#00897b', bg: 'rgba(0,137,123,0.1)',   icon: '🎯' },
  stamped:       { label: 'Stamped',       color: '#2e7d32', bg: 'rgba(46,125,50,0.1)',   icon: '🔏' },
  dispatched:    { label: 'Dispatched',    color: '#1b5e20', bg: 'rgba(27,94,32,0.1)',    icon: '📦' },
  rejected:      { label: 'Rejected',      color: '#c62828', bg: 'rgba(198,40,40,0.1)',   icon: '❌' },
  cancelled:     { label: 'Cancelled',     color: '#757575', bg: 'rgba(117,117,117,0.1)', icon: '🚫' },
};

const TABS = [
  { label: 'Action Needed', statuses: ['pending', 'kyc_completed'] },
  { label: 'Accepted',      statuses: ['accepted'] },
  { label: 'In Progress',   statuses: ['kyc_scheduled'] },
  { label: 'Completed',     statuses: ['stamped', 'dispatched'] },
  { label: 'All',           statuses: null },
];

function RejectDialog({ open, onClose, onConfirm, loading }) {
  const [reason, setReason] = useState('');
  return (
    <Dialog open={open} onClose={onClose} PaperProps={{ sx: { borderRadius: `${RADIUS.xl}px`, background: 'var(--color-surface)' } }}>
      <DialogTitle sx={{ fontFamily: TYPOGRAPHY.fontFamily.display, fontWeight: 700 }}>Reject Request</DialogTitle>
      <DialogContent>
        <TextField
          fullWidth multiline rows={3} label="Reason (optional)"
          value={reason} onChange={(e) => setReason(e.target.value)}
          sx={{ mt: 1, '& .MuiOutlinedInput-root': { borderRadius: `${RADIUS.md}px` } }}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
        <Button onClick={onClose} sx={{ color: 'var(--color-text-secondary)' }}>Cancel</Button>
        <Button variant="contained" onClick={() => onConfirm(reason)} disabled={loading}
          sx={{ borderRadius: `${RADIUS.md}px`, fontWeight: 700, background: '#c62828', '&:hover': { background: '#b71c1c' } }}>
          {loading ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : 'Reject'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function ScheduleDialog({ open, onClose, onConfirm, loading }) {
  const [dt, setDt] = useState('');
  return (
    <Dialog open={open} onClose={onClose} PaperProps={{ sx: { borderRadius: `${RADIUS.xl}px`, background: 'var(--color-surface)' } }}>
      <DialogTitle sx={{ fontFamily: TYPOGRAPHY.fontFamily.display, fontWeight: 700 }}>Schedule Video KYC</DialogTitle>
      <DialogContent>
        <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)', display: 'block', mb: 2 }}>
          Pick a date & time for the Video KYC session. A secure video link will be auto-generated and sent to the citizen.
        </Typography>
        <TextField
          fullWidth type="datetime-local" label="Session Date & Time"
          value={dt} onChange={(e) => setDt(e.target.value)}
          InputLabelProps={{ shrink: true }}
          inputProps={{ min: new Date().toISOString().slice(0, 16) }}
          sx={{ '& .MuiOutlinedInput-root': { borderRadius: `${RADIUS.md}px` } }}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
        <Button onClick={onClose} sx={{ color: 'var(--color-text-secondary)' }}>Cancel</Button>
        <Button variant="contained" onClick={() => onConfirm(dt)} disabled={!dt || loading}
          sx={{ borderRadius: `${RADIUS.md}px`, fontWeight: 700, background: 'var(--color-primary)' }}>
          {loading ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : 'Schedule'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function DispatchDialog({ open, onClose, onConfirm, loading }) {
  const [trackingId, setTrackingId] = useState('');
  return (
    <Dialog open={open} onClose={onClose} PaperProps={{ sx: { borderRadius: `${RADIUS.xl}px`, background: 'var(--color-surface)' } }}>
      <DialogTitle sx={{ fontFamily: TYPOGRAPHY.fontFamily.display, fontWeight: 700 }}>Mark as Dispatched</DialogTitle>
      <DialogContent>
        <TextField
          fullWidth label="Courier Tracking ID (optional)"
          value={trackingId} onChange={(e) => setTrackingId(e.target.value)}
          sx={{ mt: 1, '& .MuiOutlinedInput-root': { borderRadius: `${RADIUS.md}px` } }}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
        <Button onClick={onClose} sx={{ color: 'var(--color-text-secondary)' }}>Cancel</Button>
        <Button variant="contained" onClick={() => onConfirm(trackingId)} disabled={loading}
          sx={{ borderRadius: `${RADIUS.md}px`, fontWeight: 700, background: 'var(--color-primary)' }}>
          {loading ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : 'Mark Dispatched'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function RequestCard({ request, onAction, actionLoading }) {
  const meta = STATUS_META[request.status] || STATUS_META.pending;

  const addr = request.courierAddress;
  const addrStr = addr?.city ? `${addr.line1}, ${addr.city}, ${addr.state} — ${addr.pincode}` : null;

  return (
    <GlassCard sx={{ p: 2 }}>
      {/* Header row */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 1.5 }}>
        <Avatar src={request.citizen?.avatar} sx={{ width: 40, height: 40, flexShrink: 0 }}>
          {request.citizen?.name?.[0] || 'C'}
        </Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" sx={{ fontWeight: 700, color: 'var(--color-text)' }}>
            {request.citizen?.name || 'Citizen'}
          </Typography>
          <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)', display: 'block' }}>
            {request.document?.title || 'Document'} •{' '}
            {new Date(request.createdAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
          </Typography>
        </Box>
        <Chip
          label={`${meta.icon} ${meta.label}`} size="small"
          sx={{ height: 22, fontSize: '0.68rem', fontWeight: 700, background: meta.bg, color: meta.color, border: 'none', flexShrink: 0 }}
        />
      </Box>

      {/* Payment badge */}
      {request.payment?.status === 'paid' ? (
        <Chip label={`✓ ${NOTARIZATION_FEE_DISPLAY} Paid`} size="small"
          sx={{ height: 18, fontSize: '0.62rem', fontWeight: 700, mb: 1.25,
            background: 'rgba(27,94,32,0.1)', color: '#1b5e20', border: 'none' }} />
      ) : request.status === 'accepted' ? (
        <Chip label="⏳ Payment pending from citizen" size="small"
          sx={{ height: 18, fontSize: '0.62rem', fontWeight: 700, mb: 1.25,
            background: 'rgba(255,109,0,0.1)', color: '#ff6d00', border: 'none' }} />
      ) : null}

      {/* Notes */}
      {request.notes && (
        <Box sx={{ p: 1.25, mb: 1.25, borderRadius: `${RADIUS.md}px`, background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
          <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>
            "{request.notes}"
          </Typography>
        </Box>
      )}

      {/* KYC video link */}
      {request.videoLink && ['kyc_scheduled', 'kyc_completed'].includes(request.status) && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.25 }}>
          <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)' }}>
            📹 Scheduled: {request.scheduledAt ? new Date(request.scheduledAt).toLocaleString('en-IN') : '—'}
          </Typography>
          <Button size="small" href={request.videoLink} target="_blank" rel="noopener noreferrer"
            sx={{ borderRadius: `${RADIUS.sm}px`, fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-primary)' }}>
            Join →
          </Button>
        </Box>
      )}

      {/* Courier info */}
      {request.courierRequested && addrStr && (
        <Box sx={{ p: 1.25, mb: 1.25, borderRadius: `${RADIUS.md}px`, background: 'rgba(0,137,123,0.06)', border: '1px solid rgba(0,137,123,0.2)' }}>
          <Typography variant="caption" sx={{ fontWeight: 700, color: '#00897b', display: 'block' }}>
            📦 Courier Requested
          </Typography>
          <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)' }}>{addrStr}</Typography>
        </Box>
      )}

      {/* Notarized PDF link */}
      {request.notarizedPdfUrl && (
        <Button size="small" variant="outlined" href={request.notarizedPdfUrl} target="_blank" rel="noopener noreferrer"
          fullWidth sx={{ mb: 1.25, borderRadius: `${RADIUS.md}px`, fontWeight: 600, borderColor: '#2e7d32', color: '#2e7d32' }}>
          📥 Download Notarized PDF
        </Button>
      )}

      {/* Action buttons */}
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        {request.status === 'pending' && (
          <>
            <Button size="small" variant="contained"
              onClick={() => onAction('accept', request._id)}
              disabled={actionLoading === request._id}
              sx={{ borderRadius: `${RADIUS.md}px`, fontWeight: 700, flex: 1, background: 'var(--color-primary)' }}>
              {actionLoading === request._id ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : '✅ Accept'}
            </Button>
            <Button size="small" variant="outlined"
              onClick={() => onAction('reject', request._id)}
              disabled={actionLoading === request._id}
              sx={{ borderRadius: `${RADIUS.md}px`, fontWeight: 600, flex: 1, borderColor: '#c62828', color: '#c62828' }}>
              ❌ Reject
            </Button>
          </>
        )}

        {request.status === 'accepted' && request.payment?.status !== 'paid' && (
          <Box sx={{
            p: 1.25, borderRadius: `${RADIUS.md}px`, width: '100%',
            background: 'rgba(255,109,0,0.07)', border: '1px solid rgba(255,109,0,0.25)',
            textAlign: 'center',
          }}>
            <Typography variant="caption" sx={{ color: '#ff6d00', fontWeight: 700 }}>
              ⏳ Awaiting citizen payment ({NOTARIZATION_FEE_DISPLAY})
            </Typography>
            <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)', display: 'block', mt: 0.25 }}>
              You can schedule the KYC session once payment is confirmed.
            </Typography>
          </Box>
        )}

        {request.status === 'accepted' && request.payment?.status === 'paid' && (
          <Button size="small" variant="contained" fullWidth
            onClick={() => onAction('schedule', request._id)}
            disabled={actionLoading === request._id}
            sx={{ borderRadius: `${RADIUS.md}px`, fontWeight: 700, background: '#7b1fa2', '&:hover': { background: '#6a1b9a' } }}>
            {actionLoading === request._id ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : '📹 Schedule Video KYC'}
          </Button>
        )}

        {request.status === 'kyc_scheduled' && (
          <Button size="small" variant="contained" fullWidth
            onClick={() => onAction('complete-kyc', request._id)}
            disabled={actionLoading === request._id}
            sx={{ borderRadius: `${RADIUS.md}px`, fontWeight: 700, background: '#00897b', '&:hover': { background: '#00695c' } }}>
            {actionLoading === request._id ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : '🎯 Mark KYC Complete'}
          </Button>
        )}

        {request.status === 'kyc_completed' && (
          <Button size="small" variant="contained" fullWidth
            onClick={() => onAction('stamp', request._id)}
            disabled={actionLoading === request._id}
            sx={{ borderRadius: `${RADIUS.md}px`, fontWeight: 700, background: '#2e7d32', '&:hover': { background: '#1b5e20' } }}>
            {actionLoading === request._id ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : '🔏 Stamp & Notarize Document'}
          </Button>
        )}

        {request.status === 'stamped' && request.courierRequested && !request.courierTrackingId && (
          <Button size="small" variant="outlined" fullWidth
            onClick={() => onAction('dispatch', request._id)}
            sx={{ borderRadius: `${RADIUS.md}px`, fontWeight: 600, borderColor: '#00897b', color: '#00897b' }}>
            📦 Mark as Dispatched
          </Button>
        )}
      </Box>
    </GlassCard>
  );
}

const PAGE_SIZE = 20;

export default function NotarizationRequests() {
  const dispatch = useDispatch();
  const requests = useSelector(selectNotarizationRequests);
  const hasMore = useSelector(selectNotarizationRequestsHasMore);
  const currentPage = useSelector(selectNotarizationRequestsPage);
  const loading = useSelector(selectNotaryRequestsLoading);

  const [tab, setTab] = useState(0);
  const [actionLoading, setActionLoading] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [scheduleTarget, setScheduleTarget] = useState(null);
  const [dispatchTarget, setDispatchTarget] = useState(null);

  useEffect(() => { dispatch(fetchNotarizationRequests({ page: 1, limit: PAGE_SIZE })); }, [dispatch]);

  const handleLoadMore = () => {
    dispatch(fetchNotarizationRequests({ page: currentPage + 1, limit: PAGE_SIZE, append: true }));
  };

  const filtered = TABS[tab].statuses
    ? requests.filter((r) => TABS[tab].statuses.includes(r.status))
    : requests;

  const handleAction = async (type, id) => {
    if (type === 'reject') { setRejectTarget(id); return; }
    if (type === 'schedule') { setScheduleTarget(id); return; }
    if (type === 'dispatch') { setDispatchTarget(id); return; }

    setActionLoading(id);
    if (type === 'accept') await dispatch(acceptNotarizationRequest(id));
    if (type === 'complete-kyc') await dispatch(completeKYC(id));
    if (type === 'stamp') await dispatch(stampDocument(id));
    setActionLoading(null);
  };

  const handleReject = async (reason) => {
    setActionLoading(rejectTarget);
    await dispatch(rejectNotarizationRequest({ id: rejectTarget, reason }));
    setRejectTarget(null);
    setActionLoading(null);
  };

  const handleSchedule = async (scheduledAt) => {
    setActionLoading(scheduleTarget);
    await dispatch(scheduleKYC({ id: scheduleTarget, scheduledAt }));
    setScheduleTarget(null);
    setActionLoading(null);
  };

  const handleDispatch = async (courierTrackingId) => {
    setActionLoading(dispatchTarget);
    await dispatch(markDispatched({ id: dispatchTarget, courierTrackingId }));
    setDispatchTarget(null);
    setActionLoading(null);
  };

  return (
    <AnimatedPage>
      <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: 800, mx: 'auto', pb: { xs: 10, md: 4 } }}>
        <GradientHeading variant="h5" sx={{ fontFamily: TYPOGRAPHY.fontFamily.display, fontWeight: 800, mb: 0.5 }}>
          🔏 Notarization Requests
        </GradientHeading>
        <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)', mb: 2.5 }}>
          Review and act on citizen requests
        </Typography>

        <Tabs
          value={tab} onChange={(_, v) => setTab(v)}
          sx={{
            mb: 2.5, borderBottom: '1px solid var(--color-border)',
            '& .MuiTab-root': { fontSize: '0.78rem', fontWeight: 600, textTransform: 'none', color: 'var(--color-text-secondary)', minWidth: 0, px: 1.5 },
            '& .Mui-selected': { color: 'var(--color-primary)' },
            '& .MuiTabs-indicator': { background: 'var(--color-primary)' },
          }}
        >
          {TABS.map((t, i) => {
            const count = t.statuses
              ? requests.filter((r) => t.statuses.includes(r.status)).length
              : requests.length;
            return (
              <Tab key={i} label={`${t.label}${count > 0 ? ` (${count})` : ''}`} />
            );
          })}
        </Tabs>

        {loading && requests.length === 0 ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress sx={{ color: 'var(--color-primary)' }} />
          </Box>
        ) : filtered.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <Typography sx={{ fontSize: 40, mb: 1 }}>📭</Typography>
            <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)' }}>
              No requests in this category
            </Typography>
          </Box>
        ) : (
          <>
            <AnimatePresence>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {filtered.map((req, i) => (
                  <motion.div
                    key={req._id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <RequestCard request={req} onAction={handleAction} actionLoading={actionLoading} />
                  </motion.div>
                ))}
              </Box>
            </AnimatePresence>

            {hasMore && tab === TABS.length - 1 && (
              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
                <Button
                  variant="outlined"
                  onClick={handleLoadMore}
                  disabled={loading}
                  sx={{ borderRadius: 2, fontWeight: 600, borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                >
                  {loading ? <CircularProgress size={18} sx={{ color: 'var(--color-primary)' }} /> : 'Load More'}
                </Button>
              </Box>
            )}
          </>
        )}
      </Box>

      <RejectDialog
        open={!!rejectTarget}
        onClose={() => setRejectTarget(null)}
        onConfirm={handleReject}
        loading={!!actionLoading}
      />
      <ScheduleDialog
        open={!!scheduleTarget}
        onClose={() => setScheduleTarget(null)}
        onConfirm={handleSchedule}
        loading={!!actionLoading}
      />
      <DispatchDialog
        open={!!dispatchTarget}
        onClose={() => setDispatchTarget(null)}
        onConfirm={handleDispatch}
        loading={!!actionLoading}
      />
    </AnimatedPage>
  );
}
