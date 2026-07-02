/**
 * server/src/services/notification/emailService.js
 *
 * Email service abstraction:
 *   - EMAIL_PROVIDER=resend    → Resend HTTP API (production — works on Render/Heroku)
 *   - EMAIL_PROVIDER=gmail     → Gmail SMTP (local dev only)
 *   - EMAIL_PROVIDER=sendgrid  → SendGrid SMTP
 *   - In dev with no creds    → Ethereal test account (preview URLs logged)
 *
 * All HTML templates are themed with NyayaSetu brand colors (no external CSS dependency,
 * all styles inline so they render reliably across email clients).
 */

const nodemailer = require('nodemailer');
const axios = require('axios');
const logger = require('../../utils/logger');

const EMAIL_PROVIDER = process.env.EMAIL_PROVIDER || 'gmail';
const EMAIL_FROM = process.env.EMAIL_FROM || 'NyayaSetu <onboarding@resend.dev>';

let transporter = null;
let etherealPreviewUrlBuilder = null;

/**
 * Build / return the singleton Nodemailer transporter.
 * Lazy-initialised so missing env vars don't crash at require time.
 */
async function getTransporter() {
  if (transporter) return transporter;

  try {
    if (EMAIL_PROVIDER === 'sendgrid') {
      transporter = nodemailer.createTransport({
        host: 'smtp.sendgrid.net',
        port: 587,
        secure: false,
        auth: {
          user: 'apikey',
          pass: process.env.SENDGRID_API_KEY || process.env.EMAIL_PASS,
        },
      });
      logger.info('[emailService] Initialised SendGrid SMTP transporter');
    } else if (EMAIL_PROVIDER === 'gmail') {
      if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        if (process.env.NODE_ENV !== 'production') {
          const testAccount = await nodemailer.createTestAccount();
          transporter = nodemailer.createTransport({
            host: 'smtp.ethereal.email',
            port: 587,
            secure: false,
            auth: { user: testAccount.user, pass: testAccount.pass },
          });
          etherealPreviewUrlBuilder = nodemailer.getTestMessageUrl;
          logger.warn('[emailService] Gmail creds missing — using Ethereal dev inbox', {
            user: testAccount.user,
          });
        } else {
          throw new Error('EMAIL_USER and EMAIL_PASS must be set in production');
        }
      } else {
        transporter = nodemailer.createTransport({
          host: process.env.EMAIL_HOST || 'smtp.gmail.com',
          port: Number(process.env.EMAIL_PORT) || 587,
          secure: Number(process.env.EMAIL_PORT) === 465,
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
          },
        });
        logger.info('[emailService] Initialised Gmail SMTP transporter');
      }
    } else {
      throw new Error(`Unknown EMAIL_PROVIDER: ${EMAIL_PROVIDER}`);
    }
  } catch (err) {
    logger.error('[emailService] Transporter init failed', { error: err.message });
    throw err;
  }

  return transporter;
}

/**
 * Base sendEmail function.
 * @param {object} opts
 * @param {string} opts.to       Recipient email
 * @param {string} opts.subject  Subject line
 * @param {string} opts.html     HTML body
 * @param {string} [opts.text]   Optional plain-text alternative (auto-derived if omitted)
 * @param {Array}  [opts.attachments] Nodemailer attachments
 */
async function sendEmail({ to, subject, html, text, attachments }) {
  if (!to || !subject || !html) {
    throw new Error('sendEmail requires to, subject and html');
  }

  if (process.env.NODE_ENV === 'development') {
    logger.info('[emailService][DEV] Outgoing email', {
      to,
      subject,
      bodyPreview: html.replace(/<[^>]+>/g, '').substring(0, 200),
    });
  }

  // Resend HTTP API — bypasses SMTP entirely, works on all cloud hosts
  if (EMAIL_PROVIDER === 'resend') {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error('RESEND_API_KEY is not set');
    try {
      const { data } = await axios.post(
        'https://api.resend.com/emails',
        { from: EMAIL_FROM, to, subject, html, text: text || html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() },
        { headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, timeout: 15000 }
      );
      logger.info('[emailService] Email sent via Resend', { to, subject, id: data?.id });
      return data;
    } catch (err) {
      const detail = err.response?.data ? JSON.stringify(err.response.data) : err.message;
      logger.error('[emailService] Resend API error', { to, subject, error: detail });
      throw new Error(detail);
    }
  }

  try {
    const tx = await getTransporter();
    const info = await tx.sendMail({
      from: EMAIL_FROM,
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
      attachments,
    });

    logger.info('[emailService] Email sent', { to, subject, messageId: info.messageId });

    if (etherealPreviewUrlBuilder) {
      const previewUrl = etherealPreviewUrlBuilder(info);
      if (previewUrl) {
        logger.info('[emailService] Ethereal preview URL', { previewUrl });
      }
    }

    return info;
  } catch (err) {
    logger.error('[emailService] sendMail failed', { to, subject, error: err.message });
    throw err;
  }
}

