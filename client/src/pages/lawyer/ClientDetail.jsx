/**
 * client/src/pages/lawyer/ClientDetail.jsx
 */

import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { motion, useReducedMotion } from 'framer-motion';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Avatar from '@mui/material/Avatar';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Skeleton from '@mui/material/Skeleton';

import { fetchMyClients, selectClients, selectLawyerLoading } from '../../store/slices/lawyerSlice';
import AnimatedPage from '../../components/ui/AnimatedPage';
import GradientHeading from '../../components/ui/GradientHeading';
import { RADIUS, SHADOWS, TYPOGRAPHY } from '../../theme/tokens';

const MODE_ICON = { chat: '💬', video: '📹', phone: '📞', in_person: '🤝' };

const STATUS_META = {
  requested:  { label: 'Requested',  bg: 'rgba(237,108,2,0.12)',  color: '#ed6c02' },
  accepted:   { label: 'Accepted',   bg: 'rgba(2,136,209,0.12)',  color: '#0288d1' },
  completed:  { label: 'Completed',  bg: 'rgba(46,125,50,0.1)',   color: '#2e7d32' },
  rejected:   { label: 'Rejected',   bg: 'rgba(211,47,47,0.1)',   color: '#d32f2f' },
  cancelled:  { label: 'Cancelled',  bg: 'rgba(211,47,47,0.1)',   color: '#d32f2f' },
  active:     { label: 'Active',     bg: 'rgba(46,125,50,0.1)',   color: '#2e7d32' },
  disposed:   { label: 'Disposed',   bg: 'rgba(117,117,117,0.12)', color: '#757575' },
};

function SectionTitle({ children }) {
  return (
    <Typography variant="overline" sx={{
      fontWeight: 700, color: 'var(--color-text-secondary)',
      letterSpacing: '0.1em', display: 'block', mb: 1.5,
    }}>
      {children}
    </Typography>
  );
}

