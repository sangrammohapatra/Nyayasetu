/**
 * server/src/worker/jobs/resetFreeQuota.js
 *
 * Bull cron job — runs on the 1st of every month at midnight IST (18:30 UTC
 * of the last day of the previous month, which is the same instant as
 * 00:00 IST on the 1st).
 *
 * Schedule string:  '30 18 28-31 * *'  — this fires on the 28th-31st at
 * 18:30 UTC and we additionally check that tomorrow is the 1st, giving us
 * a reliable monthly reset regardless of month length.
 *
 * Alternatively: '0 0 1 * *' in IST cron — represented as '30 18 * * *'
 * does not work cleanly with variable month lengths, so we use a simpler
 * approach: run daily at 18:30 UTC (00:00 IST next day) and only process
 * users whose freeUsage.resetDate <= now.
 *
 * WHY THIS APPROACH:
 *   resetDate is set to the 1st of next month when a user registers or when
 *   their quota was last reset. The job wakes up daily and bulk-resets any
 *   user whose resetDate has passed. This is far more reliable than trying
 *   to schedule one-shot jobs per user.
 *
 * Cron schedule (stored on the Bull queue in worker.js):
 *   '30 18 * * *'   — every day at 18:30 UTC = 00:00 IST
 *
 * Processing:
 *   - Uses a Mongoose cursor so it never loads all users into memory
 *   - Processes in batches of 100 (bulkWrite)
 *   - Sets resetDate to the 1st of NEXT month
 */

'use strict';

const mongoose = require('mongoose');
const logger = require('../../utils/logger');
const { FREE_TIER_LIMITS } = require('../../config/constants');

/**
 * Compute the 1st of next month at 00:00:00 UTC.
 * @param {Date} [from]  Reference date (defaults to now)
 * @returns {Date}
 */
function nextMonthFirstDay(from) {
  const d = from ? new Date(from) : new Date();
  // Move to 1st of the next month
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + 1);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/**
 * Main job processor function.
 * Registered in worker.js as the processor for the 'resetFreeQuota' job.
 *
 * @param {import('bull').Job} job
 */
async function process(job) {
  const User = mongoose.model('User');
  const now = new Date();

  logger.info('[resetFreeQuota] Starting monthly free-quota reset', { triggeredAt: now.toISOString() });

  job.progress(0);

  let totalProcessed = 0;
  let totalUpdated = 0;
  const BATCH_SIZE = 100;

  // Only users whose resetDate is at or before now need resetting.
  // Users on paid plans still get their free counters reset (their limits
  // are higher but the counter still ticks each month).
  const filter = {
    $or: [
      { 'freeUsage.resetDate': { $lte: now } },
      { 'freeUsage.resetDate': { $exists: false } },
    ],
  };

  // Count total affected for progress reporting
  let totalToProcess;
  try {
    totalToProcess = await User.countDocuments(filter);
  } catch (err) {
    logger.error('[resetFreeQuota] countDocuments failed', { error: err.message });
    throw err;
  }

  if (totalToProcess === 0) {
    logger.info('[resetFreeQuota] No users need resetting');
    job.progress(100);
    return { totalProcessed: 0, totalUpdated: 0 };
  }

  logger.info('[resetFreeQuota] Users to reset', { totalToProcess });

  // Cursor-based iteration — never load all users at once
  const cursor = User.find(filter)
    .select('_id persona freeUsage subscription')
    .lean()
    .cursor();

  let batch = [];

  const flushBatch = async () => {
    if (batch.length === 0) return;

    const newResetDate = nextMonthFirstDay(now);

    const bulkOps = batch.map(user => {
      const persona = (user.persona || 'citizen').toLowerCase();
      const subPlan = user.subscription?.plan;
      const subActive =
        subPlan &&
        subPlan !== 'free' &&
        user.subscription?.validUntil &&
        now < new Date(user.subscription.validUntil);
      const activePlan = subActive ? subPlan : 'free';
      const limits =
        FREE_TIER_LIMITS[persona]?.[activePlan] ||
        FREE_TIER_LIMITS.citizen.free;

      return {
        updateOne: {
          filter: { _id: user._id },
          update: {
            $set: {
              'freeUsage.docsGenerated': 0,
              'freeUsage.casesTracked': 0,
              'freeUsage.aiChatsUsed': 0,
              'freeUsage.docsLimit': limits.docsLimit,
              'freeUsage.casesLimit': limits.casesLimit,
              'freeUsage.aiChatsLimit': limits.aiChatsLimit,
              'freeUsage.resetDate': newResetDate,
            },
          },
        },
      };
    });

    try {
      const result = await User.bulkWrite(bulkOps, { ordered: false });
      totalUpdated += result.modifiedCount || 0;
    } catch (err) {
      logger.error('[resetFreeQuota] bulkWrite failed on batch', {
        batchSize: batch.length,
        error: err.message,
      });
      // Partial failures are logged but don't abort the entire job.
    }

    totalProcessed += batch.length;
    batch = [];

    // Update job progress
    if (totalToProcess > 0) {
      const pct = Math.min(99, Math.round((totalProcessed / totalToProcess) * 100));
      job.progress(pct);
    }

    logger.debug('[resetFreeQuota] Batch flushed', { totalProcessed, totalUpdated });
  };

  for await (const user of cursor) {
    batch.push(user);
    if (batch.length >= BATCH_SIZE) {
      await flushBatch();
    }
  }

  // Flush any remaining users
  await flushBatch();

  job.progress(100);

  logger.info('[resetFreeQuota] Complete', {
    totalProcessed,
    totalUpdated,
    durationMs: Date.now() - now.getTime(),
  });

  return { totalProcessed, totalUpdated };
}

/**
 * Optional: called when the job fails after all retries.
 */
function onFailed(job, err) {
  logger.error('[resetFreeQuota] Job failed permanently', {
    jobId: job.id,
    error: err.message,
    stack: err.stack,
  });
}

/**
 * Optional: called when the job completes successfully.
 */
function onCompleted(job, result) {
  logger.info('[resetFreeQuota] Job completed', {
    jobId: job.id,
    result,
  });
}

module.exports = { process, onFailed, onCompleted, nextMonthFirstDay };
