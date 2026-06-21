const logger = require('../utils/logger');

// ─── Error Classification ──────────────────────────────────────────────────────

/**
 * mapError — maps any thrown error to a { status, code, message } object.
 * Handles Mongoose, JWT, Multer, and custom application errors.
 * NEVER leaks implementation details to the client in production.
 */
function mapError(err) {
  // ── Mongoose: document failed validation ──────────────────────────────────
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message);
    return {
      status: 400,
      code: 'VALIDATION_ERROR',
      message: messages.join('. '),
      fields: Object.fromEntries(
        Object.entries(err.errors).map(([k, v]) => [k, v.message])
      ),
    };
  }

  // ── Mongoose: duplicate key (unique index violation) ─────────────────────
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    const value = err.keyValue?.[field];
    return {
      status: 409,
      code: 'DUPLICATE_KEY',
      message: `${field} '${value}' is already in use`,
      field,
    };
  }

  // ── Mongoose: bad ObjectId cast ───────────────────────────────────────────
  if (err.name === 'CastError') {
    return {
      status: 400,
      code: 'INVALID_ID',
      message: `Invalid value for '${err.path}': ${err.value}`,
    };
  }

  // ── JWT: malformed token ──────────────────────────────────────────────────
  if (err.name === 'JsonWebTokenError') {
    return { status: 401, code: 'INVALID_TOKEN', message: 'Invalid authentication token' };
  }

  // ── JWT: token has expired ────────────────────────────────────────────────
  if (err.name === 'TokenExpiredError') {
    return { status: 401, code: 'TOKEN_EXPIRED', message: 'Authentication token has expired' };
  }

  // ── JWT: token not yet valid ──────────────────────────────────────────────
  if (err.name === 'NotBeforeError') {
    return { status: 401, code: 'TOKEN_NOT_ACTIVE', message: 'Token is not yet active' };
  }

  // ── Multer: file upload error ─────────────────────────────────────────────
  if (err.name === 'MulterError') {
    return { status: 400, code: 'FILE_UPLOAD_ERROR', message: err.message };
  }

  // ── Custom app errors thrown via createError() ────────────────────────────
  if (err.status || err.statusCode) {
    return {
      status: err.status || err.statusCode,
      code: err.code || 'APP_ERROR',
      message: err.message || 'An error occurred',
    };
  }

  // ── Fallthrough: unexpected server error ──────────────────────────────────
  return {
    status: 500,
    code: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred. Please try again later.',
  };
}

// ─── Global Error Handler ──────────────────────────────────────────────────────

/**
 * errorHandler — the LAST middleware in app.js.
 * Catches everything passed via next(err) and returns a consistent JSON shape.
 *
 * Canonical error response schema:
 *   {
 *     error:    string           — machine-readable uppercase code (e.g. 'NOT_FOUND')
 *     message:  string           — human-readable description
 *     fields?:  Record<string, string>  — field-level validation messages
 *     details?: Record<string, unknown> — domain-specific extras (upgradeUrl, quota info, etc.)
 *     stack?:   string           — stack trace (development + 5xx only)
 *   }
 *
 * Inline res.json() calls in controllers MUST use the same shape:
 *   res.status(N).json({ error: 'ERROR_CODE', message: 'human text' })
 * Never use { error: 'human text' } (no code) or { errorCode, errorMessage } (wrong keys).
 */
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  const mapped = mapError(err);

  // ── Server-side logging ────────────────────────────────────────────────────
  if (mapped.status >= 500) {
    logger.error('Server error', {
      message: err.message,
      stack: err.stack,
      path: req.originalUrl,
      method: req.method,
      userId: req.user?.userId ?? null,
      ip: req.ip,
    });
  } else if (mapped.status >= 400 && mapped.status !== 401) {
    // 401s are very common (session expiry) — log at debug to avoid noise
    logger.warn('Client error', {
      code: mapped.code,
      message: mapped.message,
      path: req.originalUrl,
      method: req.method,
      userId: req.user?.userId ?? null,
    });
  }

  // ── Build response ─────────────────────────────────────────────────────────
  const response = {
    error: mapped.code,
    message: mapped.message,
  };

  if (mapped.fields) response.fields = mapped.fields;
  if (mapped.field)  response.field  = mapped.field;

  // Stack trace — development only, never in production (Rule #20)
  if (process.env.NODE_ENV === 'development' && mapped.status >= 500) {
    response.stack = err.stack;
  }

  res.status(mapped.status).json(response);
}

// ─── createError helper ────────────────────────────────────────────────────────

/**
 * createError — throw a structured HTTP error from any controller.
 *
 * Usage:
 *   throw createError(403, 'FORBIDDEN', 'You cannot access this resource');
 *   throw createError(404, 'NOT_FOUND', 'Document not found');
 *
 * @param {number} status
 * @param {string} code
 * @param {string} message
 */
function createError(status, code, message) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

module.exports = { errorHandler, createError };
