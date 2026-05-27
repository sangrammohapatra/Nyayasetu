const logger = require('../../utils/logger');

// ─── Provider: Fast2SMS ───────────────────────────────────────────────────────

/**
 * sendViaFast2SMS — sends OTP or plain SMS via Fast2SMS (India-only, free tier).
 *
 * Env vars required:
 *   FAST2SMS_API_KEY  — from fast2sms.com dashboard
 *
 * Free tier: ₹50 credit on signup (~100 OTP SMS).
 * Route 'q' (Quick SMS) is used for transactional messages; no DLT needed for OTP.
 *
 * @param {string} phone   — E.164 format (+91XXXXXXXXXX)
 * @param {string} message — SMS body (for OTP, the OTP digits only on 'otp' route)
 * @param {string} [otp]   — if provided, uses the dedicated OTP route for better delivery
 */
async function sendViaFast2SMS(phone, message, otp) {
  const apiKey = process.env.FAST2SMS_API_KEY;
  if (!apiKey) {
    throw new Error('FAST2SMS_API_KEY missing in .env');
  }

  // Fast2SMS expects a 10-digit number (strip +91)
  const mobile = phone.replace(/^\+91/, '');

  const axios = require('axios');

  // Use 'q' (Quick SMS) route for both OTP and generic messages.
  // The dedicated 'otp' route requires a DLT-registered template on the account;
  // 'q' works on fresh accounts without DLT setup and is fine for development.
  const payload = otp
    ? {
        route: 'q',
        message: `${otp} is your NyayaSetu OTP. Valid for 5 minutes. Do not share. -NyayaSetu`,
        language: 'english',
        flash: 0,
        numbers: mobile,
      }
    : {
        route: 'q',
        message,
        language: 'english',
        flash: 0,
        numbers: mobile,
      };

  try {
    const { data } = await axios.post('https://www.fast2sms.com/dev/bulkV2', payload, {
      headers: {
        authorization: apiKey,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });

    if (!data?.return) {
      throw new Error(`Fast2SMS rejected request: ${JSON.stringify(data)}`);
    }

    logger.info(`[sms/fast2sms] Sent to ${phone}, requestId: ${data?.request_id}`);
    return { provider: 'fast2sms', requestId: data?.request_id };
  } catch (err) {
    // Surface the actual Fast2SMS response body so errors are actionable
    const detail = err.response?.data
      ? JSON.stringify(err.response.data)
      : err.message;
    logger.error(`[sms/fast2sms] API error for ${phone}: ${detail}`);
    throw new Error(`Fast2SMS: ${detail}`);
  }
}

// ─── Provider: Twilio ──────────────────────────────────────────────────────────

/**
 * sendViaTwilio — sends SMS via Twilio REST API.
 * Used in development (free trial credit).
 *
 * @param {string} phone   — E.164 format (+91XXXXXXXXXX)
 * @param {string} message — full SMS body
 */
async function sendViaTwilio(phone, message) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken  = process.env.TWILIO_AUTH_TOKEN;
  const from       = process.env.TWILIO_SMS_FROM;

  if (!accountSid || !authToken || !from) {
    throw new Error(
      'Twilio credentials missing. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_SMS_FROM in .env'
    );
  }

  const twilio = require('twilio');
  const client = twilio(accountSid, authToken);

  const result = await client.messages.create({ body: message, from, to: phone });

  logger.info(`[sms/twilio] Sent to ${phone}, SID: ${result.sid}`);
  return { provider: 'twilio', sid: result.sid };
}

// ─── Provider: MSG91 ──────────────────────────────────────────────────────────

/**
 * sendViaMSG91 — sends OTP via MSG91 OTP API.
 * Used in production (cheapest for India, DLT-compliant).
 *
 * MSG91 OTP API sends a pre-approved DLT template with the OTP variable
 * substituted in. The template must be registered on MSG91 dashboard.
 *
 * @param {string} phone — E.164 format (+91XXXXXXXXXX)
 * @param {string} otp   — 6-digit OTP
 */
async function sendViaMSG91(phone, otp) {
  const authKey    = process.env.MSG91_AUTH_KEY;
  const templateId = process.env.MSG91_TEMPLATE_ID;

  if (!authKey || !templateId) {
    throw new Error(
      'MSG91 credentials missing. Set MSG91_AUTH_KEY and MSG91_TEMPLATE_ID in .env'
    );
  }

  // Strip the leading '+' — MSG91 accepts '91XXXXXXXXXX'
  const mobile = phone.replace(/^\+/, '');

  const axios = require('axios');
  const response = await axios.post(
    'https://api.msg91.com/api/v5/otp',
    { template_id: templateId, mobile, otp, authkey: authKey },
    { headers: { 'Content-Type': 'application/json' }, timeout: 10000 }
  );

  if (response.data?.type !== 'success') {
    throw new Error(`MSG91 API error: ${JSON.stringify(response.data)}`);
  }

  logger.info(`[sms/msg91] OTP sent to ${phone}, requestId: ${response.data?.request_id}`);
  return { provider: 'msg91', requestId: response.data?.request_id };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * sendOTP — dispatch a 6-digit OTP to the given phone number.
 *
 * Provider is selected via SMS_PROVIDER env var:
 *   'twilio'  → Twilio (dev default)
 *   'msg91'   → MSG91 (prod)
 *
 * @param {string} phone — E.164 format (+91XXXXXXXXXX)
 * @param {string} otp   — 6-digit OTP string
 */
async function sendOTP(phone, otp) {
  const provider = process.env.SMS_PROVIDER || 'twilio';
  const message  = `${otp} is your NyayaSetu OTP. Valid for 5 minutes. Do not share this with anyone. -NyayaSetu`;

  logger.debug(`[smsService] Sending OTP via ${provider} to ${phone}`);

  try {
    switch (provider) {
      case 'msg91':
        return await sendViaMSG91(phone, otp);

      case 'fast2sms':
        return await sendViaFast2SMS(phone, message, otp);

      case 'twilio':
      default:
        return await sendViaTwilio(phone, message);
    }
  } catch (err) {
    logger.error(`[smsService] Failed to send OTP to ${phone}: ${err.message}`);
    throw err;
  }
}

/**
 * sendSMS — generic non-OTP SMS sender (hearing alerts, notifications).
 *
 * @param {string} phone   — E.164 format
 * @param {string} message — plain text body (max 160 chars for single SMS)
 */
async function sendSMS(phone, message) {
  const provider = process.env.SMS_PROVIDER || 'twilio';

  try {
    switch (provider) {
      case 'msg91': {
        const authKey  = process.env.MSG91_AUTH_KEY;
        const senderId = process.env.MSG91_SENDER_ID || 'NYAYSU';
        const mobile   = phone.replace(/^\+/, '');

        const axios = require('axios');
        const { data } = await axios.get('https://api.msg91.com/api/sendhttp.php', {
          params: {
            authkey:   authKey,
            mobiles:   mobile,
            message,
            sender:    senderId,
            route:     4,
            country:   91,
            DLT_TE_ID: process.env.MSG91_DLT_TE_ID || '',
          },
          timeout: 10000,
        });

        logger.info(`[sms/msg91] SMS sent to ${phone}: ${data}`);
        return { provider: 'msg91', response: data };
      }

      case 'fast2sms':
        return await sendViaFast2SMS(phone, message);

      case 'twilio':
      default:
        return await sendViaTwilio(phone, message);
    }
  } catch (err) {
    logger.error(`[smsService] Failed to send SMS to ${phone}: ${err.message}`);
    throw err;
  }
}

module.exports = { sendOTP, sendSMS };
