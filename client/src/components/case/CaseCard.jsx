import React, { useState, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { motion, useReducedMotion } from 'framer-motion';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Collapse from '@mui/material/Collapse';
import Skeleton from '@mui/material/Skeleton';

import HearingTimeline from './HearingTimeline';
import { pushSnackbar } from '../../store/slices/uiSlice';
import { RADIUS, SHADOWS } from '../../theme/tokens';

const STATUS_MAP = {
  active:      { label: 'Active',      bg: 'rgba(46,125,50,0.1)',   color: 'var(--color-success)' },
  pending:     { label: 'Active',      bg: 'rgba(46,125,50,0.1)',   color: 'var(--color-success)' },
  disposed:    { label: 'Disposed',    bg: 'var(--color-border)',    color: 'var(--color-text-secondary)' },
  transferred: { label: 'Transferred', bg: 'rgba(2,119,189,0.1)',   color: 'var(--color-info)' },
  unknown:     { label: 'Unknown',     bg: 'var(--color-border)',    color: 'var(--color-text-secondary)' },
  archived:    { label: 'Archived',    bg: 'var(--color-border)',    color: 'var(--color-text-secondary)' },
};

function daysUntil(date) {
  if (!date) return null;
  return Math.ceil((new Date(date) - new Date()) / 86400000);
}

function isWithinDays(date, days) {
  const d = daysUntil(date);
  return d !== null && d >= 0 && d <= days;
}

export function CaseCardSkeleton() {
  return (
    <Box sx={{ p: 2.5, borderRadius: `${RADIUS.lg}px`, border: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
        <Skeleton variant="text" width="60%" height={22} />
        <Skeleton variant="rounded" width={60} height={20} />
      </Box>
      <Skeleton variant="text" width="40%" height={16} />
      <Skeleton variant="text" width="75%" height={32} sx={{ mt: 1.5 }} />
      <Box sx={{ display: 'flex', gap: 1, mt: 1.5 }}>
        <Skeleton variant="rounded" width={50} height={22} />
        <Skeleton variant="rounded" width={50} height={22} />
      </Box>
    </Box>
  );
}

export default function CaseCard({ caseData, onRefresh, onDelete, onArchive, onUpdateAlerts, onShare, archived = false, focused = false }) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const prefersReducedMotion = useReducedMotion();
  const [expanded, setExpanded] = useState(focused);
  const [refreshing, setRefreshing] = useState(false);

  const handleRemind = useCallback(async () => {
    try {
      await onUpdateAlerts(caseData._id, { alertsEnabled: true }).unwrap();
      dispatch(pushSnackbar({
        message: t('hearing.remind_set', 'Reminder enabled — you\'ll be alerted before the hearing.'),
        severity: 'success',
      }));
    } catch {
      dispatch(pushSnackbar({
        message: t('hearing.remind_error', 'Failed to set reminder. Please try again.'),
        severity: 'error',
      }));
    }
  }, [caseData._id, onUpdateAlerts, dispatch, t]);

  const statusKey = (caseData.caseStatus || caseData.status || 'pending').toLowerCase();
  const isUserArchived = archived || caseData.archived === true;
  const statusStyle = (isUserArchived && statusKey !== 'disposed')
    ? STATUS_MAP.archived
    : (STATUS_MAP[statusKey] || STATUS_MAP.active);
  const statusLabel = (isUserArchived && statusKey !== 'disposed')
    ? t('case.status_archived', 'Archived')
    : statusStyle.label;
  const nextDate = caseData.nextHearingDate;
  const daysLeft = daysUntil(nextDate);
  const isUrgent = isWithinDays(nextDate, 7);
  const sharedLawyer = caseData.sharedWithLawyer;
  const sharedLawyerName = sharedLawyer && typeof sharedLawyer === 'object' ? sharedLawyer.name : '';
  const isShared = Boolean(sharedLawyer);

  const handleRefresh = async (e) => {
    e.stopPropagation();
    setRefreshing(true);
    await onRefresh(caseData._id);
    setRefreshing(false);
  };

  return (
    <motion.div
      id={`case-${caseData._id}`}
      layout
      style={{ scrollMarginTop: 88 }}
      initial={prefersReducedMotion ? false : { opacity: 0, y: 20, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={prefersReducedMotion ? undefined : { opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
    >
      <Box sx={{
        borderRadius: `${RADIUS.xl}px`,
        border: isUrgent ? '1.5px solid var(--color-warning)' : `1px solid ${focused ? 'var(--color-primary)' : 'var(--color-border)'}`,
        background: focused ? 'var(--color-primary-alpha)' : 'var(--color-surface)',
        boxShadow: expanded ? SHADOWS.md : SHADOWS.sm,
        overflow: 'hidden',
        transition: 'box-shadow 0.25s',
      }}>
        {isUrgent && (
          <Box sx={{ height: 3, background: 'linear-gradient(90deg, var(--color-warning), var(--color-error))' }} />
        )}

        <Box onClick={() => setExpanded((v) => !v)} sx={{ p: 2.5, cursor: 'pointer', userSelect: 'none' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
            <Box sx={{ flex: 1, minWidth: 0, pr: 1 }}>
              <Typography variant="body2" sx={{
                fontWeight: 700, color: 'var(--color-text)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {caseData.caseTitle || caseData.cnrNumber}
              </Typography>
              {caseData.court && (
                <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)' }}>
                  🏛️ {caseData.court}
                  {caseData.district && ` · ${caseData.district}`}
                </Typography>
              )}
            </Box>
            <Chip size="small" label={statusLabel}
              sx={{
                height: 20, fontSize: '0.67rem', fontWeight: 700,
                background: statusStyle.bg, color: statusStyle.color,
                flexShrink: 0,
              }} />
          </Box>

          <Typography sx={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '0.78rem', letterSpacing: '0.08em',
            color: 'var(--color-text-secondary)', mb: 1.25,
          }}>
            {caseData.cnrNumber}
          </Typography>

          {nextDate && (
            <Box sx={{
              p: 1.5, borderRadius: `${RADIUS.md}px`,
              background: isUrgent ? 'rgba(230,81,0,0.08)' : 'var(--color-primary-alpha)',
              border: `1px solid ${isUrgent ? 'var(--color-warning)' : 'var(--color-primary)'}`,
              mb: 1.5,
            }}>
              <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)', display: 'block' }}>
                {t('case.next_hearing', 'Next Hearing')}
              </Typography>
              <Typography variant="body1" sx={{
                fontWeight: 800,
                color: isUrgent ? 'var(--color-warning)' : 'var(--color-primary)',
                lineHeight: 1.2,
              }}>
                {new Date(nextDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', weekday: 'short' })}
              </Typography>
              {daysLeft !== null && daysLeft >= 0 && (
                <Typography variant="caption" sx={{ fontWeight: 600, color: isUrgent ? 'var(--color-warning)' : 'var(--color-text-secondary)' }}>
                  {daysLeft === 0 ? '🔴 Today!' : daysLeft === 1 ? '⚠️ Tomorrow!' : `in ${daysLeft} days`}
                </Typography>
              )}
            </Box>
          )}

          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', gap: 0.75, minWidth: 0, flexWrap: 'wrap' }}>
              {isShared && (
                <Chip
                  size="small"
                  label={sharedLawyerName
                    ? t('case.shared_with', 'Shared with {{name}}', { name: sharedLawyerName })
                    : t('case.shared', 'Shared')}
                  sx={{
                    height: 20, fontSize: '0.65rem', fontWeight: 700, maxWidth: 150,
                    background: 'rgba(237,108,2,0.12)', color: '#ed6c02',
                    '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis' },
                  }}
                />
              )}
              {caseData.alertChannels?.whatsapp && (
                <Tooltip title="WhatsApp alerts on">
                  <Chip size="small" label="📱 WA" sx={{ height: 20, fontSize: '0.65rem', background: 'rgba(37,211,102,0.1)', color: '#25D366' }} />
                </Tooltip>
              )}
              {caseData.alertChannels?.email && (
                <Tooltip title="Email alerts on">
                  <Chip size="small" label="📧" sx={{ height: 20, fontSize: '0.65rem', background: 'var(--color-primary-alpha)', color: 'var(--color-primary)' }} />
                </Tooltip>
              )}
            </Box>
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              {onShare && (
                <Tooltip title={t('case.share_with_lawyer', 'Share with a lawyer')}>
                  <IconButton
                    size="small"
                    onClick={(e) => { e.stopPropagation(); onShare(caseData); }}
                    sx={{ color: 'var(--color-text-secondary)', '&:hover': { color: 'var(--color-primary)' } }}
                  >
                    <span style={{ fontSize: 16, lineHeight: 1 }}>🤝</span>
                  </IconButton>
                </Tooltip>
              )}
              <Tooltip title={t('case.refresh', 'Sync with eCourts')}>
                <IconButton size="small" onClick={handleRefresh} disabled={refreshing}
                  sx={{ color: 'var(--color-text-secondary)', '&:hover': { color: 'var(--color-primary)' } }}>
                  <motion.span
                    animate={prefersReducedMotion ? {} : refreshing ? { rotate: 360 } : {}}
                    transition={{ duration: 1, repeat: refreshing ? Infinity : 0, ease: 'linear' }}
                    style={{ display: 'inline-block', fontSize: 16 }}>
                    🔄
                  </motion.span>
                </IconButton>
              </Tooltip>
              {onArchive && (
                <Tooltip title={archived ? t('case.restore', 'Restore') : t('case.archive', 'Archive')}>
                  <IconButton
                    size="small"
                    onClick={(e) => { e.stopPropagation(); onArchive(caseData._id); }}
                    sx={{ color: 'var(--color-text-secondary)', '&:hover': { color: 'var(--color-primary)' } }}
                  >
                    {archived ? '📤' : '📥'}
                  </IconButton>
                </Tooltip>
              )}
              <Tooltip title={t('case.delete', 'Remove')}>
                <IconButton size="small" onClick={(e) => { e.stopPropagation(); onDelete(caseData._id); }}
                  sx={{ color: 'var(--color-error)', '&:hover': { background: 'var(--color-error-light, #FFEBEE)' } }}>
                  🗑
                </IconButton>
              </Tooltip>
              <Typography sx={{ fontSize: 14, color: 'var(--color-text-secondary)', ml: 0.5, mt: 0.25, transition: 'transform 0.25s', transform: expanded ? 'rotate(180deg)' : 'none' }}>
                ▾
              </Typography>
            </Box>
          </Box>
        </Box>

        <Collapse in={expanded} timeout={300}>
          <Box sx={{ px: 2.5, pb: 2.5, borderTop: '1px solid var(--color-border)', pt: 2 }}>
            {caseData.notes && (
              <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)', whiteSpace: 'pre-line', mb: 1.5, fontSize: '0.8rem' }}>
                {caseData.notes}
              </Typography>
            )}
            <Typography variant="caption" sx={{ fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', mb: 1.5 }}>
              {t('case.hearing_history', 'Hearing Timeline')}
            </Typography>
            <HearingTimeline hearings={caseData.hearings || []} onRemind={handleRemind} />
          </Box>
        </Collapse>
      </Box>

    </motion.div>
  );
}
