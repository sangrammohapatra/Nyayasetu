/**
 * server/src/worker/worker.js
 *
 * Bull worker entry point — runs as a SEPARATE PROCESS from the Express server.
 * Start with: node src/worker/worker.js  (or nodemon in dev)
 *
 * Bull Board UI for monitoring: http://localhost:5001/admin/queues
 * (separate port from the API so it doesn't conflict)
 *
 * Queues & processors:
 *   hearingAlertQueue   → checkHearingDates (cron 6 AM IST), sendHearingAlert
 *   documentQueue       → generateDocument
 *   subscriptionQueue   → resetFreeQuota (cron midnight IST 1st of month)
 *   notificationQueue   → sendMonthlyReminder
 */

'use strict';

const path = require('path');
// server/src/worker/ → up 2 levels → server/ where .env lives
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const mongoose = require('mongoose');
const Bull = require('bull');
const express = require('express');
const { createBullBoard } = require('@bull-board/api');
const { BullAdapter } = require('@bull-board/api/bullAdapter');
const { ExpressAdapter } = require('@bull-board/express');

const logger = require('../utils/logger');
const { buildBullRedisOpts } = require('../utils/bullRedisOpts');

// ─── MongoDB connection ────────────────────────────────────────────────────────

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/nyayasetu';
const REDIS_URL  = process.env.REDIS_URL  || 'redis://localhost:6379';

const REDIS_OPTS = { redis: buildBullRedisOpts(REDIS_URL) };

async function connectMongo() {
  try {
    // Workers run as a separate process from the Express server.
    // Keep the pool small (max 3) so both processes together stay well within
    // Atlas M0's 500-connection limit even when running multiple worker instances.
    await mongoose.connect(MONGO_URI, { maxPoolSize: 3, minPoolSize: 1 });
    logger.info('[worker] MongoDB connected', { uri: MONGO_URI.replace(/:\/\/[^@]+@/, '://***@') });
  } catch (err) {
    logger.error('[worker] MongoDB connection failed', { error: err.message });
    process.exit(1);
  }
}

// ─── Queue factories ───────────────────────────────────────────────────────────

const hearingAlertQueue = new Bull('hearingAlerts',  REDIS_OPTS);
const documentQueue     = new Bull('documents',       REDIS_OPTS);
const subscriptionQueue = new Bull('subscriptions',   REDIS_OPTS);
const notificationQueue = new Bull('notifications',   REDIS_OPTS);
const rtiDeadlineQueue  = new Bull('rtiDeadlines',   REDIS_OPTS);

// ─── Job processors (lazy-required to give Mongoose time to connect first) ────

function loadProcessors() {
  // Note: filenames use the .job.js suffix; exports vary per file
  const { checkHearingDates } = require('./jobs/checkHearingDates.job');
  const { sendHearingAlert }  = require('./jobs/sendHearingAlert.job');
  const generateDocumentJob   = require('./jobs/generateDocument.job'); // exports fn directly
  const resetFreeQuotaJob     = require('./jobs/resetFreeQuota');       // exports { process }
  const { checkRTIDeadlines } = require('./jobs/checkRTIDeadlines.job');
  const { sendRTIAlert }      = require('./jobs/sendRTIAlert.job');

  // ── Hearing alerts ─────────────────────────────────────────────────────────
  hearingAlertQueue.process('checkHearingDates', 1, checkHearingDates);
  hearingAlertQueue.process('sendHearingAlert',  5, sendHearingAlert);

  // ── RTI deadlines ──────────────────────────────────────────────────────────
  rtiDeadlineQueue.process('checkRTIDeadlines', 1, (job) => checkRTIDeadlines(job, rtiDeadlineQueue));
  rtiDeadlineQueue.process('sendRTIAlert',      5, sendRTIAlert);

  // ── Document generation ────────────────────────────────────────────────────
  documentQueue.process('generateDocument', 3, generateDocumentJob);

  // ── Subscription / quota management ───────────────────────────────────────
  subscriptionQueue.process('resetFreeQuota', 1, resetFreeQuotaJob.process);
  // No-op until the real processor is built; prevents jobs accumulating in Redis.
  notificationQueue.process('sendMonthlyReminder', 1, async (job) => {
    logger.warn('[worker] sendMonthlyReminder not yet implemented — job skipped', { jobId: job.id });
  });

  logger.info('[worker] All job processors registered');
}

// ─── Cron job scheduling ───────────────────────────────────────────────────────

const IST_OFFSET_HOURS = 5.5;   // IST = UTC + 5:30

