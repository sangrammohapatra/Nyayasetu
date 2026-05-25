/**
 * server/src/middleware/verifyTwilioSignature.js
 *
 * Verifies the X-Twilio-Signature header on inbound WhatsApp webhooks.
 * In NODE_ENV=development we accept everything (Twilio Sandbox + ngrok URLs
 * sometimes fail signature checks during local testing).
 */

const twilio = require('twilio');
const logger = require('../utils/logger');

function verifyTwilioSignature(req, res, next) {
  if (process.env.NODE_ENV === 'development') {
    logger.debug('[verifyTwilioSignature] Bypassed in development');
    return next();
  }

  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) {
    logger.error('[verifyTwilioSignature] TWILIO_AUTH_TOKEN not configured');
    return res.status(500).json({ error: 'Server misconfigured' });
  }

  const signature = req.header('X-Twilio-Signature') || '';
  if (!signature) {
    logger.warn('[verifyTwilioSignature] Missing X-Twilio-Signature header', {
      ip: req.ip,
      path: req.originalUrl,
    });
    return res.status(403).json({ error: 'Forbidden' });
  }

  // Twilio computes the signature using the full public URL.
  // Behind a proxy (Render / Railway / Heroku) req.protocol may be 'http' even though
  // the public URL is https — fall back to X-Forwarded-Proto when present.
  const forwardedProto = req.header('X-Forwarded-Proto');
  const protocol = forwardedProto || req.protocol;
  const host = req.header('X-Forwarded-Host') || req.get('host');
  const url = `${protocol}://${host}${req.originalUrl}`;

  const params = req.body && typeof req.body === 'object' ? req.body : {};

  const valid = twilio.validateRequest(authToken, signature, url, params);

  if (!valid) {
    logger.warn('[verifyTwilioSignature] Invalid signature', {
      url,
      ip: req.ip,
    });
    return res.status(403).json({ error: 'Invalid Twilio signature' });
  }

  return next();
}

module.exports = verifyTwilioSignature;
