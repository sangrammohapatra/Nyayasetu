'use strict';

/**
 * Consultation SLA monitor
 *
 * Runs hourly checks and enforces the following SLA:
 *   1. Auto-reject 'requested' consultations with no lawyer response after 48 h,
 *      refunding the citizen in full (the lawyer's non-response, not the
 *      citizen's fault) — mirrors notarizationSla.js's expireStalePending.
 */

const Consultation = require('../models/Consultation.model');
const Payment = require('../models/Payment.model');
const Notification = require('../models/Notification.model');
const razorpayService = require('./payment/razorpayService');
const logger = require('../utils/logger');

const HOUR = 60 * 60 * 1000;
const REQUEST_SLA_HOURS = 48;

// ─── Individual checks ────────────────────────────────────────────────────────

async function expireStaleRequests(io) {
  const cutoff = new Date(Date.now() - REQUEST_SLA_HOURS * HOUR);

  const stale = await Consultation.find({
    status: 'requested',
    createdAt: { $lt: cutoff },
  }).select('_id citizen lawyer payment').lean();

  for (const c of stale) {
    try {
      const updated = await Consultation.findOneAndUpdate(
        { _id: c._id, status: 'requested' },
        {
          status: 'rejected',
          rejectionReason: 'Automatically declined: the lawyer did not respond within 48 hours',
        }
      );
      if (!updated) continue; // already transitioned by another path

      let refundInitiated = false;
      if (c.payment) {
        const payment = await Payment.findById(c.payment);
        if (payment && payment.status === 'paid' && payment.razorpayPaymentId) {
          try {
            await razorpayService.initiateRefund(payment.razorpayPaymentId, payment.amount, {
              reason: 'Consultation auto-declined — lawyer did not respond within 48 hours',
            });
            payment.status = 'refunded';
            await payment.save();
            refundInitiated = true;
          } catch (err) {
            logger.error('[consultationSla] Refund failed for auto-declined consultation', {
              consultationId: c._id,
              error: err.message,
            });
          }
        }
      }

      await Notification.createForUser({
        userId: c.citizen,
        type: 'consultation_rejected',
        title: 'Consultation request expired',
        body: `Your consultation request was automatically declined because the lawyer did not respond within 48 hours.${refundInitiated ? ' A refund will be processed in 5-7 business days.' : ''} Please book with another lawyer.`,
        data: { consultationId: c._id },
        actionUrl: '/citizen/consultations',
        io,
      });

      logger.info('[consultationSla] Auto-declined stale consultation request', { id: c._id, refundInitiated });
    } catch (err) {
      logger.error('[consultationSla] Failed to expire stale consultation request', { id: c._id, error: err.message });
    }
  }
}

// ─── Main runner ──────────────────────────────────────────────────────────────

async function runSlaChecks(io) {
  logger.info('[consultationSla] Running SLA checks');
  await Promise.allSettled([
    expireStaleRequests(io),
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
  logger.info('[consultationSla] SLA monitor started (interval: 1 h)');

  runSlaChecks(io).catch((err) =>
    logger.error('[consultationSla] Startup run failed', { error: err.message })
  );

  setInterval(
    () => runSlaChecks(io).catch((err) =>
      logger.error('[consultationSla] Scheduled run failed', { error: err.message })
    ),
    INTERVAL
  );
}

module.exports = { start };
