const axios  = require('axios');
const crypto = require('crypto');
const logger = require('../../utils/logger');

// ─── Config ────────────────────────────────────────────────────────────────────

const KANOON_BASE    = 'https://api.indiankanoon.org';
const CACHE_TTL_SECS = 86400; // 24 hours
const REQUEST_TIMEOUT = 12000;

// ─── Cache helpers ─────────────────────────────────────────────────────────────

function queryCacheKey(query) {
  const hash = crypto.createHash('sha256').update(query).digest('hex').slice(0, 16);
  return `kanoon:${hash}`;
}

async function getFromCache(key) {
  try {
    const { redisClient } = require('../../config/redis');
    if (!redisClient || redisClient.status !== 'ready') return null;
    const cached = await redisClient.get(key);
    if (!cached) return null;
    return JSON.parse(cached);
  } catch {
    return null; // Cache miss is non-fatal
  }
}

async function setInCache(key, data) {
  try {
    const { redisClient } = require('../../config/redis');
    if (!redisClient || redisClient.status !== 'ready') return;
    if (typeof redisClient.setEx === 'function') {
      await redisClient.setEx(key, CACHE_TTL_SECS, JSON.stringify(data));
    } else if (typeof redisClient.setex === 'function') {
      await redisClient.setex(key, CACHE_TTL_SECS, JSON.stringify(data));
    } else {
      await redisClient.set(key, JSON.stringify(data), 'EX', CACHE_TTL_SECS);
    }
  } catch {
    // Cache write failure is non-fatal
  }
}

// ─── HTTP client ───────────────────────────────────────────────────────────────

function getHeaders() {
  const apiKey = process.env.INDIANKANOON_API_KEY;
  if (!apiKey) {
    logger.warn('[kanoon] INDIANKANOON_API_KEY not set — requests may fail');
  }
  return {
    'Authorization': `Token ${apiKey || ''}`,
    'Accept':        'application/json',
    'Content-Type':  'application/x-www-form-urlencoded',
    'User-Agent':    'NyayaSetu/1.0 (+https://nyayasetu.in)',
  };
}

// ─── Response normaliser ───────────────────────────────────────────────────────

function normalizeResults(rawResults) {
  if (!Array.isArray(rawResults)) return [];

  return rawResults.map((doc) => ({
    docId:       String(doc.tid   || doc.docid || doc.doc_id || ''),
    title:       String(doc.title || doc.doc_title || '').trim(),
    headline:    String(doc.headline || doc.snippet || doc.summary || '').trim(),
    publishdate: doc.publishdate || doc.date || doc.judgment_date || null,
    doctype:     String(doc.doctype || doc.doc_type || 'judgment').toLowerCase(),
    court:       String(doc.docsource || doc.court || '').trim(),
    citation:    String(doc.citation || '').trim(),
    // Canonical URL the user can visit
    url:         doc.tid ? `https://indiankanoon.org/doc/${doc.tid}/` : null,
  }));
}

// ─── searchLaw ────────────────────────────────────────────────────────────────

/**
 * searchLaw — full-text search across Indian Kanoon's case law database.
 *
 * Caches results in Redis for 24h to respect API rate limits and reduce latency.
 *
 * @param {string} query     — search terms (act name, section number, keywords)
 * @param {number} pagenum   — 0-based page (10 results per page)
 * @returns {Promise<{ results, total, pagenum, query }>}
 */
