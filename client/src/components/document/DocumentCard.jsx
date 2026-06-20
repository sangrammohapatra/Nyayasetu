import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion, useReducedMotion } from 'framer-motion';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Skeleton from '@mui/material/Skeleton';
import Tooltip from '@mui/material/Tooltip';

import { RADIUS, SHADOWS } from '../../theme/tokens';

export const CATEGORY_ICONS = {
  consumer: '🛒', property: '🏠', employment: '💼', family: '👨‍👩‍👧',
  criminal: '⚖️', rti: '📑', civil: '🏛️', financial: '💰', labour: '👷', startup: '🚀',
};

export const STATUS_CONFIG = {
  completed:  { label: 'Ready',      color: 'var(--color-success)', bg: 'rgba(46,125,50,0.1)' },
  generating: { label: 'Generating', color: 'var(--color-warning)', bg: 'rgba(230,81,0,0.1)' },
  active:     { label: 'Draft',      color: 'var(--color-primary)', bg: 'var(--color-primary-alpha)' },
  abandoned:  { label: 'Abandoned',  color: 'var(--color-text-secondary)', bg: 'var(--color-border)' },
};

export function DocumentCardSkeleton() {
  return (
    <Box sx={{ p: 2.5, borderRadius: `${RADIUS.lg}px`, border: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
      <Box sx={{ display: 'flex', gap: 2 }}>
        <Skeleton variant="rectangular" width={46} height={46} sx={{ borderRadius: `${RADIUS.md}px`, flexShrink: 0 }} />
        <Box sx={{ flex: 1 }}>
          <Skeleton variant="text" width="70%" height={20} />
          <Skeleton variant="text" width="45%" height={16} sx={{ mt: 0.5 }} />
          <Skeleton variant="rounded" width={60} height={19} sx={{ mt: 1 }} />
        </Box>
      </Box>
    </Box>
  );
}

export default function DocumentCard({ doc, plan, onView, onDownload, onShare, onDelete, delay = 0 }) {
  const { t } = useTranslation();
  const prefersReducedMotion = useReducedMotion();
  const status = STATUS_CONFIG[doc.status] || STATUS_CONFIG.completed;
  const catIcon = CATEGORY_ICONS[doc.template?.category || doc.category] || '📄';
  const isPaid = doc.isPaid || plan === 'basic' || plan === 'pro';

  return (
    <motion.div
      initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={prefersReducedMotion ? undefined : { opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
      transition={{ delay, duration: 0.35 }}
      layout
    >
      <Box sx={{
        p: 2.5, borderRadius: `${RADIUS.lg}px`,
        background: 'var(--color-surface)',
        border: '1.5px solid var(--color-border)',
        transition: 'border-color 0.2s, box-shadow 0.2s',
        '&:hover': { borderColor: 'var(--color-primary)', boxShadow: SHADOWS.sm },
      }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
          <Box sx={{
            width: 46, height: 46, borderRadius: `${RADIUS.md}px`,
            background: 'var(--color-primary-alpha)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, flexShrink: 0,
          }}>
            {catIcon}
          </Box>

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" sx={{
              fontWeight: 700, color: 'var(--color-text)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', mb: 0.25,
            }}>
              {doc.title}
            </Typography>
            <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)', display: 'block' }}>
              {doc.template?.name || doc.templateSlug} ·{' '}
              {new Date(doc.createdAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.75, mt: 1, flexWrap: 'wrap' }}>
              <Chip size="small" label={status.label}
                sx={{ height: 19, fontSize: '0.67rem', fontWeight: 600,
                  background: status.bg, color: status.color, border: 'none' }} />
              {isPaid && (
                <Chip size="small" label="✓ PDF Ready"
                  sx={{ height: 19, fontSize: '0.67rem', fontWeight: 600,
                    background: 'rgba(46,125,50,0.1)', color: 'var(--color-success)', border: 'none' }} />
              )}
            </Box>
          </Box>

          <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
            <Tooltip title={t('myDocs.view', 'View')} arrow>
              <IconButton size="small" onClick={() => onView(doc._id)}
                sx={{ color: 'var(--color-primary)', '&:hover': { background: 'var(--color-primary-alpha)' } }}>
                <Typography sx={{ fontSize: 16 }}>👁</Typography>
              </IconButton>
            </Tooltip>

            {doc.status === 'completed' && (
              <Tooltip title={isPaid ? t('myDocs.download', 'Download PDF') : t('myDocs.upgrade_pdf', 'Upgrade to download')} arrow>
                <IconButton size="small" onClick={() => onDownload(doc)}
                  sx={{ color: isPaid ? 'var(--color-success)' : 'var(--color-text-secondary)',
                    '&:hover': { background: 'var(--color-success-light, #E8F5E9)' } }}>
                  <Typography sx={{ fontSize: 16 }}>{isPaid ? '📥' : '🔒'}</Typography>
                </IconButton>
              </Tooltip>
            )}

            <Tooltip title={t('myDocs.share', 'Share')} arrow>
              <IconButton size="small" onClick={() => onShare(doc._id)}
                sx={{ color: 'var(--color-text-secondary)', '&:hover': { background: 'var(--color-overlay)' } }}>
                <Typography sx={{ fontSize: 16 }}>🔗</Typography>
              </IconButton>
            </Tooltip>

            <Tooltip title={t('myDocs.delete', 'Delete')} arrow>
              <IconButton size="small" onClick={() => onDelete(doc)}
                sx={{ color: 'var(--color-error)', '&:hover': { background: 'var(--color-error-light, #FFEBEE)' } }}>
                <Typography sx={{ fontSize: 16 }}>🗑</Typography>
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </Box>
    </motion.div>
  );
}
