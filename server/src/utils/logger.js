/**
 * server/src/utils/logger.js
 *
 * Winston logger for NyayaSetu.
 *
 * Transports:
 *   Console     — always on; colorised in dev, JSON in prod
 *   error.log   — error level only
 *   combined.log— all levels
 *
 * Usage:
 *   const logger = require('./utils/logger');
 *   logger.info('Server started', { port: 5000 });
 *   logger.error('DB failed', { error: err.message, stack: err.stack });
 *   logger.warn('Rate limit hit', { ip, route });
 *   logger.debug('Cache miss', { key });
 */

'use strict';

const path = require('path');
const fs   = require('fs');
const winston = require('winston');
const { combine, timestamp, label, printf, colorize, json, errors, splat } = winston.format;

const IS_DEV  = process.env.NODE_ENV !== 'production';
const IS_TEST = process.env.NODE_ENV === 'test';

// ─── Ensure logs directory exists ─────────────────────────────────────────────

const LOG_DIR = path.resolve(process.cwd(), 'logs');
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// ─── Custom pretty-print format for development ────────────────────────────────

const devFormat = printf(({ level, message, timestamp: ts, stack, ...meta }) => {
  const metaStr = Object.keys(meta).length
    ? '\n  ' + JSON.stringify(meta, null, 2).replace(/\n/g, '\n  ')
    : '';
  const stackStr = stack ? `\n${stack}` : '';
  return `${ts} [${level}] ${message}${stackStr}${metaStr}`;
});

// ─── Formats ──────────────────────────────────────────────────────────────────

const sharedFormats = [
  errors({ stack: IS_DEV }),          // serialize Error objects
  splat(),                             // allow printf-style %s, %d
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
];

const devConsoleFormat = combine(
  ...sharedFormats,
  colorize({ all: true }),
  devFormat
);

const prodConsoleFormat = combine(
  ...sharedFormats,
  json()
);

const fileFormat = combine(
  ...sharedFormats,
  json()
);

// ─── Transports ───────────────────────────────────────────────────────────────

const transports = [];

// Console — suppressed during Jest tests to keep output clean
if (!IS_TEST) {
  transports.push(
    new winston.transports.Console({
      level: IS_DEV ? 'debug' : 'info',
      format: IS_DEV ? devConsoleFormat : prodConsoleFormat,
      handleExceptions: true,
      handleRejections: true,
    })
  );
}

// File: error.log — error level only
transports.push(
  new winston.transports.File({
    filename: path.join(LOG_DIR, 'error.log'),
    level: 'error',
    format: fileFormat,
    maxsize: 10 * 1024 * 1024,   // 10 MB
    maxFiles: 5,
    tailable: true,
    handleExceptions: true,
    handleRejections: true,
  })
);

// File: combined.log — all levels
transports.push(
  new winston.transports.File({
    filename: path.join(LOG_DIR, 'combined.log'),
    level: IS_DEV ? 'debug' : 'info',
    format: fileFormat,
    maxsize: 20 * 1024 * 1024,   // 20 MB
    maxFiles: 10,
    tailable: true,
  })
);

// ─── Logger instance ──────────────────────────────────────────────────────────

const logger = winston.createLogger({
  level: IS_DEV ? 'debug' : 'info',
  exitOnError: false,
  transports,
  // Silent in test unless VERBOSE_TESTS=true
  silent: IS_TEST && process.env.VERBOSE_TESTS !== 'true',
});

// ─── Express request logger middleware ────────────────────────────────────────

/**
 * Attach to Express for structured HTTP request logging.
 * Usage in app.js:
 *   app.use(logger.requestMiddleware);
 */
logger.requestMiddleware = (req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const level = res.statusCode >= 500 ? 'error'
                : res.statusCode >= 400 ? 'warn'
                : 'info';
    logger[level](`${req.method} ${req.originalUrl}`, {
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      ua: (req.headers['user-agent'] || '').substring(0, 80),
    });
  });
  next();
};

// ─── Stream for Morgan (if used) ─────────────────────────────────────────────

logger.stream = {
  write: (message) => {
    logger.info(message.trimEnd());
  },
};

module.exports = logger;
