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
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const mongoose = require('mongoose');
const Bull = require('bull');
const express = require('express');
const { createBullBoard } = require('@bull-board/api');
const { BullAdapter } = require('@bull-board/api/bullAdapter');
const { ExpressAdapter } = require('@bull-board/express');

const logger = require('../utils/logger');

// ─── MongoDB connection ────────────────────────────────────────────────────────

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/nyayasetu';
const REDIS_URL  = process.env.REDIS_URL  || 'redis://localhost:6379';

const REDIS_OPTS = {
  redis: REDIS_URL.startsWith('rediss://')
    ? { url: REDIS_URL, tls: {} }
    : { url: REDIS_URL },
};

async function connectMongo() {
  try {
    await mongoose.connect(MONGO_URI);
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

// ─── Job processors (lazy-required to give Mongoose time to connect first) ────

function loadProcessors() {
  const checkHearingDatesJob  = require('./jobs/checkHearingDates');
  const sendHearingAlertJob   = require('./jobs/sendHearingAlert');
  const generateDocumentJob   = require('./jobs/generateDocument');
  const resetFreeQuotaJob     = require('./jobs/resetFreeQuota');
  const sendMonthlyReminderJob= require('./jobs/sendMonthlyReminder');

  // ── Hearing alerts ─────────────────────────────────────────────────────────
  // Concurrency 1 — single daily scan, sequential
  hearingAlertQueue.process('checkHearingDates', 1, checkHearingDatesJob.process);
  // Concurrency 5 — individual alert sends can be parallelised
  hearingAlertQueue.process('sendHearingAlert',  5, sendHearingAlertJob.process);

  // ── Document generation ────────────────────────────────────────────────────
  // Concurrency 3 — limit concurrent AI calls to control rate limits
  documentQueue.process('generateDocument', 3, generateDocumentJob.process);

  // ── Subscription / quota management ───────────────────────────────────────
  subscriptionQueue.process('resetFreeQuota',      1, resetFreeQuotaJob.process);
  notificationQueue.process('sendMonthlyReminder', 2, sendMonthlyReminderJob.process);

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

  // resetFreeQuota — 1st of every month at midnight IST = 18:30 UTC on last day
  // "0 18 28-31 * *" fires on the 28th–31st at 18:30 UTC; the job internally
  // checks resetDate <= now before acting, so over-firing is safe.
  await subscriptionQueue.add(
    'resetFreeQuota',
    {},
    {
      repeat: { cron: '30 18 * * *', tz: 'UTC' },  // daily at 00:00 IST; job guards itself
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

  logger.info('[worker] Cron jobs scheduled', {
    checkHearingDates:  '00:30 UTC daily (06:00 AM IST)',
    resetFreeQuota:     '18:30 UTC daily — self-guarded monthly reset',
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

  const queues = [hearingAlertQueue, documentQueue, subscriptionQueue, notificationQueue];
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

module.exports = { hearingAlertQueue, documentQueue, subscriptionQueue, notificationQueue };
