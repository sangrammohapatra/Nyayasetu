'use strict';

/**
 * selfSigner — dev-path digital attestation using Node built-in crypto.
 *
 * Produces a SHA-256 fingerprint of the document content and an
 * HMAC-SHA256 attestation anchored to JWT_SECRET.  The signed PDF is the
 * original document re-rendered by pdfGenerator with a green "DIGITAL
 * ATTESTATION" block appended.  No new npm packages required.
 *
 * This is NOT legally valid under IT Act 2000 §5 (that requires a licensed
 * CA or Aadhaar eSign ESP).  It is sufficient for development/testing and
 * demonstrates the full signing flow before swapping in SignDesk for prod.
 */

const crypto = require('crypto');
const logger  = require('../../utils/logger');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fingerprint(content) {
  return crypto.createHash('sha256').update(String(content), 'utf8').digest('hex');
}

function hmacAttestation(documentId, fp, signerName, isodatetime) {
  const secret = process.env.JWT_SECRET || 'nyayasetu-dev-secret';
  return crypto
    .createHmac('sha256', secret)
    .update(`${documentId}|${fp}|${signerName}|${isodatetime}`)
    .digest('hex');
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * selfSign — re-generates the document PDF with an attestation block appended.
 *
 * @param {object} document  Mongoose Document instance (must have .content)
 * @param {object} user      User lean object { name, _id }
 * @param {object} template  DocumentTemplate lean object
 * @returns {Promise<{
 *   signedPdfBuffer: Buffer,
 *   fingerprint: string,
 *   attestation: string,
 *   signerName: string,
 *   signedAt: Date,
 *   provider: 'self-signed',
 * }>}
 */
async function selfSign(document, user, template) {
  const content = document.lawyerEditedContent || document.content;
  if (!content) throw new Error('Document has no content to sign');

  const signerName = user?.name || 'Document Owner';
  const signedAt   = new Date();
  const fp         = fingerprint(content);
  const attestation = hmacAttestation(String(document._id), fp, signerName, signedAt.toISOString());

  // Lazy-require pdfGenerator to avoid circular deps at startup
  const { generateLegalDocument } = require('../pdf/pdfGenerator');

  // Inject attestation block — pdfGenerator reads this and renders the section
  const docWithSig = {
    ...(document.toObject ? document.toObject() : { ...document }),
    _signatureBlock: {
      signerName,
      signedAt,
      fingerprint: fp,
      attestation,  // stored in DB; first 32 chars shown in the PDF
      provider:     'NyayaSetu Platform Attestation (Self-Signed)',
    },
  };

  logger.info(`[selfSigner] Signing document ${document._id} for ${signerName}`);
  const signedPdfBuffer = await generateLegalDocument(docWithSig, user, template);

  return { signedPdfBuffer, fingerprint: fp, attestation, signerName, signedAt, provider: 'self-signed' };
}

module.exports = { selfSign };
