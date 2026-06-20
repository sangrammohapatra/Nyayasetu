const asyncHandler = require('../utils/asyncHandler');
const aiTriageService = require('../services/ai/aiTriageService');
const User = require('../models/User.model');
const { createError } = require('../middleware/error.middleware');
const logger = require('../utils/logger');

// Daily triage limits per plan
const DAILY_LIMITS = {
  free:         1,
  basic:        3,
  pro:          999,
  professional: 5,
  firm:         999,
};

function getDailyLimit(plan) {
  return DAILY_LIMITS[plan] ?? 1;
}

function getTodayStart() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/**
 * POST /v1/triage
 * Body: { description, stateCode?, language? }
 *
 * Analyzes a legal emergency description and returns triage guidance.
 * Enforces per-plan daily usage limits.
 */
const analyzeSituation = asyncHandler(async (req, res) => {
  const { description, stateCode, language } = req.body;
  const { userId, plan, persona, preferredLanguage } = req.user;

  if (!description || description.trim().length < 10) {
    return res.status(400).json({
      error: 'INVALID_INPUT',
      message: 'Please describe your situation in at least 10 characters.',
    });
  }

  if (description.length > 2000) {
    return res.status(400).json({
      error: 'INPUT_TOO_LONG',
      message: 'Please keep your description under 2000 characters.',
    });
  }

  // ── Daily quota check ──────────────────────────────────────────────────────
  const user = await User.findById(userId)
    .select('freeUsage.triageUsed freeUsage.triageResetDate')
    .lean();

  if (!user) throw createError(401, 'USER_NOT_FOUND', 'User not found');

  const limit      = getDailyLimit(plan);
  const todayStart = getTodayStart();
  const lastReset  = user.freeUsage?.triageResetDate
    ? new Date(user.freeUsage.triageResetDate)
    : null;

  const isNewDay   = !lastReset || lastReset < todayStart;
  const usedToday  = isNewDay ? 0 : (user.freeUsage?.triageUsed ?? 0);

  if (usedToday >= limit) {
    const tomorrow = new Date(todayStart);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return res.status(403).json({
      error: 'TRIAGE_QUOTA_EXCEEDED',
      message: `You have used all ${limit} free triage${limit === 1 ? '' : 's'} for today. Upgrade for more.`,
      used:       usedToday,
      limit,
      resetsAt:   tomorrow.toISOString(),
      upgradeUrl: '/pricing',
    });
  }

  // ── AI triage ──────────────────────────────────────────────────────────────
  const resolvedState    = stateCode || req.user.stateCode || null;
  const resolvedLanguage = language || preferredLanguage || 'en';

  logger.info(`[Triage] userId=${userId} plan=${plan} state=${resolvedState}`);

  const result = await aiTriageService.analyze({
    description:  description.trim(),
    stateCode:    resolvedState,
    language:     resolvedLanguage,
  });

  // ── Increment usage ────────────────────────────────────────────────────────
  const now = new Date();
  const updateOp = isNewDay
    ? { $set: { 'freeUsage.triageUsed': 1, 'freeUsage.triageResetDate': now } }
    : { $inc: { 'freeUsage.triageUsed': 1 } };

  await User.findByIdAndUpdate(userId, updateOp);

  res.json({
    success: true,
    triage:  result,
    usage: {
      used:      usedToday + 1,
      limit,
      remaining: Math.max(0, limit - usedToday - 1),
    },
  });
});

/**
 * GET /v1/triage/quota
 * Returns the current user's daily triage usage without consuming a slot.
 */
const getTriageQuota = asyncHandler(async (req, res) => {
  const { userId, plan } = req.user;

  const user = await User.findById(userId)
    .select('freeUsage.triageUsed freeUsage.triageResetDate')
    .lean();

  const limit      = getDailyLimit(plan);
  const todayStart = getTodayStart();
  const lastReset  = user?.freeUsage?.triageResetDate
    ? new Date(user.freeUsage.triageResetDate)
    : null;

  const isNewDay  = !lastReset || lastReset < todayStart;
  const usedToday = isNewDay ? 0 : (user?.freeUsage?.triageUsed ?? 0);

  const tomorrow = new Date(todayStart);
  tomorrow.setDate(tomorrow.getDate() + 1);

  res.json({
    used:      usedToday,
    limit,
    remaining: Math.max(0, limit - usedToday),
    resetsAt:  tomorrow.toISOString(),
  });
});

module.exports = { analyzeSituation, getTriageQuota };
