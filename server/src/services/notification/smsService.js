const logger = require('../../utils/logger');

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
    if (provider === 'msg91') {
      const authKey  = process.env.MSG91_AUTH_KEY;
      const senderId = process.env.MSG91_SENDER_ID || 'NYAYSU';
      const mobile   = phone.replace(/^\+/, '');

      const axios = require('axios');
      const { data } = await axios.get('https://api.msg91.com/api/sendhttp.php', {
        params: {
          authkey:    authKey,
          mobiles:    mobile,
          message,
          sender:     senderId,
          route:      4,        // Transactional route
          country:    91,
          DLT_TE_ID:  process.env.MSG91_DLT_TE_ID || '',
        },
        timeout: 10000,
      });

      logger.info(`[sms/msg91] SMS sent to ${phone}: ${data}`);
      return { provider: 'msg91', response: data };
    }

    return await sendViaTwilio(phone, message);
  } catch (err) {
    logger.error(`[smsService] Failed to send SMS to ${phone}: ${err.message}`);
    throw err;
  }
}

module.exports = { sendOTP, sendSMS };