async function scheduleCronJobs() {
  // checkHearingDates — 6:00 AM IST every day = 00:30 UTC
  // '30 0 * * *' in UTC = 6:00 AM IST
  await hearingAlertQueue.add(
    'checkHearingDates',
    { scheduledAt: new Date().toISOString() },
    {
      repeat: { cron: '30 0 * * *', tz: 'UTC' },
      jobId: 'cron_checkHearingDates',   // stable ID prevents duplicates on restart
      removeOnComplete: true,
      removeOnFail: 100,
      attempts: 2,
      backoff: { type: 'fixed', delay: 5 * 60 * 1000 }, // retry after 5 min
    }
  );

  // resetFreeQuota — fires DAILY at 18:30 UTC (00:00 IST). The job itself only
  // resets users whose freeUsage.resetDate <= now (see resetFreeQuota.js), so
  // this is idempotent and over-firing is safe. Deliberately NOT a once-a-month
  // cron ('30 18 1 * *'): if that single monthly firing failed all 3 retries
  // (e.g. Mongo down at that moment), free-tier users would be stuck for a
  // full month. Daily firing means a missed month-start reset is caught the
  // very next day instead.
  await subscriptionQueue.add(
    'resetFreeQuota',
    {},
    {
      repeat: { cron: '30 18 * * *', tz: 'UTC' },
      jobId: 'cron_resetFreeQuota',
      removeOnComplete: true,
      removeOnFail: 50,
      attempts: 3,
      backoff: { type: 'exponential', delay: 10000 },
    }
  );

  // sendMonthlyReminder — 1st of every month at 9:00 AM IST = 3:30 UTC
  await notificationQueue.add(
    'sendMonthlyReminder',
    {},
    {
      repeat: { cron: '30 3 1 * *', tz: 'UTC' },
      jobId: 'cron_sendMonthlyReminder',
      removeOnComplete: true,
      removeOnFail: 50,
      attempts: 2,
    }
  );

  // checkRTIDeadlines — 7:00 AM IST every day = 01:30 UTC
  await rtiDeadlineQueue.add(
    'checkRTIDeadlines',
    { scheduledAt: new Date().toISOString() },
    {
      repeat: { cron: '30 1 * * *', tz: 'UTC' },
      jobId: 'cron_checkRTIDeadlines',
      removeOnComplete: true,
      removeOnFail: 100,
      attempts: 2,
      backoff: { type: 'fixed', delay: 5 * 60 * 1000 },
    }
  );

  logger.info('[worker] Cron jobs scheduled', {
    checkHearingDates:  '00:30 UTC daily (06:00 AM IST)',
    checkRTIDeadlines:  '01:30 UTC daily (07:00 AM IST)',
    resetFreeQuota:     '18:30 UTC daily (00:00 IST) — idempotent on resetDate',
    sendMonthlyReminder:'03:30 UTC on 1st of month (09:00 AM IST)',
  });
}

// ─── Global event handlers ─────────────────────────────────────────────────────

function wireQueueEvents(queue) {
  queue.on('completed', (job, result) => {
    logger.info('[worker] Job completed', { queue: queue.name, jobId: job.id, name: job.name });
    if (typeof job.data?.onCompleted === 'function') job.data.onCompleted(job, result);
  });

  queue.on('failed', (job, err) => {
    logger.error('[worker] Job failed', {
      queue: queue.name,
      jobId: job.id,
      name: job.name,
      attempt: job.attemptsMade,
      error: err.message,
    });
  });

  queue.on('stalled', (job) => {
    logger.warn('[worker] Job stalled', { queue: queue.name, jobId: job.id });
  });

  queue.on('error', (err) => {
    logger.error('[worker] Queue error', { queue: queue.name, error: err.message });
  });
}

// ─── Bull Board monitoring UI ─────────────────────────────────────────────────

function startBullBoard() {
  const app = express();
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath('/admin/queues');

  createBullBoard({
    queues: [
      new BullAdapter(hearingAlertQueue),
      new BullAdapter(documentQueue),
      new BullAdapter(subscriptionQueue),
      new BullAdapter(notificationQueue),
      new BullAdapter(rtiDeadlineQueue),
    ],
    serverAdapter,
  });

  // Simple auth middleware — protect in production with real auth
  app.use('/admin/queues', (req, res, next) => {
    const token = req.headers['x-worker-token'] || req.query.token;
    if (process.env.NODE_ENV === 'production' && token !== process.env.WORKER_UI_TOKEN) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
  });

  app.use('/admin/queues', serverAdapter.getRouter());

  const BOARD_PORT = parseInt(process.env.WORKER_BOARD_PORT || '5001', 10);
  app.listen(BOARD_PORT, () => {
    logger.info(`[worker] Bull Board UI at http://localhost:${BOARD_PORT}/admin/queues`);
  });
}

// ─── Graceful shutdown ─────────────────────────────────────────────────────────

async function shutdown(signal) {
  logger.info(`[worker] ${signal} received — shutting down gracefully`);
  try {
    await Promise.all([
      hearingAlertQueue.close(),
      documentQueue.close(),
      subscriptionQueue.close(),
      notificationQueue.close(),
      rtiDeadlineQueue.close(),
    ]);
    await mongoose.disconnect();
    logger.info('[worker] All queues closed, MongoDB disconnected');
    process.exit(0);
  } catch (err) {
    logger.error('[worker] Error during shutdown', { error: err.message });
    process.exit(1);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('uncaughtException', (err) => {
  logger.error('[worker] Uncaught exception', { error: err.message, stack: err.stack });
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  logger.error('[worker] Unhandled rejection', { reason: String(reason) });
});

// ─── Boot ──────────────────────────────────────────────────────────────────────

async function boot() {
  logger.info('[worker] Starting NyayaSetu Worker', { env: process.env.NODE_ENV });

  await connectMongo();

  const queues = [hearingAlertQueue, documentQueue, subscriptionQueue, notificationQueue, rtiDeadlineQueue];
  queues.forEach(wireQueueEvents);

  loadProcessors();
  await scheduleCronJobs();
  startBullBoard();

  logger.info('[worker] Worker ready ✓');
}

boot().catch((err) => {
  logger.error('[worker] Boot failed', { error: err.message, stack: err.stack });
  process.exit(1);
});

module.exports = { hearingAlertQueue, documentQueue, subscriptionQueue, notificationQueue, rtiDeadlineQueue };
