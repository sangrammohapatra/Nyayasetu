'use strict';

const RTIApplication    = require('../models/RTIApplication.model');
const AuditLog          = require('../models/AuditLog.model');
const rtiAIService      = require('../services/ai/rtiAIService');
const rtiPdfService     = require('../services/pdf/rtiPdfService');
const { CENTRAL_MINISTRIES, STATE_DEPARTMENTS, CIC_INFO, searchMinistries } = require('../data/rtiMinistries');
const asyncHandler      = require('../utils/asyncHandler');
const { createError }   = require('../middleware/error.middleware');
const logger            = require('../utils/logger');

// ─── listRTIs ─────────────────────────────────────────────────────────────────

/**
 * GET /v1/rti
 */
const listRTIs = asyncHandler(async (req, res) => {
  const { userId } = req.user;
  const { status, page = 1, limit = 20 } = req.query;

  const filter = { user: userId, isActive: true };
  if (status) filter.status = status;

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [rtis, total] = await Promise.all([
    RTIApplication.find(filter)
      .select('-__v')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean(),
    RTIApplication.countDocuments(filter),
  ]);

  // Enrich with computed fields
  const enriched = rtis.map((rti) => {
    const now = new Date();
    const deadline = rti.responseDeadline ? new Date(rti.responseDeadline) : null;
    const daysLeft = deadline ? Math.ceil((deadline - now) / (1000 * 60 * 60 * 24)) : null;

    let urgency = 'none';
    if (deadline && ['filed', 'first_appeal_due'].includes(rti.status)) {
      if (daysLeft < 0) urgency = 'overdue';
      else if (daysLeft <= 3) urgency = 'critical';
      else if (daysLeft <= 7) urgency = 'warning';
      else urgency = 'normal';
    }

    return { ...rti, daysUntilDeadline: daysLeft, deadlineUrgency: urgency };
  });

  res.json({ rtis: enriched, total, page: parseInt(page), limit: parseInt(limit) });
});

// ─── getRTIDetail ─────────────────────────────────────────────────────────────

/**
 * GET /v1/rti/:id
 */
const getRTIDetail = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { userId } = req.user;

  const rti = await RTIApplication.findById(id).lean();
  if (!rti) throw createError(404, 'RTI_NOT_FOUND', 'RTI application not found');
  if (rti.user.toString() !== userId) throw createError(403, 'FORBIDDEN', 'Access denied');

  const now = new Date();
  const deadline = rti.responseDeadline ? new Date(rti.responseDeadline) : null;
  const daysLeft = deadline ? Math.ceil((deadline - now) / (1000 * 60 * 60 * 24)) : null;
  let urgency = 'none';
  if (deadline && ['filed', 'first_appeal_due'].includes(rti.status)) {
    if (daysLeft < 0) urgency = 'overdue';
    else if (daysLeft <= 3) urgency = 'critical';
    else if (daysLeft <= 7) urgency = 'warning';
    else urgency = 'normal';
  }

  res.json({ rti: { ...rti, daysUntilDeadline: daysLeft, deadlineUrgency: urgency } });
});

// ─── aiDraftRTI ──────────────────────────────────────────────────────────────

/**
 * POST /v1/rti/ai-draft
 *
 * AI generates an RTI application from a plain-language description.
 * Does NOT save to DB — returns the draft for user review.
 */
const aiDraftRTI = asyncHandler(async (req, res) => {
  const { description, language = 'en' } = req.body;

  if (!description || description.trim().length < 10) {
    throw createError(400, 'DESCRIPTION_REQUIRED', 'Please describe what information you need');
  }

  const draft = await rtiAIService.draftApplication({ description, language });

  logger.info(`[rti/aiDraft] AI draft generated for user ${req.user.userId}`);
  res.json({ draft });
});

// ─── createRTI ───────────────────────────────────────────────────────────────

/**
 * POST /v1/rti
 *
 * Save a (possibly AI-drafted) RTI application.
 */
