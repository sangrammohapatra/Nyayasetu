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
import Snackbar from '@mui/material/Snackbar';
import Skeleton from '@mui/material/Skeleton';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';

import AnimatedPage from '../../components/ui/AnimatedPage';
import GlassCard from '../../components/ui/GlassCard';
import GradientHeading from '../../components/ui/GradientHeading';
import api from '../../services/api';
import { RADIUS, TYPOGRAPHY } from '../../theme/tokens';

const STATUS_COLORS = {
  approved:     { bg: 'rgba(46,125,50,0.12)',  color: '#2e7d32', label: 'Approved' },
  pending:      { bg: 'rgba(237,108,2,0.12)',  color: '#ed6c02', label: 'Pending' },
  under_review: { bg: 'rgba(2,136,209,0.12)',  color: '#0288d1', label: 'Under Review' },
  rejected:     { bg: 'rgba(211,47,47,0.12)',  color: '#d32f2f', label: 'Rejected' },
};

export default function AdminNotaries() {
  const [notaries, setNotaries]     = useState([]);
  const [total, setTotal]           = useState(0);
  const [page, setPage]             = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [search, setSearch]         = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [actionId, setActionId]     = useState(null);
  const [snack, setSnack]           = useState({ open: false, msg: '', severity: 'success' });

  const [rejectDialog, setRejectDialog] = useState({ open: false, notaryId: null, name: '' });
  const [rejectReason, setRejectReason] = useState('');

  const fetchNotaries = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({
      page:  page + 1,
      limit: rowsPerPage,
      ...(search       && { search }),
      ...(statusFilter && { status: statusFilter }),
    });
    api.get(`/admin/notaries?${params}`)
      .then(({ data }) => {
        setNotaries(data.notaries || []);
        setTotal(data.total || 0);
      })
      .catch((err) => setError(err.response?.data?.message || 'Failed to load notaries'))
      .finally(() => setLoading(false));
  }, [page, rowsPerPage, search, statusFilter]);

  useEffect(() => { fetchNotaries(); }, [fetchNotaries]);

  const handleVerify = async (notaryProfileId, name) => {
    setActionId(notaryProfileId);
    try {
      await api.post(`/admin/notaries/${notaryProfileId}/verify`);
      setSnack({ open: true, msg: `${name} verified successfully.`, severity: 'success' });
      fetchNotaries();
    } catch (err) {
      setSnack({ open: true, msg: err.response?.data?.message || 'Verification failed.', severity: 'error' });
    } finally {
      setActionId(null);
    }
  };

  const openRejectDialog = (notaryProfileId, name) => {
    setRejectDialog({ open: true, notaryId: notaryProfileId, name });
    setRejectReason('');
  };

  const handleReject = async () => {
    const { notaryId, name } = rejectDialog;
    setRejectDialog((d) => ({ ...d, open: false }));
    setActionId(notaryId);
    try {
      await api.post(`/admin/notaries/${notaryId}/reject`, { reason: rejectReason || undefined });
      setSnack({ open: true, msg: `${name}'s profile rejected.`, severity: 'info' });
      fetchNotaries();
    } catch (err) {
      setSnack({ open: true, msg: err.response?.data?.message || 'Rejection failed.', severity: 'error' });
    } finally {
      setActionId(null);
      setRejectReason('');
    }
  };

  return (
    <AnimatedPage>
      <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: 1200, mx: 'auto' }}>
        <GradientHeading variant="h5" sx={{ fontFamily: TYPOGRAPHY.fontFamily.display, fontWeight: 700, mb: 3 }}>
          Notaries
        </GradientHeading>

        <GlassCard sx={{ p: 2, mb: 2 }}>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            <TextField
              size="small" placeholder="Search name, email, phone…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              sx={{ flex: '1 1 200px', '& .MuiOutlinedInput-root': { borderRadius: `${RADIUS.md}px` } }}
            />
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel>Status</InputLabel>
              <Select
                label="Status" value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
                sx={{ borderRadius: `${RADIUS.md}px` }}
              >
                <MenuItem value="">All</MenuItem>
                <MenuItem value="pending">Pending</MenuItem>
                <MenuItem value="under_review">Under Review</MenuItem>
                <MenuItem value="approved">Approved</MenuItem>
                <MenuItem value="rejected">Rejected</MenuItem>
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
                  <TableCell>Name</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Reg. Number</TableCell>
                  <TableCell>State</TableCell>
                  <TableCell>Experience</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
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
                  : notaries.map((np) => {
                      const u       = np.user || {};
                      const vstatus = np.verificationStatus || (np.isVerified ? 'approved' : 'pending');
                      const colors  = STATUS_COLORS[vstatus] || STATUS_COLORS.pending;
                      const busy    = actionId === np._id;
                      const canVerify = vstatus !== 'approved';
                      const canReject = vstatus !== 'rejected';

                      return (
                        <TableRow key={np._id} sx={{ '& td': { borderBottom: '1px solid var(--color-border)', py: 1 } }}>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontWeight: 600, color: 'var(--color-text)' }}>{u.name || '—'}</Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)' }}>{u.email || '—'}</Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)', fontFamily: 'monospace' }}>
                              {np.notaryRegistrationNumber || '—'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)' }}>{np.registrationState || '—'}</Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)' }}>
                              {np.experience != null ? `${np.experience} yr${np.experience !== 1 ? 's' : ''}` : '—'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={colors.label} size="small"
                              sx={{ height: 20, fontSize: '0.68rem', fontWeight: 700, background: colors.bg, color: colors.color }}
                            />
                          </TableCell>
                          <TableCell align="right">
                            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                              {canVerify && (
                                <Button
                                  size="small" variant="contained"
                                  disabled={busy}
                                  onClick={() => handleVerify(np._id, u.name)}
                                  sx={{
                                    fontSize: '0.7rem', py: 0.4, px: 1.5,
                                    borderRadius: `${RADIUS.md}px`,
                                    background: 'var(--color-primary)',
                                    minWidth: 72,
                                    '&:hover': { background: 'var(--color-primary-dark, var(--color-primary))' },
                                  }}
                                >
                                  {busy ? <CircularProgress size={12} sx={{ color: '#fff' }} /> : 'Approve'}
                                </Button>
                              )}
                              {canReject && (
                                <Button
                                  size="small" variant="outlined" color="error"
                                  disabled={busy}
                                  onClick={() => openRejectDialog(np._id, u.name)}
                                  sx={{ fontSize: '0.7rem', py: 0.4, px: 1.5, borderRadius: `${RADIUS.md}px`, minWidth: 72 }}
                                >
                                  Reject
                                </Button>
                              )}
                            </Box>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                {!loading && notaries.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                      <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)' }}>No notaries found</Typography>
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

      <Dialog open={rejectDialog.open} onClose={() => setRejectDialog((d) => ({ ...d, open: false }))} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Reject {rejectDialog.name}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus fullWidth multiline rows={3}
            label="Reason (optional)"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions sx={{ pb: 2, px: 3 }}>
          <Button onClick={() => setRejectDialog((d) => ({ ...d, open: false }))}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleReject}>Reject</Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snack.open} autoHideDuration={4000}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snack.severity} onClose={() => setSnack((s) => ({ ...s, open: false }))} sx={{ borderRadius: 2 }}>
          {snack.msg}
        </Alert>
      </Snackbar>
    </AnimatedPage>
  );
}
