/**
 * server/src/routes/whatsapp.routes.js
 *
 * Twilio expects:
 *   GET  /v1/whatsapp/webhook   — verification challenge (used by Meta Cloud API too)
 *   POST /v1/whatsapp/webhook   — inbound messages, signed with X-Twilio-Signature
 *
 * IMPORTANT: Twilio sends application/x-www-form-urlencoded by default. The Express
 * app's global json() middleware is fine, but we additionally mount urlencoded() at
 * this route so the body is parsed correctly even if the global stack only enabled JSON.
 */

const express = require('express');
const router = express.Router();

const whatsappController = require('../controllers/whatsapp.controller');
const verifyTwilioSignature = require('../middleware/verifyTwilioSignature.middleware');
const logger = require('../utils/logger');

// Twilio sends url-encoded form data — make sure it's parsed here.
const urlencodedParser = express.urlencoded({ extended: false });

/**
 * GET /v1/whatsapp/webhook
 *
 * Twilio doesn't require this, but Meta Cloud API webhook setup does — it sends:
 *   ?hub.mode=subscribe&hub.verify_token=<token>&hub.challenge=<challenge>
 * We support both providers from the same route.
 */
router.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  const expected = process.env.WHATSAPP_VERIFY_TOKEN || process.env.META_VERIFY_TOKEN;

  if (mode === 'subscribe' && expected && token === expected) {
    logger.info('[whatsapp.routes] WhatsApp webhook verified (Meta)');
    return res.status(200).send(challenge);
  }

  // Twilio doesn't call GET — but a manual probe should not 500.
  return res.status(200).send('NyayaSetu WhatsApp webhook is live');
});

/**
 * POST /v1/whatsapp/webhook
 * Inbound Twilio (or Meta) message → state machine → TwiML reply.
 */
router.post(
  '/webhook',
  urlencodedParser,
  verifyTwilioSignature,
  whatsappController.handleIncoming
);

module.exports = router;
