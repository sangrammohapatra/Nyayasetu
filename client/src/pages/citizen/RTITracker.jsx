/**
 * client/src/pages/citizen/RTITracker.jsx
 *
 * RTI applications dashboard — lists all RTIs with countdown timers,
 * urgency indicators, and quick action buttons.
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Skeleton from '@mui/material/Skeleton';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';

import AnimatedPage from '../../components/ui/AnimatedPage';
import GlassCard from '../../components/ui/GlassCard';
import GradientHeading from '../../components/ui/GradientHeading';
import RTIStatusBadge from '../../components/rti/RTIStatusBadge';
import { RADIUS, SHADOWS, TYPOGRAPHY } from '../../theme/tokens';

import {
  listRTIs,
  deleteRTI,
  selectRTIs,
  selectRTILoading,
  selectRTITotal,
} from '../../store/slices/rtiSlice';
import { pushSnackbar } from '../../store/slices/uiSlice';

// ─── Countdown chip ────────────────────────────────────────────────────────────

function DeadlineCountdown({ rti }) {
  const { daysUntilDeadline: days, deadlineUrgency: urgency, status } = rti;

  if (!['filed', 'first_appeal_due'].includes(status) || days === null) return null;

  const configs = {
    overdue:  { label: `${Math.abs(days)}d overdue`, bg: '#FFEBEE', color: '#B71C1C', pulse: true },
    critical: { label: `${days}d left`,              bg: '#FFF3E0', color: '#E65100', pulse: true },
    warning:  { label: `${days}d left`,              bg: '#FFFDE7', color: '#F57F17', pulse: false },
    normal:   { label: `${days}d left`,              bg: '#E3F2FD', color: '#1565C0', pulse: false },
  };

  const cfg = configs[urgency] || configs.normal;

  return (
    <Box
      sx={{
        display:      'inline-flex',
        alignItems:   'center',
        gap:          0.5,
        px:           1.2,
        py:           0.3,
        borderRadius: `${RADIUS.sm}px`,
        background:   cfg.bg,
        border:       `1px solid ${cfg.color}44`,
        ...(cfg.pulse && {
          animation: 'rti-pulse 1.6s ease-in-out infinite',
          '@keyframes rti-pulse': {
            '0%,100%': { opacity: 1 },
            '50%':     { opacity: 0.6 },
          },
        }),
      }}
    >
      <Box
        sx={{
          width: 7, height: 7, borderRadius: '50%',
          background: cfg.color, flexShrink: 0,
        }}
      />
      <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: cfg.color }}>
        {cfg.label}
      </Typography>
    </Box>
  );
}

// ─── RTI Card ─────────────────────────────────────────────────────────────────

function RTICard({ rti, onDelete, delay = 0 }) {
  const navigate = useNavigate();
  const prefersReducedMotion = useReducedMotion();
  const [menuAnchor, setMenuAnchor] = useState(null);

  const isUrgent = ['overdue', 'critical'].includes(rti.deadlineUrgency);
  const needsAction = rti.status === 'first_appeal_due' || (rti.status === 'filed' && rti.daysUntilDeadline <= 3);

  return (
    <motion.div
      initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ delay, duration: 0.35 }}
      layout
    >
      <GlassCard
        elevation={1}
        sx={{
          mb:     2,
          border: `1.5px solid ${isUrgent ? 'rgba(230,81,0,0.3)' : 'var(--color-border)'}`,
          cursor: 'pointer',
          transition: 'box-shadow 0.2s, border-color 0.2s',
          '&:hover': { boxShadow: SHADOWS.md, borderColor: 'var(--color-primary)' },
        }}
        onClick={() => navigate(`/citizen/rti/${rti._id}`)}
      >
        <Box sx={{ p: { xs: 2, sm: 2.5 } }}>
          {/* Header row */}
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 1.5 }}>
            <Box
              sx={{
                width:      44,
                height:     44,
                borderRadius: `${RADIUS.md}px`,
                background:  isUrgent ? 'rgba(230,81,0,0.1)' : 'var(--color-primary-alpha)',
                display:    'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize:   22,
                flexShrink: 0,
              }}
            >
              📋
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography
                variant="body1"
                sx={{
                  fontWeight: 700,
                  color: 'var(--color-text)',
                  lineHeight: 1.3,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                }}
              >
                {rti.title}
              </Typography>
              <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)' }}>
                {rti.ministry}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.75 }}>
              <RTIStatusBadge status={rti.status} />
              <DeadlineCountdown rti={rti} />
            </Box>
          </Box>

          {/* Action prompt */}
          {needsAction && (
            <Box
              sx={{
                p: 1.25,
                borderRadius: `${RADIUS.sm}px`,
                background: 'rgba(230,81,0,0.07)',
                border: '1px solid rgba(230,81,0,0.2)',
                mb: 1.5,
              }}
            >
              <Typography sx={{ fontSize: '0.78rem', color: '#E65100', fontWeight: 600 }}>
                {rti.status === 'first_appeal_due'
                  ? '⚠ Deadline passed — First Appeal can be filed now'
                  : `⚠ Only ${rti.daysUntilDeadline} day(s) left for PIO to respond`}
              </Typography>
            </Box>
          )}

          <Divider sx={{ borderColor: 'var(--color-border)', mb: 1.5 }} />

          {/* Footer row */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Chip
                label={rti.govLevel === 'central' ? 'Central' : `State — ${rti.state || ''}`}
                size="small"
                sx={{ height: 20, fontSize: '0.65rem', fontWeight: 600, background: 'var(--color-overlay)' }}
              />
              {rti.referenceNumber && (
                <Chip
                  label={`Ref: ${rti.referenceNumber}`}
                  size="small"
                  sx={{ height: 20, fontSize: '0.65rem', background: 'var(--color-overlay)' }}
                />
              )}
            </Box>
            <Box sx={{ display: 'flex', gap: 0.5 }} onClick={(e) => e.stopPropagation()}>
              <Tooltip title="Download RTI Application PDF">
                <IconButton
                  size="small"
                  href={`/api/rti/${rti._id}/download/application`}
                  onClick={(e) => { e.stopPropagation(); e.preventDefault(); window.open(`/api/rti/${rti._id}/download/application`); }}
                  sx={{ color: 'var(--color-primary)', fontSize: '1rem' }}
                >
                  📥
                </IconButton>
              </Tooltip>
              <IconButton
                size="small"
                onClick={(e) => { e.stopPropagation(); setMenuAnchor(e.currentTarget); }}
                sx={{ color: 'var(--color-text-secondary)' }}
              >
                ⋯
              </IconButton>
              <Menu
                anchorEl={menuAnchor}
                open={Boolean(menuAnchor)}
                onClose={() => setMenuAnchor(null)}
                onClick={(e) => e.stopPropagation()}
              >
                <MenuItem onClick={() => { setMenuAnchor(null); navigate(`/citizen/rti/${rti._id}`); }}>
                  View Details
                </MenuItem>
                {rti.status === 'drafted' && (
                  <MenuItem
                    onClick={() => { setMenuAnchor(null); onDelete(rti._id); }}
                    sx={{ color: 'var(--color-error)' }}
                  >
                    Delete Draft
                  </MenuItem>
                )}
              </Menu>
            </Box>
          </Box>
        </Box>
      </GlassCard>
    </motion.div>
  );
}

