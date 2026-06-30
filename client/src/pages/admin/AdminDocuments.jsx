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

const ACCESS_COLORS = {
  free_tier:        { bg: 'rgba(97,97,97,0.1)',   color: '#616161' },
  subscription:     { bg: 'rgba(2,136,209,0.1)',  color: '#0288d1' },
  pay_per_doc:      { bg: 'rgba(46,125,50,0.1)',  color: '#2e7d32' },
  lawyer_generated: { bg: 'rgba(106,27,154,0.1)', color: '#6a1b9a' },
};

function AccessChip({ value }) {
  const c = ACCESS_COLORS[value] || ACCESS_COLORS.free_tier;
  return (
    <Chip label={value?.replace(/_/g, ' ')} size="small"
      sx={{ height: 20, fontSize: '0.68rem', fontWeight: 700, background: c.bg, color: c.color, border: 'none', textTransform: 'capitalize' }} />
  );
}

function DocumentDetail({ doc, onClose, onDeleteSuccess }) {
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' });

  if (!doc) return null;

  const handleDelete = async () => {
    setConfirmOpen(false);
    setActionLoading(true);
    try {
      await api.delete(`/admin/documents/${doc._id}`);
      setSnack({ open: true, message: 'Document removed successfully.', severity: 'success' });
      onDeleteSuccess(doc._id);
      setTimeout(onClose, 1200);
    } catch (err) {
      setSnack({ open: true, message: err.response?.data?.message || 'Delete failed.', severity: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  const fields = [
    ['Document ID', doc._id],
    ['Title', doc.title],
    ['User', doc.user ? `${doc.user.name} (${doc.user.email})` : '—'],
    ['Template Slug', doc.templateSlug || '—'],
    ['Access Type', doc.accessType?.replace(/_/g, ' ')],
    ['Paid', doc.isPaid ? 'Yes' : 'No'],
    ['Active', doc.isActive ? 'Yes' : 'No'],
    ['Created At', doc.createdAt ? new Date(doc.createdAt).toLocaleString('en-IN') : '—'],
  ];

  return (
    <Box sx={{ width: { xs: '100vw', sm: 440 }, p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <GradientHeading variant="h6" sx={{ fontFamily: TYPOGRAPHY.fontFamily.display, fontWeight: 700 }}>Document Detail</GradientHeading>
        <IconButton onClick={onClose} size="small">✕</IconButton>
      </Box>
      <Divider sx={{ mb: 2, borderColor: 'var(--color-border)' }} />

      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
        {fields.map(([label, value]) => (
          <Box key={label} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.6, borderBottom: '1px solid var(--color-border)', gap: 2 }}>
            <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)', fontWeight: 600, flexShrink: 0 }}>{label}</Typography>
            <Typography variant="caption" sx={{ color: 'var(--color-text)', fontWeight: 500, textAlign: 'right', fontFamily: label.includes('ID') || label.includes('Slug') ? 'monospace' : undefined, wordBreak: 'break-all' }}>
              {String(value)}
            </Typography>
          </Box>
        ))}

        <Box sx={{ mt: 2.5 }}>
          <Divider sx={{ mb: 2, borderColor: 'var(--color-border)' }} />
          <Alert severity="warning" sx={{ mb: 2, borderRadius: 2, fontSize: '0.78rem' }}>
            Deletion is permanent from the user's perspective and cannot be reversed from the UI.
          </Alert>
          <Button
            variant="contained" color="error" fullWidth
            disabled={actionLoading}
            onClick={() => setConfirmOpen(true)}
            startIcon={actionLoading ? <CircularProgress size={14} sx={{ color: '#fff' }} /> : null}
            sx={{ borderRadius: `${RADIUS.md}px`, fontWeight: 700, textTransform: 'none' }}
          >
            Delete Document
          </Button>
        </Box>
      </Box>

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>Delete Document?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            <strong>"{doc.title}"</strong> will be soft-deleted. The user will no longer see or access it. The record is retained in the database for audit purposes.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmOpen(false)} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button onClick={handleDelete} variant="contained" color="error" sx={{ textTransform: 'none', fontWeight: 700 }}>Delete</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snack.open} autoHideDuration={4000} onClose={() => setSnack((s) => ({ ...s, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={snack.severity} onClose={() => setSnack((s) => ({ ...s, open: false }))} sx={{ borderRadius: 2 }}>{snack.message}</Alert>
      </Snackbar>
    </Box>
  );
}

export default function AdminDocuments() {
  const [documents, setDocuments] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [accessType, setAccessType] = useState('');
  const [selected, setSelected] = useState(null);

  const fetchDocuments = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({
      page: page + 1, limit: rowsPerPage,
      ...(search     && { search }),
      ...(accessType && { accessType }),
    });
    api.get(`/admin/documents?${params}`)
      .then(({ data }) => { setDocuments(data.documents || []); setTotal(data.pagination?.total || 0); })
      .catch((err) => setError(err.response?.data?.message || 'Failed to load documents'))
      .finally(() => setLoading(false));
  }, [page, rowsPerPage, search, accessType]);

  useEffect(() => { fetchDocuments(); }, [fetchDocuments]);

  const handleDeleteSuccess = (deletedId) => {
    setDocuments((prev) => prev.filter((d) => d._id !== deletedId));
    setTotal((t) => t - 1);
    setSelected(null);
  };

  return (
    <AnimatedPage>
      <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: 1200, mx: 'auto' }}>
        <GradientHeading variant="h5" sx={{ fontFamily: TYPOGRAPHY.fontFamily.display, fontWeight: 700, mb: 3 }}>
          📄 Documents
        </GradientHeading>

        <GlassCard sx={{ p: 2, mb: 2 }}>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            <TextField size="small" placeholder="Search by title, user name or email…"
              value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              sx={{ flex: '1 1 220px', '& .MuiOutlinedInput-root': { borderRadius: `${RADIUS.md}px` } }} />
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel>Access Type</InputLabel>
              <Select label="Access Type" value={accessType} onChange={(e) => { setAccessType(e.target.value); setPage(0); }} sx={{ borderRadius: `${RADIUS.md}px` }}>
                <MenuItem value="">All</MenuItem>
                {['free_tier', 'subscription', 'pay_per_doc', 'lawyer_generated'].map((a) => (
                  <MenuItem key={a} value={a}>{a.replace(/_/g, ' ')}</MenuItem>
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
                  <TableCell>Title</TableCell>
                  <TableCell>User</TableCell>
                  <TableCell>Template</TableCell>
                  <TableCell>Access</TableCell>
                  <TableCell>Paid</TableCell>
                  <TableCell>Created</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading
                  ? Array.from({ length: 8 }).map((_, i) => (
                      <TableRow key={i}>{Array.from({ length: 6 }).map((_, j) => <TableCell key={j}><Skeleton variant="text" height={20} /></TableCell>)}</TableRow>
                    ))
                  : documents.map((d) => (
                      <TableRow key={d._id} hover onClick={() => setSelected(d)}
                        sx={{ cursor: 'pointer', '& td': { borderBottom: '1px solid var(--color-border)', py: 1 } }}>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 600, color: 'var(--color-text)', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {d.title}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 600, color: 'var(--color-text)' }}>{d.user?.name || '—'}</Typography>
                          <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)' }}>{d.user?.email || ''}</Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'var(--color-text-secondary)' }}>{d.templateSlug || '—'}</Typography>
                        </TableCell>
                        <TableCell><AccessChip value={d.accessType} /></TableCell>
                        <TableCell>
                          <Chip
                            label={d.isPaid ? 'Paid' : 'Free'}
                            size="small"
                            sx={{ height: 18, fontSize: '0.65rem', fontWeight: 700, border: 'none',
                              background: d.isPaid ? 'rgba(46,125,50,0.1)' : 'rgba(97,97,97,0.1)',
                              color: d.isPaid ? '#2e7d32' : '#616161',
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)' }}>
                            {d.createdAt ? new Date(d.createdAt).toLocaleDateString('en-IN') : '—'}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                {!loading && documents.length === 0 && (
                  <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                    <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)' }}>No documents found</Typography>
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
        <DocumentDetail
          doc={selected}
          onClose={() => setSelected(null)}
          onDeleteSuccess={handleDeleteSuccess}
        />
      </Drawer>
    </AnimatedPage>
  );
}
