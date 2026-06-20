'use strict';

const crypto = require('crypto');
const axios  = require('axios');
const logger = require('../../utils/logger');

// ─── Jitsi Meet (dev / no-key fallback) ──────────────────────────────────────
// Completely free, no account required. Room name is unpredictable to prevent
// uninvited guests. Rooms auto-close when the last participant leaves.

function jitsiRoomUrl(consultationId) {
  const token = crypto
    .createHash('sha256')
    .update(`${consultationId}-${process.env.JWT_SECRET || 'nyayasetu'}`)
    .digest('hex')
    .slice(0, 12);
  return `https://meet.jit.si/nyayasetu-${token}`;
}

// ─── Daily.co (prod) ──────────────────────────────────────────────────────────
// $0.00/month up to 2000 participant-minutes, then pay-as-you-go.
// API key: dashboard.daily.co → Developers → API keys

async function dailyCreateRoom(consultationId, scheduledAt, durationMinutes = 30) {
  const apiKey = process.env.DAILY_API_KEY;
  const domain = process.env.DAILY_DOMAIN; // e.g. "nyayasetu" → nyayasetu.daily.co

  // Room expires 2 hours after the scheduled slot ends (generous grace period)
  const expiry = Math.floor(
    (new Date(scheduledAt).getTime() + (durationMinutes + 120) * 60_000) / 1000
  );

  const roomName = `nyayasetu-${String(consultationId).slice(-16)}`;

  const { data } = await axios.post(
    'https://api.daily.co/v1/rooms',
    {
      name: roomName,
      privacy: 'public',
      properties: {
        exp: expiry,
        enable_knocking: true,
        enable_screenshare: true,
        start_video_off: false,
        start_audio_off: false,
        max_participants: 2,
        ...(domain ? {} : {}), // custom domain is optional
      },
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 10_000,
    }
  );

  // Daily returns { url } which is the full meeting URL including domain
  return data.url;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Create a video room for a consultation.
 *
 * Dev  (no DAILY_API_KEY): Jitsi Meet — free, no account needed.
 * Prod (DAILY_API_KEY set): Daily.co — managed WebRTC, auto-expiring room.
 *
 * @param {{ _id, scheduledAt, durationMinutes }} consultation
 * @returns {Promise<string>}  The full meeting URL
 */
async function createRoom(consultation) {
  const { _id, scheduledAt, durationMinutes } = consultation;

  if (process.env.DAILY_API_KEY) {
    try {
      const url = await dailyCreateRoom(_id, scheduledAt, durationMinutes);
      logger.info(`[video/daily] Room created for consultation ${_id}: ${url}`);
      return url;
    } catch (err) {
      logger.error(`[video/daily] Room creation failed, falling back to Jitsi: ${err.message}`);
      // Hard fail in prod so misconfigured Daily keys surface immediately
      if (process.env.NODE_ENV === 'production') throw err;
    }
  }

  const url = jitsiRoomUrl(_id);
  logger.info(`[video/jitsi] Room URL for consultation ${_id}: ${url}`);
  return url;
}

module.exports = { createRoom };
