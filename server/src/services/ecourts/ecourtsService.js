'use strict';

const logger = require('../../utils/logger');
const { getCaseStatus, validateCNR } = require('./ecourtsClient');

const STATE_CODE_MAP = {
  AP: 'Andhra Pradesh',
  AR: 'Arunachal Pradesh',
  AS: 'Assam',
  BR: 'Bihar',
  CG: 'Chhattisgarh',
  CH: 'Chandigarh',
  DL: 'Delhi',
  GA: 'Goa',
  GJ: 'Gujarat',
  HR: 'Haryana',
  HP: 'Himachal Pradesh',
  JH: 'Jharkhand',
  JK: 'Jammu & Kashmir',
  KA: 'Karnataka',
  KL: 'Kerala',
  LD: 'Lakshadweep',
  MH: 'Maharashtra',
  ML: 'Meghalaya',
  MN: 'Manipur',
  MP: 'Madhya Pradesh',
  MZ: 'Mizoram',
  NL: 'Nagaland',
  OD: 'Odisha',
  PB: 'Punjab',
  PY: 'Puducherry',
  RJ: 'Rajasthan',
  SK: 'Sikkim',
  TN: 'Tamil Nadu',
  TS: 'Telangana',
  TR: 'Tripura',
  UP: 'Uttar Pradesh',
  UK: 'Uttarakhand',
  WB: 'West Bengal',
};

function normalizeCNR(cnrNumber) {
  return String(cnrNumber || '').trim().toUpperCase().replace(/\s+/g, '');
}

function inferStateFromCNR(cnrNumber) {
  const code = normalizeCNR(cnrNumber).slice(0, 2);
  return STATE_CODE_MAP[code] || null;
}

function inferStateFromCourt(courtName) {
  if (!courtName) {
    return null;
  }

  const court = String(courtName).trim().toLowerCase();
  const directMatch = Object.values(STATE_CODE_MAP).find((state) =>
    court.includes(state.toLowerCase())
  );

  if (directMatch) {
    return directMatch;
  }

  if (court.includes('delhi high court')) return 'Delhi';
  if (court.includes('bombay high court')) return 'Maharashtra';
  if (court.includes('madras high court')) return 'Tamil Nadu';
  if (court.includes('calcutta high court')) return 'West Bengal';
  if (court.includes('allahabad high court')) return 'Uttar Pradesh';

  return null;
}

function inferDistrictFromCourt(courtName) {
  if (!courtName) {
    return null;
  }

  const directPatterns = [
    /district court(?:,|\sof)?\s+(.+)$/i,
    /district consumer disputes redressal commission(?:,|\sof)?\s+(.+)$/i,
    /family court(?:,|\sof)?\s+(.+)$/i,
    /court of .+ at\s+(.+)$/i,
  ];

  for (const pattern of directPatterns) {
    const match = String(courtName).match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  return null;
}

function extractPrimaryParties(parties = []) {
  const petitioner = parties.find((party) => party.role === 'petitioner') || null;
  const respondent = parties.find((party) => party.role === 'respondent') || null;

  return {
    petitioner: petitioner ? petitioner.name : null,
    respondent: respondent ? respondent.name : null,
  };
}

function sortHearings(hearings = []) {
  return [...hearings].sort((left, right) => new Date(left.date) - new Date(right.date));
}

function normalizeCasePayload(cnrNumber, caseData) {
  const hearings = sortHearings(caseData.hearings || []);
  const primaryParties = extractPrimaryParties(caseData.parties || []);
  const inferredState = inferStateFromCourt(caseData.court) || inferStateFromCNR(cnrNumber);
  const inferredDistrict = inferDistrictFromCourt(caseData.court);

  const nextHearingDate = caseData.nextHearingDate ||
    hearings.find((hearing) => hearing.status === 'scheduled' && new Date(hearing.date) > new Date())?.date ||
    null;

  return {
    ...caseData,
    cnrNumber: normalizeCNR(cnrNumber),
    state: inferredState,
    district: inferredDistrict,
    petitioner: primaryParties.petitioner,
    respondent: primaryParties.respondent,
    hearings,
    nextHearingDate,
    fetchedAt: new Date().toISOString(),
  };
}

async function fetchCaseByCNR(cnrNumber) {
  const cnr = normalizeCNR(cnrNumber);

  if (!validateCNR(cnr)) {
    const error = new Error('Invalid CNR format');
    error.code = 'INVALID_CNR';
    throw error;
  }

  try {
    const caseData = await getCaseStatus(cnr);

    if (!caseData) {
      const error = new Error(`No case data returned for CNR ${cnr}`);
      error.code = 'CASE_NOT_FOUND';
      throw error;
    }

    const normalized = normalizeCasePayload(cnr, caseData);

    logger.info('[ecourtsService] Case fetched successfully', {
      cnr,
      caseTitle: normalized.caseTitle,
      court: normalized.court,
      nextHearingDate: normalized.nextHearingDate,
      isMock: normalized._isMock || false,
    });

    return normalized;
  } catch (error) {
    logger.error('[ecourtsService] Failed to fetch case by CNR', {
      cnr,
      error: error.message,
    });

    if (!error.code) {
      error.code = 'ECOURTS_FETCH_FAILED';
    }

    throw error;
  }
}

async function refreshCaseByCNR(cnrNumber) {
  return fetchCaseByCNR(cnrNumber);
}

function summarizeCase(caseData) {
  if (!caseData) {
    return null;
  }

  return {
    cnrNumber: caseData.cnrNumber,
    caseTitle: caseData.caseTitle,
    court: caseData.court,
    state: caseData.state || null,
    district: caseData.district || null,
    petitioner: caseData.petitioner || null,
    respondent: caseData.respondent || null,
    nextHearingDate: caseData.nextHearingDate || null,
    caseStatus: caseData.caseStatus || 'unknown',
    hearingCount: Array.isArray(caseData.hearings) ? caseData.hearings.length : 0,
    isMock: Boolean(caseData._isMock),
  };
}

module.exports = {
  fetchCaseByCNR,
  refreshCaseByCNR,
  summarizeCase,
  validateCNR,
};
