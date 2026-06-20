'use strict';

/**
 * signatureProvider — single entry-point for all document signing operations.
 *
 * Dev  (no SIGNDESK_API_KEY): self-signed via selfSigner — instant, zero cost.
 * Prod (SIGNDESK_API_KEY set): Aadhaar eSign via SignDesk — legally valid,
 *   redirect flow, webhook receives signed PDF asynchronously.
 */

const logger = require('../../utils/logger');

function isProd() {
  return Boolean(process.env.SIGNDESK_API_KEY);
}

// ─── initiateSign ─────────────────────────────────────────────────────────────

/**
 * Start the signing flow for a document.
 *
 * Dev:  Signs synchronously — returns { done: true, ...signResult }
 * Prod: Sends PDF to SignDesk — returns { done: false, redirectUrl, sessionId }
 *
 * @param {object} document        Mongoose Document instance
 * @param {object} user            User lean object
 * @param {object} template        DocumentTemplate lean object
 * @param {Buffer} pdfBuffer       Current (unsigned) PDF buffer from storage
 * @param {string} [webhookUrl]    Full webhook URL (required for prod)
 * @returns {Promise<object>}
 */
async function initiateSign(document, user, template, pdfBuffer, webhookUrl) {
  if (isProd()) {
    const { initiateSign: sdInitiate } = require('./signDeskProvider');
    const { sessionId, redirectUrl } = await sdInitiate(document, user, pdfBuffer, webhookUrl);
    logger.info(`[signature/prod] SignDesk session started: ${sessionId}`);
    return { done: false, sessionId, redirectUrl };
  }

  // Dev: sign in-place immediately
  const { selfSign } = require('./selfSigner');
  const result = await selfSign(document, user, template);
  logger.info(`[signature/dev] Self-signed document ${document._id}`);
  return { done: true, ...result };
}

// ─── handleWebhook ───────────────────────────────────────────────────────────

/**
 * Parse and verify a SignDesk webhook POST.
 * Only called in prod — dev flow never reaches a webhook.
 *
 * @param {Buffer} rawBody    Raw request body bytes (for HMAC verification)
 * @param {string} signature  Value of x-signdesk-signature header
 * @param {object} parsedBody Already-parsed JSON body
 * @returns {{ valid: boolean, parsed: object }}
 */
function handleWebhook(rawBody, signature, parsedBody) {
  const { verifyWebhook, parseWebhook } = require('./signDeskProvider');
  const valid = verifyWebhook(rawBody, signature);
  if (!valid) {
    logger.warn('[signature] Webhook HMAC verification failed');
    return { valid: false, parsed: null };
  }
  return { valid: true, parsed: parseWebhook(parsedBody) };
}

module.exports = { initiateSign, handleWebhook, isProd };
