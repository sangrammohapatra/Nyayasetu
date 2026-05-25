const logger = require('../../utils/logger');
const { UPLOAD } = require('../../config/constants');
const cloudinaryService = require('./cloudinaryService');

const PDF_URL_EXPIRY_SECONDS = UPLOAD?.PDF_URL_EXPIRY_SECONDS || 15 * 60;

// ─── Provider: Cloudinary ──────────────────────────────────────────────────────

async function uploadToCloudinary(buffer, key, mimeType = 'application/pdf') {
  const result = await cloudinaryService.uploadPDF(buffer, key, {
    context: mimeType ? { mime_type: mimeType } : undefined,
  });

  return {
    storageKey: result.storageKey,
    provider: result.provider,
  };
}

async function getCloudinarySignedUrl(storageKey) {
  return cloudinaryService.getSignedPdfUrl(storageKey, {
    expiresIn: PDF_URL_EXPIRY_SECONDS,
  });
}

async function deleteFromCloudinary(storageKey) {
  await cloudinaryService.deletePDF(storageKey);
}

// ─── Provider: AWS S3 ─────────────────────────────────────────────────────────

async function uploadToS3(buffer, key, mimeType = 'application/pdf') {
  const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

  const s3 = new S3Client({
    region:      process.env.AWS_REGION || 'ap-south-1',
    credentials: {
      accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });

  const command = new PutObjectCommand({
    Bucket:      process.env.AWS_S3_BUCKET,
    Key:         `documents/${key}.pdf`,
    Body:        buffer,
    ContentType: mimeType,
    ServerSideEncryption: 'AES256',
    Metadata: { service: 'nyayasetu', type: 'legal-document' },
  });

  await s3.send(command);
  const storageKey = `documents/${key}.pdf`;
  logger.info(`[storage/s3] Uploaded: ${storageKey} (${buffer.length} bytes)`);
  return { storageKey, provider: 's3' };
}

async function getS3SignedUrl(storageKey) {
  const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
  const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

  const s3 = new S3Client({
    region:      process.env.AWS_REGION || 'ap-south-1',
    credentials: {
      accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });

  const command = new GetObjectCommand({
    Bucket:                     process.env.AWS_S3_BUCKET,
    Key:                        storageKey,
    ResponseContentDisposition: 'attachment',
  });

  return getSignedUrl(s3, command, { expiresIn: PDF_URL_EXPIRY_SECONDS });
}

async function deleteFromS3(storageKey) {
  const { S3Client, DeleteObjectCommand } = require('@aws-sdk/client-s3');
  const s3 = new S3Client({
    region:      process.env.AWS_REGION || 'ap-south-1',
    credentials: {
      accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });
  await s3.send(new DeleteObjectCommand({ Bucket: process.env.AWS_S3_BUCKET, Key: storageKey }));
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
    case 's3':        return uploadToS3(buffer, key);
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
    case 's3':        return getS3SignedUrl(storageKey);
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
      case 's3':        return await deleteFromS3(storageKey);
      case 'cloudinary':
      default:          return await deleteFromCloudinary(storageKey);
    }
  } catch (err) {
    // Log but don't crash — storage deletion is best-effort
    logger.error(`[storage] Failed to delete ${storageKey}: ${err.message}`);
  }
}

module.exports = { uploadPDF, getSignedPdfUrl, deletePDF };
