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

module.exports = { DAY_NAMES, defaultAvailability, resolveAvailability };
