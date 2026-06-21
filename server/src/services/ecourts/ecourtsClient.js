const axios  = require('axios');
const logger = require('../../utils/logger');
const { CNR_REGEX } = require('../../config/constants');
const { getRedisClient } = require('../../config/redis');

// ─── Redis cache helpers ───────────────────────────────────────────────────────

const CACHE_TTL_SECONDS = 60 * 60; // 1 hour

async function getCached(cnr) {
  const rc = getRedisClient();
  if (!rc) return null;
  try {
    const raw = await rc.get(`ecourts:${cnr}`);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

async function setCache(cnr, data) {
  const rc = getRedisClient();
  if (!rc) return;
  try {
    await rc.setEx(`ecourts:${cnr}`, CACHE_TTL_SECONDS, JSON.stringify(data));
  } catch { /* cache write failure is non-fatal */ }
}

// ─── Circuit breaker (in-memory) ──────────────────────────────────────────────
// States: closed (normal) → open (short-circuiting) → half-open (probing)

const circuit = {
  state:       'closed',
  failures:    0,
  lastFailure: null,
  THRESHOLD:   5,            // open after 5 consecutive failures
  RESET_MS:    60 * 1000,    // try again after 1 minute

  isOpen() {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailure > this.RESET_MS) {
        this.state = 'half-open';
        return false;
      }
      return true;
    }
    return false;
  },

  success() {
    this.failures = 0;
    this.state    = 'closed';
  },

  failure() {
    this.failures++;
    this.lastFailure = Date.now();
    if (this.failures >= this.THRESHOLD) {
      this.state = 'open';
      logger.warn(`[ecourts] Circuit breaker OPEN after ${this.failures} failures`);
    }
  },
};

// ─── eCourts API config ────────────────────────────────────────────────────────

const ECOURTS_BASE      = process.env.ECOURTS_API_BASE   || 'https://services.ecourts.gov.in';
const SCRAPER_API_KEY   = process.env.SCRAPER_API_KEY    || null; // ScraperAPI rotating-proxy key
const BRIGHT_DATA_PROXY = process.env.BRIGHT_DATA_PROXY  || null; // http://user:pass@host:port
const REQUEST_TIMEOUT   = 15000;

const ECOURTS_HEADERS = {
  'User-Agent':      'Mozilla/5.0 (compatible; NyayaSetu/1.0; +https://nyayasetu.in)',
  'Accept':          'application/json, text/html;q=0.9, */*;q=0.8',
  'Accept-Language': 'en-IN,en;q=0.9',
  'Referer':         'https://services.ecourts.gov.in/',
  'Cache-Control':   'no-cache',
};

// ─── Proxy routing & retry helpers ────────────────────────────────────────────

/**
 * buildRequest — constructs an axios config that routes through ScraperAPI or
 * Bright Data when the respective env vars are set, falling back to a direct
 * request otherwise.
 */
function buildRequest(targetUrl, params = {}, extraHeaders = {}) {
  const headers = { ...ECOURTS_HEADERS, ...extraHeaders };

  if (SCRAPER_API_KEY) {
    const fullTarget = `${targetUrl}?${new URLSearchParams(params).toString()}`;
    return {
      method:         'get',
      url:            'https://api.scraperapi.com',
      params:         { api_key: SCRAPER_API_KEY, url: fullTarget, country_code: 'in' },
      headers,
      timeout:        REQUEST_TIMEOUT * 2, // ScraperAPI adds latency
      validateStatus: (s) => s < 500,
    };
  }

  if (BRIGHT_DATA_PROXY) {
    const proxyUrl = new URL(BRIGHT_DATA_PROXY);
    return {
      method:  'get',
      url:     targetUrl,
      params,
      headers,
      timeout: REQUEST_TIMEOUT,
      proxy: {
        protocol: proxyUrl.protocol.replace(':', ''),
        host:     proxyUrl.hostname,
        port:     parseInt(proxyUrl.port, 10),
        auth:     proxyUrl.username
          ? { username: decodeURIComponent(proxyUrl.username), password: decodeURIComponent(proxyUrl.password) }
          : undefined,
      },
      validateStatus: (s) => s < 500,
    };
  }

  return {
    method:         'get',
    url:            targetUrl,
    params,
    headers,
    timeout:        REQUEST_TIMEOUT,
    validateStatus: (s) => s < 500,
  };
}

/**
 * fetchWithRetry — wraps axios with exponential-backoff retries.
 * Delays: 2s, 4s, 8s across 3 attempts.
 */
