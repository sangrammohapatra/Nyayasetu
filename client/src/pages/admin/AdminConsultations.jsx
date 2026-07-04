import React, { useEffect, useState, useCallback } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TablePagination from '@mui/material/TablePagination';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Skeleton from '@mui/material/Skeleton';
import IconButton from '@mui/material/IconButton';
import Drawer from '@mui/material/Drawer';
import Divider from '@mui/material/Divider';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import Snackbar from '@mui/material/Snackbar';
import CircularProgress from '@mui/material/CircularProgress';

import AnimatedPage from '../../components/ui/AnimatedPage';
import GlassCard from '../../components/ui/GlassCard';
import GradientHeading from '../../components/ui/GradientHeading';
import api from '../../services/api';
import { RADIUS, TYPOGRAPHY } from '../../theme/tokens';

const STATUS_COLORS = {
  requested:  { bg: 'rgba(2,136,209,0.1)',  color: '#0288d1' },
  accepted:   { bg: 'rgba(46,125,50,0.1)',  color: '#2e7d32' },
  rejected:   { bg: 'rgba(211,47,47,0.1)',  color: '#d32f2f' },
  completed:  { bg: 'rgba(27,94,32,0.12)',  color: '#1b5e20' },
  cancelled:  { bg: 'rgba(97,97,97,0.1)',   color: '#616161' },
  no_show:    { bg: 'rgba(237,108,2,0.1)',  color: '#ed6c02' },
};

const MODE_COLORS = {
  chat:      { bg: 'rgba(2,136,209,0.1)',  color: '#0288d1' },
  video:     { bg: 'rgba(106,27,154,0.1)', color: '#6a1b9a' },
  phone:     { bg: 'rgba(0,137,123,0.1)',  color: '#00897b' },
  in_person: { bg: 'rgba(93,64,55,0.1)',   color: '#5d4037' },
};

const CANCELLABLE = ['requested', 'accepted'];

function Badge({ value, colorMap }) {
  const c = colorMap[value] || { bg: 'rgba(97,97,97,0.1)', color: '#616161' };
  return (
    <Chip label={value?.replace(/_/g, ' ')} size="small"
      sx={{ height: 20, fontSize: '0.68rem', fontWeight: 700, background: c.bg, color: c.color, border: 'none', textTransform: 'capitalize' }} />
  );
}

