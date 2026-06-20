'use strict';

const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadBucketCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const logger = require('../../utils/logger');
const { UPLOAD } = require('../../config/constants');

const PDF_URL_EXPIRY_SECONDS = UPLOAD?.PDF_URL_EXPIRY_SECONDS || 15 * 60;
const KEY_PREFIX = 'documents/';

let _client = null;
let _bucket  = null;

// ─── Config ───────────────────────────────────────────────────────────────────

function ensureConfig() {
  if (_client) return { client: _client, bucket: _bucket };

  const {
    AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY,
    AWS_REGION,
    AWS_S3_BUCKET,
  } = process.env;

  const missing = ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_REGION', 'AWS_S3_BUCKET']
    .filter((k) => !process.env[k]);

  if (missing.length) {
    throw new Error(`S3 is not configured. Missing env vars: ${missing.join(', ')}`);
  }

  _client = new S3Client({
    region: AWS_REGION,
    credentials: {
      accessKeyId:     AWS_ACCESS_KEY_ID,
      secretAccessKey: AWS_SECRET_ACCESS_KEY,
    },
  });

  _bucket = AWS_S3_BUCKET;
  logger.info(`[s3Service] Client initialised — bucket: ${_bucket}, region: ${AWS_REGION}`);

  return { client: _client, bucket: _bucket };
}

// ─── Startup validation ───────────────────────────────────────────────────────

/**
 * Verify credentials and bucket access at boot time.
 * Call this from server.js when STORAGE_PROVIDER=s3.
 * Throws if credentials are wrong or the bucket is inaccessible.
 */
async function validateConfig() {
  const { client, bucket } = ensureConfig();
  await client.send(new HeadBucketCommand({ Bucket: bucket }));
  logger.info(`[s3Service] Bucket access confirmed: s3://${bucket}`);
}

// ─── Key helpers ──────────────────────────────────────────────────────────────

function buildKey(rawKey) {
  // rawKey is typically a MongoDB ObjectId string
  const clean = String(rawKey).trim().replace(/\.pdf$/i, '');
  return `${KEY_PREFIX}${clean}.pdf`;
}

// ─── Upload ──────────────────────────────────────────────────────────────────

/**
 * Upload a PDF buffer to S3.
 *
 * @param {Buffer} buffer
 * @param {string} key         Unique identifier (document._id)
 * @param {object} [options]
 * @param {string} [options.contentDisposition]
 * @returns {Promise<{ storageKey: string, provider: 's3' }>}
 */
async function uploadPDF(buffer, key, options = {}) {
  if (!Buffer.isBuffer(buffer) || !buffer.length) {
    throw new Error('uploadPDF requires a non-empty Buffer');
  }
  if (!key) throw new Error('uploadPDF requires a key');

  const { client, bucket } = ensureConfig();
  const storageKey = buildKey(key);

  await client.send(new PutObjectCommand({
    Bucket:               bucket,
    Key:                  storageKey,
    Body:                 buffer,
    ContentType:          'application/pdf',
    ContentDisposition:   options.contentDisposition || 'attachment',
    ServerSideEncryption: 'AES256',
    Metadata: { service: 'nyayasetu', type: 'legal-document' },
  }));

  logger.info(`[s3Service] Uploaded: s3://${bucket}/${storageKey} (${buffer.length} bytes)`);
  return { storageKey, provider: 's3' };
}

// ─── Signed URL ───────────────────────────────────────────────────────────────

/**
 * Generate a short-lived pre-signed GET URL for a stored PDF.
 *
 * @param {string} storageKey   Value from Document.pdfStorageKey
 * @param {object} [options]
 * @param {number} [options.expiresIn]   Seconds until expiry (default 15 min)
 * @returns {Promise<string>}
 */
async function getSignedPdfUrl(storageKey, options = {}) {
  if (!storageKey) throw new Error('getSignedPdfUrl requires a storageKey');

  const { client, bucket } = ensureConfig();
  const expiresIn = options.expiresIn || PDF_URL_EXPIRY_SECONDS;

  const command = new GetObjectCommand({
    Bucket:                     bucket,
    Key:                        storageKey,
    ResponseContentType:        'application/pdf',
    ResponseContentDisposition: 'attachment',
  });

  const url = await getSignedUrl(client, command, { expiresIn });
  logger.debug(`[s3Service] Signed URL generated for ${storageKey} (${expiresIn}s)`);
  return url;
}

// ─── Delete ───────────────────────────────────────────────────────────────────

/**
 * Delete a stored PDF.
 * Best-effort — caller should catch and log, not crash.
 *
 * @param {string} storageKey
 */
async function deletePDF(storageKey) {
  if (!storageKey) throw new Error('deletePDF requires a storageKey');

  const { client, bucket } = ensureConfig();
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: storageKey }));
  logger.info(`[s3Service] Deleted: s3://${bucket}/${storageKey}`);
}

module.exports = { ensureConfig, validateConfig, uploadPDF, getSignedPdfUrl, deletePDF };
