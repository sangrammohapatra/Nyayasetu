const asyncHandler = require('../utils/asyncHandler');
const aiTriageService = require('../services/ai/aiTriageService');
const User = require('../models/User.model');
const PublicTriage = require('../models/PublicTriage.model');
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

  // ── Atomic daily quota check-and-increment ────────────────────────────────
  // Two-step approach prevents double-spending under concurrent requests:
  //   1. Conditionally reset the day counter (idempotent: second concurrent
  //      request won't match because the first already advanced triageResetDate).
  //   2. Atomically consume one slot — null return means quota exhausted.
  const limit      = getDailyLimit(plan);
  const todayStart = getTodayStart();
  const now        = new Date();

  await User.updateOne(
    {
      _id: userId,
      $or: [
        { 'freeUsage.triageResetDate': { $lt: todayStart } },
        { 'freeUsage.triageResetDate': { $exists: false } },
      ],
    },
    { $set: { 'freeUsage.triageUsed': 0, 'freeUsage.triageResetDate': now } }
  );

  const slotGranted = await User.findOneAndUpdate(
    { _id: userId, 'freeUsage.triageUsed': { $lt: limit } },
    { $inc: { 'freeUsage.triageUsed': 1 } },
    { new: true, select: 'freeUsage' }
  );

  if (!slotGranted) {
    const tomorrow = new Date(todayStart);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return res.status(403).json({
      error: 'TRIAGE_QUOTA_EXCEEDED',
      message: `You have used all ${limit} free triage${limit === 1 ? '' : 's'} for today. Upgrade for more.`,
      limit,
      resetsAt:   tomorrow.toISOString(),
      upgradeUrl: '/pricing',
    });
  }

  const usedNow = slotGranted.freeUsage.triageUsed;

  // ── AI triage ──────────────────────────────────────────────────────────────
  const resolvedState    = stateCode || req.user.stateCode || null;
  const resolvedLanguage = language || preferredLanguage || 'en';

  logger.info(`[Triage] userId=${userId} plan=${plan} state=${resolvedState}`);

  const result = await aiTriageService.analyze({
    description:  description.trim(),
    stateCode:    resolvedState,
    language:     resolvedLanguage,
  });

  res.json({
    success: true,
    triage:  result,
    usage: {
      used:      usedNow,
      limit,
      remaining: Math.max(0, limit - usedNow),
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GUEST_DAILY_LIMIT = 1;

function getISTDateKey() {
  // Returns 'YYYY-MM-DD' in IST (UTC+5:30)
  const now = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  return now.toISOString().slice(0, 10);
}

/**
 * POST /v1/triage/public
 * Body: { email, description, stateCode?, language? }
 *
 * Guest (unauthenticated) triage — 1 free use per email per day.
 * On second attempt the same day, returns 403 with sign-up prompt.
 */
const publicAnalyzeSituation = asyncHandler(async (req, res) => {
  const { email, description, stateCode, language } = req.body;

  if (!email || !EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'INVALID_EMAIL', message: 'A valid email address is required.' });
  }

  if (!description || description.trim().length < 10) {
    return res.status(400).json({ error: 'INVALID_INPUT', message: 'Please describe your situation in at least 10 characters.' });
  }

  if (description.length > 2000) {
    return res.status(400).json({ error: 'INPUT_TOO_LONG', message: 'Please keep your description under 2000 characters.' });
  }

  const dateKey = getISTDateKey();
  const normalEmail = email.toLowerCase().trim();

  // ── Check if same email already used triage today ──────────────────────────
  const existing = await PublicTriage.findOne({ email: normalEmail, dateKey });

  if (existing && existing.count >= GUEST_DAILY_LIMIT) {
    return res.status(403).json({
      error: 'GUEST_QUOTA_EXCEEDED',
      message: 'You\'ve used your 1 free emergency triage for today.',
      used:       existing.count,
      limit:      GUEST_DAILY_LIMIT,
      signupUrl:  '/register',
      pricingUrl: '/pricing',
    });
  }

  // ── Global daily budget guard ──────────────────────────────────────────────
  // Per-email and per-IP limits block single-actor abuse; this cap limits the
  // total AI spend from rotating IPs/emails. Configurable via env so ops can
  // adjust without a deploy.
  const DAILY_PUBLIC_BUDGET = parseInt(process.env.PUBLIC_TRIAGE_DAILY_BUDGET || '200', 10);
  const todayTotalUsed = await PublicTriage.countDocuments({ dateKey });
  if (todayTotalUsed >= DAILY_PUBLIC_BUDGET) {
    return res.status(503).json({
      error: 'CAPACITY_REACHED',
      message: 'Daily public triage capacity has been reached. Sign up for unlimited access.',
      signupUrl: '/register',
    });
  }

  // ── Run AI triage ──────────────────────────────────────────────────────────
  logger.info(`[Triage/public] email=${normalEmail} state=${stateCode || 'n/a'}`);

  const result = await aiTriageService.analyze({
    description: description.trim(),
    stateCode:   stateCode || null,
    language:    language  || 'en',
  });

  // ── Increment counter ──────────────────────────────────────────────────────
  await PublicTriage.findOneAndUpdate(
    { email: normalEmail, dateKey },
    { $inc: { count: 1 } },
    { upsert: true, new: true }
  );

  res.json({
    success: true,
    triage:  result,
    usage: {
      used:      (existing?.count || 0) + 1,
      limit:     GUEST_DAILY_LIMIT,
      remaining: Math.max(0, GUEST_DAILY_LIMIT - (existing?.count || 0) - 1),
    },
  });
});

module.exports = { analyzeSituation, getTriageQuota, publicAnalyzeSituation };
