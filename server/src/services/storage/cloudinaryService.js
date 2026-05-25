'use strict';

const path = require('path');
const { v2: cloudinary } = require('cloudinary');

const logger = require('../../utils/logger');
const { UPLOAD } = require('../../config/constants');

const DEFAULT_DOCUMENT_FOLDER = 'nyayasetu/documents';
const DEFAULT_UPLOAD_FOLDER = 'nyayasetu/uploads';
const PDF_URL_EXPIRY_SECONDS = UPLOAD?.PDF_URL_EXPIRY_SECONDS || 15 * 60;

let isConfigured = false;

function ensureConfig() {
  if (isConfigured) {
    return cloudinary;
  }

  const {
    CLOUDINARY_CLOUD_NAME,
    CLOUDINARY_API_KEY,
    CLOUDINARY_API_SECRET,
  } = process.env;

  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    const error = new Error('Cloudinary environment variables are not fully configured');
    logger.error('[cloudinaryService] Missing Cloudinary configuration', {
      hasCloudName: Boolean(CLOUDINARY_CLOUD_NAME),
      hasApiKey: Boolean(CLOUDINARY_API_KEY),
      hasApiSecret: Boolean(CLOUDINARY_API_SECRET),
    });
    throw error;
  }

  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
    secure: true,
  });

  isConfigured = true;
  return cloudinary;
}

function inferExtension(mimeType, explicitFormat) {
  if (explicitFormat) {
    return explicitFormat.replace(/^\./, '');
  }

  const extensionMap = {
    'application/pdf': 'pdf',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'text/plain': 'txt',
  };

  return extensionMap[mimeType] || undefined;
}

function buildPublicId(rawId) {
  return String(rawId || '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/\.[a-z0-9]+$/i, '');
}

function uploadStream(buffer, options) {
  ensureConfig();

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error) {
        logger.error('[cloudinaryService] Upload failed', {
          error: error.message,
          folder: options.folder,
          publicId: options.public_id,
          resourceType: options.resource_type,
        });
        return reject(error);
      }

      logger.info('[cloudinaryService] Upload completed', {
        publicId: result.public_id,
        resourceType: result.resource_type,
        bytes: result.bytes,
        format: result.format,
      });

      return resolve({
        ...result,
        provider: 'cloudinary',
        storageKey: result.public_id,
      });
    });

    stream.end(buffer);
  });
}

async function uploadBuffer(buffer, mimeType, options = {}) {
  if (!Buffer.isBuffer(buffer) || !buffer.length) {
    throw new Error('uploadBuffer requires a non-empty Buffer');
  }

  const format = inferExtension(mimeType, options.format);
  const uploadOptions = {
    folder: options.folder || DEFAULT_UPLOAD_FOLDER,
    public_id: options.public_id ? buildPublicId(options.public_id) : undefined,
    resource_type: options.resource_type || 'auto',
    type: options.type,
    format,
    overwrite: options.overwrite ?? true,
    invalidate: options.invalidate ?? true,
    tags: options.tags || ['nyayasetu'],
    context: options.context,
    filename_override: options.filename_override,
    use_filename: options.use_filename ?? false,
    unique_filename: options.unique_filename ?? false,
  };

  return uploadStream(buffer, uploadOptions);
}

async function uploadPDF(buffer, key, options = {}) {
  if (!key) {
    throw new Error('uploadPDF requires a storage key');
  }

  const uploadOptions = {
    folder: options.folder || DEFAULT_DOCUMENT_FOLDER,
    public_id: buildPublicId(key),
    resource_type: 'raw',
    type: options.type || 'private',
    format: 'pdf',
    overwrite: options.overwrite ?? true,
    invalidate: options.invalidate ?? true,
    use_filename: false,
    unique_filename: false,
    tags: options.tags || ['nyayasetu', 'document', 'legal'],
    context: options.context,
    filename_override: options.filename_override || `${path.basename(String(key))}.pdf`,
  };

  return uploadStream(buffer, uploadOptions);
}

function getSignedPdfUrl(storageKey, options = {}) {
  if (!storageKey) {
    throw new Error('getSignedPdfUrl requires a storage key');
  }

  ensureConfig();

  const expiresAt = Math.floor(Date.now() / 1000) + (options.expiresIn || PDF_URL_EXPIRY_SECONDS);

  return cloudinary.utils.private_download_url(storageKey, options.format || 'pdf', {
    resource_type: options.resourceType || 'raw',
    type: options.type || 'private',
    expires_at: expiresAt,
    attachment: options.attachment ?? true,
    filename: options.filename,
  });
}

async function deleteAsset(storageKey, options = {}) {
  if (!storageKey) {
    throw new Error('deleteAsset requires a storage key');
  }

  ensureConfig();

  const result = await cloudinary.uploader.destroy(storageKey, {
    resource_type: options.resourceType || 'raw',
    type: options.type || 'private',
    invalidate: options.invalidate ?? true,
  });

  logger.info('[cloudinaryService] Delete completed', {
    storageKey,
    result: result.result,
  });

  return result;
}

async function deletePDF(storageKey) {
  return deleteAsset(storageKey, {
    resourceType: 'raw',
    type: 'private',
  });
}

module.exports = {
  ensureConfig,
  uploadBuffer,
  uploadPDF,
  getSignedPdfUrl,
  deleteAsset,
  deletePDF,
};
