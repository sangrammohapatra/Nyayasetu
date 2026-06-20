const logger = require('../../utils/logger');
const cloudinaryService = require('./cloudinaryService');
const s3Service = require('./s3Service');

const PDF_URL_EXPIRY_SECONDS = require('../../config/constants').UPLOAD?.PDF_URL_EXPIRY_SECONDS || 15 * 60;

// ─── Provider: Cloudinary ──────────────────────────────────────────────────────

async function uploadToCloudinary(buffer, key, mimeType = 'application/pdf') {
  const result = await cloudinaryService.uploadPDF(buffer, key, {
    context: mimeType ? { mime_type: mimeType } : undefined,
  });
  return { storageKey: result.storageKey, provider: result.provider };
}

async function getCloudinarySignedUrl(storageKey) {
  return cloudinaryService.getSignedPdfUrl(storageKey, { expiresIn: PDF_URL_EXPIRY_SECONDS });
}

async function deleteFromCloudinary(storageKey) {
  await cloudinaryService.deletePDF(storageKey);
}

// ─── Public API ───────────────────────────────────────────────────────────────

function getProvider() {
  return (process.env.STORAGE_PROVIDER || 'cloudinary').toLowerCase();
}

/**
 * uploadPDF — upload a PDF buffer and return the storage key.
 * The key is persisted in Document.pdfStorageKey (never exposed to clients).
 *
 * @param {Buffer} buffer    — PDF buffer from pdfGenerator
 * @param {string} key       — unique identifier (document._id)
 * @returns {Promise<{ storageKey: string, provider: string }>}
 */
async function uploadPDF(buffer, key) {
  const provider = getProvider();
  logger.debug(`[storage] Uploading PDF via ${provider}, key: ${key}`);

  switch (provider) {
    case 's3':        return s3Service.uploadPDF(buffer, key);
    case 'cloudinary':
    default:          return uploadToCloudinary(buffer, key);
  }
}

/**
 * getSignedPdfUrl — generate a short-lived (15 min) signed URL for a stored PDF.
 * Rule #9: PDF URLs are signed URLs with 15-minute expiry — never permanent.
 *
 * @param {string} storageKey — from Document.pdfStorageKey
 * @returns {Promise<string>}
 */
async function getSignedPdfUrl(storageKey) {
  const provider = getProvider();

  switch (provider) {
    case 's3':        return s3Service.getSignedPdfUrl(storageKey);
    case 'cloudinary':
    default:          return getCloudinarySignedUrl(storageKey);
  }
}

/**
 * deletePDF — remove a stored PDF (used when document is deleted).
 */
async function deletePDF(storageKey) {
  const provider = getProvider();
  try {
    switch (provider) {
      case 's3':        return await s3Service.deletePDF(storageKey);
      case 'cloudinary':
      default:          return await deleteFromCloudinary(storageKey);
    }
  } catch (err) {
    // Log but don't crash — storage deletion is best-effort
    logger.error(`[storage] Failed to delete ${storageKey}: ${err.message}`);
  }
}

module.exports = { uploadPDF, getSignedPdfUrl, deletePDF };
