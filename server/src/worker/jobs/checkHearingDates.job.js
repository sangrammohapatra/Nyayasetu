/**
 * checkHearingDates — Bull cron job that runs daily at 6:00 AM IST (00:30 UTC).
 *
 * Finds all active tracked cases where the next hearing is within the user's
 * alertDaysBefore window, and enqueues individual sendHearingAlert jobs.
 *
 * Deduplication: job ID = alert_{caseId}_{hearingDate.toISOString()}
 * This means re-running the cron never creates duplicate alert jobs for the
 * same hearing, even if the worker crashed and restarted.
 */

const logger = require('../../utils/logger');

/**
 * Main processor — receives the Bull job object.
 * @param {Bull.Job} job
 * @param {Bull.Queue} alertQueue — the hearingAlerts queue (passed from worker.js)
 */
async function checkHearingDates(job, alertQueue) {
  logger.info(`[checkHearingDates] Job ${job.id} started at ${new Date().toISOString()}`);
  await job.progress(5);

  const CaseTracker = require('../../models/CaseTracker.model');
  const { getCaseStatus } = require('../../services/ecourts/ecourtsClient');

  // ── Find all cases that have a hearing coming up within their alertDaysBefore window ──
  // We cast a wider net (7 days) and let each case's alertDaysBefore filter in the job
  const now          = new Date();
  const sevenDaysOut = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const cases = await CaseTracker.find({
    isActive:        true,
    alertsEnabled:   true,
    nextHearingDate: { $gte: now, $lte: sevenDaysOut },
    caseStatus:      'pending',
  })
    .populate('user', 'name email phone whatsappNumber whatsappOptIn preferredLanguage')
    .lean();

  logger.info(`[checkHearingDates] Found ${cases.length} cases with upcoming hearings in 7-day window`);
  await job.progress(20);

  let refreshed  = 0;
  let enqueued   = 0;
  let skipped    = 0;
  let errors     = 0;

  for (let i = 0; i < cases.length; i++) {
    const caseDoc = cases[i];

    // ── Optionally refresh from eCourts before alerting ─────────────────────
    // Only refresh cases not synced in the last 12 hours to avoid hammering the API
    const twelveHoursAgo = new Date(now.getTime() - 12 * 60 * 60 * 1000);
    const needsRefresh   = !caseDoc.lastSyncedAt || new Date(caseDoc.lastSyncedAt) < twelveHoursAgo;

    if (needsRefresh) {
      try {
        const freshData = await getCaseStatus(caseDoc.cnrNumber);

        // Use findOneAndUpdate to avoid race conditions
        const CaseTrackerModel = require('../../models/CaseTracker.model');
        await CaseTrackerModel.findByIdAndUpdate(caseDoc._id, {
          $set: {
            caseTitle:       freshData.caseTitle     || caseDoc.caseTitle,
            nextHearingDate: freshData.nextHearingDate || caseDoc.nextHearingDate,
            caseStatus:      freshData.caseStatus    || caseDoc.caseStatus,
            lastSyncedAt:    new Date(),
          },
        });

        // Use refreshed nextHearingDate if available
        if (freshData.nextHearingDate) {
          caseDoc.nextHearingDate = freshData.nextHearingDate;
        }
        refreshed++;
      } catch (refreshErr) {
        logger.warn(`[checkHearingDates] Refresh failed for CNR ${caseDoc.cnrNumber}: ${refreshErr.message}`);
        // Continue with existing data
      }
    }

    // ── Check if this case's hearing is within its specific alert window ────
    if (!caseDoc.nextHearingDate) {
      skipped++;
      continue;
    }

    const hearingDate      = new Date(caseDoc.nextHearingDate);
    const daysUntilHearing = Math.ceil((hearingDate - now) / (1000 * 60 * 60 * 24));

    if (daysUntilHearing > (caseDoc.alertDaysBefore || 1)) {
      skipped++;
      continue;
    }

    // ── Enqueue hearing alert job with deduplication ID ────────────────────
    // Rule #15: job ID = alert_{caseId}_{hearingDate.toISOString()}
    const jobId = `alert_${caseDoc._id}_${hearingDate.toISOString()}`;

    try {
      await alertQueue.add(
        'sendHearingAlert',
        {
          caseId:         caseDoc._id.toString(),
          userId:         caseDoc.user?._id?.toString() || caseDoc.user?.toString(),
          cnrNumber:      caseDoc.cnrNumber,
          caseTitle:      caseDoc.caseTitle,
          court:          caseDoc.court,
          nextHearingDate: caseDoc.nextHearingDate,
          alertChannels:  caseDoc.alertChannels,
          userEmail:      caseDoc.user?.email,
          userPhone:      caseDoc.user?.phone,
          userWhatsApp:   caseDoc.user?.whatsappNumber,
          whatsappOptIn:  caseDoc.user?.whatsappOptIn,
          userName:       caseDoc.user?.name,
          language:       caseDoc.user?.preferredLanguage || 'en',
          daysUntil:      daysUntilHearing,
        },
        {
          jobId,         // Deduplication: Bull ignores duplicate jobIds
          attempts: 3,
          backoff:  { type: 'exponential', delay: 60000 }, // 1min, 2min, 4min
          removeOnComplete: true,
        }
      );

      enqueued++;
      logger.debug(`[checkHearingDates] Enqueued alert job: ${jobId} (${daysUntilHearing} day(s) until hearing)`);
    } catch (enqueueErr) {
      // Bull throws if a job with this ID already exists — that's fine (deduplication working)
      if (enqueueErr.message?.includes('already exists') || enqueueErr.message?.includes('Job')) {
        logger.debug(`[checkHearingDates] Alert already enqueued (deduplicated): ${jobId}`);
        skipped++;
      } else {
        logger.error(`[checkHearingDates] Failed to enqueue alert for case ${caseDoc._id}: ${enqueueErr.message}`);
        errors++;
      }
    }

    // Update progress as we go through cases
    await job.progress(20 + Math.round((i / cases.length) * 75));
  }

  // ── Prune rawEcourtsData older than 30 days (storage hygiene) ──────────────
  try {
    const cleanup = await CaseTracker.clearExpiredCache();
    if (cleanup.modifiedCount > 0) {
      logger.info(`[checkHearingDates] Cleared expired rawEcourtsData from ${cleanup.modifiedCount} case(s)`);
    }
  } catch (cleanupErr) {
    logger.warn(`[checkHearingDates] Cache cleanup failed: ${cleanupErr.message}`);
  }

  await job.progress(100);

  const summary = {
    totalCases: cases.length,
    refreshed,
    enqueued,
    skipped,
    errors,
    ranAt: new Date().toISOString(),
  };

  logger.info('[checkHearingDates] Job completed:', summary);
  return summary;
}

module.exports = { checkHearingDates };
