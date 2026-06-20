'use strict';

/**
 * signDeskProvider — production Aadhaar eSign via SignDesk REST API.
 *
 * Pricing: ~₹15-25 per eSign transaction (legally valid under IT Act 2000 §5).
 * Docs:    https://signdesk.com/developers  (requires account + KYC)
 *
 * Flow:
 *   1. POST /initiateSign → our server sends PDF to SignDesk → get redirectUrl
 *   2. Frontend redirects citizen to redirectUrl → Aadhaar OTP on SignDesk page
 *   3. SignDesk POSTs webhook to /v1/webhooks/signdesk with signed PDF (base64)
 *   4. Our webhook handler re-uploads signed PDF, updates document record
 *
 * Env vars (set in production only):
 *   SIGNDESK_CLIENT_ID      — from SignDesk dashboard
 *   SIGNDESK_APP_ID         — x-parse-application-id header
 *   SIGNDESK_API_KEY        — x-parse-rest-api-key header
 *   SIGNDESK_WEBHOOK_SECRET — used to verify webhook HMAC
 *   SIGNDESK_BASE_URL       — defaults to https://api.signdesk.in/api/live
 */

const crypto = require('crypto');
const logger  = require('../../utils/logger');

const BASE_URL  = process.env.SIGNDESK_BASE_URL  || 'https://api.signdesk.in/api/live';
const CLIENT_ID = process.env.SIGNDESK_CLIENT_ID;
const APP_ID    = process.env.SIGNDESK_APP_ID;
const API_KEY   = process.env.SIGNDESK_API_KEY;

function headers() {
  return {
    'x-parse-application-id': APP_ID,
    'x-parse-rest-api-key':   API_KEY,
  };
}

// ─── initiateSign ─────────────────────────────────────────────────────────────

/**
 * Send the PDF to SignDesk and get back a signer URL to redirect the user to.
 *
 * @param {{ _id, title }} document
 * @param {{ name, email, phone }} user
 * @param {Buffer} pdfBuffer  — current (unsigned) PDF bytes
 * @param {string} webhookUrl — full URL SignDesk will POST the signed result to
 * @returns {Promise<{ sessionId: string, redirectUrl: string }>}
 */
async function initiateSign(document, user, pdfBuffer, webhookUrl) {
  if (!CLIENT_ID || !APP_ID || !API_KEY) {
    throw new Error('SignDesk credentials not configured. Set SIGNDESK_CLIENT_ID, SIGNDESK_APP_ID, SIGNDESK_API_KEY.');
  }

  // Build multipart/form-data using Node 18+ FormData global
  const form = new FormData();
  form.append('document', new Blob([pdfBuffer], { type: 'application/pdf' }), `${document._id}.pdf`);
  form.append('signer_name',    user.name || 'Document Owner');
  form.append('signer_email',   user.email || '');
  form.append('signer_phone',   user.phone || '');
  form.append('purpose',        `Legal document signing: ${document.title}`);
  form.append('signature_type', 'aadhaar');  // or 'dsc' for DSC-based
  form.append('redirect_url',   webhookUrl);
  form.append('document_id',    String(document._id));

  const res = await fetch(`${BASE_URL}/${CLIENT_ID}/aadhaar-esign/request`, {
    method:  'POST',
    headers: headers(),
    body:    form,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`SignDesk API error ${res.status}: ${text}`);
  }

  const data = await res.json();

  // SignDesk v2 returns { status: 'success', document: { session_id, signer_url } }
  if (data.status !== 'success' || !data.document?.session_id) {
    throw new Error(`SignDesk unexpected response: ${JSON.stringify(data)}`);
  }

  logger.info(`[signdesk] Signing initiated for doc ${document._id}, session: ${data.document.session_id}`);

  return {
    sessionId:   data.document.session_id,
    redirectUrl: data.document.signer_url,
  };
}

// ─── verifyWebhook ────────────────────────────────────────────────────────────

/**
 * Verify the HMAC-SHA256 signature on the webhook request.
 * SignDesk includes an `x-signdesk-signature` header.
 */
function verifyWebhook(rawBody, signature) {
  const secret = process.env.SIGNDESK_WEBHOOK_SECRET;
  if (!secret) {
    logger.warn('[signdesk] SIGNDESK_WEBHOOK_SECRET not set — skipping webhook verification');
    return true;
  }
  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature || ''));
}

// ─── parseWebhook ────────────────────────────────────────────────────────────

/**
 * Parse the signed PDF out of a verified SignDesk webhook payload.
 *
 * @param {object} body  — parsed JSON body from the webhook POST
 * @returns {{
 *   sessionId: string,
 *   status: 'signed'|'failed',
 *   signedPdfBuffer: Buffer|null,
 *   aadhaarName: string,
 *   transactionId: string,
 * }}
 */
function parseWebhook(body) {
  const status = body.status === 'signed' ? 'signed' : 'failed';

  let signedPdfBuffer = null;
  if (status === 'signed') {
    if (body.signed_document) {
      // Inline base64
      signedPdfBuffer = Buffer.from(body.signed_document, 'base64');
    } else if (body.document_url) {
      // URL — caller must download separately; return null here, controller fetches it
      signedPdfBuffer = null;
    }
  }

  return {
    sessionId:       body.session_id,
    status,
    signedPdfBuffer,
    documentUrl:     body.document_url || null,
    aadhaarName:     body.aadhaar_name || '',
    transactionId:   body.transaction_id || '',
  };
}

module.exports = { initiateSign, verifyWebhook, parseWebhook };
