const dns = require('dns');
const logger = require('../utils/logger');

const LOOPBACK = new Set(['127.0.0.1', '::1', '0.0.0.0']);

/**
 * Node's c-ares resolver on Windows reports 127.0.0.1 when the OS DNS server
 * is IPv6-only. Nothing listens on that port, so mongodb+srv SRV lookups fail
 * with querySrv ECONNREFUSED even though nslookup succeeds.
 * Only replaces the resolver when every configured server is loopback.
 */
function ensureDnsServers() {
  const current = dns.getServers();
  const usable = current.filter((server) => !LOOPBACK.has(server));
  if (usable.length > 0) return;

  const fromEnv = (process.env.DNS_SERVERS || '')
    .split(',')
    .map((server) => server.trim())
    .filter(Boolean);
  const fallback = fromEnv.length > 0 ? fromEnv : ['8.8.8.8', '1.1.1.1'];

  dns.setServers(fallback);
  logger.warn(
    `Node DNS resolver was ${current.join(', ') || 'empty'}. Using ${fallback.join(', ')} so MongoDB SRV lookup can succeed.`
  );
}

module.exports = { ensureDnsServers };
