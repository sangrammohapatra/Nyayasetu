import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartTooltip, ResponsiveContainer,
} from 'recharts';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import Skeleton from '@mui/material/Skeleton';
import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';
import LinearProgress from '@mui/material/LinearProgress';

import AnimatedPage from '../../components/ui/AnimatedPage';
import GlassCard from '../../components/ui/GlassCard';
import GradientHeading from '../../components/ui/GradientHeading';
import api from '../../services/api';
import { SHADOWS, TYPOGRAPHY } from '../../theme/tokens';

/* ── Stat card ───────────────────────────────────────────────────────────── */
function StatCard({ icon, label, value, sub, onClick, color }) {
  const prefersReducedMotion = useReducedMotion();
  return (
    <motion.div
      whileHover={prefersReducedMotion ? undefined : { y: -3 }}
      transition={{ duration: 0.2 }}
      style={{ width: '100%' }}
    >
      <GlassCard
        onClick={onClick}
        sx={{
          p: 2.5,
          height: '100%',
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
            <GradientHeading variant="h5" sx={{ fontFamily: TYPOGRAPHY.fontFamily.display, fontWeight: 800, lineHeight: 1.1, mt: 0.25 }}>
              {value ?? '—'}
            </GradientHeading>
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

/* ── Trend area chart ────────────────────────────────────────────────────── */
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function fmtDate(str) {
  if (!str) return '';
  const [, m, d] = str.split('-');
  return `${MONTHS[+m - 1]} ${+d}`;
}

function TrendChart({ id, data, dataKey, color, title, yFormatter }) {
  return (
    <GlassCard sx={{ p: 2.5, height: '100%' }}>
      <Typography variant="body2" sx={{ fontWeight: 700, color: 'var(--color-text)', mb: 2 }}>
        {title}
      </Typography>
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`grad-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={color} stopOpacity={0.28} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={(val, i) => i % 7 === 0 ? fmtDate(val) : ''}
            tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}
            axisLine={false} tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}
            axisLine={false} tickLine={false}
            width={yFormatter ? 52 : 32}
            tickFormatter={yFormatter}
          />
          <RechartTooltip
            labelFormatter={fmtDate}
            formatter={(val) => [yFormatter ? yFormatter(val) : val]}
            contentStyle={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Area
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            strokeWidth={2}
            fill={`url(#grad-${id})`}
            dot={false}
            activeDot={{ r: 4, fill: color, strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </GlassCard>
  );
}

/* ── Main page ───────────────────────────────────────────────────────────── */
export default function AdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats]           = useState(null);
  const [analytics, setAnalytics]   = useState(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);

  useEffect(() => {
    Promise.all([
      api.get('/admin/stats'),
      api.get('/admin/analytics'),
    ])
      .then(([{ data: s }, { data: a }]) => { setStats(s); setAnalytics(a); })
      .catch((err) => setError(err.response?.data?.message || 'Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, []);

  const revenueInRupees = stats?.totalPayments?.amountInRupees
    ?? (stats?.totalPayments != null && typeof stats.totalPayments === 'number'
        ? (stats.totalPayments / 100).toFixed(2)
        : null);

  return (
    <AnimatedPage>
      <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: 1200, mx: 'auto' }}>

        {/* Header */}
        <Box sx={{ mb: 3 }}>
          <GradientHeading variant="h5" sx={{ fontFamily: TYPOGRAPHY.fontFamily.display, fontWeight: 700 }}>
            ⚖️ Dashboard
          </GradientHeading>
          <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)', mt: 0.5 }}>
            Platform overview &amp; analytics
          </Typography>
        </Box>

        <AnimatePresence>
          {loading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              <Grid container spacing={2} sx={{ mb: 4 }}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <Grid item xs={6} sm={4} md={4} lg={2} key={i}>
                    <Skeleton variant="rounded" height={100} animation="wave" sx={{ borderRadius: 2, bgcolor: 'var(--color-surface)' }} />
                  </Grid>
                ))}
              </Grid>
              <Skeleton variant="rounded" height={220} animation="wave" sx={{ borderRadius: 2, bgcolor: 'var(--color-surface)', mb: 3 }} />
              <Grid container spacing={2}>
                {[1, 2].map((i) => (
                  <Grid item xs={12} md={6} key={i}>
                    <Skeleton variant="rounded" height={240} animation="wave" sx={{ borderRadius: 2, bgcolor: 'var(--color-surface)' }} />
                  </Grid>
                ))}
              </Grid>
            </motion.div>
          )}
        </AnimatePresence>

        {error && <Alert severity="error" sx={{ borderRadius: 2 }}>{error}</Alert>}

        {stats && (
          <>
            {/* KPI cards */}
            <Grid container spacing={2} sx={{ mb: 4 }} alignItems="stretch">
              {[
                { icon: '👥', label: 'Total Users',     value: stats.totalUsers?.toLocaleString('en-IN'),           color: '#1976d2', onClick: () => navigate('/admin/users') },
                { icon: '📄', label: 'Documents',       value: stats.totalDocuments?.toLocaleString('en-IN'),        color: '#0288d1' },
                { icon: '👨‍⚖️', label: 'Active Lawyers', value: stats.activeLawyers?.toLocaleString('en-IN'),          color: '#7b1fa2', onClick: () => navigate('/admin/lawyers') },
                { icon: '🆕', label: "Today's Signups", value: stats.todaySignups?.toLocaleString('en-IN'),          color: '#ed6c02', sub: 'new users today' },
                { icon: '💰', label: 'Revenue',         value: revenueInRupees != null ? `₹${Number(revenueInRupees).toLocaleString('en-IN')}` : '—', color: '#2e7d32' },
                { icon: '🔔', label: 'Active Subs',     value: stats.activeSubscriptions?.toLocaleString('en-IN'),   color: '#6a1b9a', sub: 'paid subscribers' },
              ].map((s) => (
                <Grid item xs={6} sm={4} md={4} lg={2} key={s.label} sx={{ display: 'flex' }}>
                  <StatCard {...s} />
                </Grid>
              ))}
            </Grid>

            <Divider sx={{ borderColor: 'var(--color-border)', mb: 4 }} />

            {/* Breakdown + quick actions */}
            <Grid container spacing={3} sx={{ mb: 4 }}>
              <Grid item xs={12} md={6} lg={5}>
                <GlassCard sx={{ p: 2.5, height: '100%' }}>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: 'var(--color-text)', mb: 2 }}>
                    👥 User Breakdown
                  </Typography>
                  <MetricBar label="Total Users"        value={stats.totalUsers}          max={stats.totalUsers}                     color="#1976d2" />
                  <MetricBar label="Active Lawyers"     value={stats.activeLawyers}       max={stats.totalUsers}                     color="#7b1fa2" />
                  <MetricBar label="Active Subscribers" value={stats.activeSubscriptions} max={stats.totalUsers}                     color="#2e7d32" />
                  <MetricBar label="Today's Signups"    value={stats.todaySignups}        max={Math.max(stats.todaySignups ?? 0, 1)} color="#ed6c02" />
                </GlassCard>
              </Grid>

              <Grid item xs={12} md={6} lg={4}>
                <GlassCard sx={{ p: 2.5, height: '100%' }}>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: 'var(--color-text)', mb: 2 }}>
                    📄 Content &amp; Revenue
                  </Typography>
                  <MetricBar label="Documents Generated" value={stats.totalDocuments} max={Math.max(stats.totalDocuments ?? 0, 1)} color="#0288d1" />
                  <MetricBar
                    label="Revenue (₹)"
                    value={revenueInRupees != null ? Math.round(Number(revenueInRupees)) : null}
                    max={Math.max(revenueInRupees != null ? Number(revenueInRupees) : 0, 1)}
                    color="#2e7d32"
                  />
                </GlassCard>
              </Grid>

              <Grid item xs={12} md={12} lg={3}>
                <GlassCard sx={{ p: 2.5, height: '100%' }}>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: 'var(--color-text)', mb: 2 }}>
                    ⚡ Quick Actions
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {[
                      { icon: '👥', label: 'Manage Users',   path: '/admin/users' },
                      { icon: '👨‍⚖️', label: 'Verify Lawyers', path: '/admin/lawyers' },
                      { icon: '📋', label: 'Edit Templates',  path: '/admin/templates' },
                      { icon: '🔍', label: 'Audit Log',       path: '/admin/audit-logs' },
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

            {/* Time-series charts */}
            {analytics && (
              <>
                <Divider sx={{ borderColor: 'var(--color-border)', mb: 4 }} />
                <Grid container spacing={3} sx={{ mb: 4 }}>
                  <Grid item xs={12} md={6}>
                    <TrendChart
                      id="signups"
                      data={analytics.signups}
                      dataKey="count"
                      color="#1976d2"
                      title="📈 Daily Signups — Last 30 Days"
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TrendChart
                      id="revenue"
                      data={analytics.revenue}
                      dataKey="amount"
                      color="#2e7d32"
                      title="💰 Daily Revenue — Last 30 Days"
                      yFormatter={(v) => `₹${v}`}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TrendChart
                      id="documents"
                      data={analytics.documents}
                      dataKey="count"
                      color="#0288d1"
                      title="📄 Documents Generated — Last 30 Days"
                    />
                  </Grid>
                </Grid>
              </>
            )}
          </>
        )}
      </Box>
    </AnimatedPage>
  );
}
