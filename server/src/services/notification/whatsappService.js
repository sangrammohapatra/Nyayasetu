/**
 * server/src/services/notification/whatsappService.js
 *
 * WhatsApp messaging service powered by Twilio.
 * - In development: messages are logged to the console AND sent via Twilio Sandbox
 *   (sandbox requires the recipient to first join with the sandbox join code).
 * - In production: messages are sent through the configured WhatsApp Business sender.
 *
 * Phone numbers are normalised to E.164 format (+91XXXXXXXXXX) before sending.
 */

const twilio = require('twilio');
const logger = require('../../utils/logger');

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_WHATSAPP_FROM = process.env.TWILIO_WHATSAPP_FROM; // e.g. 'whatsapp:+14155238886'

let twilioClient = null;
if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
  try {
    twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  } catch (err) {
    logger.error('[whatsappService] Failed to initialise Twilio client', { error: err.message });
  }
} else {
  logger.warn('[whatsappService] TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN not set. WhatsApp sending disabled.');
}

/**
 * Normalise a phone number to the Twilio WhatsApp address format.
 * Accepts inputs like "9999999999", "+919999999999", "whatsapp:+919999999999".
 */
function toWhatsAppAddress(phone) {
  if (!phone) throw new Error('Phone number is required');
  let p = String(phone).trim();

  if (p.startsWith('whatsapp:')) return p;

  p = p.replace(/[\s\-()]/g, '');

  if (!p.startsWith('+')) {
    if (p.length === 10) p = `+91${p}`;
    else if (p.startsWith('91') && p.length === 12) p = `+${p}`;
    else if (p.startsWith('0') && p.length === 11) p = `+91${p.substring(1)}`;
    else p = `+${p}`;
  }

  return `whatsapp:${p}`;
}

/**
 * Send a plain text WhatsApp message.
 * @param {string} phone     Recipient phone (any common Indian format).
 * @param {string} message   Body text (Twilio limit ~1600 chars).
 * @returns {Promise<object>} Twilio message resource or a dev-mode stub.
 */
async function sendMessage(phone, message) {
  if (!phone || !message) {
    throw new Error('sendMessage requires both phone and message');
  }

  const to = toWhatsAppAddress(phone);
  const from = TWILIO_WHATSAPP_FROM;

  if (process.env.NODE_ENV === 'development') {
    logger.info('[whatsappService][DEV] Outgoing WhatsApp message', {
      to,
      from,
      preview: message.substring(0, 200),
    });
  }

  if (!twilioClient || !from) {
    logger.warn('[whatsappService] Twilio not configured — message not delivered', { to });
    return {
      sid: `dev_${Date.now()}`,
      status: 'logged_only',
      to,
      body: message,
    };
  }

  try {
    const result = await twilioClient.messages.create({
      from,
      to,
      body: message,
    });
    logger.info('[whatsappService] Message sent', { sid: result.sid, to, status: result.status });
    return result;
  } catch (err) {
    logger.error('[whatsappService] Twilio send failed', {
      to,
      code: err.code,
      message: err.message,
    });
    throw err;
  }
}

/**
 * Send a WhatsApp message that includes a media attachment (image, PDF, etc.).
 * @param {string} phone
 * @param {string} message    Caption / body text (can be empty string).
 * @param {string} mediaUrl   Publicly reachable HTTPS URL of the media (Cloudinary / signed S3 URL).
 */
async function sendMediaMessage(phone, message, mediaUrl) {
  if (!phone || !mediaUrl) {
    throw new Error('sendMediaMessage requires both phone and mediaUrl');
  }

  const to = toWhatsAppAddress(phone);
  const from = TWILIO_WHATSAPP_FROM;

  if (process.env.NODE_ENV === 'development') {
    logger.info('[whatsappService][DEV] Outgoing WhatsApp MEDIA message', {
      to,
      from,
      mediaUrl,
      preview: (message || '').substring(0, 200),
    });
  }

  if (!twilioClient || !from) {
    logger.warn('[whatsappService] Twilio not configured — media message not delivered', { to });
    return {
      sid: `dev_${Date.now()}`,
      status: 'logged_only',
      to,
      body: message,
      mediaUrl,
    };
  }

  try {
    const result = await twilioClient.messages.create({
      from,
      to,
      body: message || '',
      mediaUrl: [mediaUrl],
    });
    logger.info('[whatsappService] Media message sent', {
      sid: result.sid,
      to,
      status: result.status,
    });
    return result;
  } catch (err) {
    logger.error('[whatsappService] Twilio media send failed', {
      to,
      code: err.code,
      message: err.message,
    });
    throw err;
  }
}

/**
 * Convenience: send the same message to many recipients sequentially.
 * Errors on individual sends do not abort the batch.
 */
async function sendBulk(phones, message) {
  const results = [];
  for (const phone of phones) {
    try {
      const r = await sendMessage(phone, message);
      results.push({ phone, ok: true, sid: r.sid });
    } catch (err) {
      results.push({ phone, ok: false, error: err.message });
    }
  }
  return results;
}

module.exports = {
  sendMessage,
  sendMediaMessage,
  sendBulk,
  toWhatsAppAddress,
};
