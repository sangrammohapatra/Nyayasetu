const Redis = require('ioredis');
const logger = require('../utils/logger');

let redisClient = null;

/**
 * Creates and connects an ioredis client.
 * Handles connection errors gracefully — the app can run with degraded
 * functionality (no Bull queues, no rate-limit persistence) if Redis is down.
 */
async function connectRedis() {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

  try {
    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 10) {
          logger.error('Redis: Max retries reached. Giving up.');
          return null; // Stop retrying
        }
        const delay = Math.min(times * 500, 3000); // 500ms, 1s, 1.5s... max 3s
        logger.warn(`Redis: Retry attempt ${times}, waiting ${delay}ms...`);
        return delay;
      },
      enableOfflineQueue: true, // Queue commands while reconnecting
      connectTimeout: 10000,
      lazyConnect: true, // Don't auto-connect; we call .connect() explicitly
    });

    // ── Event Handlers ─────────────────────────────────────────────────────
    redisClient.on('connect', () => {
      logger.info('Redis client connected');
    });

    redisClient.on('ready', () => {
      logger.info('Redis client ready to accept commands');
    });

    redisClient.on('error', (err) => {
      // Log but don't crash — app degrades gracefully without Redis
      logger.error('Redis client error:', err.message);
    });

    redisClient.on('close', () => {
      logger.warn('Redis connection closed');
    });

    redisClient.on('reconnecting', (delay) => {
      logger.info(`Redis reconnecting in ${delay}ms...`);
    });

    redisClient.on('end', () => {
      logger.warn('Redis connection ended. No more reconnects.');
    });

    // Explicitly connect (since lazyConnect: true)
    await redisClient.connect();
    logger.info(`Redis connected → ${redisUrl.replace(/\/\/.*@/, '//*****@')}`);
  } catch (error) {
    logger.error('Redis connection failed:', error.message);
    logger.warn('Continuing without Redis — Bull queues and session caching will be unavailable');
    // Don't throw — let the server start anyway
  }
}

/**
 * Returns the shared Redis client.
 * May be null if Redis failed to connect.
 */
function getRedisClient() {
  return redisClient;
}

/**
 * Checks if Redis is currently connected and usable.
 */
function isRedisConnected() {
  return redisClient !== null && redisClient.status === 'ready';
}

module.exports = { connectRedis, getRedisClient, isRedisConnected, redisClient: getRedisClient() };

// Re-export a live reference so other modules always get the current client
Object.defineProperty(module.exports, 'redisClient', {
  get() {
    return redisClient;
  },
});