function ConsultationDetail({ consultation, onClose, onRefreshList }) {
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [refundDialogOpen, setRefundDialogOpen] = useState(false);
  const [refundReason, setRefundReason] = useState('');
  const [noShowDialogOpen, setNoShowDialogOpen] = useState(false);
  const [noShowReason, setNoShowReason] = useState('');
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' });

  if (!consultation) return null;

  const canCancel = CANCELLABLE.includes(consultation.status);
  const canRefund = !!consultation.isPaid;
  const canMarkNoShow = consultation.status === 'accepted';

  const handleCancel = async () => {
    setConfirmOpen(false);
    setActionLoading(true);
    try {
      await api.patch(`/admin/consultations/${consultation._id}/cancel`, { reason: cancelReason || undefined });
      setSnack({ open: true, message: 'Consultation cancelled successfully.', severity: 'success' });
      onRefreshList();
      setTimeout(onClose, 1200);
    } catch (err) {
      setSnack({ open: true, message: err.response?.data?.message || 'Cancellation failed.', severity: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleRefund = async () => {
    setRefundDialogOpen(false);
    setActionLoading(true);
    try {
      const { data } = await api.post(`/admin/consultations/${consultation._id}/refund`, { reason: refundReason || undefined });
      setSnack({ open: true, message: `Refund of ₹${(data.refundAmount / 100).toFixed(2)} issued.`, severity: 'success' });
      onRefreshList();
      setTimeout(onClose, 1200);
    } catch (err) {
      setSnack({ open: true, message: err.response?.data?.message || 'Refund failed.', severity: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleNoShow = async () => {
    setNoShowDialogOpen(false);
    setActionLoading(true);
    try {
      await api.post(`/admin/consultations/${consultation._id}/no-show`, { reason: noShowReason || undefined });
      setSnack({ open: true, message: 'Consultation marked as no-show.', severity: 'success' });
      onRefreshList();
      setTimeout(onClose, 1200);
    } catch (err) {
      setSnack({ open: true, message: err.response?.data?.message || 'Failed to mark no-show.', severity: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  const fields = [
    ['Citizen', consultation.citizen ? `${consultation.citizen.name} (${consultation.citizen.email})` : '—'],
    ['Lawyer', consultation.lawyer  ? `${consultation.lawyer.name} (${consultation.lawyer.email})`   : '—'],
    ['Mode', consultation.mode?.replace(/_/g, ' ')],
    ['Status', consultation.status?.replace(/_/g, ' ')],
    ['Case Area', consultation.caseArea || '—'],
    ['Subject', consultation.subject || '—'],
    ['Fee', consultation.fee != null ? `₹${consultation.fee / 100}` : '—'],
    ['Paid', consultation.isPaid ? 'Yes' : 'No'],
    ['Scheduled At', consultation.scheduledAt ? new Date(consultation.scheduledAt).toLocaleString('en-IN') : '—'],
    ['Cancelled By', consultation.cancelledBy || '—'],
    ['Cancellation Reason', consultation.cancellationReason || '—'],
    ['Created At', consultation.createdAt ? new Date(consultation.createdAt).toLocaleString('en-IN') : '—'],
  ];

  return (
    <Box sx={{ width: { xs: '100vw', sm: 440 }, p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <GradientHeading variant="h6" sx={{ fontFamily: TYPOGRAPHY.fontFamily.display, fontWeight: 700 }}>Consultation Detail</GradientHeading>
        <IconButton onClick={onClose} size="small">✕</IconButton>
      </Box>
      <Divider sx={{ mb: 2, borderColor: 'var(--color-border)' }} />

      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
        {fields.map(([label, value]) => (
          <Box key={label} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.6, borderBottom: '1px solid var(--color-border)', gap: 2 }}>
            <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)', fontWeight: 600, flexShrink: 0 }}>{label}</Typography>
            <Typography variant="caption" sx={{ color: 'var(--color-text)', fontWeight: 500, textAlign: 'right', textTransform: 'capitalize' }}>
              {String(value)}
            </Typography>
          </Box>
        ))}

        {(canCancel || canRefund || canMarkNoShow) && (
          <Box sx={{ mt: 2.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Divider sx={{ mb: 1, borderColor: 'var(--color-border)' }} />
            {canRefund && (
              <Button
                variant="outlined" color="warning" fullWidth
                disabled={actionLoading}
                onClick={() => setRefundDialogOpen(true)}
                startIcon={actionLoading ? <CircularProgress size={14} /> : null}
                sx={{ borderRadius: `${RADIUS.md}px`, fontWeight: 700, textTransform: 'none' }}
              >
                Issue Refund
              </Button>
            )}
            {canMarkNoShow && (
              <Button
                variant="outlined" fullWidth
                disabled={actionLoading}
                onClick={() => setNoShowDialogOpen(true)}
                startIcon={actionLoading ? <CircularProgress size={14} /> : null}
                sx={{ borderRadius: `${RADIUS.md}px`, fontWeight: 700, textTransform: 'none', borderColor: '#757575', color: '#757575' }}
              >
                Mark as No-Show
              </Button>
            )}
            {canCancel && (
              <Button
                variant="outlined" color="error" fullWidth
                disabled={actionLoading}
                onClick={() => setConfirmOpen(true)}
                startIcon={actionLoading ? <CircularProgress size={14} /> : null}
                sx={{ borderRadius: `${RADIUS.md}px`, fontWeight: 700, textTransform: 'none' }}
              >
                Cancel Consultation
              </Button>
            )}
          </Box>
        )}
      </Box>

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>Cancel Consultation?</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            This will immediately cancel the booking. Both citizen and lawyer will lose access to this slot.
          </DialogContentText>
          <TextField
            size="small" label="Reason (optional)" value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            fullWidth placeholder="e.g. Policy violation, user dispute…"
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: `${RADIUS.md}px` } }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmOpen(false)} sx={{ textTransform: 'none' }}>Back</Button>
          <Button onClick={handleCancel} variant="contained" color="error" sx={{ textTransform: 'none', fontWeight: 700 }}>Confirm Cancel</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={refundDialogOpen} onClose={() => setRefundDialogOpen(false)} PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>Issue Refund?</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            This refunds the full amount (₹{consultation.fee != null ? (consultation.fee / 100).toFixed(2) : '—'}) via Razorpay
            and cancels the booking if it hasn't already reached a final state.
          </DialogContentText>
          <TextField
            size="small" label="Reason (optional)" value={refundReason}
            onChange={(e) => setRefundReason(e.target.value)}
            fullWidth placeholder="e.g. Dispute resolution, service not delivered…"
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: `${RADIUS.md}px` } }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setRefundDialogOpen(false)} sx={{ textTransform: 'none' }}>Back</Button>
          <Button onClick={handleRefund} variant="contained" color="warning" sx={{ textTransform: 'none', fontWeight: 700 }}>Confirm Refund</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={noShowDialogOpen} onClose={() => setNoShowDialogOpen(false)} PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>Mark as No-Show?</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            This credits the lawyer the full fee for holding the slot and notifies the citizen. Use this when the
            lawyer should have marked the session but didn't.
          </DialogContentText>
          <TextField
            size="small" label="Reason (optional)" value={noShowReason}
            onChange={(e) => setNoShowReason(e.target.value)}
            fullWidth placeholder="e.g. Confirmed with lawyer, citizen never joined…"
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: `${RADIUS.md}px` } }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setNoShowDialogOpen(false)} sx={{ textTransform: 'none' }}>Back</Button>
          <Button onClick={handleNoShow} variant="contained" sx={{ textTransform: 'none', fontWeight: 700 }}>Confirm No-Show</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snack.open} autoHideDuration={4000} onClose={() => setSnack((s) => ({ ...s, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={snack.severity} onClose={() => setSnack((s) => ({ ...s, open: false }))} sx={{ borderRadius: 2 }}>{snack.message}</Alert>
      </Snackbar>
    </Box>
  );
}

export default function AdminConsultations() {
  const [consultations, setConsultations] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [selected, setSelected] = useState(null);

  const fetchConsultations = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({
      page: page + 1, limit: rowsPerPage,
      ...(search && { search }),
      ...(status && { status }),
    });
    api.get(`/admin/consultations?${params}`)
      .then(({ data }) => { setConsultations(data.consultations || []); setTotal(data.pagination?.total || 0); })
      .catch((err) => setError(err.response?.data?.message || 'Failed to load consultations'))
      .finally(() => setLoading(false));
  }, [page, rowsPerPage, search, status]);

  useEffect(() => { fetchConsultations(); }, [fetchConsultations]);

  return (
    <AnimatedPage>
      <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: 1200, mx: 'auto' }}>
        <GradientHeading variant="h5" sx={{ fontFamily: TYPOGRAPHY.fontFamily.display, fontWeight: 700, mb: 3 }}>
          🤝 Consultations
        </GradientHeading>

        <GlassCard sx={{ p: 2, mb: 2 }}>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            <TextField size="small" placeholder="Search by citizen or lawyer name/email…"
              value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              sx={{ flex: '1 1 220px', '& .MuiOutlinedInput-root': { borderRadius: `${RADIUS.md}px` } }} />
            <FormControl size="small" sx={{ minWidth: 130 }}>
              <InputLabel>Status</InputLabel>
              <Select label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }} sx={{ borderRadius: `${RADIUS.md}px` }}>
                <MenuItem value="">All</MenuItem>
                {['requested','accepted','rejected','completed','cancelled','no_show'].map((s) => (
                  <MenuItem key={s} value={s}>{s.replace(/_/g, ' ')}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </GlassCard>

        {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}

        <GlassCard sx={{ overflow: 'hidden' }}>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ '& th': { fontWeight: 700, color: 'var(--color-text-secondary)', fontSize: '0.75rem', background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)' } }}>
                  <TableCell>Citizen</TableCell>
                  <TableCell>Lawyer</TableCell>
                  <TableCell>Mode</TableCell>
                  <TableCell>Fee</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Scheduled</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading
                  ? Array.from({ length: 8 }).map((_, i) => (
                      <TableRow key={i}>{Array.from({ length: 6 }).map((_, j) => <TableCell key={j}><Skeleton variant="text" height={20} /></TableCell>)}</TableRow>
                    ))
                  : consultations.map((c) => (
                      <TableRow key={c._id} hover onClick={() => setSelected(c)}
                        sx={{ cursor: 'pointer', '& td': { borderBottom: '1px solid var(--color-border)', py: 1 } }}>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 600, color: 'var(--color-text)' }}>{c.citizen?.name || '—'}</Typography>
                          <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)' }}>{c.citizen?.email || ''}</Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 600, color: 'var(--color-text)' }}>{c.lawyer?.name || '—'}</Typography>
                          <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)' }}>{c.lawyer?.email || ''}</Typography>
                        </TableCell>
                        <TableCell><Badge value={c.mode} colorMap={MODE_COLORS} /></TableCell>
                        <TableCell>
                          <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                            {c.fee != null ? `₹${c.fee / 100}` : '—'}
                          </Typography>
                        </TableCell>
                        <TableCell><Badge value={c.status} colorMap={STATUS_COLORS} /></TableCell>
                        <TableCell>
                          <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)' }}>
                            {c.scheduledAt ? new Date(c.scheduledAt).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : '—'}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                {!loading && consultations.length === 0 && (
                  <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                    <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)' }}>No consultations found</Typography>
                  </TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination component="div" count={total} page={page} rowsPerPage={rowsPerPage}
            rowsPerPageOptions={[10, 20, 50]}
            onPageChange={(_, p) => setPage(p)}
            onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value)); setPage(0); }}
            sx={{ borderTop: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }} />
        </GlassCard>
      </Box>

      <Drawer anchor="right" open={!!selected} onClose={() => setSelected(null)}
        PaperProps={{ sx: { background: 'var(--color-surface)' } }}>
        <ConsultationDetail
          consultation={selected}
          onClose={() => setSelected(null)}
          onRefreshList={fetchConsultations}
        />
      </Drawer>
    </AnimatedPage>
  );
}
