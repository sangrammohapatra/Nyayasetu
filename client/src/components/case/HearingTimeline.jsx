/**
 * client/src/components/case/HearingTimeline.jsx
 *
 * Vertical timeline of past and upcoming court hearings.
 * Past hearings are greyed with a ✓ marker.
 * The next upcoming hearing has a pulsing dot and highlighted styling.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import { RADIUS } from '../../theme/tokens';

function isPast(date) {
  return date && new Date(date) < new Date();
}

function isWithinDays(date, days) {
  if (!date) return false;
  const d = new Date(date);
  const now = new Date();
  return d >= now && d <= new Date(now.getTime() + days * 86400000);
}

function formatDate(date) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    weekday: 'short',
  });
}

function TimelineNode({ isPastNode, isNext }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 28, flexShrink: 0 }}>
      {/* Dot */}
      <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {isNext && (
          <motion.div
            animate={{ scale: [1, 1.8, 1], opacity: [0.6, 0, 0.6] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
            style={{
              position: 'absolute',
              width: 22, height: 22,
              borderRadius: '50%',
              background: 'var(--color-primary)',
            }}
          />
        )}
        <Box sx={{
          width: 14, height: 14,
          borderRadius: '50%',
          background: isPastNode
            ? 'var(--color-border)'
            : isNext
            ? 'var(--color-primary)'
            : 'var(--color-text-secondary)',
          border: isNext ? '2px solid var(--color-primary)' : '2px solid var(--color-border)',
          zIndex: 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {isPastNode && (
            <Typography sx={{ fontSize: 8, color: 'var(--color-text-secondary)', lineHeight: 1 }}>✓</Typography>
          )}
        </Box>
      </Box>
    </Box>
  );
}

function HearingEntry({ hearing, isNext, isLast, onRemind }) {
  const { t } = useTranslation();
  const past = isPast(hearing.date);
  const urgent = isWithinDays(hearing.date, 7);

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.35 }}
    >
      <Box sx={{ display: 'flex', gap: 2, pb: isLast ? 0 : 3, position: 'relative' }}>
        {/* Vertical line */}
        {!isLast && (
          <Box sx={{
            position: 'absolute',
            left: 13, top: 14, bottom: 0,
            width: 2,
            background: past ? 'var(--color-border)' : 'var(--color-primary)',
            opacity: past ? 0.4 : 0.25,
          }} />
        )}

        <TimelineNode isPastNode={past} isNext={isNext} />

        <Box sx={{
          flex: 1,
          p: 2,
          borderRadius: `${RADIUS.lg}px`,
          border: isNext
            ? '1.5px solid var(--color-primary)'
            : '1px solid var(--color-border)',
          background: isNext
            ? 'var(--color-primary-alpha)'
            : past
            ? 'var(--color-bg)'
            : 'var(--color-surface)',
          opacity: past ? 0.7 : 1,
        }}>
          {/* Date row */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.75 }}>
            <Typography variant="body2" sx={{
              fontWeight: 700,
              color: isNext
                ? 'var(--color-primary)'
                : past
                ? 'var(--color-text-secondary)'
                : 'var(--color-text)',
              fontFamily: isNext ? "'Playfair Display',serif" : 'inherit',
              fontSize: isNext ? '1rem' : '0.875rem',
            }}>
              {formatDate(hearing.date)}
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {past && <Chip label="Past" size="small" sx={{ height: 18, fontSize: '0.62rem', background: 'var(--color-border)', color: 'var(--color-text-secondary)' }} />}
              {isNext && !urgent && <Chip label="Next" size="small" sx={{ height: 18, fontSize: '0.62rem', background: 'var(--color-primary)', color: '#fff' }} />}
              {urgent && <Chip label="⚠️ Soon" size="small" sx={{ height: 18, fontSize: '0.62rem', background: 'var(--color-warning)', color: '#fff' }} />}
            </Box>
          </Box>

          {/* Purpose */}
          {hearing.purpose && (
            <Typography variant="caption" sx={{ color: 'var(--color-text)', fontWeight: 600, display: 'block', mb: 0.25 }}>
              📋 {hearing.purpose}
            </Typography>
          )}

          {/* Result */}
          {hearing.result && (
            <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)', display: 'block', mb: 0.25 }}>
              📝 {hearing.result}
            </Typography>
          )}

          {/* Judge */}
          {hearing.judgeName && (
            <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)', display: 'block' }}>
              👩‍⚖️ {t('hearing.judge', 'Before')}: {hearing.judgeName}
            </Typography>
          )}

          {/* Remind me button for future hearings */}
          {!past && (
            <Button
              size="small"
              variant="outlined"
              onClick={() => onRemind?.(hearing)}
              sx={{
                mt: 1, borderRadius: `${RADIUS.md}px`, fontSize: '0.72rem',
                fontWeight: 600, py: 0.4, px: 1.5,
                borderColor: isNext ? 'var(--color-primary)' : 'var(--color-border)',
                color: isNext ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                '&:hover': { background: 'var(--color-primary-alpha)', borderColor: 'var(--color-primary)' },
              }}
            >
              🔔 {t('hearing.remind', 'Remind me')}
            </Button>
          )}
        </Box>
      </Box>
    </motion.div>
  );
}

function HearingTimeline({ hearings = [], onRemind }) {
  const { t } = useTranslation();

  const sorted = [...hearings].sort((a, b) => new Date(a.date) - new Date(b.date));
  const nextIndex = sorted.findIndex((h) => !isPast(h.date));

  if (sorted.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 3 }}>
        <Typography sx={{ fontSize: 36, mb: 1 }}>📅</Typography>
        <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)' }}>
          {t('hearing.noHearings', 'No hearing dates recorded yet.')}
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ pt: 1 }}>
      {sorted.map((hearing, i) => (
        <HearingEntry
          key={hearing._id || i}
          hearing={hearing}
          isNext={i === nextIndex}
          isLast={i === sorted.length - 1}
          onRemind={onRemind}
        />
      ))}
    </Box>
  );
}

export default HearingTimeline;
