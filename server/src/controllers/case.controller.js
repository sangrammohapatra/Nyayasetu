const CaseTracker  = require('../models/CaseTracker.model');
const User         = require('../models/User.model');
const Notification = require('../models/Notification.model');
const AuditLog     = require('../models/AuditLog.model');
const LawyerProfile = require('../models/LawyerProfile.model');
const { getCaseStatus, validateCNR } = require('../services/ecourts/ecourtsClient');
const asyncHandler  = require('../utils/asyncHandler');
const { createError } = require('../middleware/error.middleware');
const logger        = require('../utils/logger');
const { CNR_REGEX } = require('../config/constants');

// ─── Data freshness helper ────────────────────────────────────────────────────

/**
 * computeDataFreshness — converts lastSyncedAt into a human-readable staleness
 * label and boolean flags for the API response.
 */
function computeDataFreshness(lastSyncedAt) {
  if (!lastSyncedAt) {
    return { label: 'Not yet synced', isStale: true, isCacheExpired: false };
  }

  const diffMs   = Date.now() - new Date(lastSyncedAt).getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHrs  = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  let label;
  if (diffMins < 5)       label = 'Updated just now';
  else if (diffHrs < 1)   label = `Updated ${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
  else if (diffHrs < 24)  label = `Updated ${diffHrs} hour${diffHrs !== 1 ? 's' : ''} ago`;
  else if (diffDays < 30) label = `Updated ${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  else                    label = 'Data not refreshed in over 30 days';

  return {
    label,
    isStale:        diffHrs >= 24,
    isCacheExpired: diffDays >= 30,
  };
}

// ─── addCase ──────────────────────────────────────────────────────────────────

/**
 * POST /v1/cases
 *
 * Validate CNR → quota check → duplicate check → eCourts fetch → create document.
 */
const addCase = asyncHandler(async (req, res) => {
  const { userId } = req.user;
  const { cnrNumber, state, district, alertDaysBefore = 1, alertChannels = {} } = req.body;

  // ── CNR validation ─────────────────────────────────────────────────────────
  if (!cnrNumber) throw createError(400, 'CNR_REQUIRED', 'CNR number is required');

  const cnr = cnrNumber.trim().toUpperCase();
  if (!validateCNR(cnr)) {
    throw createError(400, 'INVALID_CNR',
      'Invalid CNR format. Expected: 4 letters + 2 digits + 6 digits + 4-digit year (e.g. DLHC010012342024)');
  }

  // ── Load user for quota check ──────────────────────────────────────────────
  const user = await User.findById(userId).select('freeUsage subscription state district email phone whatsappNumber whatsappOptIn');
  if (!user) throw createError(404, 'USER_NOT_FOUND', 'User not found');

  const now = new Date();
  const isSubscribed =
    user.subscription?.plan &&
    user.subscription.plan !== 'free' &&
    user.subscription?.validUntil &&
    now < new Date(user.subscription.validUntil);

  // ── Duplicate check ────────────────────────────────────────────────────────
  // Runs before the quota claim so a duplicate CNR never wastes a free slot.
  const existing = await CaseTracker.findOne({ user: userId, cnrNumber: cnr });
  if (existing) {
    return res.status(409).json({
      error:   'DUPLICATE_CASE',
      message: 'You are already tracking this case.',
      caseId:  existing._id,
    });
  }

  // ── Atomically claim a free-tier quota slot ───────────────────────────────
  // Replaces the old read-then-later-increment: two concurrent addCase calls
  // could both read used < limit before either incremented, letting a
  // free-tier user exceed casesLimit.
  if (!isSubscribed) {
    const quotaLimit = user.freeUsage?.casesLimit ?? 1;
    const quotaClaimed = await User.findOneAndUpdate(
      { _id: userId, 'freeUsage.casesTracked': { $lt: quotaLimit } },
      { $inc: { 'freeUsage.casesTracked': 1 } },
      { new: true }
    );
    if (!quotaClaimed) {
      return res.status(403).json({
        error:      'QUOTA_EXCEEDED',
        message:    `Free plan allows tracking ${quotaLimit} case. Upgrade to track more cases.`,
        used:       user.freeUsage?.casesTracked ?? 0,
        limit:      quotaLimit,
        upgradeUrl: '/pricing',
      });
    }
  }

  // ── Fetch from eCourts ─────────────────────────────────────────────────────
  let ecourtsData = null;
  try {
    ecourtsData = await getCaseStatus(cnr);
  } catch (err) {
    logger.warn(`[case/add] eCourts fetch failed for ${cnr}: ${err.message}`);
    // Don't block case creation if eCourts is down — user can refresh later
  }

  // ── Determine state from CNR prefix or user's state ───────────────────────
  const resolvedState = state ||
    ecourtsData?.court?.split(' ')[0] || // e.g. "Delhi High Court" → "Delhi"
    user.state ||
    null;

  // ── Create CaseTracker document ────────────────────────────────────────────
  let caseDoc;
  try {
    caseDoc = await CaseTracker.create({
      user:         userId,
      cnrNumber:    cnr,
      caseTitle:    ecourtsData?.caseTitle    || `Case ${cnr}`,
      caseType:     ecourtsData?.caseType     || null,
      caseNumber:   ecourtsData?.caseNumber   || null,
      filingDate:   ecourtsData?.filingDate   || null,
      court:        ecourtsData?.court        || null,
      courtCode:    ecourtsData?.courtCode    || null,
      bench:        ecourtsData?.bench        || null,
      state:        resolvedState,
      district:     district || user.district || null,
      parties:      ecourtsData?.parties      || [],
      hearings:     ecourtsData?.hearings     || [],
      nextHearingDate: ecourtsData?.nextHearingDate || null,
      caseStatus:   ecourtsData?.caseStatus   || 'pending',
      alertDaysBefore: Math.min(7, Math.max(1, alertDaysBefore)),
      alertChannels: {
        whatsapp: alertChannels.whatsapp ?? (user.whatsappOptIn || false),
        email:    alertChannels.email    ?? false,
        web:      alertChannels.web      ?? true,
      },
      alertsEnabled: true,
      lastSyncedAt:  ecourtsData ? new Date() : null,
      rawEcourtsData: ecourtsData || null,
      countedTowardFreeQuota: !isSubscribed,
    });
  } catch (err) {
    // Release the claimed slot — nothing was actually created.
    if (!isSubscribed) {
      await User.findByIdAndUpdate(userId, { $inc: { 'freeUsage.casesTracked': -1 } });
    }
    throw err;
  }

  await AuditLog.log(req, 'case.added', 'CaseTracker', caseDoc._id, { cnrNumber: cnr });

  res.status(201).json({
    message:  'Case added successfully',
    case:     sanitizeCase(caseDoc),
    fetched:  !!ecourtsData,
    _isMock:  ecourtsData?._isMock || false,
  });
});

// ─── listCases ────────────────────────────────────────────────────────────────

/**
 * GET /v1/cases
 */
const VALID_CASE_STATUSES = ['pending', 'disposed', 'transferred', 'unknown'];

const listCases = asyncHandler(async (req, res) => {
  const { userId } = req.user;

  const page  = Math.max(1, parseInt(req.query.page)  || 1);
  const limit = Math.min(100, parseInt(req.query.limit) || 20);
  const { caseStatus } = req.query;
  const filter = { user: userId, isActive: true };

  // Default view hides disposed (concluded) cases so a case that ended years
  // ago doesn't clutter the active dashboard. ?caseStatus=disposed views the
  // archive; ?caseStatus=all (or any other valid status) opts out of the default.
  if (caseStatus === 'all') {
    // no additional filter
  } else if (caseStatus && VALID_CASE_STATUSES.includes(caseStatus)) {
    filter.caseStatus = caseStatus;
  } else {
    filter.caseStatus = { $ne: 'disposed' };
  }

  const [cases, total, disposedCount] = await Promise.all([
    CaseTracker.find(filter)
      .select('-rawEcourtsData')
      .sort({ nextHearingDate: 1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    CaseTracker.countDocuments(filter),
    // Lets the UI show an "Archived (n)" tab count without a second round trip.
    CaseTracker.countDocuments({ user: userId, isActive: true, caseStatus: 'disposed' }),
  ]);

  const enriched = cases.map((c) => {
    const freshness = computeDataFreshness(c.lastSyncedAt);
    const daysUntilNextHearing = c.nextHearingDate
      ? Math.ceil((new Date(c.nextHearingDate) - new Date()) / (1000 * 60 * 60 * 24))
      : null;
    return {
      ...c,
      daysUntilNextHearing,
      isHearingSoon:  daysUntilNextHearing !== null && daysUntilNextHearing <= (c.alertDaysBefore || 1),
      dataFreshness:  freshness.label,
      isDataStale:    freshness.isStale,
    };
  });

  res.json({
    cases: enriched,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    hasMore:    page * limit < total,
    disposedCount,
  });
});

// ─── getCaseDetail ────────────────────────────────────────────────────────────

/**
 * GET /v1/cases/:id
 */
const getCaseDetail = asyncHandler(async (req, res) => {
  const { id: caseId } = req.params;
  const { userId }     = req.user;

  const caseDoc = await CaseTracker.findById(caseId)
    .populate('sharedWithLawyer', 'name email phone')
    .populate('linkedDocuments',  'title templateSlug createdAt isPaid')
    .select('-rawEcourtsData');

  if (!caseDoc)                      throw createError(404, 'CASE_NOT_FOUND', 'Case not found');
  if (!caseDoc.user.equals(userId))  throw createError(403, 'FORBIDDEN', 'This case does not belong to you');

  const freshness = computeDataFreshness(caseDoc.lastSyncedAt);
  const caseObj   = caseDoc.toObject();
  caseObj.daysUntilNextHearing = caseDoc.daysUntilNextHearing;
  caseObj.isHearingSoon        = caseDoc.isHearingSoon;
  caseObj.dataFreshness        = freshness.label;
  caseObj.isDataStale          = freshness.isStale;

  res.json({ case: caseObj });
});

// ─── refreshCase ─────────────────────────────────────────────────────────────

/**
 * POST /v1/cases/:id/refresh
 *
 * Re-fetch from eCourts and merge new hearings into the existing record.
 */
const refreshCase = asyncHandler(async (req, res) => {
  const { id: caseId } = req.params;
  const { userId }     = req.user;

  const caseDoc = await CaseTracker.findById(caseId);
  if (!caseDoc)                      throw createError(404, 'CASE_NOT_FOUND', 'Case not found');
  if (!caseDoc.user.equals(userId))  throw createError(403, 'FORBIDDEN', 'Access denied');

  let ecourtsData  = null;
  let refreshed    = true;
  let refreshError = null;

  try {
    ecourtsData = await getCaseStatus(caseDoc.cnrNumber);
  } catch (err) {
    logger.error(`[case/refresh] eCourts fetch failed: ${err.message}`);
    refreshed    = false;
    refreshError = 'eCourts system is temporarily unavailable. Showing last known data.';
    // Persist the error so the cron job can skip recently-failed cases
    await CaseTracker.updateOne({ _id: caseDoc._id }, { $set: { syncError: err.message } });
  }

  if (refreshed && ecourtsData) {
    await caseDoc.updateFromEcourts(ecourtsData);
  }

  await AuditLog.log(req, 'case.refreshed', 'CaseTracker', caseDoc._id, {
    cnrNumber: caseDoc.cnrNumber,
    refreshed,
  });

  const freshness = computeDataFreshness(caseDoc.lastSyncedAt);

  res.json({
    message:       refreshed ? 'Case refreshed successfully' : 'Showing last known data',
    case:          sanitizeCase(caseDoc),
    refreshed,
    dataFreshness: freshness.label,
    isDataStale:   freshness.isStale,
    ...(refreshError && { refreshError }),
    _isMock:       ecourtsData?._isMock || false,
  });
});

// ─── updateAlerts ─────────────────────────────────────────────────────────────

/**
 * PATCH /v1/cases/:id/alerts
 */
const updateAlerts = asyncHandler(async (req, res) => {
  const { id: caseId } = req.params;
  const { userId }     = req.user;
  const { alertDaysBefore, alertChannels, alertsEnabled } = req.body;

  const caseDoc = await CaseTracker.findById(caseId);
  if (!caseDoc)                      throw createError(404, 'CASE_NOT_FOUND', 'Case not found');
  if (!caseDoc.user.equals(userId))  throw createError(403, 'FORBIDDEN', 'Access denied');

  if (alertDaysBefore !== undefined) {
    caseDoc.alertDaysBefore = Math.min(7, Math.max(1, parseInt(alertDaysBefore)));
  }
  if (alertChannels !== undefined) {
    caseDoc.alertChannels = {
      whatsapp: alertChannels.whatsapp ?? caseDoc.alertChannels.whatsapp,
      email:    alertChannels.email    ?? caseDoc.alertChannels.email,
      web:      alertChannels.web      ?? caseDoc.alertChannels.web,
    };
  }
  if (alertsEnabled !== undefined) {
    caseDoc.alertsEnabled = Boolean(alertsEnabled);
  }

  await caseDoc.save();

  await AuditLog.log(req, 'case.alerts.updated', 'CaseTracker', caseDoc._id, {
    alertDaysBefore: caseDoc.alertDaysBefore,
    alertChannels:   caseDoc.alertChannels,
    alertsEnabled:   caseDoc.alertsEnabled,
  });

  res.json({
    message:       'Alert settings updated',
    alertDaysBefore: caseDoc.alertDaysBefore,
    alertChannels:   caseDoc.alertChannels,
    alertsEnabled:   caseDoc.alertsEnabled,
  });
});

// ─── shareWithLawyer ─────────────────────────────────────────────────────────

/**
 * POST /v1/cases/:id/share-lawyer
 */
const shareWithLawyer = asyncHandler(async (req, res) => {
  const { id: caseId } = req.params;
  const { userId }     = req.user;
  const { lawyerId }   = req.body;

  if (!lawyerId) throw createError(400, 'LAWYER_ID_REQUIRED', 'lawyerId is required');

  const [caseDoc, lawyerProfile] = await Promise.all([
    CaseTracker.findById(caseId),
    LawyerProfile.findOne({ user: lawyerId, isVerified: true }).populate('user', 'name email phone whatsappNumber'),
  ]);

  if (!caseDoc)                      throw createError(404, 'CASE_NOT_FOUND', 'Case not found');
  if (!caseDoc.user.equals(userId))  throw createError(403, 'FORBIDDEN', 'Access denied');
  if (!lawyerProfile)                throw createError(404, 'LAWYER_NOT_FOUND', 'Verified lawyer not found');

  caseDoc.sharedWithLawyer = lawyerId;
  caseDoc.sharedAt         = new Date();
  await caseDoc.save();

  // Notify the lawyer
  const lawyer = lawyerProfile.user;
  const io     = req.app.get('io');

  await Notification.createForUser({
    userId:    lawyerId,
    type:      'case_updated',
    title:     'Case Shared With You',
    body:      `A client has shared their case "${caseDoc.caseTitle}" with you for review.`,
    data:      { caseId: caseDoc._id, cnrNumber: caseDoc.cnrNumber },
    actionUrl: `/lawyer/cases/${caseDoc._id}`,
    channel:   'web',
    priority:  'normal',
    io,
  });

  // WhatsApp notification if lawyer has number
  if (lawyer?.phone || lawyer?.whatsappNumber) {
    try {
      const { sendSMS } = require('../services/notification/smsService');
      const phone = lawyer.whatsappNumber || lawyer.phone;
      await sendSMS(phone,
        `NyayaSetu: A client has shared case "${caseDoc.caseTitle}" (CNR: ${caseDoc.cnrNumber}) with you. Log in to review.`
      );
    } catch (smsErr) {
      logger.warn('[case/shareWithLawyer] SMS notification failed:', { error: smsErr.message });
    }
  }

  await AuditLog.log(req, 'case.shared_with_lawyer', 'CaseTracker', caseDoc._id, { lawyerId });

  res.json({
    message:  'Case shared with lawyer successfully',
    lawyerName: lawyer?.name,
    sharedAt:   caseDoc.sharedAt,
  });
});

// ─── removeCase ───────────────────────────────────────────────────────────────

/**
 * DELETE /v1/cases/:id
 */
const removeCase = asyncHandler(async (req, res) => {
  const { id: caseId } = req.params;
  const { userId } = req.user;

  const caseDoc = await CaseTracker.findById(caseId);
  if (!caseDoc)                      throw createError(404, 'CASE_NOT_FOUND', 'Case not found');
  if (!caseDoc.user.equals(userId))  throw createError(403, 'FORBIDDEN', 'Access denied');
  if (!caseDoc.isActive)             return res.json({ message: 'Case already removed' });

  caseDoc.isActive = false;
  await caseDoc.save();

  // Decrement only if this specific case originally consumed a free-tier
  // quota slot — using the user's *current* subscription status here would
  // let a case added while subscribed decrement a counter it never incremented,
  // driving it negative and granting extra free slots.
  if (caseDoc.countedTowardFreeQuota) {
    await User.findByIdAndUpdate(userId, {
      $inc: { 'freeUsage.casesTracked': -1 },
    });
  }

  await AuditLog.log(req, 'case.removed', 'CaseTracker', caseDoc._id, { cnrNumber: caseDoc.cnrNumber });

  res.json({ message: 'Case removed successfully', caseId });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sanitizeCase(caseDoc) {
  const obj = caseDoc.toObject ? caseDoc.toObject() : { ...caseDoc };
  delete obj.rawEcourtsData;
  return obj;
}

module.exports = {
  addCase,
  listCases,
  getCaseDetail,
  refreshCase,
  updateAlerts,
  shareWithLawyer,
  removeCase,
};
