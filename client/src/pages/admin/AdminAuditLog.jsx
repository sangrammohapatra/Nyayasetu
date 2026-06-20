/**
 * client/src/pages/admin/AdminAuditLog.jsx
 *
 * Paginated, filterable view of AuditLog entries for admins.
 * Calls GET /v1/admin/audit-logs
 */

import React, { useEffect, useState, useCallback } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';
import Alert from '@mui/material/Alert';
import Tooltip from '@mui/material/Tooltip';
import Divider from '@mui/material/Divider';

import AnimatedPage from '../../components/ui/AnimatedPage';
import GlassCard from '../../components/ui/GlassCard';
import GradientHeading from '../../components/ui/GradientHeading';
import { TYPOGRAPHY, RADIUS, SHADOWS } from '../../theme/tokens';
import api from '../../services/api';

// ── Severity colour per action prefix ────────────────────────────────────────

function actionColor(action = '') {
  if (action.startsWith('user.login') || action.startsWith('otp')) return '#1976d2';
  if (action.includes('failed') || action.includes('fail')) return '#c62828';
  if (action.includes('payment') || action.includes('subscription')) return '#2e7d32';
  if (action.includes('admin')) return '#7b1fa2';
  if (action.includes('document')) return '#0288d1';
  if (action.includes('lawyer')) return '#e65100';
  return 'var(--color-text-secondary)';
}

// ── Single row ────────────────────────────────────────────────────────────────

