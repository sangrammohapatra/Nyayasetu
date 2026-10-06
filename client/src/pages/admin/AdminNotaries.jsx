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
import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';
import Skeleton from '@mui/material/Skeleton';

import AnimatedPage from '../../components/ui/AnimatedPage';
import GlassCard from '../../components/ui/GlassCard';
import GradientHeading from '../../components/ui/GradientHeading';
import ApplicationReviewDialog from '../../components/admin/ApplicationReviewDialog';
import api from '../../services/api';
import { RADIUS, TYPOGRAPHY } from '../../theme/tokens';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function listText(values) {
  return Array.isArray(values) && values.length ? values.map((v) => String(v).replace(/_/g, ' ')).join(', ') : '';
}

function formatWhen(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

function availabilityText(slots) {
  if (!Array.isArray(slots) || slots.length === 0) return '';
  return slots
    .filter((slot) => slot.isActive !== false)
    .map((slot) => `${DAYS[slot.dayOfWeek] || 'Day'} ${slot.startTime || ''}${slot.endTime ? `–${slot.endTime}` : ''}`)
    .join('\n');
}

function notaryDocuments(np) {
  const docs = (np.verificationDocs || [])
    .filter((doc) => doc?.url)
    .map((doc, index) => ({
      label: (doc.type || `Document ${index + 1}`).replace(/_/g, ' '),
      url: doc.url,
    }));
  if (docs.length === 0) docs.push({ label: 'Notary certificate', url: '' });
  return docs;
}

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
  const [review, setReview]         = useState(null);

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

  const handleVerify = async () => {
    if (!review) return;
    const name = review.user?.name || 'Notary';
    setActionId(review._id);
    try {
      await api.post(`/admin/notaries/${review._id}/verify`);
      setSnack({ open: true, msg: `${name} verified successfully.`, severity: 'success' });
      setReview(null);
      fetchNotaries();
    } catch (err) {
      setSnack({ open: true, msg: err.response?.data?.message || 'Verification failed.', severity: 'error' });
    } finally {
      setActionId(null);
    }
  };

  const handleReset = async () => {
    if (!review) return;
    const name = review.user?.name || 'Notary';
    setActionId(review._id);
    try {
      await api.post(`/admin/notaries/${review._id}/reset-verification`);
      setSnack({ open: true, msg: `${name} reset to pending.`, severity: 'info' });
      setReview(null);
      fetchNotaries();
    } catch (err) {
      setSnack({ open: true, msg: err.response?.data?.message || 'Reset failed.', severity: 'error' });
    } finally {
      setActionId(null);
    }
  };

  const handleReject = async (reason) => {
    if (!review) return;
    const name = review.user?.name || 'Notary';
    setActionId(review._id);
    try {
      await api.post(`/admin/notaries/${review._id}/reject`, { reason: reason || undefined });
      setSnack({ open: true, msg: `${name}'s profile rejected.`, severity: 'info' });
      setReview(null);
      fetchNotaries();
    } catch (err) {
      setSnack({ open: true, msg: err.response?.data?.message || 'Rejection failed.', severity: 'error' });
    } finally {
      setActionId(null);
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

                      return (
                        <TableRow
                          key={np._id}
                          hover
                          onClick={() => setReview(np)}
                          sx={{ cursor: 'pointer', '& td': { borderBottom: '1px solid var(--color-border)', py: 1 } }}
                        >
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
                            <Button
                              size="small" variant="outlined"
                              onClick={(event) => { event.stopPropagation(); setReview(np); }}
                              sx={{ fontSize: '0.7rem', py: 0.4, px: 1.5, borderRadius: `${RADIUS.md}px`, minWidth: 72 }}
                            >
                              Review
                            </Button>
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

      {review && (
        <ApplicationReviewDialog
          open
          onClose={() => setReview(null)}
          name={review.user?.name}
          status={STATUS_COLORS[review.verificationStatus || (review.isVerified ? 'approved' : 'pending')] || STATUS_COLORS.pending}
          submittedAt={formatWhen(review.createdAt)}
          priorRejection={review.rejectionReason}
          documents={notaryDocuments(review)}
          canVerify={(review.verificationStatus || (review.isVerified ? 'approved' : 'pending')) !== 'approved'}
          canReject={['pending', 'under_review'].includes(review.verificationStatus || (review.isVerified ? 'approved' : 'pending'))}
          canReset={['approved', 'rejected'].includes(review.verificationStatus || (review.isVerified ? 'approved' : 'pending'))}
          busy={actionId === review._id}
          onApprove={handleVerify}
          onReject={handleReject}
          onReset={handleReset}
          sections={[
            {
              title: 'Contact',
              items: [
                { label: 'Phone', value: review.user?.phone },
                { label: 'Email', value: review.user?.email },
                { label: 'State', value: review.user?.state },
                { label: 'District', value: review.user?.district },
                { label: 'Pincode', value: review.user?.pincode },
                { label: 'Language', value: review.user?.preferredLanguage },
              ],
            },
            {
              title: 'Registration',
              items: [
                { label: 'Registration number', value: review.notaryRegistrationNumber },
                { label: 'Registration state', value: review.registrationState },
                { label: 'Appointing authority', value: review.appointingAuthority },
                { label: 'Appointment year', value: review.appointmentYear },
                { label: 'Experience', value: review.experience != null ? `${review.experience} years` : '' },
                { label: 'Languages', value: listText(review.languages) },
                { label: 'Practising states', value: listText(review.practicingStates), full: true },
                { label: 'Bio', value: review.bio, full: true },
                { label: 'Accepting requests', value: review.isAcceptingRequests ? 'Yes' : 'No' },
                { label: 'Weekly hours', value: availabilityText(review.availability), full: true },
              ],
            },
          ]}
        />
      )}

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
