import React, { useMemo, useEffect, useRef } from 'react';
import { format, isToday, isSameDay, addDays, subDays } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';

import { RADIUS, SHADOWS, TYPOGRAPHY } from '../../theme/tokens';

// ─── Layout constants ─────────────────────────────────────────────────────────

const HOUR_HEIGHT   = 64;   // px per hour
const TIME_COL_W    = 52;   // px for the time label column
const START_HOUR    = 6;    // 6 AM
const END_HOUR      = 22;   // 10 PM
const HOURS         = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => i + START_HOUR);
const TOTAL_HEIGHT  = HOURS.length * HOUR_HEIGHT;

// ─── Overlap column assignment ────────────────────────────────────────────────

function assignColumns(events) {
  if (events.length === 0) return [];

  const sorted = [...events].sort((a, b) => a.date - b.date);

  // Assign each event to the first column it fits in
  const cols = []; // cols[i] = end time of last event in column i
  const placed = sorted.map((ev) => {
    const endMs = ev.date.getTime() + (ev.durationMinutes || 30) * 60_000;
    let col = cols.findIndex((colEnd) => colEnd <= ev.date.getTime());
    if (col === -1) {
      col = cols.length;
      cols.push(endMs);
    } else {
      cols[col] = endMs;
    }
    return { ...ev, _col: col, _endMs: endMs };
  });

  // For each event, count how many columns are active during its span
  return placed.map((ev) => {
    let maxCol = ev._col;
    placed.forEach((other) => {
      const overlaps = ev.date.getTime() < other._endMs && other.date.getTime() < ev._endMs;
      if (overlaps) maxCol = Math.max(maxCol, other._col);
    });
    return { ...ev, _totalCols: maxCol + 1 };
  });
}

// ─── Current time indicator ───────────────────────────────────────────────────

