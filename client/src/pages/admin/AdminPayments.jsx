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
  created:            { bg: 'rgba(97,97,97,0.1)',    color: '#616161' },
  paid:               { bg: 'rgba(46,125,50,0.1)',   color: '#2e7d32' },
  failed:             { bg: 'rgba(211,47,47,0.1)',   color: '#d32f2f' },
  refunded:           { bg: 'rgba(2,136,209,0.1)',   color: '#0288d1' },
  partially_refunded: { bg: 'rgba(237,108,2,0.1)',   color: '#ed6c02' },
};

const TYPE_COLORS = {
  pay_per_doc:  { bg: 'rgba(2,136,209,0.1)',   color: '#0288d1' },
  subscription: { bg: 'rgba(106,27,154,0.1)',  color: '#6a1b9a' },
  consultation: { bg: 'rgba(0,137,123,0.1)',   color: '#00897b' },
};

function StatusChip({ value, colorMap, label }) {
  const c = colorMap[value] || colorMap.created;
  const display = label ?? value?.replace(/_/g, ' ');
  return (
    <Chip label={display} size="small" sx={{ height: 20, fontSize: '0.68rem', fontWeight: 700, background: c.bg, color: c.color, border: 'none', textTransform: 'capitalize' }} />
  );
}

function fmt(paise) { return paise != null ? `₹${(paise / 100).toFixed(2)}` : '—'; }

