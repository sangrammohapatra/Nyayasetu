/**
 * NyayaSetu Worker Process
 *
 * This is a SEPARATE process from the Express server (Rule #7, Section 15).
 * Start it with: `node worker/src/worker.js` or `npm run dev:worker`
 *
 * It processes Bull queue jobs:
 *   - documents       → generateDocument job
 *   - hearingAlerts   → checkHearingDates + sendHearingAlert jobs
 *   - subscriptions   → resetFreeQuota job
 *   - notifications   → sendMonthlyReminder job
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../server/.env') });

const Bull   = require('bull');
const logger = require('../../server/src/utils/logger');
const { connectDB }    = require('../../server/src/config/db');
const { connectRedis } = require('../../server/src/config/redis');
const { QUEUE_NAMES }  = require('../../server/src/config/constants');

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const QUEUE_CONFIG = {
  defaultJobOptions: {
    attempts:         3,
    backoff:          { type: 'exponential', delay: 5000 },
    removeOnComplete: 50,
    removeOnFail:     20,
  },
};

// ─── Queue instances ───────────────────────────────────────────────────────────

const queues = {
  [QUEUE_NAMES.DOCUMENTS]:     new Bull(QUEUE_NAMES.DOCUMENTS,     REDIS_URL, QUEUE_CONFIG),
  [QUEUE_NAMES.HEARING_ALERTS]: new Bull(QUEUE_NAMES.HEARING_ALERTS, REDIS_URL, QUEUE_CONFIG),
  [QUEUE_NAMES.SUBSCRIPTIONS]: new Bull(QUEUE_NAMES.SUBSCRIPTIONS, REDIS_URL, QUEUE_CONFIG),
  [QUEUE_NAMES.NOTIFICATIONS]: new Bull(QUEUE_NAMES.NOTIFICATIONS, REDIS_URL, QUEUE_CONFIG),
};

// ─── Job processors ───────────────────────────────────────────────────────────

const generateDocumentProcessor = require('./jobs/generateDocument');

async function registerProcessors() {
  // ── Documents queue ──────────────────────────────────────────────────────
  queues[QUEUE_NAMES.DOCUMENTS].process('generateDocument', 3, generateDocumentProcessor);

  queues[QUEUE_NAMES.DOCUMENTS].on('completed', (job, result) => {
    logger.info(`[worker] Document job ${job.id} completed:`, result);
  });

  queues[QUEUE_NAMES.DOCUMENTS].on('failed', (job, err) => {
    logger.error(`[worker] Document job ${job.id} failed (attempt ${job.attemptsMade}/${job.opts.attempts}):`, err.message);
  });

  queues[QUEUE_NAMES.DOCUMENTS].on('stalled', (job) => {
    logger.warn(`[worker] Document job ${job.id} stalled — will be retried`);
  });

  // ── Hearing alerts queue ─────────────────────────────────────────────────
  queues[QUEUE_NAMES.HEARING_ALERTS].process('checkHearingDates', 1, async (job) => {
    logger.info('[worker] Running checkHearingDates');
    const { checkHearingDates } = require('./jobs/hearingAlerts');
    return checkHearingDates(job, queues[QUEUE_NAMES.HEARING_ALERTS]);
  });

  queues[QUEUE_NAMES.HEARING_ALERTS].process('sendHearingAlert', 5, async (job) => {
    const { sendHearingAlert } = require('./jobs/hearingAlerts');
    return sendHearingAlert(job);
  });

  // ── Subscriptions queue (monthly cron) ───────────────────────────────────
  queues[QUEUE_NAMES.SUBSCRIPTIONS].process('resetFreeQuota', 1, async (job) => {
    logger.info('[worker] Running resetFreeQuota');
    const User = require('../../server/src/models/User.model');
    const result = await User.resetMonthlyQuotas();
    logger.info(`[worker] resetFreeQuota: updated ${result.modifiedCount} users`);
    return result;
  });

  // ── Notifications queue (monthly reminder) ────────────────────────────────
  queues[QUEUE_NAMES.NOTIFICATIONS].process('sendMonthlyReminder', 2, async (job) => {
    logger.info('[worker] Running sendMonthlyReminder — stub, implement as needed');
    return { ok: true };
  });

  // ── Schedule recurring jobs (safe to call multiple times — Bull deduplicates) ─
  await scheduleRecurringJobs();

  logger.info('[worker] All processors registered');
}

// ─── Cron jobs ─────────────────────────────────────────────────────────────────

async function scheduleRecurringJobs() {
  // Hearing alerts: daily at 6:00 AM IST (00:30 UTC)
  await queues[QUEUE_NAMES.HEARING_ALERTS].add(
    'checkHearingDates',
    {},
    {
      repeat:    { cron: '30 0 * * *' },
      jobId:     'hearing_check_daily',
      removeOnComplete: true,
    }
  );

  // Reset free-tier quotas: 1st of every month at midnight IST (18:30 UTC previous day)
  await queues[QUEUE_NAMES.SUBSCRIPTIONS].add(
    'resetFreeQuota',
    {},
    {
      repeat:    { cron: '30 18 L * *' },
      jobId:     'reset_quota_monthly',
      removeOnComplete: true,
    }
  );

  // Monthly reminder: 1st of month at 9:00 AM IST (03:30 UTC)
  await queues[QUEUE_NAMES.NOTIFICATIONS].add(
    'sendMonthlyReminder',
    {},
    {
      repeat:    { cron: '30 3 1 * *' },
      jobId:     'monthly_reminder',
      removeOnComplete: true,
    }
  );

  logger.info('[worker] Recurring jobs scheduled');
}

// ─── Boot sequence ─────────────────────────────────────────────────────────────

async function boot() {
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  logger.info('  NyayaSetu Worker Process');
  logger.info(`  Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`  Redis: ${REDIS_URL.replace(/\/\/.*@/, '//*****@')}`);
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  try {
    await connectDB();
    await connectRedis();
    await registerProcessors();

    logger.info('[worker] Worker process ready. Waiting for jobs…');
  } catch (err) {
    logger.error('[worker] Boot failed:', err.message);
    process.exit(1);
  }
}

// ─── Graceful shutdown ─────────────────────────────────────────────────────────

async function shutdown(signal) {
  logger.info(`[worker] ${signal} received. Closing queues…`);
  await Promise.all(Object.values(queues).map((q) => q.close()));
  logger.info('[worker] All queues closed. Exiting.');
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('unhandledRejection', (err) => {
  logger.error('[worker] Unhandled rejection:', err.message);
});

boot();
