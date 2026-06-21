'use strict';

/**
 * sendRTIAlert — processes individual RTI deadline notification jobs.
 *
 * alertType:
 *   'day25'   — 5 days left to respond, remind user to check status
 *   'day30'   — deadline today/tomorrow, prompt to check or prepare First Appeal
 *   'overdue' — past 30-day deadline, inform user to file First Appeal
 */

const logger = require('../../utils/logger');

const ALERT_MESSAGES = {
  day25: {
    subject: (title) => `RTI Reminder: ${title} — 5 Days Left for Response`,
    body: (name, title, ministry, deadline) => `
      <p>Dear ${name},</p>
      <p>Your RTI application <strong>"${title}"</strong> filed with <strong>${ministry}</strong> has <strong>5 days remaining</strong> for the PIO to respond.</p>
      <p>Response Deadline: <strong>${new Date(deadline).toLocaleDateString('en-IN', { dateStyle: 'full' })}</strong></p>
      <p>If you do not receive a response by the deadline, you have the right to file a <strong>First Appeal</strong> under Section 19(1) of the RTI Act, 2005. NyayaSetu can auto-generate this for you.</p>
      <p><a href="${process.env.CLIENT_URL}/citizen/rti" style="background:#1565C0;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;margin-top:10px;">Track Your RTI →</a></p>
    `,
  },
  day30: {
    subject: (title) => `RTI Deadline Today: ${title} — Check for Response or Prepare First Appeal`,
    body: (name, title, ministry, deadline) => `
      <p>Dear ${name},</p>
      <p>The 30-day response deadline for your RTI application <strong>"${title}"</strong> (${ministry}) expires <strong>today/tomorrow</strong>.</p>
      <ul>
        <li>If you received a satisfactory response — mark it as resolved in NyayaSetu.</li>
        <li>If you received an unsatisfactory or partial response — you can file a <strong>First Appeal</strong>.</li>
        <li>If you received <em>no response</em> — you are entitled to file a <strong>First Appeal under Section 19(1)</strong>. NyayaSetu will auto-generate the appeal letter for you.</li>
      </ul>
      <p><a href="${process.env.CLIENT_URL}/citizen/rti" style="background:#E65100;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;margin-top:10px;">File First Appeal Now →</a></p>
    `,
  },
  overdue: {
    subject: (title) => `RTI Deadline Passed: ${title} — Time to File First Appeal`,
    body: (name, title, ministry) => `
      <p>Dear ${name},</p>
      <p>The 30-day statutory response deadline for your RTI application <strong>"${title}"</strong> filed with <strong>${ministry}</strong> has now <strong>passed</strong>.</p>
      <p>Under Section 19(1) of the RTI Act, 2005, you can file a <strong>First Appeal</strong> with the First Appellate Authority within 30 days of the expiry of the PIO's response period.</p>
      <p>NyayaSetu can generate your First Appeal letter automatically — open the RTI tracker to get started.</p>
      <p><strong>Don't delay</strong> — you have a 30-day window to file the First Appeal.</p>
      <p><a href="${process.env.CLIENT_URL}/citizen/rti" style="background:#B71C1C;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;margin-top:10px;">Generate First Appeal →</a></p>
    `,
  },
};

/**
 * @param {Bull.Job} job
 */
async function sendRTIAlert(job) {
  const {
    rtiId, alertType, daysLeft,
    userId, userEmail, userName,
    rtiTitle, ministry, deadline,
  } = job.data;

  logger.info(`[sendRTIAlert] Processing ${alertType} alert for RTI ${rtiId}`);

  const RTIApplication = require('../../models/RTIApplication.model');
  const { sendEmail }  = require('../../services/notification/emailService');

  // Re-validate the RTI is still in a state that needs this alert
  const rti = await RTIApplication.findById(rtiId);
  if (!rti || !rti.isActive) {
    logger.info(`[sendRTIAlert] RTI ${rtiId} no longer active, skipping`);
    return { skipped: true };
  }

  // Check if this specific alert type was already sent
  const alertKey = alertType === 'day25' ? 'day25' : alertType === 'day30' ? 'day30' : 'day30';
  if (rti.alertSent?.[alertKey]) {
    logger.info(`[sendRTIAlert] Alert ${alertType} already sent for RTI ${rtiId}, skipping`);
    return { skipped: true, reason: 'already_sent' };
  }

  const msgConfig = ALERT_MESSAGES[alertType];
  if (!msgConfig) {
    logger.warn(`[sendRTIAlert] Unknown alertType: ${alertType}`);
    return { skipped: true };
  }

  const name = userName || 'Citizen';

  // ── Send Email ─────────────────────────────────────────────────────────────
  if (userEmail) {
    try {
      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f5f5f5;">
          <div style="background: #1565C0; padding: 24px; text-align: center;">
            <h2 style="color: #ffffff; margin: 0; font-size: 22px;">⚖ NyayaSetu RTI Tracker</h2>
            <p style="color: rgba(255,255,255,0.85); margin: 6px 0 0; font-size: 13px;">Right to Information Act, 2005</p>
          </div>
          <div style="background: #ffffff; padding: 28px 32px; border-radius: 0 0 8px 8px;">
            ${msgConfig.body(name, rtiTitle || 'Your RTI Application', ministry || 'Department', deadline)}
            <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 24px 0;">
            <p style="color: #90a4ae; font-size: 11px; margin: 0;">
              You are receiving this because you opted in to RTI deadline alerts on NyayaSetu.
              RTI Act, 2005 mandates 30-day response period. First Appeal must be filed within 30 days of PIO's response deadline.
            </p>
          </div>
        </body>
        </html>
      `;

      await sendEmail({
        to:      userEmail,
        subject: msgConfig.subject(rtiTitle || 'Your RTI Application'),
        html:    emailHtml,
      });

      logger.info(`[sendRTIAlert] Email sent to ${userEmail} for RTI ${rtiId} (${alertType})`);
    } catch (emailErr) {
      logger.error(`[sendRTIAlert] Email failed for RTI ${rtiId}: ${emailErr.message}`);
      // Non-fatal — continue to mark alert as sent
    }
  }

  // ── Mark alert as sent in DB ───────────────────────────────────────────────
  const alertField = alertType === 'day25' ? 'alertSent.day25' : 'alertSent.day30';
  await RTIApplication.findByIdAndUpdate(rtiId, { $set: { [alertField]: true } });

  logger.info(`[sendRTIAlert] Alert ${alertType} marked as sent for RTI ${rtiId}`);
  return { sent: true, alertType, rtiId };
}

module.exports = { sendRTIAlert };