/* ---------------------------------------------------------------------------
 * HTML TEMPLATE BUILDERS — inline-styled (email-client safe).
 * ------------------------------------------------------------------------ */

const BRAND = {
  primary: '#1565C0',
  primaryDark: '#0D47A1',
  bg: '#F8FAFF',
  surface: '#FFFFFF',
  text: '#1A1A1A',
  textSecondary: '#5F6B7A',
  border: '#E3E8F0',
  success: '#1B5E20',
  warning: '#E65100',
};

function emailShell({ heading, contentHtml, ctaLabel, ctaUrl, footerNote }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${heading}</title>
</head>
<body style="margin:0;padding:0;background-color:${BRAND.bg};font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${BRAND.text};">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${BRAND.bg};padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;background-color:${BRAND.surface};border-radius:12px;border:1px solid ${BRAND.border};overflow:hidden;">
          <tr>
            <td style="background-color:${BRAND.primary};padding:20px 32px;">
              <h1 style="margin:0;color:#FFFFFF;font-size:22px;letter-spacing:0.3px;font-family:Georgia,'Times New Roman',serif;">⚖️ NyayaSetu</h1>
              <p style="margin:4px 0 0 0;color:#E3F2FD;font-size:13px;">Bridge to Justice</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <h2 style="margin:0 0 16px 0;color:${BRAND.text};font-size:20px;">${heading}</h2>
              <div style="font-size:15px;line-height:1.6;color:${BRAND.text};">
                ${contentHtml}
              </div>
              ${
                ctaLabel && ctaUrl
                  ? `<div style="margin:28px 0 8px 0;">
                       <a href="${ctaUrl}" style="display:inline-block;background-color:${BRAND.primary};color:#FFFFFF;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:15px;">${ctaLabel}</a>
                     </div>`
                  : ''
              }
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;background-color:${BRAND.bg};border-top:1px solid ${BRAND.border};">
              <p style="margin:0;font-size:12px;color:${BRAND.textSecondary};line-height:1.5;">
                ${footerNote || 'You are receiving this email because you signed up for NyayaSetu.'}
              </p>
              <p style="margin:8px 0 0 0;font-size:11px;color:${BRAND.textSecondary};">
                © ${new Date().getFullYear()} NyayaSetu. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Hearing reminder email — sent 1-2 days before scheduled court hearing. */
function hearingReminderEmail(caseTitle, date, court) {
  const formattedDate = date instanceof Date ? date.toLocaleString('en-IN', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  }) : String(date);

  const content = `
    <p>This is a reminder that you have an upcoming court hearing.</p>
    <table cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:20px 0;border-collapse:collapse;">
      <tr>
        <td style="padding:10px 12px;background-color:${BRAND.bg};border:1px solid ${BRAND.border};border-radius:6px 0 0 6px;font-weight:600;width:120px;">Case</td>
        <td style="padding:10px 12px;background-color:${BRAND.surface};border:1px solid ${BRAND.border};border-left:none;border-radius:0 6px 6px 0;">${escapeHtml(caseTitle)}</td>
      </tr>
      <tr><td colspan="2" style="height:6px;"></td></tr>
      <tr>
        <td style="padding:10px 12px;background-color:${BRAND.bg};border:1px solid ${BRAND.border};border-radius:6px 0 0 6px;font-weight:600;">Date &amp; Time</td>
        <td style="padding:10px 12px;background-color:${BRAND.surface};border:1px solid ${BRAND.border};border-left:none;border-radius:0 6px 6px 0;color:${BRAND.warning};font-weight:600;">${escapeHtml(formattedDate)}</td>
      </tr>
      <tr><td colspan="2" style="height:6px;"></td></tr>
      <tr>
        <td style="padding:10px 12px;background-color:${BRAND.bg};border:1px solid ${BRAND.border};border-radius:6px 0 0 6px;font-weight:600;">Court</td>
        <td style="padding:10px 12px;background-color:${BRAND.surface};border:1px solid ${BRAND.border};border-left:none;border-radius:0 6px 6px 0;">${escapeHtml(court || 'N/A')}</td>
      </tr>
    </table>
    <p style="color:${BRAND.textSecondary};font-size:13px;">Please arrive at the court at least 30 minutes before the scheduled time. Carry all relevant documents and identification.</p>
  `;

  return emailShell({
    heading: '🔔 Upcoming Court Hearing Reminder',
    contentHtml: content,
    ctaLabel: 'View Case Details',
    ctaUrl: `${process.env.CLIENT_URL || 'https://nyayasetu.in'}/cases`,
    footerNote: 'You receive this alert because case hearing alerts are enabled. You can change this in your case settings.',
  });
}

