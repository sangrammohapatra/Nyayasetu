'use strict';

/**
 * checkRTIDeadlines — Bull cron job that runs daily at 7:00 AM IST (01:30 UTC).
 *
 * Scans RTI applications for approaching/passed response deadlines and:
 *  - Day 25: warns user (5 days left)
 *  - Day 30: deadline alert — prompts to check for response or file First Appeal
 *  - Overdue (day 30+): auto-transitions status to first_appeal_due
 *
 * Deduplication: job ID prevents duplicate alerts for the same RTI + event.
 */

const logger = require('../../utils/logger');

/**
 * @param {Bull.Job} job
 * @param {Bull.Queue} rtiAlertQueue
 */
async function checkRTIDeadlines(job, rtiAlertQueue) {
  logger.info(`[checkRTIDeadlines] Job ${job.id} started at ${new Date().toISOString()}`);
  await job.progress(5);

  const RTIApplication = require('../../models/RTIApplication.model');

  const now    = new Date();
  const day3   = new Date(now.getTime() + 3  * 24 * 60 * 60 * 1000);
  const day8   = new Date(now.getTime() + 8  * 24 * 60 * 60 * 1000);
  const day35  = new Date(now.getTime() + 35 * 24 * 60 * 60 * 1000);

  // Fetch all active filed RTIs whose deadlines fall within the alert window
  const rtis = await RTIApplication.find({
    isActive:         true,
    alertsEnabled:    true,
    status:           'filed',
    responseDeadline: { $gte: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000), $lte: day35 },
  }).populate('user', 'name email phone whatsappOptIn preferredLanguage');

  logger.info(`[checkRTIDeadlines] Found ${rtis.length} RTIs in alert window`);
  await job.progress(20);

  let enqueued = 0;
  let overdue  = 0;

  for (const rti of rtis) {
    const deadline = new Date(rti.responseDeadline);
    const daysLeft = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));

    // ── Auto-transition overdue RTIs to first_appeal_due ──────────────────────
    if (daysLeft < 0 && rti.status === 'filed') {
      try {
        await RTIApplication.findByIdAndUpdate(rti._id, { status: 'first_appeal_due' });
        overdue++;
        logger.info(`[checkRTIDeadlines] Auto-transitioned RTI ${rti._id} to first_appeal_due (${Math.abs(daysLeft)} days overdue)`);
      } catch (err) {
        logger.warn(`[checkRTIDeadlines] Auto-transition failed for ${rti._id}: ${err.message}`);
      }

      // Enqueue overdue alert if not already sent
      if (!rti.alertSent?.day30) {
        const jobId = `rti_alert_overdue_${rti._id}`;
        try {
          await rtiAlertQueue.add('sendRTIAlert', {
            rtiId:      rti._id.toString(),
            alertType:  'overdue',
            daysLeft,
            userId:     rti.user?._id?.toString(),
            userEmail:  rti.user?.email,
            userName:   rti.user?.name,
            rtiTitle:   rti.title,
            ministry:   rti.ministry,
            deadline:   rti.responseDeadline,
          }, {
            jobId,
            attempts:  3,
            backoff:   { type: 'exponential', delay: 60000 },
            removeOnComplete: true,
          });
          enqueued++;
        } catch (e) {
          if (!e.message?.includes('already exists')) {
            logger.error(`[checkRTIDeadlines] Failed to enqueue overdue alert for ${rti._id}: ${e.message}`);
          }
        }
      }
      continue;
    }

    // ── Day 25 warning (5 days left) ──────────────────────────────────────────
    if (daysLeft <= 5 && daysLeft > 0 && !rti.alertSent?.day25) {
      const jobId = `rti_alert_day25_${rti._id}`;
      try {
        await rtiAlertQueue.add('sendRTIAlert', {
          rtiId:      rti._id.toString(),
          alertType:  'day25',
          daysLeft,
          userId:     rti.user?._id?.toString(),
          userEmail:  rti.user?.email,
          userName:   rti.user?.name,
          rtiTitle:   rti.title,
          ministry:   rti.ministry,
          deadline:   rti.responseDeadline,
        }, {
          jobId,
          attempts:  3,
          backoff:   { type: 'exponential', delay: 60000 },
          removeOnComplete: true,
        });
        enqueued++;
        logger.debug(`[checkRTIDeadlines] Enqueued day25 alert: ${jobId} (${daysLeft} days left)`);
      } catch (e) {
        if (!e.message?.includes('already exists')) {
          logger.error(`[checkRTIDeadlines] Failed to enqueue day25 alert for ${rti._id}: ${e.message}`);
        }
      }
    }

    // ── Day 30 deadline alert (0-1 days left) ─────────────────────────────────
    if (daysLeft <= 1 && daysLeft >= 0 && !rti.alertSent?.day30) {
      const jobId = `rti_alert_day30_${rti._id}`;
      try {
        await rtiAlertQueue.add('sendRTIAlert', {
          rtiId:      rti._id.toString(),
          alertType:  'day30',
          daysLeft,
          userId:     rti.user?._id?.toString(),
          userEmail:  rti.user?.email,
          userName:   rti.user?.name,
          rtiTitle:   rti.title,
          ministry:   rti.ministry,
          deadline:   rti.responseDeadline,
        }, {
          jobId,
          attempts:  3,
          backoff:   { type: 'exponential', delay: 60000 },
          removeOnComplete: true,
        });
        enqueued++;
        logger.debug(`[checkRTIDeadlines] Enqueued day30 alert: ${jobId}`);
      } catch (e) {
        if (!e.message?.includes('already exists')) {
          logger.error(`[checkRTIDeadlines] Failed to enqueue day30 alert for ${rti._id}: ${e.message}`);
        }
      }
    }
  }

  await job.progress(100);

  const summary = { total: rtis.length, enqueued, autoTransitioned: overdue, ranAt: new Date().toISOString() };
  logger.info('[checkRTIDeadlines] Job completed:', summary);
  return summary;
}

module.exports = { checkRTIDeadlines };
