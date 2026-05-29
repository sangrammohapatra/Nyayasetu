/**
 * sendHearingAlert — Bull job that dispatches a hearing reminder to a single user.
 *
 * Triggered by checkHearingDates.js. Sends alerts via whichever channels
 * the user has enabled (web, WhatsApp, email).
 *
 * Message template (all channels):
 *   "🏛️ Hearing Reminder: Your case {caseTitle} has a hearing on {date}
 *    at {court}. Prepared by NyayaSetu."
 */

const logger = require('../../utils/logger');

/**
 * Main processor.
 * @param {Bull.Job} job
 */
async function sendHearingAlert(job) {
  const {
    caseId,
    userId,
    cnrNumber,
    caseTitle,
    court,
    nextHearingDate,
    alertChannels = {},
    userEmail,
    userPhone,
    userWhatsApp,
    whatsappOptIn,
    userName,
    language = 'en',
    daysUntil,
  } = job.data;

  logger.info(`[sendHearingAlert] Job ${job.id} — case: ${cnrNumber}, channels: ${JSON.stringify(alertChannels)}`);
  await job.progress(10);

  // ── Format hearing date ────────────────────────────────────────────────────
  const hearingDate = nextHearingDate ? new Date(nextHearingDate) : null;
  const dateFormatted = hearingDate
    ? hearingDate.toLocaleDateString('en-IN', {
        weekday: 'long',
        year:    'numeric',
        month:   'long',
        day:     'numeric',
      })
    : 'the upcoming date';

  const daysText = daysUntil === 1
    ? 'tomorrow'
    : daysUntil === 0
    ? 'today'
    : `in ${daysUntil} days`;

  // ── Build message texts ────────────────────────────────────────────────────
  const shortMessage =
    `🏛️ Hearing Reminder: Your case "${caseTitle || cnrNumber}" has a hearing ${daysText} (${dateFormatted}) at ${court || 'the court'}. Prepared by NyayaSetu.`;

  const whatsappMessage =
    `🏛️ *NyayaSetu Hearing Reminder*\n\n` +
    `📋 *Case:* ${caseTitle || cnrNumber}\n` +
    `📅 *Date:* ${dateFormatted}\n` +
    `🏛️ *Court:* ${court || 'As per notice'}\n` +
    `🔖 *CNR:* ${cnrNumber}\n\n` +
    `Please ensure all required documents are ready and arrive on time.\n\n` +
    `View case: ${process.env.CLIENT_URL || 'https://nyayasetu.in'}/cases/${caseId}\n\n` +
    `_To stop these reminders, update your alert settings on NyayaSetu._`;

  const results = { web: null, whatsapp: null, email: null };
  let anySuccess = false;

  // ── 1. Web (in-app) notification — always send ────────────────────────────
  try {
    const Notification = require('../../models/Notification.model');

    await Notification.createForUser({
      userId,
      type:      'hearing_alert',
      title:     `🏛️ Hearing ${daysText.charAt(0).toUpperCase() + daysText.slice(1)}`,
      body:      shortMessage,
      data: {
        caseId,
        cnrNumber,
        caseTitle,
        court,
        nextHearingDate,
        daysUntil,
      },
      actionUrl: `/cases/${caseId}`,
      channel:   'web',
      priority:  daysUntil <= 1 ? 'urgent' : 'high',
    });

    results.web = 'sent';
    anySuccess  = true;
    logger.info(`[sendHearingAlert] Web notification sent for case ${cnrNumber}`);
  } catch (webErr) {
    logger.error(`[sendHearingAlert] Web notification failed: ${webErr.message}`);
    results.web = `error: ${webErr.message}`;
  }

  await job.progress(35);

  // ── 2. WhatsApp notification ───────────────────────────────────────────────
  const shouldWhatsApp = (alertChannels.whatsapp && whatsappOptIn && userWhatsApp) ||
                         (alertChannels.whatsapp && userPhone);

  if (shouldWhatsApp) {
    const phone = userWhatsApp || userPhone;
    try {
      const { sendSMS } = require('../../services/notification/smsService');
      await sendSMS(phone, whatsappMessage);

      results.whatsapp = 'sent';
      anySuccess       = true;
      logger.info(`[sendHearingAlert] WhatsApp sent to ${phone} for case ${cnrNumber}`);
    } catch (waErr) {
      logger.error(`[sendHearingAlert] WhatsApp failed for ${phone}: ${waErr.message}`);
      results.whatsapp = `error: ${waErr.message}`;
    }
  } else {
    results.whatsapp = 'skipped';
  }

  await job.progress(65);

  // ── 3. Email notification ─────────────────────────────────────────────────
  if (alertChannels.email && userEmail) {
    try {
      const { sendHearingAlertEmail } = require('../../services/notification/emailService');

      await sendHearingAlertEmail({
        to:          userEmail,
        caseTitle:   caseTitle || cnrNumber,
        hearingDate: nextHearingDate,
        court:       court,
        cnrNumber,
        documentUrl: `${process.env.CLIENT_URL || 'https://nyayasetu.in'}/cases/${caseId}`,
      });

      results.email = 'sent';
      anySuccess    = true;
      logger.info(`[sendHearingAlert] Email sent to ${userEmail} for case ${cnrNumber}`);
    } catch (emailErr) {
      logger.error(`[sendHearingAlert] Email failed for ${userEmail}: ${emailErr.message}`);
      results.email = `error: ${emailErr.message}`;
    }
  } else {
    results.email = alertChannels.email ? 'skipped_no_email' : 'disabled';
  }

  await job.progress(85);

  // ── 4. Record alert sent on the CaseTracker document ──────────────────────
  try {
    const CaseTracker = require('../../models/CaseTracker.model');

    // Mark the specific hearing's alertSent flag
    await CaseTracker.findOneAndUpdate(
      {
        _id:              caseId,
        'hearings.date':  nextHearingDate,
      },
      {
        $set: { 'hearings.$.alertSent': true },
      }
    );

    logger.debug(`[sendHearingAlert] Marked alertSent on hearing ${nextHearingDate} for case ${caseId}`);
  } catch (markErr) {
    // Non-fatal — the alert was already sent
    logger.warn(`[sendHearingAlert] Could not mark alertSent: ${markErr.message}`);
  }

  await job.progress(100);

  const summary = {
    caseId,
    cnrNumber,
    channels: results,
    anySuccess,
    sentAt:   new Date().toISOString(),
  };

  if (!anySuccess) {
    logger.error(`[sendHearingAlert] All channels failed for case ${cnrNumber}:`, results);
    // Throw so Bull retries
    throw new Error(`All notification channels failed for case ${cnrNumber}: ${JSON.stringify(results)}`);
  }

  logger.info(`[sendHearingAlert] Job ${job.id} completed:`, summary);
  return summary;
}

module.exports = { sendHearingAlert };
