const asyncHandler = require('../utils/asyncHandler');
const aiTriageService = require('../services/ai/aiTriageService');
const User = require('../models/User.model');
const PublicTriage = require('../models/PublicTriage.model');
const PublicTriageIp = require('../models/PublicTriageIp.model');
const { createError } = require('../middleware/error.middleware');
const logger = require('../utils/logger');
const { TRIAGE_DAILY_LIMITS } = require('../config/constants');

function getDailyLimit(plan) {
  return TRIAGE_DAILY_LIMITS[plan] ?? 1;
}

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/**
 * Midnight IST (00:00 UTC+5:30), returned as its equivalent UTC instant —
 * i.e. timezone-independent regardless of the server's local TZ. Matches the
 * IST day boundary used by getISTDateKey() for the public triage endpoint,
 * so both resets happen at the same wall-clock moment for an IST-based user.
 */
function getTodayStart() {
  const istNow = new Date(Date.now() + IST_OFFSET_MS);
  const istMidnightAsUTC = Date.UTC(istNow.getUTCFullYear(), istNow.getUTCMonth(), istNow.getUTCDate());
  return new Date(istMidnightAsUTC - IST_OFFSET_MS);
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
    const tomorrow = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
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

  const tomorrow = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

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
// Higher than the per-email limit to tolerate shared IPs (offices, campuses,
// carrier-grade NAT) while still capping a single-actor bot that rotates
// email addresses/aliases from one machine.
const GUEST_IP_DAILY_LIMIT = parseInt(process.env.PUBLIC_TRIAGE_IP_DAILY_LIMIT || '5', 10);

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

  // ── Atomically claim today's per-IP slot ────────────────────────────────────
  // Without this, an attacker with a list of emails (or a +alias generator)
  // can bypass the per-email cap trivially by rotating the email on every
  // request from the same machine. Same claim-then-work pattern as below.
  const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
  let ipClaimed;
  try {
    ipClaimed = await PublicTriageIp.findOneAndUpdate(
      { ip, dateKey, count: { $lt: GUEST_IP_DAILY_LIMIT } },
      { $inc: { count: 1 }, $setOnInsert: { ip, dateKey } },
      { upsert: true, new: true }
    );
  } catch (err) {
    if (err.code === 11000) {
      ipClaimed = await PublicTriageIp.findOneAndUpdate(
        { ip, dateKey, count: { $lt: GUEST_IP_DAILY_LIMIT } },
        { $inc: { count: 1 } },
        { new: true }
      );
    } else {
      throw err;
    }
  }

  if (!ipClaimed) {
    return res.status(403).json({
      error: 'IP_QUOTA_EXCEEDED',
      message: 'Too many guest triage requests from this network today. Please sign up for unlimited access.',
      limit:      GUEST_IP_DAILY_LIMIT,
      signupUrl:  '/register',
      pricingUrl: '/pricing',
    });
  }

  // ── Atomically claim today's guest slot before running AI ──────────────────
  // Claim-then-work (matches analyzeSituation's pattern) closes the TOCTOU
  // window where two concurrent requests from the same email both read
  // count=0 and both proceed. The upsert can race on first-ever use for an
  // email/day, which throws a duplicate-key error; on that error the doc now
  // exists, so we retry as a plain conditional update.
  let claimed;
  try {
    claimed = await PublicTriage.findOneAndUpdate(
      { email: normalEmail, dateKey, count: { $lt: GUEST_DAILY_LIMIT } },
      { $inc: { count: 1 }, $setOnInsert: { email: normalEmail, dateKey } },
      { upsert: true, new: true }
    );
  } catch (err) {
    if (err.code === 11000) {
      claimed = await PublicTriage.findOneAndUpdate(
        { email: normalEmail, dateKey, count: { $lt: GUEST_DAILY_LIMIT } },
        { $inc: { count: 1 } },
        { new: true }
      );
    } else {
      throw err;
    }
  }

  if (!claimed) {
    const existing = await PublicTriage.findOne({ email: normalEmail, dateKey }).select('count').lean();
    return res.status(403).json({
      error: 'GUEST_QUOTA_EXCEEDED',
      message: 'You\'ve used your 1 free emergency triage for today.',
      used:       existing?.count ?? GUEST_DAILY_LIMIT,
      limit:      GUEST_DAILY_LIMIT,
      signupUrl:  '/register',
      pricingUrl: '/pricing',
    });
  }

  // ── Run AI triage ──────────────────────────────────────────────────────────
  logger.info(`[Triage/public] email=${normalEmail} state=${stateCode || 'n/a'}`);

  const result = await aiTriageService.analyze({
    description: description.trim(),
    stateCode:   stateCode || null,
    language:    language  || 'en',
  });

  res.json({
    success: true,
    triage:  result,
    usage: {
      used:      claimed.count,
      limit:     GUEST_DAILY_LIMIT,
      remaining: Math.max(0, GUEST_DAILY_LIMIT - claimed.count),
    },
  });
});

module.exports = { analyzeSituation, getTriageQuota, publicAnalyzeSituation };
