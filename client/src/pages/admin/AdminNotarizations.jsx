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
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Skeleton from '@mui/material/Skeleton';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Divider from '@mui/material/Divider';
import Avatar from '@mui/material/Avatar';

import AnimatedPage from '../../components/ui/AnimatedPage';
import GlassCard from '../../components/ui/GlassCard';
import GradientHeading from '../../components/ui/GradientHeading';
import api from '../../services/api';
import { RADIUS, TYPOGRAPHY } from '../../theme/tokens';

const STATUS_META = {
  pending:       { label: 'Pending',       color: '#ed6c02', bg: 'rgba(237,108,2,0.12)' },
  accepted:      { label: 'Accepted',      color: '#0288d1', bg: 'rgba(2,136,209,0.12)' },
  kyc_scheduled: { label: 'KYC Scheduled', color: '#7b1fa2', bg: 'rgba(123,31,162,0.12)' },
  kyc_completed: { label: 'KYC Done',      color: '#00897b', bg: 'rgba(0,137,123,0.12)' },
  stamped:       { label: 'Stamped',       color: '#2e7d32', bg: 'rgba(46,125,50,0.12)' },
  dispatched:    { label: 'Dispatched',    color: '#1b5e20', bg: 'rgba(27,94,32,0.12)' },
  rejected:      { label: 'Rejected',      color: '#c62828', bg: 'rgba(198,40,40,0.12)' },
  cancelled:     { label: 'Cancelled',     color: '#757575', bg: 'rgba(117,117,117,0.12)' },
};

function DetailField({ label, value }) {
  return (
    <Box>
      <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)', fontWeight: 600, textTransform: 'uppercase', fontSize: '0.65rem' }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ color: 'var(--color-text)', mt: 0.25 }}>
        {value || '—'}
      </Typography>
    </Box>
  );
}

function DetailDialog({ requestId, onClose }) {
  const [req, setReq] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refunding, setRefunding] = useState(false);
  const [refundDone, setRefundDone] = useState(false);

  useEffect(() => {
    if (!requestId) return;
    setLoading(true);
    setError(null);
    setRefundDone(false);
    api.get(`/admin/notarizations/${requestId}`)
      .then(({ data }) => setReq(data))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load request'))
      .finally(() => setLoading(false));
  }, [requestId]);

  const handleRefund = async () => {
    setRefunding(true);
    try {
      await api.post(`/admin/payments/${req.payment?.razorpayOrderId}/refund`);
      setRefundDone(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Refund failed');
    } finally {
      setRefunding(false);
    }
  };

  const meta = req ? (STATUS_META[req.status] || STATUS_META.pending) : null;

  return (
    <Dialog open={!!requestId} onClose={onClose} maxWidth="sm" fullWidth
      PaperProps={{ sx: { borderRadius: `${RADIUS.xl}px`, background: 'var(--color-surface)' } }}>
      <DialogTitle sx={{ fontFamily: TYPOGRAPHY.fontFamily.display, fontWeight: 700 }}>
        Notarization Request Detail
      </DialogTitle>
      <DialogContent>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress sx={{ color: 'var(--color-primary)' }} />
          </Box>
        ) : error ? (
          <Alert severity="error">{error}</Alert>
        ) : req ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {refundDone && (
              <Alert severity="success" sx={{ borderRadius: `${RADIUS.md}px` }}>Refund initiated successfully.</Alert>
            )}

            {req.payment?.status === 'paid' && ['kyc_scheduled', 'kyc_completed'].includes(req.status) && (
              <Alert severity="warning" sx={{ borderRadius: `${RADIUS.md}px` }}>
                Payment collected but document not yet delivered — notary has ₹{(req.payment.amount / 100).toFixed(2)} in pending earnings for this request.
              </Alert>
            )}

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Chip
                label={meta.label} size="small"
                sx={{ height: 22, fontSize: '0.72rem', fontWeight: 700, background: meta.bg, color: meta.color }}
              />
              <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)' }}>
                Created {new Date(req.createdAt).toLocaleString('en-IN')}
              </Typography>
            </Box>

            <Divider sx={{ borderColor: 'var(--color-border)' }} />

            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
              <DetailField label="Citizen" value={`${req.citizen?.name} (${req.citizen?.email})`} />
              <DetailField label="Phone" value={req.citizen?.phone} />
              <DetailField label="Notary" value={req.notary?.name} />
              <DetailField label="Reg. Number" value={req.notaryProfile?.notaryRegistrationNumber} />
              <DetailField label="Document" value={req.document?.title} />
              <DetailField label="KYC Scheduled" value={req.scheduledAt ? new Date(req.scheduledAt).toLocaleString('en-IN') : null} />
            </Box>

            <Divider sx={{ borderColor: 'var(--color-border)' }} />

            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
              <DetailField label="Payment Status" value={req.payment?.status?.toUpperCase()} />
              <DetailField label="Amount" value={req.payment?.amount ? `₹${(req.payment.amount / 100).toFixed(2)}` : null} />
              <DetailField label="Razorpay Payment ID" value={req.payment?.razorpayPaymentId} />
              <DetailField label="Paid At" value={req.payment?.paidAt ? new Date(req.payment.paidAt).toLocaleString('en-IN') : null} />
            </Box>

            {req.courierRequested && (
              <>
                <Divider sx={{ borderColor: 'var(--color-border)' }} />
                <Box>
                  <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)', fontWeight: 700, textTransform: 'uppercase', fontSize: '0.65rem' }}>
                    Courier Address
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'var(--color-text)', mt: 0.5 }}>
                    {[
                      req.courierAddress?.name,
                      req.courierAddress?.line1,
                      req.courierAddress?.line2,
                      req.courierAddress?.city,
                      req.courierAddress?.state,
                      req.courierAddress?.pincode,
                    ].filter(Boolean).join(', ')}
                  </Typography>
                  {req.courierTrackingId && (
                    <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)' }}>
                      Tracking: {req.courierTrackingId}
                    </Typography>
                  )}
                </Box>
              </>
            )}

            {req.notes && (
              <DetailField label="Citizen Notes" value={req.notes} />
            )}
            {req.rejectionReason && (
              <DetailField label="Rejection Reason" value={req.rejectionReason} />
            )}

            {req.notarizedPdfUrl && (
              <Button size="small" variant="outlined" href={req.notarizedPdfUrl} target="_blank" rel="noopener noreferrer"
                sx={{ borderRadius: `${RADIUS.md}px`, fontWeight: 600, borderColor: '#2e7d32', color: '#2e7d32', alignSelf: 'flex-start' }}>
                View Notarized PDF
              </Button>
            )}
          </Box>
        ) : null}
      </DialogContent>
      <DialogActions sx={{ pb: 2, px: 3, gap: 1 }}>
        {req && req.payment?.status === 'paid' && !refundDone && (
          <Button
            variant="outlined" color="warning"
            disabled={refunding}
            onClick={handleRefund}
            sx={{ borderRadius: `${RADIUS.md}px`, fontWeight: 600, mr: 'auto' }}
          >
            {refunding ? <CircularProgress size={16} /> : 'Issue Refund'}
          </Button>
        )}
        <Button onClick={onClose} sx={{ color: 'var(--color-text-secondary)' }}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

