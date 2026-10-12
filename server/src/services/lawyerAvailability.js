'use strict';

// 0 = Sunday. Matches Date#getDay() and the onboarding schedule editor.
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * defaultAvailability — Mon–Fri 09:00–17:00, weekends off.
 * Used when a lawyer is accepting clients but never saved a weekly schedule.
 */
function defaultAvailability() {
  return DAY_NAMES.map((_, dayOfWeek) => ({
    dayOfWeek,
    startTime: '09:00',
    endTime: '17:00',
    isActive: dayOfWeek >= 1 && dayOfWeek <= 5,
  }));
}

/**
 * resolveAvailability — the schedule slot generation and booking should use.
 * An empty array means "never configured", not "unavailable every day".
 */
function resolveAvailability(profile) {
  const saved = profile?.availability;
  if (Array.isArray(saved) && saved.length > 0) return saved;
  return defaultAvailability();
}

/**
 * A zone-less datetime (the value from <input type="datetime-local">) is IST.
 * Strings that already carry Z or an offset are left as that instant.
 * Returns null for missing or unparseable values.
 */
function parseIstScheduledAt(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const raw = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(raw)) return null;
  const zoned = /(?:Z|[+-]\d{2}:?\d{2})$/.test(raw);
  const normalized = zoned ? raw : `${raw.length === 16 ? `${raw}:00` : raw}+05:30`;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function istWallClock(date) {
  const ist = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  return {
    dayOfWeek: ist.getDay(),
    minutes: ist.getHours() * 60 + ist.getMinutes(),
  };
}

/**
 * Same window rule as consultation booking: active day, start inclusive, end exclusive.
 * `labels.role` is "You" for a notary scheduling their own session, "Lawyer" for a citizen booking.
 */
function availabilityWindowError(profile, scheduledDate, labels = {}) {
  const unavailable = labels.unavailable || 'NOTARY_UNAVAILABLE';
  const who = labels.who || 'You are';
  const hoursLabel = labels.hoursLabel || 'your working hours';
  const { dayOfWeek, minutes } = istWallClock(scheduledDate);
  const dayRules = resolveAvailability(profile).filter(
    (rule) => rule.dayOfWeek === dayOfWeek && rule.isActive !== false && rule.startTime && rule.endTime
  );
  if (!dayRules.length) {
    return {
      error: unavailable,
      message: `${who} not available on ${DAY_NAMES[dayOfWeek]}. Choose another day.`,
    };
  }
  const fits = dayRules.some((rule) => {
    const [sH, sM] = rule.startTime.split(':').map(Number);
    const [eH, eM] = rule.endTime.split(':').map(Number);
    if ([sH, sM, eH, eM].some((n) => Number.isNaN(n))) return false;
    return minutes >= sH * 60 + sM && minutes < eH * 60 + eM;
  });
  if (!fits) {
    const hours = dayRules.map((rule) => `${rule.startTime}–${rule.endTime}`).join(', ');
    return {
      error: 'OUTSIDE_HOURS',
      message: `That time is outside ${hoursLabel} (${hours} IST).`,
    };
  }
  return null;
}

module.exports = {
  DAY_NAMES,
  defaultAvailability,
  resolveAvailability,
  parseIstScheduledAt,
  istWallClock,
  availabilityWindowError,
};
