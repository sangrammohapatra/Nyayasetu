import React, { useEffect, useState, useCallback } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
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
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Snackbar from '@mui/material/Snackbar';
import CircularProgress from '@mui/material/CircularProgress';

import AnimatedPage from '../../components/ui/AnimatedPage';
import GlassCard from '../../components/ui/GlassCard';
import GradientHeading from '../../components/ui/GradientHeading';
import api from '../../services/api';
import { RADIUS, TYPOGRAPHY } from '../../theme/tokens';

const STATUS_META = {
  pending:    { label: 'Pending',    bg: 'rgba(237,108,2,0.1)',  color: '#ed6c02' },
  processing: { label: 'Processing', bg: 'rgba(2,136,209,0.1)',  color: '#0288d1' },
  completed:  { label: 'Completed',  bg: 'rgba(46,125,50,0.1)',  color: '#2e7d32' },
  failed:     { label: 'Failed',     bg: 'rgba(198,40,40,0.1)',  color: '#c62828' },
};

const PROFESSIONS = [
  { key: 'lawyer', label: 'Lawyer', endpoint: '/admin/lawyer-withdrawals', userField: 'lawyerUser', profileField: 'lawyerProfile', profileLabel: 'barCouncilNumber' },
  { key: 'notary', label: 'Notary', endpoint: '/admin/withdrawals', userField: 'notaryUser', profileField: 'notaryProfile', profileLabel: 'notaryRegistrationNumber' },
];

function fmt(paise) {
  return `₹${((paise || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
}

function ProcessDialog({ withdrawal, profession, onClose, onDone }) {
  const [status, setStatus] = useState('completed');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  if (!withdrawal) return null;

  const handleSubmit = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.post(`${profession.endpoint}/${withdrawal._id}/process`, { status, reference, notes });
      onDone();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to process withdrawal');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onClose={() => !saving && onClose()} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ fontWeight: 700 }}>Process Withdrawal</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ mb: 2, color: 'var(--color-text-secondary)' }}>
          {fmt(withdrawal.amount)} to {withdrawal.bankSnapshot?.bankName} ({withdrawal.bankSnapshot?.maskedAccountNumber})
        </Typography>
        {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}
        <FormControl size="small" fullWidth sx={{ mb: 2 }}>
          <InputLabel>Status</InputLabel>
          <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <MenuItem value="processing">Processing</MenuItem>
            <MenuItem value="completed">Completed</MenuItem>
            <MenuItem value="failed">Failed</MenuItem>
          </Select>
        </FormControl>
        <TextField
          size="small" fullWidth label="Reference (UTR / transfer ref)" value={reference}
          onChange={(e) => setReference(e.target.value)} sx={{ mb: 2 }}
        />
        <TextField
          size="small" fullWidth label="Notes (optional)" value={notes} multiline rows={2}
          onChange={(e) => setNotes(e.target.value)}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={saving} sx={{ textTransform: 'none' }}>Cancel</Button>
        <Button onClick={handleSubmit} variant="contained" disabled={saving} sx={{ textTransform: 'none', fontWeight: 700 }}>
          {saving ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : 'Confirm'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function AdminWithdrawals() {
  const [professionKey, setProfessionKey] = useState('lawyer');
  const profession = PROFESSIONS.find((p) => p.key === professionKey);

  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState('');
  const [processing, setProcessing] = useState(null);
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' });

  const fetchWithdrawals = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({
      page: page + 1, limit: rowsPerPage,
      ...(status && { status }),
    });
    api.get(`${profession.endpoint}?${params}`)
      .then(({ data }) => { setItems(data.items || []); setTotal(data.total || 0); })
      .catch((err) => setError(err.response?.data?.message || 'Failed to load withdrawals'))
      .finally(() => setLoading(false));
  }, [profession, page, rowsPerPage, status]);

  useEffect(() => { fetchWithdrawals(); }, [fetchWithdrawals]);

  const handleProcessed = () => {
    setProcessing(null);
    setSnack({ open: true, message: 'Withdrawal updated.', severity: 'success' });
    fetchWithdrawals();
  };

  return (
    <AnimatedPage>
      <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: 1200, mx: 'auto' }}>
        <GradientHeading variant="h5" sx={{ fontFamily: TYPOGRAPHY.fontFamily.display, fontWeight: 700, mb: 2 }}>
          💸 Withdrawal Requests
        </GradientHeading>

        <Tabs
          value={professionKey}
          onChange={(_, v) => { setProfessionKey(v); setPage(0); }}
          sx={{ mb: 2, borderBottom: '1px solid var(--color-border)' }}
        >
          {PROFESSIONS.map((p) => <Tab key={p.key} value={p.key} label={p.label} sx={{ textTransform: 'none', fontWeight: 600 }} />)}
        </Tabs>

        <GlassCard sx={{ p: 2, mb: 2 }}>
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Status</InputLabel>
            <Select label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }} sx={{ borderRadius: `${RADIUS.md}px` }}>
              <MenuItem value="">All</MenuItem>
              {['pending', 'processing', 'completed', 'failed'].map((s) => (
                <MenuItem key={s} value={s}>{STATUS_META[s].label}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </GlassCard>

        {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}

        <GlassCard sx={{ overflow: 'hidden' }}>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ '& th': { fontWeight: 700, color: 'var(--color-text-secondary)', fontSize: '0.75rem', background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)' } }}>
                  <TableCell>{profession.label}</TableCell>
                  <TableCell>Amount</TableCell>
                  <TableCell>Bank</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Requested</TableCell>
                  <TableCell align="right">Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading
                  ? Array.from({ length: 6 }).map((_, i) => (
                      <TableRow key={i}>{Array.from({ length: 6 }).map((_, j) => <TableCell key={j}><Skeleton variant="text" height={20} /></TableCell>)}</TableRow>
                    ))
                  : items.map((w) => {
                      const meta = STATUS_META[w.status] || STATUS_META.pending;
                      const user = w[profession.userField];
                      const canProcess = w.status === 'pending' || w.status === 'processing';
                      return (
                        <TableRow key={w._id} sx={{ '& td': { borderBottom: '1px solid var(--color-border)', py: 1 } }}>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontWeight: 600, color: 'var(--color-text)' }}>{user?.name || '—'}</Typography>
                            <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)' }}>{user?.email || ''}</Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontWeight: 700, color: 'var(--color-text)' }}>{fmt(w.amount)}</Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)' }}>
                              {w.bankSnapshot?.bankName} · {w.bankSnapshot?.maskedAccountNumber}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip label={meta.label} size="small" sx={{ height: 20, fontSize: '0.68rem', fontWeight: 700, background: meta.bg, color: meta.color }} />
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)' }}>
                              {new Date(w.createdAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            {canProcess && (
                              <Button size="small" variant="outlined" onClick={() => setProcessing(w)} sx={{ textTransform: 'none', fontWeight: 600 }}>
                                Process
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                {!loading && items.length === 0 && (
                  <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                    <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)' }}>No withdrawal requests found</Typography>
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

      <ProcessDialog
        withdrawal={processing}
        profession={profession}
        onClose={() => setProcessing(null)}
        onDone={handleProcessed}
      />

      <Snackbar open={snack.open} autoHideDuration={4000} onClose={() => setSnack((s) => ({ ...s, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={snack.severity} onClose={() => setSnack((s) => ({ ...s, open: false }))} sx={{ borderRadius: 2 }}>{snack.message}</Alert>
      </Snackbar>
    </AnimatedPage>
  );
}
