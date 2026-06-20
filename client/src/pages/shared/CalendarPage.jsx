import React, { useState, useMemo } from 'react';
import { format, isSameDay, addDays, startOfMonth } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import ToggleButton from '@mui/material/ToggleButton';
import useMediaQuery from '@mui/material/useMediaQuery';
import Drawer from '@mui/material/Drawer';
import { useTheme } from '@mui/material/styles';

import AnimatedPage from '../../components/ui/AnimatedPage';
import GradientHeading from '../../components/ui/GradientHeading';
import GlassCard from '../../components/ui/GlassCard';
import CalendarView from '../../components/calendar/CalendarView';
import DayEventsPanel from '../../components/calendar/DayEventsPanel';
import DayView from '../../components/calendar/DayView';
import { useCalendarEvents } from '../../hooks/useCalendarEvents';
import { RADIUS, SHADOWS, TYPOGRAPHY } from '../../theme/tokens';

// ─── Upcoming events strip ────────────────────────────────────────────────────

function UpcomingStrip({ events }) {
  const navigate = useNavigate();
  const today    = new Date();
  const upcoming = useMemo(
    () => events.filter((ev) => ev.date >= today).slice(0, 5),
    [events],
  );

  if (upcoming.length === 0) return null;

  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="overline" sx={{
        color: 'var(--color-text-secondary)', fontWeight: 700,
        letterSpacing: '0.1em', fontSize: '0.65rem',
        display: 'block', mb: 1.5,
      }}>
        Coming Up
      </Typography>
      <Box sx={{
        display: 'flex', gap: 1, overflowX: 'auto', pb: 0.5,
        '&::-webkit-scrollbar': { display: 'none' },
      }}>
        {upcoming.map((ev) => {
          const isEvToday  = isSameDay(ev.date, today);
          const isTomorrow = isSameDay(ev.date, addDays(today, 1));
          const dayLabel   = isEvToday ? 'Today' : isTomorrow ? 'Tomorrow' : format(ev.date, 'EEE d MMM');
          return (
            <motion.div
              key={ev.id}
              whileHover={{ y: -2 }}
              transition={{ duration: 0.15 }}
              onClick={() => navigate(ev.link)}
              style={{ cursor: 'pointer', flexShrink: 0 }}
            >
              <Box sx={{
                p: 1.5, borderRadius: `${RADIUS.lg}px`,
                border: `1.5px solid ${ev.color}`,
                background: 'var(--color-surface)',
                minWidth: 150, maxWidth: 200,
                boxShadow: SHADOWS.sm,
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
                  <Typography sx={{ fontSize: 16 }}>{ev.icon}</Typography>
                  <Chip size="small" label={dayLabel}
                    sx={{ height: 18, fontSize: '0.6rem', fontWeight: 700,
                      background: ev.color, color: '#fff', border: 'none' }} />
                </Box>
                <Typography variant="body2" sx={{
                  fontWeight: 700, color: 'var(--color-text)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  fontSize: '0.8rem',
                }}>
                  {ev.title}
                </Typography>
                <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)' }}>
                  {format(ev.date, 'h:mm a')}
                </Typography>
              </Box>
            </motion.div>
          );
        })}
      </Box>
    </Box>
  );
}

// ─── View toggle ──────────────────────────────────────────────────────────────