function ConsultationCard({ c, i }) {
  const prefersReducedMotion = useReducedMotion();
  const sm = STATUS_META[c.status] || { label: c.status, bg: 'transparent', color: 'inherit' };
  const scheduled = c.scheduledAt
    ? new Date(c.scheduledAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
    : '—';

  return (
    <motion.div initial={prefersReducedMotion ? false : { opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 2, py: 1.5, px: 2,
        borderBottom: '1px solid var(--color-border)',
        '&:last-child': { borderBottom: 'none' },
        flexWrap: 'wrap',
      }}>
        <Box sx={{ width: 34, height: 34, borderRadius: `${RADIUS.md}px`, background: 'var(--color-primary-alpha)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
          {MODE_ICON[c.mode] || '📋'}
        </Box>
        <Box sx={{ flex: 1, minWidth: 120 }}>
          <Typography variant="body2" sx={{ fontWeight: 600, color: 'var(--color-text)', textTransform: 'capitalize' }}>
            {c.mode?.replace('_', '-')} consultation
          </Typography>
          <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)' }}>
            📅 {scheduled}
          </Typography>
        </Box>
        {c.fee != null && (
          <Typography variant="caption" sx={{ fontWeight: 700, color: 'var(--color-text)', flexShrink: 0 }}>
            ₹{(c.fee / 100).toFixed(0)}
          </Typography>
        )}
        <Chip size="small" label={sm.label} sx={{ height: 22, fontSize: '0.7rem', fontWeight: 700, background: sm.bg, color: sm.color, flexShrink: 0 }} />
      </Box>
    </motion.div>
  );
}

function CaseCard({ c, i }) {
  const prefersReducedMotion = useReducedMotion();
  const sm = STATUS_META[(c.status || 'active').toLowerCase()] || { label: c.status, bg: 'rgba(46,125,50,0.1)', color: '#2e7d32' };

  return (
    <motion.div initial={prefersReducedMotion ? false : { opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 2, py: 1.5, px: 2,
        borderBottom: '1px solid var(--color-border)',
        '&:last-child': { borderBottom: 'none' },
        flexWrap: 'wrap',
      }}>
        <Box sx={{ width: 34, height: 34, borderRadius: `${RADIUS.md}px`, background: 'rgba(46,125,50,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
          ⚖️
        </Box>
        <Box sx={{ flex: 1, minWidth: 120 }}>
          <Typography variant="body2" sx={{ fontWeight: 600, color: 'var(--color-text)' }}>
            {c.caseTitle || c.cnrNumber}
          </Typography>
          <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)' }}>
            {c.court && `🏛️ ${c.court}`}
            {c.cnrNumber && ` · ${c.cnrNumber}`}
          </Typography>
        </Box>
        {c.nextHearingDate && (
          <Typography variant="caption" sx={{ color: 'var(--color-primary)', fontWeight: 700, flexShrink: 0 }}>
            📅 {new Date(c.nextHearingDate).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
          </Typography>
        )}
        <Chip size="small" label={sm.label} sx={{ height: 22, fontSize: '0.7rem', fontWeight: 700, background: sm.bg, color: sm.color, flexShrink: 0 }} />
      </Box>
    </motion.div>
  );
}

function ClientDetail() {
  const { t } = useTranslation();
  const { userId } = useParams();
  const prefersReducedMotion = useReducedMotion();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const clients = useSelector(selectClients);
  const loading = useSelector(selectLawyerLoading);

  useEffect(() => {
    if (clients.length === 0) dispatch(fetchMyClients());
  }, [dispatch, clients.length]);

  const client = clients.find((c) => {
    const id = c.user?.id || c.user?._id;
    return String(id) === userId;
  });

  const u = client?.user || {};
  const consultations = client?.consultations || [];
  const cases = client?.sharedCases || [];
  const initials = u.name?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || '?';

  if (loading && !client) {
    return (
      <AnimatedPage>
        <Box sx={{ p: { xs: 2, sm: 3, md: 4 }, maxWidth: 800, mx: 'auto' }}>
          <Skeleton variant="rectangular" height={120} sx={{ borderRadius: `${RADIUS.xl}px`, mb: 3 }} />
          <Skeleton variant="rectangular" height={200} sx={{ borderRadius: `${RADIUS.xl}px`, mb: 2 }} />
          <Skeleton variant="rectangular" height={200} sx={{ borderRadius: `${RADIUS.xl}px` }} />
        </Box>
      </AnimatedPage>
    );
  }

  if (!client) {
    return (
      <AnimatedPage>
        <Box sx={{ p: { xs: 2, sm: 3, md: 4 }, maxWidth: 800, mx: 'auto', textAlign: 'center', pt: 8 }}>
          <Typography sx={{ fontSize: 52, mb: 2 }}>👤</Typography>
          <GradientHeading variant="h6" sx={{ fontFamily: TYPOGRAPHY.fontFamily.display, fontWeight: 700, mb: 1 }}>
            {t('clients.notFound', 'Client not found')}
          </GradientHeading>
          <Button onClick={() => navigate('/lawyer/clients')} sx={{ mt: 2, color: 'var(--color-primary)', fontWeight: 600 }}>
            ← {t('clients.backToList', 'Back to Clients')}
          </Button>
        </Box>
      </AnimatedPage>
    );
  }

  return (
    <AnimatedPage>
      <Box sx={{ p: { xs: 2, sm: 3, md: 4 }, maxWidth: 800, mx: 'auto', pb: { xs: 10, md: 4 } }}>

        {/* Back */}
        <Button
          onClick={() => navigate('/lawyer/clients')}
          sx={{ mb: 2.5, color: 'var(--color-text-secondary)', fontWeight: 600, fontSize: '0.82rem', pl: 0 }}
        >
          ← {t('clients.backToList', 'Back to Clients')}
        </Button>

        {/* Client header card */}
        <motion.div initial={prefersReducedMotion ? false : { opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
          <Box sx={{
            p: 3, borderRadius: `${RADIUS.xl}px`, border: '1px solid var(--color-border)',
            background: 'var(--color-surface)', boxShadow: SHADOWS.sm, mb: 3,
            display: 'flex', alignItems: 'center', gap: 2.5, flexWrap: 'wrap',
          }}>
            <Avatar sx={{ width: 60, height: 60, background: 'var(--color-primary)', fontWeight: 700, fontSize: '1.4rem' }}>
              {initials}
            </Avatar>
            <Box sx={{ flex: 1, minWidth: 160 }}>
              <GradientHeading variant="h5" sx={{ fontFamily: TYPOGRAPHY.fontFamily.display, fontWeight: 700 }}>
                {u.name || t('common.unknown', 'Unknown')}
              </GradientHeading>
              <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)', mt: 0.25 }}>
                {u.phone}{u.email && ` · ${u.email}`}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Chip size="small" label={`📅 ${consultations.length} consultation${consultations.length !== 1 ? 's' : ''}`}
                sx={{ height: 24, fontSize: '0.72rem', fontWeight: 600, background: 'var(--color-primary-alpha)', color: 'var(--color-primary)' }} />
              <Chip size="small" label={`⚖️ ${cases.length} case${cases.length !== 1 ? 's' : ''}`}
                sx={{ height: 24, fontSize: '0.72rem', fontWeight: 600, background: 'rgba(46,125,50,0.1)', color: 'var(--color-success)' }} />
            </Box>
          </Box>
        </motion.div>

        {/* Consultations */}
        <motion.div initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Box sx={{ borderRadius: `${RADIUS.xl}px`, border: '1px solid var(--color-border)', background: 'var(--color-surface)', boxShadow: SHADOWS.sm, overflow: 'hidden', mb: 3 }}>
            <Box sx={{ px: 2.5, py: 2, borderBottom: '1px solid var(--color-border)' }}>
              <SectionTitle>{t('consultations.title', 'Consultations')}</SectionTitle>
            </Box>
            {consultations.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 5 }}>
                <Typography sx={{ fontSize: 36, mb: 1 }}>📅</Typography>
                <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)' }}>
                  {t('clients.noConsultations', 'No consultations with this client yet.')}
                </Typography>
              </Box>
            ) : (
              consultations.map((c, i) => <ConsultationCard key={c._id || i} c={c} i={i} />)
            )}
          </Box>
        </motion.div>

        {/* Shared cases */}
        <motion.div initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}>
          <Box sx={{ borderRadius: `${RADIUS.xl}px`, border: '1px solid var(--color-border)', background: 'var(--color-surface)', boxShadow: SHADOWS.sm, overflow: 'hidden' }}>
            <Box sx={{ px: 2.5, py: 2, borderBottom: '1px solid var(--color-border)' }}>
              <SectionTitle>{t('case.cases', 'Cases shared with you')}</SectionTitle>
            </Box>
            {cases.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 5 }}>
                <Typography sx={{ fontSize: 36, mb: 1 }}>⚖️</Typography>
                <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)' }}>
                  {t('clients.noCases', 'No cases shared by this client yet.')}
                </Typography>
              </Box>
            ) : (
              cases.map((c, i) => <CaseCard key={c._id || i} c={c} i={i} />)
            )}
          </Box>
        </motion.div>

      </Box>
    </AnimatedPage>
  );
}

export default ClientDetail;