// ─── Filter chips ──────────────────────────────────────────────────────────────

const FILTERS = [
  { label: 'All',           value: undefined },
  { label: 'Filed',         value: 'filed' },
  { label: 'Action Needed', value: 'first_appeal_due' },
  { label: 'Draft',         value: 'drafted' },
  { label: 'Closed',        value: 'closed' },
];

// ─── Main page ────────────────────────────────────────────────────────────────

export default function RTITracker() {
  const dispatch  = useDispatch();
  const navigate  = useNavigate();
  const prefersReducedMotion = useReducedMotion();

  const rtis    = useSelector(selectRTIs);
  const loading = useSelector(selectRTILoading);
  const total   = useSelector(selectRTITotal);
  const [activeFilter, setActiveFilter] = useState(undefined);

  useEffect(() => {
    dispatch(listRTIs({ status: activeFilter }));
  }, [dispatch, activeFilter]);

  const handleDelete = async (rtiId) => {
    if (!window.confirm('Delete this RTI draft?')) return;
    await dispatch(deleteRTI(rtiId));
    dispatch(pushSnackbar({ message: 'RTI draft deleted', severity: 'info' }));
  };

  const urgentCount = rtis.filter((r) => ['overdue', 'critical'].includes(r.deadlineUrgency) || r.status === 'first_appeal_due').length;

  return (
    <AnimatedPage>
      <Box sx={{ p: { xs: 2, sm: 3, md: 4 }, maxWidth: 840, mx: 'auto', pb: { xs: 10, md: 4 } }}>

        {/* Page header */}
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
        >
          <Box
            sx={{
              borderRadius: `${RADIUS.xl}px`,
              background: 'linear-gradient(135deg, #0D47A1 0%, #1565C0 100%)',
              p: { xs: 2.5, sm: 3.5 },
              mb: 3,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <Box
              sx={{
                position: 'absolute', right: -30, top: -30,
                width: 180, height: 180, borderRadius: '50%',
                background: 'rgba(255,255,255,0.07)', pointerEvents: 'none',
              }}
            />
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <Typography sx={{ fontSize: 28 }}>📋</Typography>
                  <Typography
                    variant="h5"
                    sx={{ fontFamily: TYPOGRAPHY.fontFamily.display, fontWeight: 700, color: '#fff' }}
                  >
                    RTI Tracker
                  </Typography>
                </Box>
                <Typography sx={{ color: 'rgba(255,255,255,0.82)', fontSize: '0.85rem', lineHeight: 1.5 }}>
                  File, track, and escalate RTI applications under the RTI Act, 2005
                </Typography>
                {urgentCount > 0 && (
                  <Box
                    sx={{
                      mt: 1.5,
                      px: 1.5,
                      py: 0.5,
                      borderRadius: `${RADIUS.sm}px`,
                      background: 'rgba(255,167,38,0.2)',
                      border: '1px solid rgba(255,167,38,0.4)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 0.75,
                    }}
                  >
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', background: '#FFA726', animation: 'pulse 1.4s infinite', '@keyframes pulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.4 } } }} />
                    <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#FFA726' }}>
                      {urgentCount} RTI{urgentCount > 1 ? 's' : ''} need attention
                    </Typography>
                  </Box>
                )}
              </Box>
              <Button
                variant="contained"
                onClick={() => navigate('/citizen/rti/new')}
                sx={{
                  background: '#FFFFFF',
                  color: '#1565C0',
                  fontWeight: 700,
                  borderRadius: `${RADIUS.md}px`,
                  px: 2.5,
                  py: 1,
                  flexShrink: 0,
                  '&:hover': { background: 'rgba(255,255,255,0.9)' },
                  boxShadow: SHADOWS.md,
                }}
              >
                + File New RTI
              </Button>
            </Box>
          </Box>
        </motion.div>

        {/* Info banner */}
        <motion.div initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
          <Box
            sx={{
              mb: 3, p: 2,
              borderRadius: `${RADIUS.lg}px`,
              background: 'var(--color-primary-alpha)',
              border: '1px solid var(--color-primary)',
              display: 'flex', alignItems: 'flex-start', gap: 2,
            }}
          >
            <Typography sx={{ fontSize: 20, flexShrink: 0 }}>ℹ️</Typography>
            <Box>
              <Typography sx={{ fontSize: '0.82rem', color: 'var(--color-primary)', fontWeight: 700, mb: 0.25 }}>
                RTI Act, 2005 — Key Deadlines
              </Typography>
              <Typography sx={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                PIO must respond within <strong>30 days</strong> of filing. If no/unsatisfactory response, file a <strong>First Appeal</strong> within 30 days to the First Appellate Authority (FAA). If First Appeal fails, escalate to <strong>CIC/SIC</strong> within 90 days.
              </Typography>
            </Box>
          </Box>
        </motion.div>

        {/* Filter tabs */}
        <Box sx={{ display: 'flex', gap: 1, mb: 3, flexWrap: 'wrap' }}>
          {FILTERS.map((f) => (
            <Chip
              key={String(f.value)}
              label={f.label}
              onClick={() => setActiveFilter(f.value)}
              variant={activeFilter === f.value ? 'filled' : 'outlined'}
              sx={{
                fontWeight: 600,
                cursor: 'pointer',
                background:  activeFilter === f.value ? 'var(--color-primary)' : 'transparent',
                color:       activeFilter === f.value ? '#fff' : 'var(--color-text-secondary)',
                borderColor: activeFilter === f.value ? 'var(--color-primary)' : 'var(--color-border)',
                '&:hover': { background: activeFilter === f.value ? 'var(--color-primary)' : 'var(--color-overlay)' },
              }}
            />
          ))}
        </Box>

        {/* RTI list */}
        <AnimatePresence mode="popLayout">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Box key={i} sx={{ mb: 2, p: 2.5, borderRadius: `${RADIUS.lg}px`, border: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
                <Box sx={{ display: 'flex', gap: 2, mb: 1.5 }}>
                  <Skeleton variant="rounded" width={44} height={44} />
                  <Box sx={{ flex: 1 }}>
                    <Skeleton variant="text" width="60%" height={22} />
                    <Skeleton variant="text" width="40%" height={16} sx={{ mt: 0.5 }} />
                  </Box>
                  <Skeleton variant="rounded" width={100} height={22} />
                </Box>
                <Skeleton variant="rounded" width="100%" height={1} sx={{ mb: 1.5 }} />
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Skeleton variant="rounded" width={70} height={20} />
                  <Skeleton variant="rounded" width={90} height={20} />
                </Box>
              </Box>
            ))
          ) : rtis.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <Typography sx={{ fontSize: 56, mb: 2 }}>📋</Typography>
                <GradientHeading variant="h6" sx={{ mb: 1 }}>No RTI Applications Yet</GradientHeading>
                <Typography sx={{ color: 'var(--color-text-secondary)', mb: 3, maxWidth: 380, mx: 'auto', lineHeight: 1.6 }}>
                  RTI is one of the most powerful tools for Indian citizens. Ask any government for information — they must respond in 30 days.
                </Typography>
                <Button
                  variant="contained"
                  onClick={() => navigate('/citizen/rti/new')}
                  sx={{
                    background: 'var(--color-primary)',
                    borderRadius: `${RADIUS.md}px`,
                    fontWeight: 700,
                    px: 3, py: 1.25,
                  }}
                >
                  File Your First RTI
                </Button>
              </Box>
            </motion.div>
          ) : (
            rtis.map((rti, i) => (
              <RTICard key={rti._id} rti={rti} onDelete={handleDelete} delay={i * 0.05} />
            ))
          )}
        </AnimatePresence>
      </Box>
    </AnimatedPage>
  );
}