export default function AdminNotarizations() {
  const [items, setItems]     = useState([]);
  const [total, setTotal]     = useState(0);
  const [page, setPage]       = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [search, setSearch]   = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [detailId, setDetailId] = useState(null);

  const fetchData = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({
      page:  page + 1,
      limit: rowsPerPage,
      ...(search       && { search }),
      ...(statusFilter && { status: statusFilter }),
    });
    api.get(`/admin/notarizations?${params}`)
      .then(({ data }) => {
        setItems(data.items || []);
        setTotal(data.total || 0);
      })
      .catch((err) => setError(err.response?.data?.message || 'Failed to load notarizations'))
      .finally(() => setLoading(false));
  }, [page, rowsPerPage, search, statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <AnimatedPage>
      <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: 1200, mx: 'auto' }}>
        <GradientHeading variant="h5" sx={{ fontFamily: TYPOGRAPHY.fontFamily.display, fontWeight: 700, mb: 3 }}>
          Notarization Requests
        </GradientHeading>

        <GlassCard sx={{ p: 2, mb: 2 }}>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            <TextField
              size="small" placeholder="Search citizen or notary name / email…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              sx={{ flex: '1 1 220px', '& .MuiOutlinedInput-root': { borderRadius: `${RADIUS.md}px` } }}
            />
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel>Status</InputLabel>
              <Select
                label="Status" value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
                sx={{ borderRadius: `${RADIUS.md}px` }}
              >
                <MenuItem value="">All</MenuItem>
                {Object.entries(STATUS_META).map(([k, v]) => (
                  <MenuItem key={k} value={k}>{v.label}</MenuItem>
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
                  <TableCell>Notary</TableCell>
                  <TableCell>Document</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Payment</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell align="right">Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading
                  ? Array.from({ length: 8 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 7 }).map((_, j) => (
                          <TableCell key={j}><Skeleton variant="text" height={20} /></TableCell>
                        ))}
                      </TableRow>
                    ))
                  : items.map((req) => {
                      const meta = STATUS_META[req.status] || STATUS_META.pending;
                      const payPaid = req.payment?.status === 'paid';
                      return (
                        <TableRow key={req._id} sx={{ '& td': { borderBottom: '1px solid var(--color-border)', py: 1 } }}>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Avatar src={req.citizen?.avatar} sx={{ width: 28, height: 28, fontSize: 12 }}>
                                {req.citizen?.name?.[0] || 'C'}
                              </Avatar>
                              <Box>
                                <Typography variant="body2" sx={{ fontWeight: 600, color: 'var(--color-text)', lineHeight: 1.2 }}>
                                  {req.citizen?.name || '—'}
                                </Typography>
                                <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)' }}>
                                  {req.citizen?.email}
                                </Typography>
                              </Box>
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)' }}>
                              {req.notary?.name || '—'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)' }}>
                              {req.document?.title || '—'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={meta.label} size="small"
                              sx={{ height: 20, fontSize: '0.68rem', fontWeight: 700, background: meta.bg, color: meta.color }}
                            />
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={payPaid ? '✓ Paid' : 'Pending'} size="small"
                              sx={{
                                height: 20, fontSize: '0.68rem', fontWeight: 700,
                                background: payPaid ? 'rgba(46,125,50,0.1)' : 'rgba(117,117,117,0.1)',
                                color: payPaid ? '#2e7d32' : '#757575',
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)' }}>
                              {new Date(req.createdAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Button
                              size="small" variant="outlined"
                              onClick={() => setDetailId(req._id)}
                              sx={{ fontSize: '0.7rem', py: 0.4, px: 1.5, borderRadius: `${RADIUS.md}px`, minWidth: 60, borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
                            >
                              View
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                {!loading && items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                      <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)' }}>
                        No notarization requests found
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={total}
            page={page}
            rowsPerPage={rowsPerPage}
            rowsPerPageOptions={[10, 20, 50]}
            onPageChange={(_, p) => setPage(p)}
            onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value)); setPage(0); }}
            sx={{ borderTop: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
          />
        </GlassCard>
      </Box>

      <DetailDialog requestId={detailId} onClose={() => setDetailId(null)} />
    </AnimatedPage>
  );
}
