'use strict';

/**
 * Admin session middleware.
 *
 * Enforces a 15-minute inactivity timeout for admin users independent of the
 * main JWT expiry (which is 1 hour). On every admin API call:
 *  - If a session key exists in Redis → refresh its TTL (sliding window) → allow.
 *  - If the key is missing but the JWT was issued < 5 min ago → bootstrap the
 *    key (first request after fresh login) → allow.
 *  - Otherwise → 401 ADMIN_SESSION_EXPIRED, prompting the client to re-auth.
 *
 * Register in admin.routes.js AFTER the /reauth endpoint so that re-auth itself
 * is never blocked by this middleware.
 */

const { getRedisClient } = require('../config/redis');
const logger = require('../utils/logger');

const ADMIN_SESSION_TTL = 15 * 60;        // 15 minutes (seconds)
const BOOTSTRAP_GRACE_SECONDS = 5 * 60;   // 5 minutes — allow fresh JWT to bootstrap

async function requireAdminSession(req, res, next) {
  const redis = getRedisClient();
  if (!redis) {
    // Fail-open: if Redis is unavailable, don't block admins.
    logger.warn('[adminSession] Redis unavailable — skipping admin session check');
    return next();
  }

  const userId = req.user?.userId;
  if (!userId) return next();

  const sessionKey = `admin:session:${userId}`;

  try {
    const exists = await redis.exists(sessionKey);

    if (!exists) {
      const jwtAge = Math.floor(Date.now() / 1000) - (req.user.iat || 0);
      if (jwtAge <= BOOTSTRAP_GRACE_SECONDS) {
        // Fresh login — bootstrap the session automatically.
        await redis.set(sessionKey, '1', 'EX', ADMIN_SESSION_TTL);
        return next();
      }
      return res.status(401).json({
        error: 'ADMIN_SESSION_EXPIRED',
        message: 'Your admin session has timed out after 15 minutes of inactivity. Please re-authenticate to continue.',
      });
    }

    // Sliding window: reset TTL on every admin request.
    await redis.expire(sessionKey, ADMIN_SESSION_TTL);
    return next();
  } catch (err) {
    logger.error('[adminSession] Redis error during session check', { error: err.message });
    // Fail-open on Redis errors so a Redis blip doesn't lock out all admins.
    return next();
  }
}

module.exports = { requireAdminSession, ADMIN_SESSION_TTL };