async function searchLaw(query, pagenum = 0) {
  if (!query || !query.trim()) throw new Error('Search query is required');

  const trimmedQuery = query.trim();
  const cacheKey     = queryCacheKey(`search:${trimmedQuery}:${pagenum}`);

  // Try cache first
  const cached = await getFromCache(cacheKey);
  if (cached) {
    logger.debug(`[kanoon] Cache hit for query: "${trimmedQuery}", page: ${pagenum}`);
    return cached;
  }

  logger.info(`[kanoon] Searching: "${trimmedQuery}", page: ${pagenum}`);

  try {
    // Indian Kanoon uses form-encoded POST for search
    const params = new URLSearchParams({
      formInput: trimmedQuery,
      pagenum:   String(pagenum),
    });

    const response = await axios.post(
      `${KANOON_BASE}/search/`,
      params.toString(),
      {
        headers: getHeaders(),
        timeout: REQUEST_TIMEOUT,
      }
    );

    const raw     = response.data;
    const results = normalizeResults(raw.docs || raw.results || []);

    const payload = {
      results,
      total:   raw.total   || raw.total_results || results.length,
      pagenum,
      query:   trimmedQuery,
      source:  'api',
    };

    await setInCache(cacheKey, payload);
    logger.info(`[kanoon] Search returned ${results.length} results for: "${trimmedQuery}"`);
    return payload;
  } catch (err) {
    // Return empty results rather than throwing — search is supplementary
    logger.error(`[kanoon] Search failed for "${trimmedQuery}": ${err.message}`);

    if (err.response?.status === 401) {
      throw new Error('Indian Kanoon API authentication failed. Check INDIANKANOON_API_KEY.');
    }

    // Return graceful empty on other errors
    return { results: [], total: 0, pagenum, query: trimmedQuery, error: err.message };
  }
}

// ─── getDocument ─────────────────────────────────────────────────────────────

/**
 * getDocument — fetch the full text of a specific judgment or act.
 *
 * @param {string|number} docId — Indian Kanoon document TID
 * @returns {Promise<object>}
 */
async function getDocument(docId) {
  if (!docId) throw new Error('docId is required');

  const cacheKey = queryCacheKey(`doc:${docId}`);

  const cached = await getFromCache(cacheKey);
  if (cached) {
    logger.debug(`[kanoon] Cache hit for docId: ${docId}`);
    return cached;
  }

  logger.info(`[kanoon] Fetching document: ${docId}`);

  try {
    const response = await axios.get(
      `${KANOON_BASE}/doc/${docId}/`,
      {
        headers: { ...getHeaders(), 'Content-Type': 'application/json' },
        timeout: REQUEST_TIMEOUT,
      }
    );

    const doc = response.data;
    const payload = {
      docId:       String(docId),
      title:       doc.title || '',
      content:     doc.doc || doc.content || doc.text || '',
      publishdate: doc.publishdate || null,
      doctype:     doc.doctype || 'judgment',
      court:       doc.docsource || doc.court || '',
      citation:    doc.citation || '',
      url:         `https://indiankanoon.org/doc/${docId}/`,
    };

    // Cache documents longer — they rarely change
    await setInCache(cacheKey, { ...payload, _cachedAt: new Date().toISOString() });
    return payload;
  } catch (err) {
    logger.error(`[kanoon] getDocument ${docId} failed: ${err.message}`);
    throw err;
  }
}

// ─── searchActSection ─────────────────────────────────────────────────────────

/**
 * searchActSection — convenience method that builds an optimal query for
 * finding cases interpreting a specific act section.
 *
 * Used by documentEngine.js to enrich legalCitations with case law.
 *
 * @param {string} actName       — e.g. "Consumer Protection Act 2019"
 * @param {string} sectionNumber — e.g. "35" or "12(1)(a)"
 * @param {number} pagenum
 * @returns {Promise<object>}
 */
async function searchActSection(actName, sectionNumber, pagenum = 0) {
  // Build a precise query using Indian Kanoon's field syntax
  // "doctypes:legislation" or "doctypes:judgments"
  const query = sectionNumber
    ? `"section ${sectionNumber}" "${actName}"`
    : `"${actName}"`;

  return searchLaw(query, pagenum);
}

/**
 * searchByAct — get all judgments citing a given act (useful for jurisdiction research).
 *
 * @param {string} actName  — short or full name
 * @param {number} pagenum
 */
async function searchByAct(actName, pagenum = 0) {
  return searchLaw(`"${actName}" doctypes:judgments`, pagenum);
}

module.exports = {
  searchLaw,
  getDocument,
  searchActSection,
  searchByAct,
};