const createRTI = asyncHandler(async (req, res) => {
  const { userId } = req.user;
  const {
    title, description, govLevel, state,
    ministry, department,
    pioName, pioDesignation, pioAddress, pioEmail, pioPhone,
    subjects,
    applicantName, applicantAddress, applicantPhone, applicantEmail, applicantBpl,
    feeAmount, feeMode, feeStatus,
    aiDrafted, notes,
  } = req.body;

  if (!title || !title.trim()) throw createError(400, 'TITLE_REQUIRED', 'RTI title is required');
  if (!subjects || !Array.isArray(subjects) || subjects.length === 0) {
    throw createError(400, 'SUBJECTS_REQUIRED', 'At least one RTI question is required');
  }
  if (!ministry) throw createError(400, 'MINISTRY_REQUIRED', 'Ministry/Department is required');
  if (!pioAddress) throw createError(400, 'ADDRESS_REQUIRED', 'PIO address is required');

  const rti = await RTIApplication.create({
    user:             userId,
    title:            title.trim(),
    description:      description?.trim(),
    govLevel:         govLevel || 'central',
    state:            state?.trim(),
    ministry:         ministry.trim(),
    department:       department?.trim(),
    pioName:          pioName?.trim(),
    pioDesignation:   pioDesignation?.trim(),
    pioAddress:       pioAddress.trim(),
    pioEmail:         pioEmail?.trim().toLowerCase(),
    pioPhone:         pioPhone?.trim(),
    subjects:         subjects.map((s) => s.trim()).filter(Boolean),
    applicantName:    applicantName?.trim(),
    applicantAddress: applicantAddress?.trim(),
    applicantPhone:   applicantPhone?.trim(),
    applicantEmail:   applicantEmail?.trim().toLowerCase(),
    applicantBpl:     applicantBpl || false,
    feeAmount:        feeAmount || (applicantBpl ? 0 : 10),
    feeMode:          feeMode || 'online',
    feeStatus:        feeStatus || 'pending',
    aiDrafted:        aiDrafted || false,
    notes:            notes?.trim(),
    status:           'drafted',
  });

  await AuditLog.log(req, 'rti.created', 'RTIApplication', rti._id, { ministry, govLevel });
  logger.info(`[rti/create] RTI created: ${rti._id}, user: ${userId}`);

  res.status(201).json({ message: 'RTI application created', rti });
});

// ─── markAsFiled ─────────────────────────────────────────────────────────────

/**
 * PATCH /v1/rti/:id/file
 *
 * Mark an RTI as filed — sets filedDate, responseDeadline, and status → filed.
 */
const markAsFiled = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { userId } = req.user;
  const { filedDate, referenceNumber, feeMode, feeStatus } = req.body;

  const rti = await RTIApplication.findById(id);
  if (!rti) throw createError(404, 'RTI_NOT_FOUND', 'RTI application not found');
  if (rti.user.toString() !== userId) throw createError(403, 'FORBIDDEN', 'Access denied');
  if (rti.status !== 'drafted') {
    throw createError(400, 'INVALID_STATUS', 'Only drafted applications can be marked as filed');
  }

  rti.filedDate = filedDate ? new Date(filedDate) : new Date();
  if (referenceNumber) rti.referenceNumber = referenceNumber.trim();
  if (feeMode) rti.feeMode = feeMode;
  if (feeStatus) rti.feeStatus = feeStatus;
  // Pre-save hook auto-sets responseDeadline and firstAppealDeadline

  await rti.save();
  await AuditLog.log(req, 'rti.filed', 'RTIApplication', rti._id, { filedDate: rti.filedDate, referenceNumber });

  res.json({
    message: 'RTI marked as filed',
    rti,
    responseDeadline: rti.responseDeadline,
    daysUntilDeadline: rti.daysUntilDeadline,
  });
});

// ─── updateStatus ─────────────────────────────────────────────────────────────

/**
 * PATCH /v1/rti/:id/status
 */
const updateStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { userId } = req.user;
  const {
    status,
    responseDate, responseText, isResponseSatisfactory,
    firstAppealFiledDate, firstAppealReferenceNumber, faaName, faaAddress,
    firstAppealDecisionDate, firstAppealDecisionText,
    cicFiledDate, cicReferenceNumber, cicDecisionDate, cicDecisionText,
    referenceNumber, notes,
  } = req.body;

  const rti = await RTIApplication.findById(id);
  if (!rti) throw createError(404, 'RTI_NOT_FOUND', 'RTI application not found');
  if (rti.user.toString() !== userId) throw createError(403, 'FORBIDDEN', 'Access denied');

  const VALID_TRANSITIONS = {
    drafted:                ['filed', 'withdrawn'],
    filed:                  ['response_received', 'first_appeal_due', 'withdrawn'],
    response_received:      ['first_appeal_due', 'closed', 'withdrawn'],
    first_appeal_due:       ['first_appeal_filed', 'withdrawn'],
    first_appeal_filed:     ['first_appeal_decided', 'withdrawn'],
    first_appeal_decided:   ['cic_filed', 'closed', 'withdrawn'],
    cic_filed:              ['cic_decided', 'withdrawn'],
    cic_decided:            ['closed'],
    closed:                 [],
    withdrawn:              [],
  };

  if (status && !VALID_TRANSITIONS[rti.status]?.includes(status)) {
    throw createError(400, 'INVALID_TRANSITION',
      `Cannot transition from '${rti.status}' to '${status}'`);
  }

  if (status) rti.status = status;
  if (referenceNumber) rti.referenceNumber = referenceNumber.trim();
  if (notes !== undefined) rti.notes = notes?.trim();

  // Response details
  if (responseDate) rti.responseDate = new Date(responseDate);
  if (responseText !== undefined) rti.responseText = responseText?.trim();
  if (isResponseSatisfactory !== undefined) rti.isResponseSatisfactory = isResponseSatisfactory;

  // First Appeal details
  if (firstAppealFiledDate) rti.firstAppealFiledDate = new Date(firstAppealFiledDate);
  if (firstAppealReferenceNumber) rti.firstAppealReferenceNumber = firstAppealReferenceNumber.trim();
  if (faaName) rti.faaName = faaName.trim();
  if (faaAddress) rti.faaAddress = faaAddress.trim();
  if (firstAppealDecisionDate) rti.firstAppealDecisionDate = new Date(firstAppealDecisionDate);
  if (firstAppealDecisionText) rti.firstAppealDecisionText = firstAppealDecisionText.trim();

  // CIC appeal details
  if (cicFiledDate) rti.cicFiledDate = new Date(cicFiledDate);
  if (cicReferenceNumber) rti.cicReferenceNumber = cicReferenceNumber.trim();
  if (cicDecisionDate) rti.cicDecisionDate = new Date(cicDecisionDate);
  if (cicDecisionText) rti.cicDecisionText = cicDecisionText.trim();

  await rti.save();
  await AuditLog.log(req, 'rti.status_updated', 'RTIApplication', rti._id, { status });

  res.json({ message: 'RTI status updated', rti });
});

// ─── generateAppealDraft ──────────────────────────────────────────────────────

/**
 * POST /v1/rti/:id/draft-first-appeal
 *
 * AI generates a First Appeal document (does NOT change status).
 */
const generateFirstAppealDraft = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { userId } = req.user;

  const rti = await RTIApplication.findById(id).lean();
  if (!rti) throw createError(404, 'RTI_NOT_FOUND', 'RTI not found');
  if (rti.user.toString() !== userId) throw createError(403, 'FORBIDDEN', 'Access denied');

  const appealContent = await rtiAIService.draftFirstAppeal(rti);
  res.json({ appealContent });
});

/**
 * POST /v1/rti/:id/draft-cic-appeal
 *
 * AI generates a CIC Second Appeal document.
 */
const generateCICAppealDraft = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { userId } = req.user;

  const rti = await RTIApplication.findById(id).lean();
  if (!rti) throw createError(404, 'RTI_NOT_FOUND', 'RTI not found');
  if (rti.user.toString() !== userId) throw createError(403, 'FORBIDDEN', 'Access denied');

  if (!['first_appeal_filed', 'first_appeal_decided'].includes(rti.status)) {
    throw createError(400, 'INVALID_STATUS', 'First Appeal must be filed before generating CIC appeal');
  }

  const cicContent = await rtiAIService.draftCICAppeal(rti);
  res.json({ cicContent });
});

