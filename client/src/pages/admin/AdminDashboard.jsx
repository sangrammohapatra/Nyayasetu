import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';
import LinearProgress from '@mui/material/LinearProgress';

import AnimatedPage from '../../components/ui/AnimatedPage';
import GlassCard from '../../components/ui/GlassCard';
import api from '../../services/api';
import { SHADOWS } from '../../theme/tokens';

/* ── Stat card ───────────────────────────────────────────────────────────── */
function StatCard({ icon, label, value, sub, onClick, color }) {
  return (
    <motion.div whileHover={{ y: -3 }} transition={{ duration: 0.2 }}>
      <GlassCard
        onClick={onClick}
        sx={{
          p: 2.5,
          cursor: onClick ? 'pointer' : 'default',
          borderTop: color ? `3px solid ${color}` : undefined,
          '&:hover': onClick ? { boxShadow: SHADOWS.md } : {},
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
          <Typography sx={{ fontSize: 30, lineHeight: 1 }}>{icon}</Typography>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {label}
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 800, color: 'var(--color-text)', lineHeight: 1.1, mt: 0.25 }}>
              {value ?? '—'}
            </Typography>
            {sub && (
              <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)', display: 'block', mt: 0.25 }}>
                {sub}
              </Typography>
            )}
          </Box>
        </Box>
      </GlassCard>
    </motion.div>
  );
}

/* ── Horizontal bar metric ───────────────────────────────────────────────── */
function MetricBar({ label, value, max, color }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <Box sx={{ mb: 1.75 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.4 }}>
        <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)', fontWeight: 600 }}>{label}</Typography>
        <Typography variant="caption" sx={{ fontWeight: 700, color: 'var(--color-text)' }}>
          {value?.toLocaleString('en-IN') ?? '—'}
        </Typography>
      </Box>
      <LinearProgress
        variant="determinate" value={pct}
        sx={{
          height: 6, borderRadius: 3,
          background: 'var(--color-border)',
          '& .MuiLinearProgress-bar': { background: color || 'var(--color-primary)', borderRadius: 3 },
        }}
      />
    </Box>
  );
}

/* ── Main page ───────────────────────────────────────────────────────────── */
export default function AdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get('/admin/stats')
      .then(({ data }) => setStats(data))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load stats'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AnimatedPage>
      <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: 1200, mx: 'auto' }}>

        {/* Header */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h5" sx={{ fontFamily: "'Playfair Display',serif", fontWeight: 700, color: 'var(--color-text)' }}>
            ⚖️ Dashboard
          </Typography>
          <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)', mt: 0.5 }}>
            Platform overview &amp; analytics
          </Typography>
        </Box>

        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
            <CircularProgress sx={{ color: 'var(--color-primary)' }} />
          </Box>
        )}

        {error && <Alert severity="error" sx={{ borderRadius: 2 }}>{error}</Alert>}

        {stats && (
          <>
            {/* KPI cards */}
            <Grid container spacing={2} sx={{ mb: 4 }}>
              {[
                { icon: '👥', label: 'Total Users',      value: stats.totalUsers?.toLocaleString('en-IN'),        color: '#1976d2', onClick: () => navigate('/admin/users') },
                { icon: '📄', label: 'Documents',        value: stats.totalDocuments?.toLocaleString('en-IN'),     color: '#0288d1' },
                { icon: '👨‍⚖️', label: 'Active Lawyers',  value: stats.activeLawyers?.toLocaleString('en-IN'),      color: '#7b1fa2', onClick: () => navigate('/admin/lawyers') },
                { icon: '🆕', label: "Today's Signups",  value: stats.todaySignups?.toLocaleString('en-IN'),       color: '#ed6c02', sub: 'new users today' },
                {
                  icon: '💰', label: 'Revenue',
                  value: stats.totalPayments != null ? `₹${(stats.totalPayments / 100).toLocaleString('en-IN')}` : null,
                  color: '#2e7d32',
                },
                { icon: '🔔', label: 'Active Subs',      value: stats.activeSubscriptions?.toLocaleString('en-IN'), color: '#6a1b9a', sub: 'paid subscribers' },
              ].map((s) => (
                <Grid item xs={6} sm={4} md={2} key={s.label}>
                  <StatCard {...s} />
                </Grid>
              ))}
            </Grid>

            <Divider sx={{ borderColor: 'var(--color-border)', mb: 4 }} />

            {/* Breakdown charts + quick nav */}
            <Grid container spacing={3} sx={{ mb: 4 }}>
              <Grid item xs={12} md={5}>
                <GlassCard sx={{ p: 2.5, height: '100%' }}>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: 'var(--color-text)', mb: 2 }}>
                    👥 User Breakdown
                  </Typography>
                  <MetricBar label="Total Users"        value={stats.totalUsers}           max={stats.totalUsers}                        color="#1976d2" />
                  <MetricBar label="Active Lawyers"     value={stats.activeLawyers}        max={stats.totalUsers}                        color="#7b1fa2" />
                  <MetricBar label="Active Subscribers" value={stats.activeSubscriptions}  max={stats.totalUsers}                        color="#2e7d32" />
                  <MetricBar label="Today's Signups"    value={stats.todaySignups}         max={Math.max(stats.todaySignups ?? 0, 1)}    color="#ed6c02" />
                </GlassCard>
              </Grid>

              <Grid item xs={12} md={4}>
                <GlassCard sx={{ p: 2.5, height: '100%' }}>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: 'var(--color-text)', mb: 2 }}>
                    📄 Content &amp; Revenue
                  </Typography>
                  <MetricBar label="Documents Generated" value={stats.totalDocuments}  max={Math.max(stats.totalDocuments ?? 0, 1)}   color="#0288d1" />
                  <MetricBar
                    label="Revenue (₹)"
                    value={stats.totalPayments != null ? Math.round(stats.totalPayments / 100) : null}
                    max={Math.max(stats.totalPayments != null ? stats.totalPayments / 100 : 0, 1)}
                    color="#2e7d32"
                  />
                </GlassCard>
              </Grid>

              <Grid item xs={12} md={3}>
                <GlassCard sx={{ p: 2.5, height: '100%' }}>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: 'var(--color-text)', mb: 2 }}>
                    ⚡ Quick Actions
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {[
                      { icon: '👥', label: 'Manage Users',     path: '/admin/users' },
                      { icon: '👨‍⚖️', label: 'Verify Lawyers',  path: '/admin/lawyers' },
                      { icon: '📋', label: 'Edit Templates',   path: '/admin/templates' },
                    ].map((item) => (
                      <Box
                        key={item.path}
                        onClick={() => navigate(item.path)}
                        sx={{
                          display: 'flex', alignItems: 'center', gap: 1.5, px: 1.5, py: 1,
                          borderRadius: 2, cursor: 'pointer',
                          border: '1px solid var(--color-border)',
                          background: 'var(--color-bg)',
                          transition: 'all 0.15s',
                          '&:hover': { borderColor: 'var(--color-primary)', background: 'var(--color-primary-alpha)' },
                        }}
                      >
                        <Typography sx={{ fontSize: 18 }}>{item.icon}</Typography>
                        <Typography variant="caption" sx={{ fontWeight: 600, color: 'var(--color-text)' }}>
                          {item.label}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </GlassCard>
              </Grid>
            </Grid>

            <Alert severity="info" sx={{ borderRadius: 2 }}>
              Time-series charts (daily signups, revenue trends) will be available once a dedicated analytics endpoint is added to the server.
            </Alert>
          </>
        )}
      </Box>
    </AnimatedPage>
  );
}
