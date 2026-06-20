import React, { useMemo } from 'react';
import {
  format, startOfMonth, endOfMonth,
  startOfWeek, endOfWeek, eachDayOfInterval,
  isSameDay, isSameMonth, isToday,
  addMonths, subMonths,
} from 'date-fns';
import { motion, useReducedMotion } from 'framer-motion';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Button from '@mui/material/Button';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';

import { RADIUS, TYPOGRAPHY } from '../../theme/tokens';

const DAY_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MAX_CHIPS_DESKTOP = 3;
const MAX_CHIPS_MOBILE  = 2;

function groupByDay(events) {
  const map = new Map();
  events.forEach((ev) => {
    const key = format(ev.date, 'yyyy-MM-dd');
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(ev);
  });
  return map;
}

// ─── Event chip shown inside a day cell ──────────────────────────────────────

function EventChip({ event, onClick, compact }) {
  const prefersReducedMotion = useReducedMotion();
  return (
    <Tooltip title={`${event.icon} ${event.title} — ${event.subtitle}`} arrow placement="top">
      <motion.div
        whileHover={prefersReducedMotion ? undefined : { scale: 1.02 }}
        transition={{ duration: 0.12 }}
        onClick={(e) => { e.stopPropagation(); onClick(event); }}
        style={{ cursor: 'pointer', overflow: 'hidden', width: '100%' }}
      >
        {compact ? (
          <Box sx={{
            width: 7, height: 7, borderRadius: '50%',
            background: event.color,
            flexShrink: 0,
          }} />
        ) : (
          <Box sx={{
            display: 'flex', alignItems: 'center', gap: 0.4,
            px: 0.5, py: '1px',
            borderRadius: '3px',
            background: event.color,
            opacity: 0.92,
            overflow: 'hidden',
            width: '100%',
          }}>
            <Typography sx={{ fontSize: '0.5rem', lineHeight: 1, flexShrink: 0 }}>
              {event.icon}
            </Typography>
            <Typography sx={{
              fontSize: '0.58rem', fontWeight: 600, color: '#fff',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              lineHeight: 1.5,
              flex: 1, minWidth: 0,
            }}>
              {event.title}
            </Typography>
          </Box>
        )}
      </motion.div>
    </Tooltip>
  );
}

// ─── Single day cell ──────────────────────────────────────────────────────────

