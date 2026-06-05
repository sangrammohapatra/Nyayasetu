/**
 * client/src/pages/lawyer/LawyerHome.jsx
 */

import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import {
  motion,
  useMotionValue,
  useTransform,
  animate,
  AnimatePresence,
} from 'framer-motion';

import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import Divider from '@mui/material/Divider';
import Skeleton from '@mui/material/Skeleton';
import Avatar from '@mui/material/Avatar';
import CircularProgress from '@mui/material/CircularProgress';

import { selectUser } from '../../store/slices/authSlice';
import {
  fetchConsultations,
  fetchMyClients,
  selectConsultations,
  selectClients,
  updateLawyerProfile,
  selectMyLawyerProfile,
} from '../../store/slices/lawyerSlice';
import AnimatedPage from '../../components/ui/AnimatedPage';
import GlassCard from '../../components/ui/GlassCard';
import { RADIUS, SHADOWS } from '../../theme/tokens';
import api from '../../services/api';

// ─── Animated counter ─────────────────────────────────────────────────────────
function AnimatedCounter({ target, prefix = '', suffix = '', duration = 1.6 }) {
  const mv = useMotionValue(0);
  const rounded = useTransform(mv, (v) => Math.round(v));
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const ctrl = animate(mv, target, { duration, ease: 'easeOut' });
    const unsub = rounded.on('change', setDisplay);
    return () => { ctrl.stop(); unsub(); };
  }, [target]);
  return <>{prefix}{display.toLocaleString('en-IN')}{suffix}</>;
}

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, prefix = '', suffix = '', color, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
    >
      <Box sx={{
        p: 2.5, borderRadius: `${RADIUS.xl}px`,
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        boxShadow: SHADOWS.sm,
      }}>
        <Box sx={{
          width: 44, height: 44, borderRadius: `${RADIUS.md}px`,
          background: color || 'var(--color-primary-alpha)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22, mb: 1.5,
        }}>
          {icon}
        </Box>
        <Typography variant="h4" sx={{ fontWeight: 800, color: 'var(--color-text)', lineHeight: 1.1, mb: 0.25 }}>
          <AnimatedCounter target={value} prefix={prefix} suffix={suffix} />
        </Typography>
        <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)' }}>{label}</Typography>
      </Box>
    </motion.div>
  );
}

// ─── Activity feed item ───────────────────────────────────────────────────────
function ActivityItem({ item, delay }) {
  const ICONS = { document: '📄', hearing: '⚖️', consultation: '📅', case: '📋' };
  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.32 }}
    >
      <Box sx={{
        display: 'flex', alignItems: 'flex-start', gap: 1.5,
        py: 1.25, borderBottom: '1px solid var(--color-border)',
        '&:last-child': { borderBottom: 'none' },
      }}>
        <Box sx={{
          width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
          background: 'var(--color-primary-alpha)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16,
        }}>
          {ICONS[item.type] || '🔔'}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" sx={{ color: 'var(--color-text)', lineHeight: 1.4 }}>
            {item.text}
          </Typography>
          <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)' }}>
            {item.time}
          </Typography>
        </Box>
      </Box>
    </motion.div>
  );
}

