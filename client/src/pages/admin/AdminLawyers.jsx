import React, { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
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
import Tooltip from '@mui/material/Tooltip';

import AnimatedPage from '../../components/ui/AnimatedPage';
import GlassCard from '../../components/ui/GlassCard';
import GradientHeading from '../../components/ui/GradientHeading';
import api from '../../services/api';
import { RADIUS, TYPOGRAPHY } from '../../theme/tokens';

export default function AdminLawyers() {
  const [lawyers, setLawyers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [verifiedFilter, setVerifiedFilter] = useState('');
  const [verifying, setVerifying] = useState(null);
  const [snack, setSnack] = useState({ open: false, msg: '', severity: 'success' });

  const fetchLawyers = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({
      page: page + 1,
      limit: rowsPerPage,
      persona: 'lawyer',
      ...(search && { search }),
    });
    api.get(`/admin/users?${params}`)
      .then(({ data }) => {
        let list = data.users || [];
        if (verifiedFilter === 'verified') list = list.filter((u) => u.lawyerProfile?.isVerified);
        if (verifiedFilter === 'pending') list = list.filter((u) => !u.lawyerProfile?.isVerified);
        setLawyers(list);
        setTotal(data.pagination?.total || 0);
      })
      .catch((err) => setError(err.response?.data?.message || 'Failed to load lawyers'))
      .finally(() => setLoading(false));
  }, [page, rowsPerPage, search, verifiedFilter]);

  useEffect(() => { fetchLawyers(); }, [fetchLawyers]);

  const handleVerify = async (lawyerId, name) => {
    setVerifying(lawyerId);
    try {
      await api.post(`/admin/lawyers/${lawyerId}/verify`);
      setSnack({ open: true, msg: `${name} has been verified successfully.`, severity: 'success' });
      fetchLawyers();
    } catch (err) {
      setSnack({ open: true, msg: err.response?.data?.message || 'Verification failed.', severity: 'error' });
    } finally {
      setVerifying(null);
    }
  };

  return (
    <AnimatedPage>
      <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: 1200, mx: 'auto' }}>
        <GradientHeading variant="h5" sx={{ fontFamily: TYPOGRAPHY.fontFamily.display, fontWeight: 700, mb: 3 }}>
          👨‍⚖️ Lawyers
        </GradientHeading>

        {/* Filters */}
        <GlassCard sx={{ p: 2, mb: 2 }}>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            <TextField
              size="small" placeholder="Search name, email…"
              value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              sx={{ flex: '1 1 200px', '& .MuiOutlinedInput-root': { borderRadius: `${RADIUS.md}px` } }}
            />
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel>Verification</InputLabel>
              <Select label="Verification" value={verifiedFilter} onChange={(e) => { setVerifiedFilter(e.target.value); setPage(0); }}
                sx={{ borderRadius: `${RADIUS.md}px` }}>
                <MenuItem value="">All</MenuItem>
                <MenuItem value="verified">Verified</MenuItem>
                <MenuItem value="pending">Pending</MenuItem>
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
                  <TableCell>Plan</TableCell>
                  <TableCell>Bar ID</TableCell>
                  <TableCell>Specialisation</TableCell>
                  <TableCell>Status</TableCell>
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
                  : lawyers.map((u) => {
                      const lp = u.lawyerProfile || {};
                      const isVerified = lp.isVerified;
                      return (
                        <TableRow key={u._id} sx={{ '& td': { borderBottom: '1px solid var(--color-border)', py: 1 } }}>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontWeight: 600, color: 'var(--color-text)' }}>{u.name}</Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)' }}>{u.email}</Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)' }}>{u.plan || 'free'}</Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)', fontFamily: 'monospace' }}>
                              {lp.barCouncilId || '—'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)' }}>
                              {lp.specialisation?.slice(0, 2).join(', ') || '—'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            {isVerified ? (
                              <Chip label="Verified" size="small" sx={{ height: 20, fontSize: '0.68rem', fontWeight: 700, background: 'rgba(46,125,50,0.12)', color: '#2e7d32' }} />
                            ) : (
                              <Chip label="Pending" size="small" sx={{ height: 20, fontSize: '0.68rem', fontWeight: 700, background: 'rgba(237,108,2,0.12)', color: '#ed6c02' }} />
                            )}
                          </TableCell>
                          <TableCell align="right">
                            {!isVerified && (
                              <Button
                                size="small" variant="contained"
                                disabled={verifying === u._id}
                                onClick={() => handleVerify(u._id, u.name)}
                                sx={{
                                  fontSize: '0.7rem', py: 0.4, px: 1.5,
                                  borderRadius: `${RADIUS.md}px`,
                                  background: 'var(--color-primary)',
                                  minWidth: 80,
                                  '&:hover': { background: 'var(--color-primary-dark, var(--color-primary))' },
                                }}
                              >
                                {verifying === u._id ? <CircularProgress size={12} sx={{ color: '#fff' }} /> : 'Verify'}
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                {!loading && lawyers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                      <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)' }}>No lawyers found</Typography>
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

      <Snackbar open={snack.open} autoHideDuration={4000} onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={snack.severity} onClose={() => setSnack((s) => ({ ...s, open: false }))} sx={{ borderRadius: 2 }}>
          {snack.msg}
        </Alert>
      </Snackbar>
    </AnimatedPage>
  );
}