function DayCell({ date, currentMonth, dayEvents, isSelected, onDayClick, onEventClick, compact }) {
  const prefersReducedMotion = useReducedMotion();
  const inMonth  = isSameMonth(date, currentMonth);
  const todayDay = isToday(date);
  const maxChips = compact ? MAX_CHIPS_MOBILE : MAX_CHIPS_DESKTOP;
  const visible  = dayEvents.slice(0, maxChips);
  const overflow = dayEvents.length - maxChips;

  return (
    <motion.div
      whileHover={prefersReducedMotion ? undefined : { backgroundColor: 'var(--color-overlay)' }}
      transition={{ duration: 0.12 }}
      onClick={() => onDayClick(date)}
      style={{ cursor: 'pointer', borderRadius: 3, overflow: 'hidden' }}
    >
      <Box sx={{
        minHeight: compact ? 52 : 80,
        p: compact ? '4px' : '6px',
        borderRadius: '3px',
        border: isSelected
          ? '1.5px solid var(--color-primary)'
          : '1px solid transparent',
        background: isSelected ? 'var(--color-primary-alpha)' : 'transparent',
        display: 'flex',
        flexDirection: 'column',
        gap: '3px',
        overflow: 'hidden',
        transition: 'border-color 0.15s, background 0.15s',
        opacity: inMonth ? 1 : 0.3,
      }}>
        {/* Day number — left aligned, standard calendar pattern */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-start', mb: '2px' }}>
          <Box sx={{
            width: 20, height: 20,
            borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: todayDay ? 'var(--color-primary)' : 'transparent',
            flexShrink: 0,
          }}>
            <Typography sx={{
              fontSize: '0.7rem',
              fontWeight: todayDay ? 800 : isSelected ? 700 : 400,
              color: todayDay ? '#fff' : isSelected ? 'var(--color-primary)' : 'var(--color-text)',
              lineHeight: 1,
            }}>
              {format(date, 'd')}
            </Typography>
          </Box>
        </Box>

        {/* Events */}
        {!compact && visible.map((ev) => (
          <EventChip key={ev.id} event={ev} onClick={onEventClick} compact={false} />
        ))}

        {/* Mobile: colored dots */}
        {compact && visible.length > 0 && (
          <Box sx={{ display: 'flex', gap: 0.4, justifyContent: 'center', flexWrap: 'wrap', mt: 0.25 }}>
            {visible.map((ev) => (
              <EventChip key={ev.id} event={ev} onClick={onEventClick} compact />
            ))}
          </Box>
        )}

        {/* Overflow */}
        {overflow > 0 && (
          <Typography sx={{ fontSize: '0.58rem', color: 'var(--color-text-secondary)', fontWeight: 600, lineHeight: 1 }}>
            +{overflow} more
          </Typography>
        )}
      </Box>
    </motion.div>
  );
}

// ─── Main CalendarView ────────────────────────────────────────────────────────

export default function CalendarView({ events, month, onMonthChange, selectedDate, onDayClick, onEventClick }) {
  const theme   = useTheme();
  const compact = useMediaQuery(theme.breakpoints.down('sm'));
  const prefersReducedMotion = useReducedMotion();

  const gridDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 0 });
    const end   = endOfWeek(endOfMonth(month),     { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [month]);

  const eventMap = useMemo(() => groupByDay(events), [events]);

  return (
    <Box>
      {/* Month navigation header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography sx={{
          fontFamily: TYPOGRAPHY.fontFamily.display,
          fontWeight: 700, fontSize: '1.15rem',
          color: 'var(--color-text)',
        }}>
          {format(month, 'MMMM yyyy')}
        </Typography>
        <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
          <Button size="small" variant="outlined" onClick={() => onMonthChange(new Date())}
            sx={{
              fontSize: '0.72rem', fontWeight: 700, px: 1.25, py: 0.4,
              borderRadius: `${RADIUS.md}px`,
              borderColor: 'var(--color-border)',
              color: 'var(--color-text-secondary)',
              minWidth: 0,
              '&:hover': { borderColor: 'var(--color-primary)', color: 'var(--color-primary)' },
            }}>
            Today
          </Button>
          <IconButton size="small" onClick={() => onMonthChange(subMonths(month, 1))}
            sx={{ color: 'var(--color-text-secondary)', '&:hover': { color: 'var(--color-primary)' } }}>
            <Typography sx={{ fontSize: 18, lineHeight: 1 }}>‹</Typography>
          </IconButton>
          <IconButton size="small" onClick={() => onMonthChange(addMonths(month, 1))}
            sx={{ color: 'var(--color-text-secondary)', '&:hover': { color: 'var(--color-primary)' } }}>
            <Typography sx={{ fontSize: 18, lineHeight: 1 }}>›</Typography>
          </IconButton>
        </Box>
      </Box>

      {/* Day-of-week headers */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', mb: 0.5 }}>
        {DAY_HEADERS.map((d) => (
          <Typography key={d} sx={{
            fontSize: '0.65rem', fontWeight: 700, textAlign: 'center',
            color: 'var(--color-text-secondary)', textTransform: 'uppercase',
            letterSpacing: '0.06em', py: 0.5,
          }}>
            {compact ? d[0] : d}
          </Typography>
        ))}
      </Box>

      {/* Calendar grid */}
      <motion.div
        key={format(month, 'yyyy-MM')}
        initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22 }}
      >
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: compact ? '2px' : '3px',
          border: '1px solid var(--color-border)',
          borderRadius: '6px',
          overflow: 'hidden',
          background: 'var(--color-surface)',
          p: compact ? '4px' : '6px',
        }}>
          {gridDays.map((day) => {
            const key       = format(day, 'yyyy-MM-dd');
            const dayEvents = eventMap.get(key) || [];
            const isSel     = selectedDate && isSameDay(day, selectedDate);
            return (
              <DayCell
                key={key}
                date={day}
                currentMonth={month}
                dayEvents={dayEvents}
                isSelected={isSel}
                onDayClick={onDayClick}
                onEventClick={onEventClick}
                compact={compact}
              />
            );
          })}
        </Box>
      </motion.div>

      {/* Legend */}
      <Box sx={{ display: 'flex', gap: 2, mt: 1.5, flexWrap: 'wrap' }}>
        {[
          { color: 'var(--color-primary)',             icon: '💬', label: 'Consultation' },
          { color: 'var(--color-warning, #e65100)',    icon: '🏛️', label: 'Hearing' },
          { color: 'var(--color-success, #2e7d32)',    icon: '📹', label: 'Video KYC' },
        ].map(({ color, icon, label }) => (
          <Box key={label} sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
            <Box sx={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
            <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)', fontSize: '0.68rem' }}>
              {icon} {label}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