// ─── Pending consultation card ────────────────────────────────────────────────
function PendingConsultationCard({ consultation, onAccept, onReject }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState('');

  const act = async (action) => {
    setBusy(action);
    try { await action === 'accept' ? onAccept(consultation._id) : onReject(consultation._id); }
    finally { setBusy(''); }
  };

  const scheduled = consultation.scheduledAt
    ? new Date(consultation.scheduledAt).toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : '—';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
    >
      <Box sx={{
        p: 2, borderRadius: `${RADIUS.lg}px`,
        border: '1.5px solid var(--color-warning)',
        background: 'rgba(230,81,0,0.06)',
        display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap',
      }}>
        <Box sx={{ flex: 1, minWidth: 160 }}>
          <Typography variant="body2" sx={{ fontWeight: 700, color: 'var(--color-text)' }}>
            {consultation.citizen?.name || 'Client'}
          </Typography>
          <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)' }}>
            {consultation.mode} · {scheduled}
          </Typography>
          {consultation.notes && (
            <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)', display: 'block',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220 }}>
              "{consultation.notes}"
            </Typography>
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button size="small" variant="contained" onClick={() => act('accept')} disabled={!!busy}
            sx={{ borderRadius: `${RADIUS.md}px`, fontWeight: 700, background: 'var(--color-success)',
              fontSize: '0.75rem', py: 0.5, '&:hover': { background: 'var(--color-success)' } }}>
            {busy === 'accept' ? <CircularProgress size={14} sx={{ color: '#fff' }} /> : '✓ Accept'}
          </Button>
          <Button size="small" variant="outlined" onClick={() => act('reject')} disabled={!!busy}
            sx={{ borderRadius: `${RADIUS.md}px`, fontWeight: 600, fontSize: '0.75rem', py: 0.5,
              borderColor: 'var(--color-error)', color: 'var(--color-error)' }}>
            {busy === 'reject' ? <CircularProgress size={14} sx={{ color: 'var(--color-error)' }} /> : '✕'}
          </Button>
        </Box>
      </Box>
    </motion.div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
function LawyerHome() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const user = useSelector(selectUser);
  const consultations = useSelector(selectConsultations);
  const clients = useSelector(selectClients);
  const profile = useSelector(selectMyLawyerProfile);

  const [stats, setStats] = useState({ clientsCount: 0, casesMonth: 0, pendingCount: 0, earningsMonth: 0 });
  const [available, setAvailable] = useState(profile?.isAvailableForConsultation ?? true);
  const [activities, setActivities] = useState([]);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    dispatch(fetchConsultations({ status: 'requested' }));
    dispatch(fetchMyClients());
    api.get('/subscriptions/current').catch(() => {});

    Promise.all([
      api.get('/lawyers/me/clients').catch(() => ({ data: { clients: [] } })),
      api.get('/consultations?status=requested&limit=20').catch(() => ({ data: { items: [] } })),
      api.get('/payments/history?type=consultation&limit=100').catch(() => ({ data: { items: [] } })),
    ]).then(([clientsRes, consRes, paymentsRes]) => {
      const clientList = clientsRes.data?.clients || [];
      const consList = consRes.data?.items || [];
      const payList = paymentsRes.data?.items || [];
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEarnings = payList
        .filter((p) => p.status === 'paid' && new Date(p.createdAt) >= monthStart)
        .reduce((s, p) => s + (p.lawyerEarnings || 0), 0);

      setStats({
        clientsCount: clientList.length,
        casesMonth: clientList.reduce((s, c) => s + (c.sharedCases?.length || 0), 0),
        pendingCount: consList.length,
        earningsMonth: Math.round(monthEarnings / 100),
      });

      const feed = [];
      clientList.slice(0, 5).forEach((c) => {
        if (c.consultations?.[0]) {
          feed.push({ type: 'consultation', text: `${c.user?.name} requested a consultation`, time: new Date(c.consultations[0].createdAt).toLocaleDateString('en-IN') });
        }
        if (c.sharedCases?.[0]) {
          feed.push({ type: 'case', text: `${c.user?.name} shared case ${c.sharedCases[0].cnrNumber}`, time: new Date(c.sharedCases[0].createdAt || Date.now()).toLocaleDateString('en-IN') });
        }
      });
      setActivities(feed.slice(0, 8));
    }).finally(() => setLoadingStats(false));
  }, [dispatch]);

  const pending = consultations.filter((c) => c.status === 'requested');

  const handleAccept = async (id) => {
    await api.patch(`/consultations/${id}/accept`);
    dispatch(fetchConsultations({ status: 'requested' }));
  };
  const handleReject = async (id) => {
    await api.patch(`/consultations/${id}/reject`);
    dispatch(fetchConsultations({ status: 'requested' }));
  };

  const handleAvailabilityToggle = async (e) => {
    const val = e.target.checked;
    setAvailable(val);
    dispatch(updateLawyerProfile({ isAvailableForConsultation: val }));
  };

  const firstName = user?.name?.split(' ')[0] || 'Advocate';

  return (
    <AnimatedPage>
      <Box sx={{ p: { xs: 2, sm: 3, md: 4 }, maxWidth: 1100, mx: 'auto', pb: { xs: 10, md: 4 } }}>
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.38 }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
            <Box>
              <Typography variant="h4" sx={{ fontFamily: "'Playfair Display',serif", fontWeight: 700, color: 'var(--color-text)' }}>
                ⚖️ {t('lawyer.welcome', `Welcome, Adv. ${firstName}`, { name: firstName })}
              </Typography>
              <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)', mt: 0.25 }}>
                {new Date().toLocaleDateString('en-IN', { dateStyle: 'full' })}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
              <FormControlLabel
                control={
                  <Switch checked={available} onChange={handleAvailabilityToggle}
                    sx={{ '& .MuiSwitch-thumb': { background: available ? 'var(--color-success)' : 'var(--color-border)' } }} />
                }
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', background: available ? 'var(--color-success)' : 'var(--color-text-secondary)' }} />
                    <Typography variant="body2" sx={{ fontWeight: 600, color: available ? 'var(--color-success)' : 'var(--color-text-secondary)' }}>
                      {available ? t('lawyer.available', 'Accepting Consultations') : t('lawyer.unavailable', 'Unavailable')}
                    </Typography>
                  </Box>
                }
              />
            </Box>
          </Box>
        </motion.div>

        {/* Stats */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {loadingStats
            ? Array.from({ length: 4 }).map((_, i) => (
                <Grid item xs={6} sm={3} key={i}>
                  <Skeleton variant="rectangular" height={120} sx={{ borderRadius: `${RADIUS.xl}px` }} />
                </Grid>
              ))
            : [
                { icon: '👥', label: t('lawyer.active_clients', 'Active Clients'), value: stats.clientsCount, color: 'var(--color-primary-alpha)', delay: 0.05 },
                { icon: '📋', label: t('lawyer.cases_month', 'Cases This Month'), value: stats.casesMonth, color: 'rgba(46,125,50,0.1)', delay: 0.12 },
                { icon: '📅', label: t('lawyer.pending_consultations', 'Pending Consultations'), value: stats.pendingCount, color: 'rgba(230,81,0,0.1)', delay: 0.19 },
                { icon: '💰', label: t('lawyer.earnings_month', 'Earnings (Month)'), value: stats.earningsMonth, prefix: '₹', color: 'rgba(2,119,189,0.1)', delay: 0.26 },
              ].map((s) => (
                <Grid item xs={6} sm={3} key={s.label}>
                  <StatCard {...s} />
                </Grid>
              ))}
        </Grid>

        {/* Pending consultations */}
        <AnimatePresence>
          {pending.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
            >
              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" sx={{ fontFamily: "'Playfair Display',serif", fontWeight: 700, color: 'var(--color-text)', mb: 1.5 }}>
                  🔔 {t('lawyer.pending_title', 'Consultations Awaiting Your Response')}
                  <Chip label={pending.length} size="small" sx={{ ml: 1, background: 'var(--color-warning)', color: '#fff', fontWeight: 800, height: 20, fontSize: '0.7rem' }} />
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  {pending.slice(0, 5).map((c) => (
                    <PendingConsultationCard key={c._id} consultation={c} onAccept={handleAccept} onReject={handleReject} />
                  ))}
                </Box>
              </Box>
              <Divider sx={{ borderColor: 'var(--color-border)', mb: 3 }} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Quick actions + Activity feed */}
        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
              <Box sx={{ p: 2.5, borderRadius: `${RADIUS.xl}px`, border: '1px solid var(--color-border)', background: 'var(--color-surface)', boxShadow: SHADOWS.sm }}>
                <Typography variant="h6" sx={{ fontFamily: "'Playfair Display',serif", fontWeight: 700, color: 'var(--color-text)', mb: 2 }}>
                  {t('lawyer.quick_actions', 'Quick Actions')}
                </Typography>
                {[
                  { icon: '👥', label: t('lawyer.view_clients', 'View Clients'), path: '/lawyer/clients', color: 'var(--color-primary-alpha)' },
                  { icon: '📅', label: t('lawyer.consultations', 'Consultations'), path: '/lawyer/consultations', color: 'rgba(230,81,0,0.1)' },
                  { icon: '💰', label: t('lawyer.earnings', 'Earnings'), path: '/lawyer/earnings', color: 'rgba(46,125,50,0.1)' },
                  { icon: '👤', label: t('lawyer.profile', 'My Profile'), path: '/lawyer/profile', color: 'rgba(2,119,189,0.1)' },
                ].map((action, i) => (
                  <motion.div key={action.path} whileHover={{ x: 4 }} transition={{ duration: 0.15 }}>
                    <Box onClick={() => navigate(action.path)} sx={{
                      display: 'flex', alignItems: 'center', gap: 1.5,
                      p: 1.25, mb: 0.75, borderRadius: `${RADIUS.md}px`,
                      cursor: 'pointer', transition: 'background 0.15s',
                      '&:hover': { background: 'var(--color-overlay)' },
                    }}>
                      <Box sx={{ width: 36, height: 36, borderRadius: `${RADIUS.md}px`, background: action.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                        {action.icon}
                      </Box>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: 'var(--color-text)' }}>{action.label}</Typography>
                      <Typography sx={{ ml: 'auto', color: 'var(--color-text-secondary)', fontSize: 14 }}>›</Typography>
                    </Box>
                  </motion.div>
                ))}
              </Box>
            </motion.div>
          </Grid>

          <Grid item xs={12} md={8}>
            <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 }}>
              <Box sx={{ p: 2.5, borderRadius: `${RADIUS.xl}px`, border: '1px solid var(--color-border)', background: 'var(--color-surface)', boxShadow: SHADOWS.sm }}>
                <Typography variant="h6" sx={{ fontFamily: "'Playfair Display',serif", fontWeight: 700, color: 'var(--color-text)', mb: 2 }}>
                  {t('lawyer.recent_activity', 'Recent Activity')}
                </Typography>
                {activities.length === 0 ? (
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <Typography sx={{ fontSize: 36, mb: 1 }}>📋</Typography>
                    <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)' }}>
                      {t('lawyer.no_activity', 'No recent activity. Your client feed will appear here.')}
                    </Typography>
                  </Box>
                ) : (
                  activities.map((item, i) => (
                    <ActivityItem key={i} item={item} delay={i * 0.06} />
                  ))
                )}
              </Box>
            </motion.div>
          </Grid>
        </Grid>
      </Box>
    </AnimatedPage>
  );
}

export default LawyerHome;