function PaymentDetail({ paymentId, onClose, onRefreshList }) {
  const [payment, setPayment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [refundAmount, setRefundAmount] = useState('');
  const [reason, setReason] = useState('');
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' });

  const loadPayment = useCallback(() => {
    if (!paymentId) return;
    setLoading(true);
    // Fetch from the list and find the matching one (no individual GET endpoint)
    api.get(`/admin/payments?limit=200`)
      .then(({ data }) => {
        const found = (data.payments || []).find((p) => p._id === paymentId);
        setPayment(found || null);
        if (found) setRefundAmount(String(found.amount / 100));
      })
      .finally(() => setLoading(false));
  }, [paymentId]);

  useEffect(() => { loadPayment(); }, [loadPayment]);

  const canRefund = payment?.status === 'paid' && payment?.razorpayPaymentId;

  const handleRefund = async () => {
    setConfirmOpen(false);
    setActionLoading(true);
    try {
      const amountPaise = Math.round(parseFloat(refundAmount) * 100);
      await api.post(`/admin/payments/${paymentId}/refund`, { amount: amountPaise, reason });
      setSnack({ open: true, message: 'Refund initiated successfully.', severity: 'success' });
      loadPayment();
      onRefreshList();
    } catch (err) {
      setSnack({ open: true, message: err.response?.data?.message || 'Refund failed.', severity: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  const fields = payment ? [
    ['Payment ID', payment._id],
    ['User', payment.user ? `${payment.user.name} (${payment.user.email})` : '—'],
    ['Type', payment.type?.replace(/_/g, ' ')],
    ['Amount', fmt(payment.amount)],
    ['Status', payment.status?.replace(/_/g, ' ')],
    ['Razorpay Order ID', payment.razorpayOrderId || '—'],
    ['Razorpay Payment ID', payment.razorpayPaymentId || '—'],
    ['Description', payment.description || '—'],
    ['Platform Earnings', fmt(payment.platformEarnings)],
    ['Lawyer Earnings', fmt(payment.lawyerEarnings)],
    ['Refund ID', payment.refundId || '—'],
    ['Refund Amount', payment.refundAmount ? fmt(payment.refundAmount) : '—'],
    ['Refund Reason', payment.refundReason || '—'],
    ['Refunded At', payment.refundedAt ? new Date(payment.refundedAt).toLocaleString('en-IN') : '—'],
    ['Created At', payment.createdAt ? new Date(payment.createdAt).toLocaleString('en-IN') : '—'],
  ] : [];

  return (
    <Box sx={{ width: { xs: '100vw', sm: 440 }, p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <GradientHeading variant="h6" sx={{ fontFamily: TYPOGRAPHY.fontFamily.display, fontWeight: 700 }}>Payment Detail</GradientHeading>
        <IconButton onClick={onClose} size="small">✕</IconButton>
      </Box>
      <Divider sx={{ mb: 2, borderColor: 'var(--color-border)' }} />

      {loading && [1,2,3,4,5].map((i) => <Skeleton key={i} variant="text" height={24} sx={{ mb: 1 }} />)}

      {payment && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {fields.map(([label, value]) => (
            <Box key={label} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.6, borderBottom: '1px solid var(--color-border)', gap: 2 }}>
              <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)', fontWeight: 600, flexShrink: 0 }}>{label}</Typography>
              <Typography variant="caption" sx={{ color: 'var(--color-text)', fontWeight: 500, textAlign: 'right', wordBreak: 'break-all', fontFamily: label.includes('ID') ? 'monospace' : undefined }}>
                {String(value)}
              </Typography>
            </Box>
          ))}

          {canRefund && (
            <Box sx={{ mt: 2.5 }}>
              <Divider sx={{ mb: 2, borderColor: 'var(--color-border)' }} />
              <Typography variant="caption" sx={{ fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', mb: 1.5 }}>
                Issue Refund
              </Typography>
              <TextField
                size="small" label="Refund Amount (₹)" type="number"
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                helperText={`Max: ${fmt(payment.amount)}`}
                sx={{ mb: 1, '& .MuiOutlinedInput-root': { borderRadius: `${RADIUS.md}px` } }}
                fullWidth
              />
              <TextField
                size="small" label="Reason (optional)" value={reason}
                onChange={(e) => setReason(e.target.value)}
                sx={{ mb: 1.5, '& .MuiOutlinedInput-root': { borderRadius: `${RADIUS.md}px` } }}
                fullWidth
              />
              <Button
                variant="outlined" color="error" fullWidth
                disabled={actionLoading || !refundAmount || parseFloat(refundAmount) <= 0}
                onClick={() => setConfirmOpen(true)}
                startIcon={actionLoading ? <CircularProgress size={14} /> : null}
                sx={{ borderRadius: `${RADIUS.md}px`, fontWeight: 700, textTransform: 'none' }}
              >
                Initiate Refund
              </Button>
            </Box>
          )}
        </Box>
      )}

      {payment && !payment.razorpayPaymentId && payment.status === 'paid' && (
        <Alert severity="warning" sx={{ mt: 2, borderRadius: 2, fontSize: '0.78rem' }}>
          No Razorpay Payment ID on record — refund must be processed manually in the Razorpay dashboard.
        </Alert>
      )}

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>Confirm Refund</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This will refund <strong>{refundAmount ? `₹${refundAmount}` : '—'}</strong> to the user. This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmOpen(false)} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button onClick={handleRefund} variant="contained" color="error" sx={{ textTransform: 'none', fontWeight: 700 }}>Confirm Refund</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snack.open} autoHideDuration={4000} onClose={() => setSnack((s) => ({ ...s, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={snack.severity} onClose={() => setSnack((s) => ({ ...s, open: false }))} sx={{ borderRadius: 2 }}>{snack.message}</Alert>
      </Snackbar>
    </Box>
  );
}

export default function AdminPayments() {
  const [payments, setPayments] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [selectedId, setSelectedId] = useState(null);

  const fetchPayments = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({
      page: page + 1, limit: rowsPerPage,
      ...(search && { search }),
      ...(status && { status }),
      ...(type   && { type }),
    });
    api.get(`/admin/payments?${params}`)
      .then(({ data }) => { setPayments(data.payments || []); setTotal(data.pagination?.total || 0); })
      .catch((err) => setError(err.response?.data?.message || 'Failed to load payments'))
      .finally(() => setLoading(false));
  }, [page, rowsPerPage, search, status, type]);

  useEffect(() => { fetchPayments(); }, [fetchPayments]);

  return (
    <AnimatedPage>
      <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: 1200, mx: 'auto' }}>
        <GradientHeading variant="h5" sx={{ fontFamily: TYPOGRAPHY.fontFamily.display, fontWeight: 700, mb: 3 }}>
          💳 Payments
        </GradientHeading>

        <GlassCard sx={{ p: 2, mb: 2 }}>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            <TextField size="small" placeholder="Search by user name or email…"
              value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              sx={{ flex: '1 1 200px', '& .MuiOutlinedInput-root': { borderRadius: `${RADIUS.md}px` } }} />
            <FormControl size="small" sx={{ minWidth: 130 }}>
              <InputLabel>Status</InputLabel>
              <Select label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }} sx={{ borderRadius: `${RADIUS.md}px` }}>
                <MenuItem value="">All</MenuItem>
                {['created', 'paid', 'failed', 'refunded', 'partially_refunded'].map((s) => <MenuItem key={s} value={s}>{s.replace(/_/g, ' ')}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 130 }}>
              <InputLabel>Type</InputLabel>
              <Select label="Type" value={type} onChange={(e) => { setType(e.target.value); setPage(0); }} sx={{ borderRadius: `${RADIUS.md}px` }}>
                <MenuItem value="">All</MenuItem>
                {['pay_per_doc', 'subscription', 'consultation'].map((t) => <MenuItem key={t} value={t}>{t.replace(/_/g, ' ')}</MenuItem>)}
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
                  <TableCell>User</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Amount</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Razorpay Payment ID</TableCell>
                  <TableCell>Date</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading
                  ? Array.from({ length: 8 }).map((_, i) => (
                      <TableRow key={i}>{Array.from({ length: 6 }).map((_, j) => <TableCell key={j}><Skeleton variant="text" height={20} /></TableCell>)}</TableRow>
                    ))
                  : payments.map((p) => (
                      <TableRow key={p._id} hover onClick={() => setSelectedId(p._id)}
                        sx={{ cursor: 'pointer', '& td': { borderBottom: '1px solid var(--color-border)', py: 1 } }}>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 600, color: 'var(--color-text)' }}>{p.user?.name || '—'}</Typography>
                          <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)' }}>{p.user?.email || ''}</Typography>
                        </TableCell>
                        <TableCell><StatusChip value={p.type} colorMap={TYPE_COLORS} /></TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 600, color: 'var(--color-text)' }}>{fmt(p.amount)}</Typography>
                        </TableCell>
                        <TableCell><StatusChip value={p.status} colorMap={STATUS_COLORS} /></TableCell>
                        <TableCell>
                          <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'var(--color-text-secondary)' }}>
                            {p.razorpayPaymentId || '—'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)' }}>
                            {p.createdAt ? new Date(p.createdAt).toLocaleDateString('en-IN') : '—'}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                {!loading && payments.length === 0 && (
                  <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                    <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)' }}>No payments found</Typography>
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

      <Drawer anchor="right" open={!!selectedId} onClose={() => setSelectedId(null)}
        PaperProps={{ sx: { background: 'var(--color-surface)' } }}>
        <PaymentDetail
          paymentId={selectedId}
          onClose={() => setSelectedId(null)}
          onRefreshList={fetchPayments}
        />
      </Drawer>
    </AnimatedPage>
  );
}
