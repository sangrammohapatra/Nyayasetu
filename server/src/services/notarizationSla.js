'use strict';

/**
 * Notarization SLA monitor
 *
 * Runs hourly checks and enforces the following SLAs:
 *   1. Auto-cancel pending requests with no notary response after 48 h
 *   2. Remind notary to schedule KYC 24 h after citizen payment (one-time, 24–25 h window)
 *   3. Remind notary to stamp 24 h after KYC was marked complete (one-time, 24–25 h window)
 */

const NotarizationRequest = require('../models/NotarizationRequest.model');
const Notification = require('../models/Notification.model');
const razorpayService = require('./payment/razorpayService');
const logger = require('../utils/logger');

const HOUR = 60 * 60 * 1000;

// ─── Individual checks ────────────────────────────────────────────────────────

async function expireStalePending(io) {
  const cutoff = new Date(Date.now() - 48 * HOUR);

  const expired = await NotarizationRequest.find({
    status: 'pending',
    createdAt: { $lt: cutoff },
  }).select('_id citizen notary').lean();

  for (const req of expired) {
    try {
      const updated = await NotarizationRequest.findOneAndUpdate(
        { _id: req._id, status: 'pending' },
        {
          status: 'cancelled',
          rejectionReason: 'Automatically cancelled: notary did not respond within 48 hours',
        }
      );
      if (!updated) continue; // already transitioned by another path

      await Notification.createForUser({
        userId: req.citizen,
        type: 'notarization_cancelled',
        title: 'Notarization request expired',
        body: 'Your notarization request was automatically cancelled because the notary did not respond within 48 hours. Please choose another notary and submit a new request.',
        data: { notarizationRequestId: req._id },
        actionUrl: `/notarization/${req._id}`,
        io,
      });

      logger.info('[notarizationSla] Auto-cancelled stale pending request', { id: req._id });
    } catch (err) {
      logger.error('[notarizationSla] Failed to expire pending request', { id: req._id, error: err.message });
    }
  }
}

async function remindKycScheduling(io) {
  // One-shot window: send exactly once, when paidAt is between 24 h and 25 h ago.
  const now = Date.now();
  const needsReminder = await NotarizationRequest.find({
    status: 'accepted',
    'payment.status': 'paid',
    'payment.paidAt': {
      $gte: new Date(now - 25 * HOUR),
      $lte: new Date(now - 24 * HOUR),
    },
  }).select('_id notary citizen').lean();

  for (const req of needsReminder) {
    try {
      await Notification.createForUser({
        userId: req.notary,
        type: 'notarization_sla_reminder',
        title: 'Action needed: Schedule Video KYC',
        body: 'A citizen paid for notarization 24 hours ago. Please schedule the Video KYC session promptly to keep your response rate high.',
        data: { notarizationRequestId: req._id },
        actionUrl: `/notary/requests/${req._id}`,
        priority: 'high',
        io,
      });
    } catch (err) {
      logger.error('[notarizationSla] KYC scheduling reminder failed', { id: req._id, error: err.message });
    }
  }
}

async function remindStamping(io) {
  const now = Date.now();
  const needsReminder = await NotarizationRequest.find({
    status: 'kyc_completed',
    kycCompletedAt: {
      $gte: new Date(now - 25 * HOUR),
      $lte: new Date(now - 24 * HOUR),
    },
  }).select('_id notary citizen').lean();

  for (const req of needsReminder) {
    try {
      await Notification.createForUser({
        userId: req.notary,
        type: 'notarization_sla_reminder',
        title: 'Action needed: Stamp the document',
        body: 'Video KYC was completed 24 hours ago. Please stamp and notarize the document to complete the citizen\'s request.',
        data: { notarizationRequestId: req._id },
        actionUrl: `/notary/requests/${req._id}`,
        priority: 'high',
        io,
      });
    } catch (err) {
      logger.error('[notarizationSla] Stamping reminder failed', { id: req._id, error: err.message });
    }
  }
}

// ─── Main runner ──────────────────────────────────────────────────────────────

async function runSlaChecks(io) {
  logger.info('[notarizationSla] Running SLA checks');
  await Promise.allSettled([
    expireStalePending(io),
    remindKycScheduling(io),
    remindStamping(io),
  ]);
}

/**
 * start — call once after the server and database are ready.
 * Runs immediately on startup, then every hour.
 *
 * @param {object} io  Socket.IO server instance (optional; notifications still
 *                     persist to DB even without it)
 */
function start(io = null) {
  const INTERVAL = HOUR;
  logger.info('[notarizationSla] SLA monitor started (interval: 1 h)');

  runSlaChecks(io).catch((err) =>
    logger.error('[notarizationSla] Startup run failed', { error: err.message })
  );

  setInterval(
    () => runSlaChecks(io).catch((err) =>
      logger.error('[notarizationSla] Scheduled run failed', { error: err.message })
    ),
    INTERVAL
  );
}

module.exports = { start };