function NowLine() {
  const ref = useRef(null);
  const now = new Date();
  const h   = now.getHours();
  const m   = now.getMinutes();

  useEffect(() => {
    ref.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, []);

  if (h < START_HOUR || h >= END_HOUR) return null;

  const top = ((h - START_HOUR) + m / 60) * HOUR_HEIGHT;

  return (
    <Box
      ref={ref}
      sx={{
        position: 'absolute',
        top: `${top}px`,
        left: 0,
        right: 0,
        zIndex: 10,
        display: 'flex',
        alignItems: 'center',
        pointerEvents: 'none',
      }}
    >
      <Box sx={{
        width: 10, height: 10, borderRadius: '50%',
        background: 'var(--color-error)',
        flexShrink: 0, ml: '-5px',
      }} />
      <Box sx={{
        flex: 1,
        height: '1.5px',
        background: 'var(--color-error)',
        opacity: 0.8,
      }} />
    </Box>
  );
}

// ─── Single event block ───────────────────────────────────────────────────────

function EventBlock({ event, top, height, left, width, onClick }) {
  const prefersReducedMotion = useReducedMotion();
  const navigate = useNavigate();
  const narrow   = width < 80;
  const short    = height < 36;

  return (
    <Tooltip
      title={`${event.icon} ${event.title} — ${format(event.date, 'h:mm a')} (${event.durationMinutes} min)`}
      placement="right"
      arrow
    >
      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={prefersReducedMotion ? undefined : { opacity: 0, scale: 0.95 }}
        whileHover={prefersReducedMotion ? undefined : { scale: 1.02, zIndex: 20 }}
        transition={{ duration: 0.15 }}
        onClick={() => { onClick(event); navigate(event.link); }}
        style={{
          position: 'absolute',
          top,
          height: Math.max(height, 24),
          left: `${left * 100}%`,
          width: `${width * 100}%`,
          padding: '0 2px',
          zIndex: 5,
          cursor: 'pointer',
          boxSizing: 'border-box',
        }}
      >
        <Box sx={{
          height: '100%',
          borderRadius: '4px',
          background: event.color,
          opacity: 0.92,
          px: narrow ? 0.5 : 1,
          py: '3px',
          overflow: 'hidden',
          boxShadow: SHADOWS.sm,
          borderLeft: `3px solid ${event.color}`,
          filter: 'brightness(0.92)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-start',
          gap: '1px',
        }}>
          {!short && (
            <Typography sx={{
              fontSize: narrow ? '0.58rem' : '0.65rem',
              fontWeight: 700, color: '#fff',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              lineHeight: 1.3,
            }}>
              {event.icon} {event.title}
            </Typography>
          )}
          {short && (
            <Typography sx={{
              fontSize: '0.58rem', fontWeight: 700, color: '#fff',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              lineHeight: 1.3,
            }}>
              {event.icon} {event.title}
            </Typography>
          )}
          {!short && !narrow && (
            <Typography sx={{
              fontSize: '0.58rem', color: 'rgba(255,255,255,0.85)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              lineHeight: 1.2,
            }}>
              {format(event.date, 'h:mm a')} · {event.durationMinutes} min
            </Typography>
          )}
        </Box>
      </motion.div>
    </Tooltip>
  );
}

// ─── All-day / no-time events banner ─────────────────────────────────────────

function AllDayBanner({ events }) {
  const noTime = events.filter((ev) => {
    const h = ev.date.getHours();
    return h === 0 && ev.date.getMinutes() === 0;
  });
  if (noTime.length === 0) return null;

  return (
    <Box sx={{
      display: 'flex', gap: 0.75, flexWrap: 'wrap',
      px: 1, py: 1,
      borderBottom: '1px solid var(--color-border)',
      background: 'var(--color-bg)',
    }}>
      <Typography variant="caption" sx={{
        color: 'var(--color-text-secondary)', fontWeight: 600,
        alignSelf: 'center', minWidth: TIME_COL_W - 8, fontSize: '0.62rem',
      }}>
        All day
      </Typography>
      {noTime.map((ev) => (
        <Box key={ev.id} sx={{
          px: 1, py: '2px', borderRadius: '3px',
          background: ev.color, color: '#fff',
          fontSize: '0.65rem', fontWeight: 600,
        }}>
          {ev.icon} {ev.title}
        </Box>
      ))}
    </Box>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyDay({ date }) {
  return (
    <Box sx={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      height: 260, gap: 1.5,
      color: 'var(--color-text-secondary)',
    }}>
      <Typography sx={{ fontSize: 40 }}>📅</Typography>
      <Typography variant="body2" sx={{ fontWeight: 600 }}>
        No events on {format(date, 'EEEE')}
      </Typography>
      <Typography variant="caption">
        Your scheduled consultations, hearings, and KYC calls will appear here
      </Typography>
    </Box>
  );
}

// ─── Main DayView ─────────────────────────────────────────────────────────────

export default function DayView({ date, events, onEventClick, onDateChange }) {
  const theme  = useTheme();
  const isSm   = useMediaQuery(theme.breakpoints.down('sm'));
  const prefersReducedMotion = useReducedMotion();
  const scrollRef = useRef(null);

  // Filter events for this day that fall in [START_HOUR, END_HOUR)
  const dayEvents = useMemo(() => {
    return events.filter((ev) => {
      if (!isSameDay(ev.date, date)) return false;
      const h = ev.date.getHours();
      return h >= START_HOUR && h < END_HOUR;
    });
  }, [events, date]);

  const placed = useMemo(() => assignColumns(dayEvents), [dayEvents]);

  // Auto-scroll to first event (or 8 AM if none) on date change
  useEffect(() => {
    if (!scrollRef.current) return;
    const firstEvent = dayEvents[0];
    const scrollHour = firstEvent
      ? Math.max(firstEvent.date.getHours() - 1, START_HOUR)
      : 8;
    const scrollTop = (scrollHour - START_HOUR) * HOUR_HEIGHT;
    scrollRef.current.scrollTop = scrollTop;
  }, [date]);

  const isCurrentDay = isToday(date);

  return (
    <motion.div
      key={format(date, 'yyyy-MM-dd')}
      initial={prefersReducedMotion ? false : { opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.22 }}
    >
      {/* Day header */}
      <Box sx={{
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between',
        px: 1.5, py: 1.25,
        borderBottom: '1px solid var(--color-border)',
        background: 'var(--color-surface)',
        gap: 1,
      }}>
        {/* Date badge */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
          <Box sx={{
            width: 38, height: 38, borderRadius: '50%',
            background: isCurrentDay ? 'var(--color-primary)' : 'var(--color-border)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Typography sx={{
              fontSize: '0.55rem', fontWeight: 700, lineHeight: 1,
              color: isCurrentDay ? '#fff' : 'var(--color-text-secondary)',
              textTransform: 'uppercase',
            }}>
              {format(date, 'EEE')}
            </Typography>
            <Typography sx={{
              fontSize: '1rem', fontWeight: 800, lineHeight: 1,
              color: isCurrentDay ? '#fff' : 'var(--color-text)',
            }}>
              {format(date, 'd')}
            </Typography>
          </Box>

          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{
              fontFamily: TYPOGRAPHY.fontFamily.display,
              fontWeight: 700, fontSize: '0.95rem',
              color: 'var(--color-text)',
              whiteSpace: 'nowrap',
            }}>
              {format(date, 'MMMM yyyy')}
            </Typography>
            <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)' }}>
              {dayEvents.length === 0
                ? 'No events'
                : `${dayEvents.length} event${dayEvents.length !== 1 ? 's' : ''}`}
            </Typography>
          </Box>
        </Box>

        {/* Day navigation */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, flexShrink: 0 }}>
          <Tooltip title="Previous day" arrow>
            <IconButton
              size="small"
              onClick={() => onDateChange?.(subDays(date, 1))}
              sx={{ color: 'var(--color-text-secondary)', '&:hover': { color: 'var(--color-primary)' } }}
            >
              <Typography sx={{ fontSize: 18, lineHeight: 1, fontWeight: 500 }}>‹</Typography>
            </IconButton>
          </Tooltip>

          {!isCurrentDay && (
            <Button
              size="small"
              onClick={() => onDateChange?.(new Date())}
              sx={{
                fontSize: '0.72rem', fontWeight: 700, px: 1.25, py: 0.4,
                borderRadius: '6px',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-secondary)',
                minWidth: 0, textTransform: 'none',
                '&:hover': { borderColor: 'var(--color-primary)', color: 'var(--color-primary)' },
              }}
            >
              Today
            </Button>
          )}

          <Tooltip title="Next day" arrow>
            <IconButton
              size="small"
              onClick={() => onDateChange?.(addDays(date, 1))}
              sx={{ color: 'var(--color-text-secondary)', '&:hover': { color: 'var(--color-primary)' } }}
            >
              <Typography sx={{ fontSize: 18, lineHeight: 1, fontWeight: 500 }}>›</Typography>
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* All-day events */}
      <AllDayBanner events={events.filter((ev) => isSameDay(ev.date, date))} />

      {/* Empty state */}
      {dayEvents.length === 0 && <EmptyDay date={date} />}

      {/* Time grid */}
      {dayEvents.length > 0 && (
        <Box
          ref={scrollRef}
          sx={{
            overflowY: 'auto',
            maxHeight: isSm ? 'calc(100vh - 340px)' : 520,
            '&::-webkit-scrollbar': { width: 4 },
            '&::-webkit-scrollbar-thumb': { background: 'var(--color-border)', borderRadius: 2 },
          }}
        >
          <Box sx={{
            position: 'relative',
            height: TOTAL_HEIGHT,
            display: 'flex',
          }}>
            {/* Time labels column */}
            <Box sx={{
              width: TIME_COL_W,
              flexShrink: 0,
              position: 'relative',
              borderRight: '1px solid var(--color-border)',
            }}>
              {HOURS.map((h) => (
                <Box
                  key={h}
                  sx={{
                    position: 'absolute',
                    top: (h - START_HOUR) * HOUR_HEIGHT,
                    right: 8,
                    transform: 'translateY(-50%)',
                  }}
                >
                  <Typography sx={{
                    fontSize: '0.6rem', fontWeight: 600,
                    color: 'var(--color-text-secondary)',
                    whiteSpace: 'nowrap',
                  }}>
                    {format(new Date(2000, 0, 1, h), 'h a')}
                  </Typography>
                </Box>
              ))}
            </Box>

            {/* Events area */}
            <Box sx={{ flex: 1, position: 'relative' }}>
              {/* Hour grid lines */}
              {HOURS.map((h) => (
                <Box
                  key={h}
                  sx={{
                    position: 'absolute',
                    top: (h - START_HOUR) * HOUR_HEIGHT,
                    left: 0, right: 0,
                    borderTop: h === START_HOUR
                      ? 'none'
                      : '1px solid var(--color-border)',
                    opacity: 0.5,
                  }}
                />
              ))}

              {/* Half-hour markers */}
              {HOURS.map((h) => (
                <Box
                  key={`${h}-half`}
                  sx={{
                    position: 'absolute',
                    top: (h - START_HOUR) * HOUR_HEIGHT + HOUR_HEIGHT / 2,
                    left: 0, right: 0,
                    borderTop: '1px dashed var(--color-border)',
                    opacity: 0.3,
                  }}
                />
              ))}

              {/* Current time line */}
              {isCurrentDay && <NowLine />}

              {/* Event blocks */}
              <AnimatePresence>
                {placed.map((ev) => {
                  const h    = ev.date.getHours();
                  const m    = ev.date.getMinutes();
                  const top  = ((h - START_HOUR) + m / 60) * HOUR_HEIGHT;
                  const height = Math.max((ev.durationMinutes / 60) * HOUR_HEIGHT, 24);
                  const totalCols = ev._totalCols;
                  const col       = ev._col;
                  const gapFrac   = 0.005;
                  const colW      = (1 - gapFrac * (totalCols - 1)) / totalCols;
                  const left      = col * (colW + gapFrac);

                  return (
                    <EventBlock
                      key={ev.id}
                      event={ev}
                      top={top}
                      height={height}
                      left={left}
                      width={colW}
                      onClick={onEventClick}
                    />
                  );
                })}
              </AnimatePresence>
            </Box>
          </Box>
        </Box>
      )}
    </motion.div>
  );
}