function LogRow({ log }) {
  const actor = log.user?.name || log.userSnapshot?.persona || 'anonymous';
  const email = log.user?.email || log.user?.phone || '';
  const ts = new Date(log.createdAt);
  const dateStr = ts.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const timeStr = ts.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <Box sx={{
      display: 'grid',
      gridTemplateColumns: { xs: '1fr', sm: '160px 1fr 120px 80px' },
      gap: { xs: 0.5, sm: 1.5 },
      alignItems: 'center',
      px: 2, py: 1.25,
      borderBottom: '1px solid var(--color-border)',
      '&:hover': { background: 'var(--color-overlay)' },
      transition: 'background 0.15s',
    }}>
      {/* Timestamp */}
      <Box>
        <Typography variant="caption" sx={{ fontWeight: 600, color: 'var(--color-text)', display: 'block' }}>
          {dateStr}
        </Typography>
        <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)' }}>
          {timeStr}
        </Typography>
      </Box>

      {/* Action + actor */}
      <Box sx={{ minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
          <Typography variant="caption" sx={{
            fontWeight: 700, color: actionColor(log.action),
            fontFamily: 'monospace', fontSize: '0.72rem',
          }}>
            {log.action}
          </Typography>
          {log.entity && (
            <Chip label={log.entity} size="small" sx={{
              height: 16, fontSize: '0.6rem', fontWeight: 600,
              background: 'var(--color-overlay)', color: 'var(--color-text-secondary)',
            }} />
          )}
        </Box>
        <Tooltip title={email || ''}>
          <Typography variant="caption" sx={{
            color: 'var(--color-text-secondary)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block',
          }}>
            {actor}{email ? ` · ${email}` : ''}
          </Typography>
        </Tooltip>
        {log.errorMessage && (
          <Typography variant="caption" sx={{ color: 'var(--color-error)', display: 'block', mt: 0.25 }}>
            {log.errorMessage}
          </Typography>
        )}
      </Box>

      {/* IP + method */}
      <Box>
        <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)', display: 'block', fontFamily: 'monospace' }}>
          {log.ipAddress || '—'}
        </Typography>
        <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)' }}>
          {log.requestMethod} {log.responseStatus ? `· ${log.responseStatus}` : ''}
        </Typography>
      </Box>

      {/* Success badge */}
      <Box>
        <Chip
          label={log.success ? 'OK' : 'FAIL'}
          size="small"
          sx={{
            height: 20, fontSize: '0.65rem', fontWeight: 700,
            background: log.success ? 'rgba(46,125,50,0.12)' : 'rgba(198,40,40,0.12)',
            color: log.success ? 'var(--color-success)' : 'var(--color-error)',
          }}
        />
      </Box>
    </Box>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AdminAuditLog() {
  const [logs, setLogs]         = useState([]);
  const [total, setTotal]       = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage]         = useState(1);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);

  const [filterAction, setFilterAction] = useState('');
  const [filterEntity, setFilterEntity] = useState('');
  const [filterSuccess, setFilterSuccess] = useState('');

  const LIMIT = 50;

  const fetchLogs = useCallback(async (p = page) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: p, limit: LIMIT });
      if (filterAction.trim()) params.set('action', filterAction.trim());
      if (filterEntity)        params.set('entity', filterEntity);
      if (filterSuccess !== '') params.set('success', filterSuccess);

      const { data } = await api.get(`/admin/audit-logs?${params.toString()}`);
      setLogs(data.logs || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
      setPage(p);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  }, [filterAction, filterEntity, filterSuccess, page]);

  useEffect(() => {
    fetchLogs(1);
  }, []); // initial load only

  const handleSearch = () => fetchLogs(1);

  return (
    <AnimatedPage>
      <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: 1200, mx: 'auto' }}>

        {/* Header */}
        <Box sx={{ mb: 3 }}>
          <GradientHeading variant="h5" sx={{ fontFamily: TYPOGRAPHY.fontFamily.display, fontWeight: 700 }}>
            🔍 Audit Log
          </GradientHeading>
          <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)', mt: 0.5 }}>
            Platform-wide activity trail — {total.toLocaleString('en-IN')} entries
          </Typography>
        </Box>

        {/* Filters */}
        <GlassCard sx={{ p: 2, mb: 3 }}>
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <TextField
              size="small"
              label="Action"
              placeholder="e.g. document.generate"
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              sx={{ minWidth: 200, '& .MuiOutlinedInput-root': { borderRadius: `${RADIUS.md}px` } }}
            />

            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel>Entity</InputLabel>
              <Select
                value={filterEntity}
                label="Entity"
                onChange={(e) => setFilterEntity(e.target.value)}
                sx={{ borderRadius: `${RADIUS.md}px` }}
              >
                <MenuItem value="">All</MenuItem>
                {['User', 'Document', 'Payment', 'ChatSession', 'LawyerProfile', 'CaseTracker'].map((e) => (
                  <MenuItem key={e} value={e}>{e}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Outcome</InputLabel>
              <Select
                value={filterSuccess}
                label="Outcome"
                onChange={(e) => setFilterSuccess(e.target.value)}
                sx={{ borderRadius: `${RADIUS.md}px` }}
              >
                <MenuItem value="">All</MenuItem>
                <MenuItem value="true">Success</MenuItem>
                <MenuItem value="false">Failed</MenuItem>
              </Select>
            </FormControl>

            <Button
              variant="contained"
              onClick={handleSearch}
              disabled={loading}
              sx={{
                borderRadius: `${RADIUS.md}px`, fontWeight: 700,
                background: 'var(--color-primary)',
                '&:hover': { background: 'var(--color-primary-dark, var(--color-primary))' },
              }}
            >
              Apply
            </Button>
            <Button
              variant="outlined"
              onClick={() => { setFilterAction(''); setFilterEntity(''); setFilterSuccess(''); setTimeout(() => fetchLogs(1), 0); }}
              disabled={loading}
              sx={{ borderRadius: `${RADIUS.md}px`, borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
            >
              Reset
            </Button>
          </Box>
        </GlassCard>

        {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}

        {/* Table */}
        <GlassCard sx={{ overflow: 'hidden' }}>
          {/* Column headers */}
          <Box sx={{
            display: { xs: 'none', sm: 'grid' },
            gridTemplateColumns: '160px 1fr 120px 80px',
            gap: 1.5, px: 2, py: 1,
            background: 'var(--color-overlay)',
            borderBottom: '1px solid var(--color-border)',
          }}>
            {['Timestamp', 'Action / Actor', 'IP · Status', 'Outcome'].map((h) => (
              <Typography key={h} variant="caption" sx={{ fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                {h}
              </Typography>
            ))}
          </Box>

          {loading ? (
            <Box sx={{ p: 2 }}>
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} variant="rounded" height={52} sx={{ mb: 1, borderRadius: 1, bgcolor: 'var(--color-surface)' }} />
              ))}
            </Box>
          ) : logs.length === 0 ? (
            <Box sx={{ py: 8, textAlign: 'center' }}>
              <Typography sx={{ fontSize: 40, mb: 1 }}>📭</Typography>
              <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)' }}>
                No audit entries match the current filters.
              </Typography>
            </Box>
          ) : (
            logs.map((log) => <LogRow key={log._id} log={log} />)
          )}
        </GlassCard>

        {/* Pagination */}
        {totalPages > 1 && (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 1.5, mt: 3 }}>
            <Button
              variant="outlined" size="small" disabled={page <= 1 || loading}
              onClick={() => fetchLogs(page - 1)}
              sx={{ borderRadius: `${RADIUS.md}px`, borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
            >
              ← Prev
            </Button>
            <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)', fontWeight: 600 }}>
              Page {page} of {totalPages}
            </Typography>
            <Button
              variant="outlined" size="small" disabled={page >= totalPages || loading}
              onClick={() => fetchLogs(page + 1)}
              sx={{ borderRadius: `${RADIUS.md}px`, borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
            >
              Next →
            </Button>
          </Box>
        )}
      </Box>
    </AnimatedPage>
  );
}