// ─── downloadPDF ──────────────────────────────────────────────────────────────

/**
 * GET /v1/rti/:id/download/:docType
 *
 * docType: 'application' | 'first-appeal' | 'cic-appeal'
 */
const downloadPDF = asyncHandler(async (req, res) => {
  const { id, docType } = req.params;
  const { userId } = req.user;

  // Optional: override applicant details from query for live preview
  const overrides = req.query;

  const rti = await RTIApplication.findById(id).lean();
  if (!rti) throw createError(404, 'RTI_NOT_FOUND', 'RTI not found');
  if (rti.user.toString() !== userId) throw createError(403, 'FORBIDDEN', 'Access denied');

  // Allow applicant override for on-the-fly name/address in PDF
  const rtiForPdf = {
    ...rti,
    applicantName:    overrides.name    || rti.applicantName,
    applicantAddress: overrides.address || rti.applicantAddress,
    applicantPhone:   overrides.phone   || rti.applicantPhone,
    applicantEmail:   overrides.email   || rti.applicantEmail,
  };

  let pdfBuffer;
  let filename;

  if (docType === 'application') {
    pdfBuffer = await rtiPdfService.generateRTIApplicationPDF(rtiForPdf);
    filename = `RTI_Application_${rti.title.replace(/[^a-z0-9]/gi, '_').substring(0, 40)}.pdf`;
  } else if (docType === 'first-appeal') {
    // Optionally accept appeal content in request body for custom content
    const appealContent = req.body?.appealContent || {};
    pdfBuffer = await rtiPdfService.generateFirstAppealPDF(rtiForPdf, appealContent);
    filename = `RTI_First_Appeal_${rti.title.replace(/[^a-z0-9]/gi, '_').substring(0, 40)}.pdf`;
  } else if (docType === 'cic-appeal') {
    const cicContent = req.body?.cicContent || {};
    pdfBuffer = await rtiPdfService.generateCICAppealPDF(rtiForPdf, cicContent);
    filename = `RTI_CIC_Appeal_${rti.title.replace(/[^a-z0-9]/gi, '_').substring(0, 40)}.pdf`;
  } else {
    throw createError(400, 'INVALID_DOC_TYPE', "docType must be 'application', 'first-appeal', or 'cic-appeal'");
  }

  res.set({
    'Content-Type':        'application/pdf',
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Content-Length':      pdfBuffer.length,
  });
  res.end(pdfBuffer);
});

// ─── deleteRTI ───────────────────────────────────────────────────────────────

/**
 * DELETE /v1/rti/:id
 */
const deleteRTI = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { userId } = req.user;

  const rti = await RTIApplication.findById(id);
  if (!rti) throw createError(404, 'RTI_NOT_FOUND', 'RTI not found');
  if (rti.user.toString() !== userId) throw createError(403, 'FORBIDDEN', 'Access denied');

  rti.isActive = false;
  await rti.save();
  await AuditLog.log(req, 'rti.deleted', 'RTIApplication', rti._id, {});

  res.json({ message: 'RTI application removed', rtiId: id });
});

// ─── getMinistries ───────────────────────────────────────────────────────────

/**
 * GET /v1/rti/ministries
 *
 * Search or list central ministry options for the RTI wizard.
 */
const getMinistries = asyncHandler(async (req, res) => {
  const { q } = req.query;
  const results = q ? searchMinistries(q) : CENTRAL_MINISTRIES;
  res.json({ ministries: results, stateDepartments: STATE_DEPARTMENTS, cic: CIC_INFO });
});

module.exports = {
  listRTIs,
  getRTIDetail,
  aiDraftRTI,
  createRTI,
  markAsFiled,
  updateStatus,
  generateFirstAppealDraft,
  generateCICAppealDraft,
  downloadPDF,
  deleteRTI,
  getMinistries,
};
