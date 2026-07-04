/**
 * server/src/controllers/platform.controller.js
 *
 * Public, unauthenticated platform-wide counters shown on the landing page
 * and citizen home ("Documents Created", "Indians Helped", "Legal Templates").
 */

'use strict';

const DocumentModel = require('../models/Document.model');
const User = require('../models/User.model');
const DocumentTemplate = require('../models/DocumentTemplate.model');
const asyncHandler = require('../utils/asyncHandler');
const { getRedisClient } = require('../config/redis');

const STATS_CACHE_KEY = 'platform:stats';
const STATS_CACHE_TTL_SECONDS = 600; // marketing counters don't need to be real-time

// ─── getPlatformStats ──────────────────────────────────────────────────────────

/**
 * GET /v1/platform/stats
 */
const getPlatformStats = asyncHandler(async (req, res) => {
  const redis = getRedisClient();
  if (redis) {
    const cached = await redis.get(STATS_CACHE_KEY);
    if (cached) return res.json(JSON.parse(cached));
  }

  const [documentsCreated, usersHelped, legalTemplates] = await Promise.all([
    DocumentModel.countDocuments({ isDeleted: false }),
    User.countDocuments({ persona: 'citizen' }),
    DocumentTemplate.countDocuments({ isActive: true }),
  ]);

  const stats = { documentsCreated, usersHelped, legalTemplates };

  if (redis) {
    await redis.set(STATS_CACHE_KEY, JSON.stringify(stats), 'EX', STATS_CACHE_TTL_SECONDS);
  }

  res.json(stats);
});

module.exports = { getPlatformStats };
