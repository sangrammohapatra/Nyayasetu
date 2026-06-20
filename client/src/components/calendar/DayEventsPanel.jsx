import React from 'react';
import { format, isToday } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';

import { RADIUS, SHADOWS, TYPOGRAPHY } from '../../theme/tokens';

function EventRow({ event, onNavigate }) {
  const prefersReducedMotion = useReducedMotion();
  const timeStr = format(event.date, 'h:mm a');

  return (
    <motion.div
      layout
      initial={prefersReducedMotion ? false : { opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={prefersReducedMotion ? undefined : { opacity: 0, x: 12 }}
      transition={{ duration: 0.2 }}
    >
      <Box sx={{
        display: 'flex', gap: 1.5, alignItems: 'flex-start',
        p: 1.5, borderRadius: `${RADIUS.lg}px`,
        border: '1px solid var(--color-border)',
        background: 'var(--color-bg)',
        '&:hover': { borderColor: event.color, boxShadow: SHADOWS.sm },
        transition: 'border-color 0.15s, box-shadow 0.15s',
      }}>
        {/* Color bar */}
        <Box sx={{
          width: 3, borderRadius: 1, alignSelf: 'stretch', flexShrink: 0,
          background: event.color,
          minHeight: 40,
        }} />

        {/* Content */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.25 }}>
            <Typography sx={{ fontSize: 16, lineHeight: 1 }}>{event.icon}</Typography>
            <Typography variant="body2" sx={{
              fontWeight: 700, color: 'var(--color-text)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {event.title}
            </Typography>
          </Box>
          <Typography variant="caption" sx={{
            color: 'var(--color-text-secondary)', display: 'block', mb: 0.75,
          }}>
            {event.subtitle}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Chip
              size="small"
              label={timeStr}
              sx={{
                height: 20, fontSize: '0.65rem', fontWeight: 600,
                background: event.color, color: '#fff', border: 'none',
              }}
            />
            {event.link && (
              <Button
                size="small"
                onClick={() => onNavigate(event.link)}
                sx={{
                  fontSize: '0.7rem', fontWeight: 700, px: 1, py: 0.25,
                  minWidth: 0, color: event.color,
                  '&:hover': { background: 'var(--color-overlay)' },
                }}
              >
                View →
              </Button>
            )}
          </Box>
        </Box>
      </Box>
    </motion.div>
  );
}

export default function DayEventsPanel({ date, events }) {
  const navigate = useNavigate();
  const dayEvents = date
    ? events.filter((ev) => {
        const evDate = ev.date;
        return (
          evDate.getFullYear() === date.getFullYear() &&
          evDate.getMonth() === date.getMonth() &&
          evDate.getDate() === date.getDate()
        );
      }).sort((a, b) => a.date - b.date)
    : [];

  const dateLabel = date
    ? isToday(date)
      ? 'Today'
      : format(date, 'EEEE, d MMMM')
    : null;

  return (
    <Box sx={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Panel header */}
      <Box sx={{ mb: 2 }}>
        {date ? (
          <>
            <Typography sx={{
              fontFamily: TYPOGRAPHY.fontFamily.display,
              fontWeight: 700, fontSize: '1rem',
              color: 'var(--color-text)',
            }}>
              {dateLabel}
            </Typography>
            <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)' }}>
              {dayEvents.length === 0
                ? 'No events'
                : `${dayEvents.length} event${dayEvents.length !== 1 ? 's' : ''}`}
            </Typography>
          </>
        ) : (
          <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>
            Select a date to see events
          </Typography>
        )}
      </Box>

      <Divider sx={{ borderColor: 'var(--color-border)', mb: 2 }} />

      {/* Event list */}
      <Box sx={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 1.25 }}>
        <AnimatePresence mode="popLayout">
          {dayEvents.length > 0 ? (
            dayEvents.map((ev) => (
              <EventRow key={ev.id} event={ev} onNavigate={navigate} />
            ))
          ) : date ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography sx={{ fontSize: 32, mb: 1 }}>📅</Typography>
                <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)' }}>
                  No events on this day
                </Typography>
              </Box>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </Box>
    </Box>
  );
}