function ViewToggle({ view, onChange }) {
  return (
    <ToggleButtonGroup
      value={view}
      exclusive
      onChange={(_, v) => { if (v) onChange(v); }}
      size="small"
      sx={{
        '& .MuiToggleButton-root': {
          px: 1.75, py: 0.5,
          fontSize: '0.75rem', fontWeight: 600,
          border: '1px solid var(--color-border)',
          color: 'var(--color-text-secondary)',
          textTransform: 'none',
          '&.Mui-selected': {
            background: 'var(--color-primary)',
            color: '#fff',
            borderColor: 'var(--color-primary)',
            '&:hover': { background: 'var(--color-primary)' },
          },
        },
      }}
    >
      <ToggleButton value="month">Month</ToggleButton>
      <ToggleButton value="day">Day</ToggleButton>
    </ToggleButtonGroup>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const theme  = useTheme();
  const isMd   = useMediaQuery(theme.breakpoints.up('md'));
  const { events } = useCalendarEvents();

  const [view,         setView]         = useState('month');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [drawerOpen,   setDrawerOpen]   = useState(false);

  const handleDayClick = (date) => {
    setSelectedDate(date);
    if (!isMd) {
      // On mobile: first click selects, second click drills into day view
      if (isSameDay(date, selectedDate)) {
        setView('day');
      } else {
        setDrawerOpen(true);
      }
    }
  };

  const handleEventClick = (event) => {
    setSelectedDate(event.date);
    if (!isMd) setDrawerOpen(true);
  };

  // When switching to day view, sync month if needed
  const handleViewChange = (v) => {
    setView(v);
    if (v === 'month') {
      setCurrentMonth(startOfMonth(selectedDate));
    }
  };

  // Clicking a day in month view → drill into that day (desktop only)
  const handleDayDrillDown = (date) => {
    setSelectedDate(date);
    if (isMd) setView('day');
    else handleDayClick(date);
  };

  return (
    <AnimatedPage>
      <Box sx={{ p: { xs: 2, sm: 3, md: 4 }, maxWidth: 1200, mx: 'auto', pb: { xs: 10, md: 4 } }}>

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
          <Box sx={{
            display: 'flex', alignItems: 'flex-start',
            justifyContent: 'space-between', mb: 3, gap: 2,
            flexWrap: 'wrap',
          }}>
            <Box>
              <GradientHeading variant="h4" sx={{ fontFamily: TYPOGRAPHY.fontFamily.display, fontWeight: 700 }}>
                My Calendar
              </GradientHeading>
              <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)', mt: 0.25 }}>
                {events.length} upcoming event{events.length !== 1 ? 's' : ''} across all your appointments
              </Typography>
            </Box>
            <ViewToggle view={view} onChange={handleViewChange} />
          </Box>
        </motion.div>

        {/* Upcoming strip — only in month view */}
        {view === 'month' && <UpcomingStrip events={events} />}

        {/* ── Month view ── */}
        <AnimatePresence mode="wait">
          {view === 'month' && (
            <motion.div
              key="month"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.2 }}
            >
              <Grid container spacing={3} alignItems="flex-start">
                <Grid item xs={12} md={8}>
                  <GlassCard sx={{ p: { xs: 1.5, sm: 2.5 } }}>
                    <CalendarView
                      events={events}
                      month={currentMonth}
                      onMonthChange={setCurrentMonth}
                      selectedDate={selectedDate}
                      onDayClick={handleDayDrillDown}
                      onEventClick={handleEventClick}
                    />
                  </GlassCard>
                </Grid>

                {isMd && (
                  <Grid item md={4}>
                    <GlassCard sx={{ p: 2.5, position: 'sticky', top: 80, minHeight: 400 }}>
                      <DayEventsPanel date={selectedDate} events={events} />
                    </GlassCard>
                  </Grid>
                )}
              </Grid>

              {/* Mobile bottom drawer */}
              {!isMd && (
                <Drawer
                  anchor="bottom"
                  open={drawerOpen}
                  onClose={() => setDrawerOpen(false)}
                  PaperProps={{
                    sx: {
                      borderTopLeftRadius: `${RADIUS.xl}px`,
                      borderTopRightRadius: `${RADIUS.xl}px`,
                      background: 'var(--color-surface)',
                      maxHeight: '70vh',
                      px: 2.5, py: 2,
                    },
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1.5 }}>
                    <Box sx={{ width: 36, height: 4, borderRadius: 2, background: 'var(--color-border)' }} />
                  </Box>
                  {/* Drill-down button */}
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
                    <Typography
                      variant="caption"
                      onClick={() => { setDrawerOpen(false); setView('day'); }}
                      sx={{
                        color: 'var(--color-primary)', fontWeight: 700,
                        cursor: 'pointer', textDecoration: 'underline',
                      }}
                    >
                      See day view →
                    </Typography>
                  </Box>
                  <DayEventsPanel date={selectedDate} events={events} />
                </Drawer>
              )}
            </motion.div>
          )}

          {/* ── Day view ── */}
          {view === 'day' && (
            <motion.div
              key="day"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={{ duration: 0.2 }}
            >
              <GlassCard sx={{ overflow: 'hidden' }}>
                <DayView
                  date={selectedDate}
                  events={events}
                  onEventClick={handleEventClick}
                  onDateChange={setSelectedDate}
                />
              </GlassCard>
            </motion.div>
          )}
        </AnimatePresence>
      </Box>
    </AnimatedPage>
  );
}