/** Document ready email — sent when a generated legal document is available. */
function documentReadyEmail(documentTitle, downloadUrl) {
  const content = `
    <p>Great news — your legal document is ready!</p>
    <div style="margin:20px 0;padding:16px;background-color:${BRAND.bg};border-left:4px solid ${BRAND.primary};border-radius:4px;">
      <p style="margin:0;font-size:13px;color:${BRAND.textSecondary};">Document</p>
      <p style="margin:4px 0 0 0;font-size:17px;font-weight:600;color:${BRAND.text};">${escapeHtml(documentTitle)}</p>
    </div>
    <p>You can download the PDF using the button below. The link is valid for 15 minutes — if it expires, simply request a new one from your dashboard.</p>
    <p style="font-size:13px;color:${BRAND.textSecondary};margin-top:24px;">
      <strong>Reminder:</strong> NyayaSetu documents are AI-generated based on your inputs and Indian law. For high-stakes matters, we recommend a verified lawyer review — you can request one from your dashboard.
    </p>
  `;

  return emailShell({
    heading: '📄 Your Document is Ready',
    contentHtml: content,
    ctaLabel: 'Download PDF',
    ctaUrl: downloadUrl,
  });
}

/** Welcome / onboarding email — sent on first registration. */
function welcomeEmail(name) {
  const safeName = escapeHtml(name || 'there');
  const content = `
    <p>Welcome, <strong>${safeName}</strong> 👋</p>
    <p>You've just joined NyayaSetu — India's bridge to justice. Here's what you can do right now, on the free plan:</p>
    <ul style="padding-left:20px;line-height:1.8;">
      <li>Generate up to <strong>3 legal documents</strong> per month</li>
      <li>Track <strong>1 court case</strong> with live eCourts updates</li>
      <li>Two templates are <strong>always free</strong>: Domestic Violence Complaint &amp; Police FIR Draft</li>
      <li>Use NyayaSetu in <strong>11 Indian languages</strong></li>
    </ul>
    <p style="margin-top:20px;">Need legal help? Just open the chat and tell us what's happening in your own words — we'll guide you step by step.</p>
  `;

  return emailShell({
    heading: `Welcome to NyayaSetu, ${safeName}!`,
    contentHtml: content,
    ctaLabel: 'Go to Dashboard',
    ctaUrl: `${process.env.CLIENT_URL || 'https://nyayasetu.in'}/dashboard`,
    footerNote: 'You can reply to this email if you need help — a real human will read it.',
  });
}

/** Notary profile approved email — sent when an admin verifies a notary application. */
function notaryApprovedEmail(name) {
  const safeName = escapeHtml(name || 'there');
  const content = `
    <p>Congratulations, <strong>${safeName}</strong> 🎉</p>
    <p>Your notary profile has been verified and is now live on NyayaSetu. Citizens can find and book you for online notarization.</p>
    <ul style="padding-left:20px;line-height:1.8;">
      <li>Review incoming requests from your <strong>Notary Dashboard</strong></li>
      <li>Accept a request, then schedule a <strong>Video KYC</strong> session with the citizen</li>
      <li>After KYC, stamp the document to complete the notarization and get paid</li>
    </ul>
    <p style="margin-top:20px;">Keep your profile and availability up to date to receive more requests.</p>
  `;

  return emailShell({
    heading: `You're Verified, ${safeName}!`,
    contentHtml: content,
    ctaLabel: 'Go to Notary Dashboard',
    ctaUrl: `${process.env.CLIENT_URL || 'https://nyayasetu.in'}/notary/dashboard`,
    footerNote: 'You can reply to this email if you need help — a real human will read it.',
  });
}

/** OTP email — for users who prefer email-based OTP instead of SMS. */
function otpEmail(otp) {
  const content = `
    <p>Your one-time login code is:</p>
    <div style="margin:24px 0;padding:20px;background-color:${BRAND.bg};border:2px dashed ${BRAND.primary};border-radius:8px;text-align:center;">
      <p style="margin:0;font-size:32px;font-weight:700;color:${BRAND.primary};letter-spacing:8px;font-family:'Courier New',monospace;">${escapeHtml(String(otp))}</p>
    </div>
    <p style="font-size:13px;color:${BRAND.textSecondary};">This code is valid for <strong>10 minutes</strong>. Do not share it with anyone, including NyayaSetu support staff. NyayaSetu will never ask for this code.</p>
    <p style="font-size:13px;color:${BRAND.textSecondary};">If you did not request this code, please ignore this email — your account is safe.</p>
  `;

  return emailShell({
    heading: '🔐 Your Login Code',
    contentHtml: content,
    footerNote: 'For your security, never share login codes. If you suspect unauthorised access, contact support immediately.',
  });
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

module.exports = {
  sendEmail,
  hearingReminderEmail,
  documentReadyEmail,
  welcomeEmail,
  notaryApprovedEmail,
  otpEmail,
};
