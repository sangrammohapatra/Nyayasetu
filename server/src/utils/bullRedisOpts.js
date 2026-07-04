'use strict';

/**
 * buildBullRedisOpts — shared Redis connection options for Bull queues.
 *
 * Local Redis (dev) uses the raw connection URL. Non-local/managed Redis
 * (Upstash, Redis Cloud, etc.) requires explicit TLS + SNI options — passing
 * just the URL string to Bull/ioredis does not enable TLS for these providers.
 *
 * Used by every place a Bull queue is constructed (server/src/controllers/
 * document.controller.js, server/src/services/notification/documentQueueClient.js,
 * server/src/worker/worker.js) so the enqueue side and the consume side always
 * agree on how to reach Redis.
 *
 * @param {string} url  REDIS_URL, e.g. 'redis://localhost:6379' or 'rediss://user:pass@host:port'
 * @returns {object} Bull-compatible `redis` option value
 */
function buildBullRedisOpts(url) {
  const parsed = new URL(url.replace(/^rediss?:\/\//, 'http://'));
  const isLocal = ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname);
  if (isLocal) return { url };

  return {
    host:     parsed.hostname,
    port:     Number(parsed.port) || 6380,
    password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
    // rejectUnauthorized left at its secure default (true) — managed Redis
    // providers (Upstash, Redis Cloud, etc.) present valid certificates, and
    // disabling validation would let a network-level attacker MITM the
    // connection undetected. servername keeps SNI correct.
    tls:      { servername: parsed.hostname },
  };
}

module.exports = { buildBullRedisOpts };
