/**
 * NotaryHome.jsx — Notary's dashboard home
 */

import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { motion } from 'framer-motion';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';

import {
  fetchNotarizationRequests,
  selectNotarizationRequests,
  selectNotaryLoading,
} from '../../store/slices/notarySlice';
import { selectUser } from '../../store/slices/authSlice';
import AnimatedPage from '../../components/ui/AnimatedPage';
import GlassCard from '../../components/ui/GlassCard';
import GradientHeading from '../../components/ui/GradientHeading';
import { RADIUS, TYPOGRAPHY } from '../../theme/tokens';

const STATUS_META = {
  pending:       { label: 'Pending',       color: '#ed6c02', bg: 'rgba(237,108,2,0.1)' },
  accepted:      { label: 'Accepted',      color: '#0288d1', bg: 'rgba(2,136,209,0.1)' },
  kyc_scheduled: { label: 'KYC Scheduled', color: '#7b1fa2', bg: 'rgba(123,31,162,0.1)' },
  kyc_completed: { label: 'KYC Done',      color: '#00897b', bg: 'rgba(0,137,123,0.1)' },
  stamped:       { label: 'Stamped',       color: '#2e7d32', bg: 'rgba(46,125,50,0.1)' },
  dispatched:    { label: 'Dispatched',    color: '#1b5e20', bg: 'rgba(27,94,32,0.1)' },
  rejected:      { label: 'Rejected',      color: '#c62828', bg: 'rgba(198,40,40,0.1)' },
};

function StatCard({ icon, label, value, color }) {
  return (
    <GlassCard sx={{ p: 2, flex: 1, minWidth: 0 }}>
      <Typography sx={{ fontSize: 28, mb: 0.75, lineHeight: 1 }}>{icon}</Typography>
      <Typography variant="h5" sx={{ fontWeight: 800, color: color || 'var(--color-primary)', fontFamily: TYPOGRAPHY.fontFamily.display }}>
        {value}
      </Typography>
      <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)', fontWeight: 600 }}>
        {label}
      </Typography>
    </GlassCard>
  );
}

export default function NotaryHome() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const user = useSelector(selectUser);
  const requests = useSelector(selectNotarizationRequests);
  const loading = useSelector(selectNotaryLoading);

  useEffect(() => { dispatch(fetchNotarizationRequests()); }, [dispatch]);

  const pending = requests.filter((r) => r.status === 'pending').length;
  const actionNeeded = requests.filter((r) => ['pending', 'accepted', 'kyc_completed'].includes(r.status)).length;
  const completed = requests.filter((r) => ['stamped', 'dispatched'].includes(r.status)).length;
  const recent = [...requests].slice(0, 5);

  return (
    <AnimatedPage>
      <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: 900, mx: 'auto', pb: { xs: 10, md: 4 } }}>

        {/* Header */}
        <Box sx={{ mb: 3 }}>
          <GradientHeading variant="h5" sx={{ fontFamily: TYPOGRAPHY.fontFamily.display, fontWeight: 800 }}>
            Welcome back, {user?.name?.split(' ')[0]} ⚖️
          </GradientHeading>
          <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)', mt: 0.5 }}>
            Notary Dashboard — manage your notarization requests
          </Typography>
        </Box>

        {/* Action banner */}
        {actionNeeded > 0 && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
            <Box sx={{
              display: 'flex', alignItems: 'center', gap: 2,
              p: 2, mb: 3, borderRadius: `${RADIUS.lg}px`,
              background: 'rgba(237,108,2,0.08)', border: '1.5px solid rgba(237,108,2,0.3)',
            }}>
              <Typography sx={{ fontSize: 24 }}>🔔</Typography>
              <Box sx={{ flex: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 700, color: '#ed6c02' }}>
                  {actionNeeded} request{actionNeeded !== 1 ? 's' : ''} need your attention
                </Typography>
                <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)' }}>
                  Review and take action to keep your response rate high
                </Typography>
              </Box>
              <Button size="small" variant="contained"
                onClick={() => navigate('/notary/requests')}
                sx={{ borderRadius: `${RADIUS.md}px`, fontWeight: 700, background: '#ed6c02', whiteSpace: 'nowrap',
                  '&:hover': { background: '#e65100' } }}>
                View All
              </Button>
            </Box>
          </motion.div>
        )}

        {/* Stats */}
        <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
          <StatCard icon="📬" label="Pending Requests" value={pending} color="#ed6c02" />
          <StatCard icon="✅" label="Completed" value={completed} color="#2e7d32" />
          <StatCard icon="📋" label="Total Requests" value={requests.length} />
        </Box>

        {/* Quick actions */}
        <GlassCard sx={{ p: 2, mb: 3 }}>
          <Typography variant="body2" sx={{ fontWeight: 700, color: 'var(--color-text)', mb: 1.5 }}>
            Quick Actions
          </Typography>
          <Box sx={{ display: 'flex', gap: 1.25, flexWrap: 'wrap' }}>
            <Button variant="contained" onClick={() => navigate('/notary/requests')}
              sx={{ borderRadius: `${RADIUS.md}px`, fontWeight: 700, background: 'var(--color-primary)' }}>
              📬 View All Requests
            </Button>
            <Button variant="outlined" onClick={() => navigate('/notary/profile')}
              sx={{ borderRadius: `${RADIUS.md}px`, fontWeight: 600,
                borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>
              ⚙️ Edit Profile
            </Button>
          </Box>
        </GlassCard>

        {/* Recent requests */}
        <GlassCard sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
            <Typography variant="body2" sx={{ fontWeight: 700, color: 'var(--color-text)' }}>
              Recent Requests
            </Typography>
            <Button size="small" onClick={() => navigate('/notary/requests')}
              sx={{ color: 'var(--color-primary)', fontWeight: 600, fontSize: '0.75rem' }}>
              View all →
            </Button>
          </Box>

          {loading ? (
            <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)' }}>Loading…</Typography>
          ) : recent.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography sx={{ fontSize: 36, mb: 1 }}>📭</Typography>
              <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)' }}>
                No requests yet. Your profile is live!
              </Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {recent.map((req) => {
                const meta = STATUS_META[req.status] || STATUS_META.pending;
                return (
                  <Box
                    key={req._id}
                    onClick={() => navigate('/notary/requests')}
                    sx={{
                      display: 'flex', alignItems: 'center', gap: 1.5,
                      p: 1.5, borderRadius: `${RADIUS.md}px`,
                      border: '1px solid var(--color-border)',
                      background: 'var(--color-surface)',
                      cursor: 'pointer',
                      '&:hover': { borderColor: 'var(--color-primary)', background: 'var(--color-primary-alpha)' },
                    }}
                  >
                    <Typography sx={{ fontSize: 20, flexShrink: 0 }}>🔏</Typography>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" sx={{ fontWeight: 700, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {req.document?.title || 'Document'}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)' }}>
                        {req.citizen?.name} • {new Date(req.createdAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                      </Typography>
                    </Box>
                    <Chip
                      label={meta.label} size="small"
                      sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700,
                        background: meta.bg, color: meta.color, border: 'none', flexShrink: 0 }}
                    />
                  </Box>
                );
              })}
            </Box>
          )}
        </GlassCard>
      </Box>
    </AnimatedPage>
  );
}