async function fetchWithRetry(config, maxAttempts = 3) {
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await axios(config);
    } catch (err) {
      lastErr = err;
      if (attempt < maxAttempts) {
        const delay = 2000 * Math.pow(2, attempt - 1);
        logger.warn(`[ecourts] Attempt ${attempt}/${maxAttempts} failed (${err.message}). Retrying in ${delay}ms`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastErr;
}

// ─── CNR Validation ───────────────────────────────────────────────────────────

/**
 * validateCNR — strict format check for Case Number Registry numbers.
 * Format: 2 uppercase letters + 2 digits + 6 digits + 4-digit year
 * Example: DLHC010012342024
 */
function validateCNR(cnrNumber) {
  if (!cnrNumber || typeof cnrNumber !== 'string') return false;
  return CNR_REGEX.test(cnrNumber.trim().toUpperCase());
}

// ─── Mock data (dev fallback) ─────────────────────────────────────────────────

/**
 * getMockCaseData — realistic mock for development/testing.
 * Returns data that exercises all parts of the UI (3 past hearings, 1 upcoming).
 */
function getMockCaseData(cnrNumber) {
  const now       = new Date();
  const nextMonth = new Date(now);
  nextMonth.setDate(now.getDate() + 14);

  const twoMonthsAgo = new Date(now);
  twoMonthsAgo.setMonth(now.getMonth() - 2);

  const oneMonthAgo = new Date(now);
  oneMonthAgo.setMonth(now.getMonth() - 1);

  const twoWeeksAgo = new Date(now);
  twoWeeksAgo.setDate(now.getDate() - 14);

  // Extract state code from CNR for realistic court name
  const stateCode = cnrNumber?.slice(0, 2).toUpperCase() || 'DL';
  const courtMap  = {
    DL: 'Delhi High Court',
    MH: 'Bombay High Court',
    KA: 'Karnataka High Court',
    TN: 'Madras High Court',
    WB: 'Calcutta High Court',
    GJ: 'Gujarat High Court',
    RJ: 'Rajasthan High Court',
    UP: 'Allahabad High Court',
    AP: 'Andhra Pradesh High Court',
    TS: 'Telangana High Court',
  };

  return {
    cnrNumber,
    caseTitle:   'Rajesh Kumar Sharma vs State Consumer Disputes Redressal Commission',
    caseType:    'Consumer Complaint',
    caseNumber:  `CC/0123/${now.getFullYear()}`,
    filingDate:  twoMonthsAgo.toISOString(),
    court:       courtMap[stateCode] || 'District Court',
    bench:       'Hon\'ble Justice A.K. Singh',
    caseStatus:  'pending',
    parties: [
      { name: 'Rajesh Kumar Sharma', role: 'petitioner',  advocate: 'Adv. Priya Nair' },
      { name: 'XYZ Electronics Ltd', role: 'respondent',  advocate: 'Adv. Suresh Menon' },
    ],
    hearings: [
      {
        date:      twoMonthsAgo.toISOString(),
        purpose:   'Admission',
        status:    'held',
        judge:     'Hon\'ble Justice A.K. Singh',
        courtRoom: 'Court Room No. 7',
        orderText: 'Notice issued to respondent. Next date for filing reply.',
        nextDate:  oneMonthAgo.toISOString(),
      },
      {
        date:      oneMonthAgo.toISOString(),
        purpose:   'Filing of Reply',
        status:    'held',
        judge:     'Hon\'ble Justice A.K. Singh',
        courtRoom: 'Court Room No. 7',
        orderText: 'Respondent filed reply. Rejoinder to be filed by complainant.',
        nextDate:  twoWeeksAgo.toISOString(),
      },
      {
        date:      twoWeeksAgo.toISOString(),
        purpose:   'Rejoinder',
        status:    'held',
        judge:     'Hon\'ble Justice A.K. Singh',
        courtRoom: 'Court Room No. 7',
        orderText: 'Rejoinder filed. Arguments to be heard on next date.',
        nextDate:  nextMonth.toISOString(),
      },
      {
        date:    nextMonth.toISOString(),
        purpose: 'Arguments',
        status:  'scheduled',
        judge:   'Hon\'ble Justice A.K. Singh',
        courtRoom: 'Court Room No. 7',
      },
    ],
    nextHearingDate: nextMonth.toISOString(),
    _isMock:         true,
  };
}

// ─── Response parser ──────────────────────────────────────────────────────────

/**
 * parseCaseData — normalise eCourts raw API response to a consistent shape.
 *
 * The eCourts API returns different structures depending on court type
 * (HC vs DC vs tribunal). This normaliser handles the common variants.
 */
function parseCaseData(rawData, cnrNumber) {
  if (!rawData) return null;

  // If already mock-normalised, return as-is
  if (rawData._isMock) return rawData;

  // eCourts nested response shapes
  const caseInfo   = rawData.case_details || rawData.caseDetails || rawData;
  const hearingArr = rawData.history_details || rawData.hearings || rawData.caseHistory || [];
  const parties    = rawData.petitioner_advocate_details || rawData.parties || [];

  // Parse hearings into consistent format
  const hearings = (Array.isArray(hearingArr) ? hearingArr : []).map((h) => {
    const dateStr = h.hearing_date || h.date || h.next_hearing_date || null;
    return {
      date:      dateStr ? new Date(dateStr).toISOString() : null,
      purpose:   h.purpose_of_hearing || h.purpose || h.hearing_purpose || 'Hearing',
      status:    dateStr && new Date(dateStr) < new Date() ? 'held' : 'scheduled',
      judge:     h.coram || h.judge_name || null,
      courtRoom: h.court_room_no || h.court_number || null,
      orderText: h.order_text || h.judgment || null,
      nextDate:  h.next_hearing_date || null,
    };
  }).filter((h) => h.date); // Drop entries without dates

  // Sort hearings chronologically
  hearings.sort((a, b) => new Date(a.date) - new Date(b.date));

  // Determine next hearing (first future scheduled hearing)
  const upcomingHearings = hearings.filter(
    (h) => h.status === 'scheduled' && new Date(h.date) > new Date()
  );
  const nextHearingDate = upcomingHearings.length > 0
    ? upcomingHearings[0].date
    : null;

  return {
    cnrNumber:       cnrNumber || caseInfo.cnr_number || caseInfo.caseNumber,
    caseTitle:       caseInfo.case_title || caseInfo.caseTitle ||
                     `${caseInfo.petitioner_name || 'Party'} vs ${caseInfo.respondent_name || 'Respondent'}`,
    caseType:        caseInfo.case_type || caseInfo.caseType || null,
    caseNumber:      caseInfo.case_no || caseInfo.caseNo || caseInfo.case_number || null,
    filingDate:      caseInfo.filing_date ? new Date(caseInfo.filing_date).toISOString() : null,
    court:           caseInfo.court_name || caseInfo.courtName || null,
    courtCode:       caseInfo.court_code || null,
    bench:           caseInfo.coram || caseInfo.judge || null,
    caseStatus:      normalizeStatus(caseInfo.case_status || caseInfo.status),
    disposalDate:    caseInfo.disposal_date ? new Date(caseInfo.disposal_date).toISOString() : null,
    disposalType:    caseInfo.disposal_nature || null,
    parties:         parseParties(parties, rawData),
    hearings,
    nextHearingDate,
  };
}

function normalizeStatus(raw) {
  if (!raw) return 'unknown';
  const s = String(raw).toLowerCase().trim();
  if (s.includes('pending') || s.includes('active'))  return 'pending';
  if (s.includes('disposed') || s.includes('closed')) return 'disposed';
  if (s.includes('transferred'))                       return 'transferred';
  return 'pending';
}

function parseParties(partiesArr, rawData) {
  const parties = [];

  // Some eCourts responses embed petitioner/respondent at top level
  if (rawData.petitioner_name) {
    parties.push({
      name:      rawData.petitioner_name,
      role:      'petitioner',
      advocate:  rawData.petitioner_advocate || null,
    });
  }
  if (rawData.respondent_name) {
    parties.push({
      name:      rawData.respondent_name,
      role:      'respondent',
      advocate:  rawData.respondent_advocate || null,
    });
  }

  if (Array.isArray(partiesArr)) {
    partiesArr.forEach((p) => {
      if (!parties.find((ex) => ex.name === (p.name || p.petitioner_name))) {
        parties.push({
          name:     p.name || p.petitioner_name || p.respondent_name || 'Unknown',
          role:     p.role || (p.petitioner_name ? 'petitioner' : 'respondent'),
          advocate: p.advocate_name || p.advocate || null,
        });
      }
    });
  }

  return parties;
}

// ─── NJDG scraper fallback (prod) ─────────────────────────────────────────────

/**
 * scrapeNJDG — fallback HTML scraper for when the JSON API returns CAPTCHA.
 * Uses cheerio to parse the eCourts search page.
 */
async function scrapeNJDG(cnrNumber) {
  const cheerio = require('cheerio');

  const config   = buildRequest(
    `${ECOURTS_BASE}/ecourtindiaHC/cases/case_no`,
    { cnr_no: cnrNumber },
    { Accept: 'text/html' }
  );
  const response = await axios(config);

  const $ = cheerio.load(response.data);

  // eCourts uses specific table IDs — extract case details table
  const caseTitle   = $('#main_table td:contains("Case")').next().text().trim() ||
                      $('.case_heading').first().text().trim();
  const court       = $('#main_table td:contains("Court")').next().text().trim();
  const status      = $('#main_table td:contains("Status")').next().text().trim();

  // Extract hearing history from history_table
  const hearings = [];
  $('#history_table tbody tr').each((_, row) => {
    const cells = $(row).find('td');
    if (cells.length >= 3) {
      hearings.push({
        date:    $(cells[0]).text().trim(),
        purpose: $(cells[1]).text().trim(),
        status:  'held',
        judge:   $(cells[2]).text().trim() || null,
        orderText: $(cells[3])?.text().trim() || null,
      });
    }
  });

  return parseCaseData({ case_title: caseTitle, court_name: court, case_status: status, history_details: hearings }, cnrNumber);
}

// ─── Main API call ─────────────────────────────────────────────────────────────

/**
 * getCaseStatus — fetch case details from eCourts for a given CNR number.
 *
 * Tries the JSON API first. Falls back to:
 *   - NJDG scraper (prod)
 *   - Mock data (dev)
 *
 * @param {string} cnrNumber — e.g. "DLHC010012342024"
 * @returns {Promise<object>} — parsed case data
 */
async function getCaseStatus(cnrNumber) {
  const cnr = cnrNumber.trim().toUpperCase();

  if (!validateCNR(cnr)) {
    throw new Error(`Invalid CNR format: ${cnr}`);
  }

  logger.info(`[ecourts] Fetching case status for CNR: ${cnr}`);

  // ── Cache hit ─────────────────────────────────────────────────────────────
  const cached = await getCached(cnr);
  if (cached) {
    logger.info(`[ecourts] Cache hit for CNR: ${cnr}`);
    return cached;
  }

  // ── Circuit breaker check ─────────────────────────────────────────────────
  if (circuit.isOpen()) {
    logger.warn(`[ecourts] Circuit breaker OPEN — skipping API for CNR: ${cnr}`);
    if (process.env.NODE_ENV === 'development') return getMockCaseData(cnr);
    throw new Error('eCourts API is temporarily unavailable. Please try again later.');
  }

  // ── Primary: eCourts JSON API (via proxy if configured) ──────────────────
  try {
    const config   = buildRequest(`${ECOURTS_BASE}/ecourtindiaHC/cases/case_no`, { cnr_no: cnr });
    const response = await fetchWithRetry(config, 3);

    // Detect CAPTCHA or redirect (common eCourts anti-scraping measure)
    const isHtml      = typeof response.data === 'string';
    const hasCaptcha  = isHtml && response.data.toLowerCase().includes('captcha');
    const hasJson     = response.headers['content-type']?.includes('json');

    if (response.status === 200 && !hasCaptcha && (hasJson || typeof response.data === 'object')) {
      logger.info(`[ecourts] API returned JSON for CNR: ${cnr}`);
      const result = parseCaseData(response.data, cnr);
      circuit.success();
      await setCache(cnr, result);
      return result;
    }

    if (hasCaptcha) {
      logger.warn(`[ecourts] CAPTCHA detected for CNR: ${cnr} — falling back`);
    } else {
      logger.warn(`[ecourts] Unexpected response status ${response.status} for CNR: ${cnr}`);
    }
    circuit.failure();
  } catch (apiErr) {
    logger.warn(`[ecourts] Primary API error for CNR ${cnr}: ${apiErr.message}`);
    circuit.failure();
  }

  // ── Fallback: NJDG scraper (prod only) ────────────────────────────────────
  if (process.env.NODE_ENV === 'production') {
    try {
      logger.info(`[ecourts] Trying NJDG scraper for CNR: ${cnr}`);
      const scraped = await scrapeNJDG(cnr);
      if (scraped && scraped.caseTitle) {
        circuit.success();
        await setCache(cnr, scraped);
        return scraped;
      }
    } catch (scrapeErr) {
      logger.error(`[ecourts] NJDG scraper failed for CNR ${cnr}: ${scrapeErr.message}`);
    }
  }

  // ── Final fallback: mock data (dev) ───────────────────────────────────────
  if (process.env.NODE_ENV === 'development') {
    logger.info(`[ecourts] Using mock data for CNR: ${cnr} (dev mode)`);
    return getMockCaseData(cnr);
  }

  // If we reach here in production, the case truly couldn't be fetched
  throw new Error(
    `Unable to fetch case data for CNR: ${cnr}. ` +
    'The eCourts system may be temporarily unavailable. Please try again.'
  );
}

module.exports = { getCaseStatus, validateCNR, parseCaseData, getMockCaseData };
