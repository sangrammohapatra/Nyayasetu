const Bull             = require('bull');
const { v4: uuidv4 }   = require('uuid');
const DocumentModel    = require('../models/Document.model');
const ChatSession      = require('../models/ChatSession.model');
const DocumentTemplate = require('../models/DocumentTemplate.model');
const JurisdictionRule = require('../models/JurisdictionRule.model');
const User             = require('../models/User.model');
const LawyerProfile    = require('../models/LawyerProfile.model');
const CaseTracker      = require('../models/CaseTracker.model');
const AuditLog         = require('../models/AuditLog.model');
const Notification     = require('../models/Notification.model');
const { getSignedPdfUrl } = require('../services/storage/storageProvider');
const { getRedisClient } = require('../config/redis');
const { explainClause }   = require('../services/ai/clauseExplainer');
const asyncHandler     = require('../utils/asyncHandler');
const { createError }  = require('../middleware/error.middleware');
const logger           = require('../utils/logger');
const { buildBullRedisOpts } = require('../utils/bullRedisOpts');
const {
  SESSION_STATUS,
  DOCUMENT_ACCESS_TYPES,
  QUEUE_NAMES,
  PDF_URL_EXPIRY_SECONDS,
} = require('../config/constants');

// ─── Bull queue (lazy init — Redis may not be available in test) ───────────────

let _documentQueue = null;

function getDocumentQueue() {
  if (!_documentQueue) {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    _documentQueue = new Bull(QUEUE_NAMES.DOCUMENTS, {
      redis: buildBullRedisOpts(redisUrl),
      defaultJobOptions: {
        attempts:      3,
        backoff:       { type: 'exponential', delay: 5000 },
        removeOnComplete: 50,
        removeOnFail:     20,
      },
    });
    logger.info('[documentQueue] Queue initialised');
  }
  return _documentQueue;
}

// ─── Access type resolver ──────────────────────────────────────────────────────

function resolveAccessType(user, template, plan) {
  if (template.isAlwaysFree)   return DOCUMENT_ACCESS_TYPES.FREE_TIER;
  const isSubscribed = plan !== 'free' &&
    user.subscription?.validUntil &&
    new Date() < new Date(user.subscription.validUntil);
  if (isSubscribed)            return DOCUMENT_ACCESS_TYPES.SUBSCRIPTION;
  return DOCUMENT_ACCESS_TYPES.FREE_TIER;
}

// ─── generateDocument ─────────────────────────────────────────────────────────

/**
 * POST /v1/documents/generate
 *
 * Validates the session is ready, creates a Document stub, enqueues the
 * generation job, and returns 202 with a pollUrl.
 */
// A GENERATING session is only reclaimable once it's been stuck this long —
// distinguishes an actually-crashed Bull job from a concurrent request that
// just claimed the session milliseconds ago.
const STUCK_GENERATING_MS = 3 * 60 * 1000;

const generateDocument = asyncHandler(async (req, res) => {
  const { sessionId } = req.body;
  const { userId, plan } = req.user;

  if (!sessionId) throw createError(400, 'SESSION_ID_REQUIRED', 'sessionId is required');

  // ── Load and validate session ──────────────────────────────────────────────
  const session = await ChatSession.findById(sessionId).populate('template');
  if (!session)                     throw createError(404, 'SESSION_NOT_FOUND', 'Session not found');
  if (!session.user.equals(userId)) throw createError(403, 'FORBIDDEN', 'Session does not belong to you');

  const resumableStatuses = [SESSION_STATUS.DATA_COMPLETE, SESSION_STATUS.GENERATING];
  if (!resumableStatuses.includes(session.status)) {
    throw createError(400, 'SESSION_NOT_READY',
      `Session must be in "data_complete" status. Current status: "${session.status}". ` +
      'Complete the chat conversation first.'
    );
  }

  // ── Atomically claim the session for generation ───────────────────────────
  // Replaces the old read-then-write status flip: two concurrent requests for
  // the same session could both pass the check above and both flip status to
  // GENERATING, creating two Document stubs / Bull jobs from one session. This
  // update only succeeds for one caller — the other gets `claimedSession: null`.
  const stuckCutoff = new Date(Date.now() - STUCK_GENERATING_MS);
  const claimedSession = await ChatSession.findOneAndUpdate(
    {
      _id: sessionId,
      user: userId,
      $or: [
        { status: SESSION_STATUS.DATA_COMPLETE },
        { status: SESSION_STATUS.GENERATING, updatedAt: { $lt: stuckCutoff } },
      ],
    },
    { $set: { status: SESSION_STATUS.GENERATING } },
    { new: true }
  ).populate('template');

  if (!claimedSession) {
    throw createError(409, 'GENERATION_IN_PROGRESS',
      'This session is already being generated. Please wait for it to finish.');
  }

  const template = claimedSession.template;
  if (!template) throw createError(500, 'TEMPLATE_MISSING', 'Session template missing');

  // ── Load user for access type resolution ──────────────────────────────────
  const user = await User.findById(userId).select('name subscription state district freeUsage');

  // ── Determine access type ─────────────────────────────────────────────────
  const accessType = resolveAccessType(user, template, plan);
  const isPaid     = accessType !== DOCUMENT_ACCESS_TYPES.FREE_TIER || template.isAlwaysFree;

  // ── Atomically claim a free-tier quota slot ───────────────────────────────
  // Moved here (from the Bull job's success path) so the claim itself is the
  // enforcement point — checkFreeQuota's read-then-later-increment left a
  // window where concurrent requests could both pass the check. If generation
  // ultimately fails, the job refunds this slot (see generateDocument.job.js)
  // so a failure never permanently costs the user a document credit.
  if (!isPaid) {
    const quotaLimit = user.freeUsage?.docsLimit ?? 0;
    const quotaClaimed = await User.findOneAndUpdate(
      { _id: userId, 'freeUsage.docsGenerated': { $lt: quotaLimit } },
      { $inc: { 'freeUsage.docsGenerated': 1 } },
      { new: true }
    );
    if (!quotaClaimed) {
      // Release the session claim so the user isn't stuck at GENERATING with
      // nothing actually generating.
      await ChatSession.findByIdAndUpdate(sessionId, { $set: { status: SESSION_STATUS.DATA_COMPLETE } });
      return res.status(403).json({
        error: 'QUOTA_EXCEEDED',
        message: `You have used all ${quotaLimit} free document credit${quotaLimit === 1 ? '' : 's'} this month. Upgrade to continue.`,
        used: user.freeUsage?.docsGenerated ?? 0,
        limit: quotaLimit,
        upgradeUrl: '/pricing',
      });
    }
  }

  // ── Create Document stub ──────────────────────────────────────────────────
  const document = await DocumentModel.create({
    user:         userId,
    session:      sessionId,
    template:     template._id,
    templateSlug: template.slug,
    title:        `${template.name}${claimedSession.userState ? ` — ${claimedSession.userState}` : ''}`,
    content:      '',           // Populated by the Bull job
    contentHtml:  '',
    language:     claimedSession.userLanguage || 'en',
    accessType,
    isPaid,
    jurisdiction: {
      state:    claimedSession.userState,
      district: user.district,
    },
    version: 1,
  });

  // ── Enqueue generation job ────────────────────────────────────────────────
  // NOTE: quota is incremented inside the Bull job, after PDF upload succeeds,
  // so a job failure never permanently consumes a free-tier document slot.
  const job = await getDocumentQueue().add(
    'generateDocument',
    { sessionId, userId, documentId: document._id.toString() },
    { jobId: `doc_${document._id}` }
  );

  logger.info(`[document/generate] Job enqueued: ${job.id}, doc: ${document._id}`);

  await AuditLog.log(req, 'document.generate.initiated', 'Document', document._id, {
    templateSlug: template.slug,
    sessionId,
    accessType,
  });

  res.status(202).json({
    documentId: document._id,
    status:     'generating',
    pollUrl:    `/v1/documents/${document._id}`,
    jobId:      job.id,
    message:    'Document generation has started. Poll the pollUrl for status.',
  });
});

// ─── getDocument ──────────────────────────────────────────────────────────────

/**
 * GET /v1/documents/:id
 *
 * Returns the full document. Free-tier users get content but NO pdfUrl.
 */
const getDocument = asyncHandler(async (req, res) => {
  const { id: documentId } = req.params;
  const { userId, plan }   = req.user;

  const document = await DocumentModel.findById(documentId)
    .populate('template', 'name slug category complexity icon pricePayPerDoc isAlwaysFree')
    .populate('session',  'status progressPercent userState userLanguage');

  if (!document)                       throw createError(404, 'DOCUMENT_NOT_FOUND', 'Document not found');
  if (document.isDeleted)              throw createError(404, 'DOCUMENT_NOT_FOUND', 'Document not found');
  if (!document.user.equals(userId))   throw createError(403, 'FORBIDDEN', 'This document does not belong to you');

  const docObj = document.toObject();

  // ── PDF access gate ───────────────────────────────────────────────────────
  let isSubscribed = false;
  if (plan !== 'free') {
    const subUser = await User.findById(userId).select('subscription').lean();
    const validUntil = subUser?.subscription?.validUntil;
    isSubscribed = !!validUntil && new Date() < new Date(validUntil);
  }

  const canDownloadPdf = isSubscribed || document.isPaid;

  if (!canDownloadPdf) {
    // Free-tier: return content preview but suppress PDF URL
    delete docObj.pdfUrl;
    delete docObj.pdfStorageKey;
    docObj._pdfGated = true;
    docObj._upgradeUrl = '/pricing';
    docObj._upgradeMessage = 'Upgrade to Basic or Pro to download the PDF.';
  } else if (document.pdfStorageKey) {
    // Serve a cached signed URL when possible — generating one on every GET
    // burns a storage provider API call per page view. Cache for TTL-60s so
    // the URL is always valid for the full duration a client holds it.
    const redis = getRedisClient();
    const cacheKey = `pdf:signed:${documentId}`;
    let signedUrl = redis ? await redis.get(cacheKey) : null;
    if (!signedUrl) {
      try {
        signedUrl = await getSignedPdfUrl(document.pdfStorageKey);
        if (redis && signedUrl) {
          await redis.set(cacheKey, signedUrl, 'EX', PDF_URL_EXPIRY_SECONDS - 60);
        }
      } catch (err) {
        logger.error(`[document/get] Failed to sign PDF URL: ${err.message}`);
      }
    }
    docObj.pdfUrl = signedUrl || null;
  }

  // Always remove internal storage key from response
  delete docObj.pdfStorageKey;

  res.json({ document: docObj });
});

// ─── listDocuments ────────────────────────────────────────────────────────────

/**
 * GET /v1/documents
 */
const listDocuments = asyncHandler(async (req, res) => {
  const { userId } = req.user;
  const page     = Math.max(1, parseInt(req.query.page)     || 1);
  const limit    = Math.min(20, parseInt(req.query.limit)   || 20);
  const category = req.query.category;
  const status   = req.query.status;

  const filter = { user: userId, isDeleted: false };
  if (req.query.sessionId) filter.session = req.query.sessionId;
  if (status) filter.status = status;

  let query = DocumentModel.find(filter)
    .populate('template', 'name slug category icon complexity pricePayPerDoc')
    .select('-content -contentHtml -clauseExplanations -pdfStorageKey -previousVersions')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);

  if (category) {
    // Filter by template category — requires lookup since it's on the populated field
    query = DocumentModel.find(filter)
      .populate({
        path:  'template',
        match: { category },
        select: 'name slug category icon complexity pricePayPerDoc',
      })
      .select('-content -contentHtml -clauseExplanations -pdfStorageKey -previousVersions')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);
  }

  const [documents, total] = await Promise.all([
    query.lean(),
    DocumentModel.countDocuments(filter),
  ]);

  // Remove pdfUrl from list view (force re-fetch on detail page for fresh signed URL)
  const sanitised = documents
    .filter((d) => !category || d.template) // Remove null-populated templates
    .map((d) => { delete d.pdfUrl; return d; });

  res.json({
    documents: sanitised,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasMore:    page * limit < total,
    },
  });
});

// ─── getPDF ───────────────────────────────────────────────────────────────────

/**
 * GET /v1/documents/:id/pdf
 *
 * Returns a fresh 15-minute signed PDF URL.
 * Requires payment or subscription. Free-tier always blocked.
 */
const getPDF = asyncHandler(async (req, res) => {
  const { id: documentId } = req.params;
  const { userId, plan }   = req.user;

  const document = await DocumentModel.findById(documentId).select('user isPaid pdfStorageKey accessType isDeleted');
  if (!document || document.isDeleted) throw createError(404, 'DOCUMENT_NOT_FOUND', 'Document not found');
  if (!document.user.equals(userId))   throw createError(403, 'FORBIDDEN', 'Access denied');

  if (!document.pdfStorageKey) {
    throw createError(404, 'PDF_NOT_READY',
      'PDF has not been generated yet. Please wait for document generation to complete.');
  }

  // Access check: must be paid or subscribed
  const user = await User.findById(userId).select('subscription').lean();
  const isSubscribed = plan !== 'free' &&
    user?.subscription?.validUntil &&
    new Date() < new Date(user.subscription.validUntil);

  if (!document.isPaid && !isSubscribed) {
    return res.status(403).json({
      error:      'PDF_LOCKED',
      message:    'PDF download requires a paid plan or pay-per-document purchase.',
      upgradeUrl: '/pricing',
    });
  }

  // Generate fresh signed URL (Rule #9: 15-minute expiry)
  const pdfUrl = await getSignedPdfUrl(document.pdfStorageKey);

  await AuditLog.log(req, 'document.pdf.downloaded', 'Document', document._id);

  res.json({
    pdfUrl,
    expiresIn:  PDF_URL_EXPIRY_SECONDS,
    expiresAt:  new Date(Date.now() + PDF_URL_EXPIRY_SECONDS * 1000).toISOString(),
  });
});

// ─── getSignedPDF ─────────────────────────────────────────────────────────────

/**
 * GET /v1/documents/:id/signed-pdf
 *
 * Returns a fresh 15-minute signed URL for the digitally-signed PDF.
 * Only available after the signing flow completes (isSigned: true).
 */
const getSignedPDF = asyncHandler(async (req, res) => {
  const { id: documentId } = req.params;
  const { userId } = req.user;

  const document = await DocumentModel.findById(documentId)
    .select('user isSigned signedPdfStorageKey isDeleted');
  if (!document || document.isDeleted) throw createError(404, 'DOCUMENT_NOT_FOUND', 'Document not found');
  if (!document.user.equals(userId))   throw createError(403, 'FORBIDDEN', 'Access denied');
  if (!document.isSigned || !document.signedPdfStorageKey) {
    throw createError(404, 'SIGNED_PDF_NOT_FOUND', 'No signed PDF is available for this document yet');
  }

  const signedPdfUrl = await getSignedPdfUrl(document.signedPdfStorageKey);
  await AuditLog.log(req, 'document.signed_pdf.downloaded', 'Document', document._id);

  res.json({ signedPdfUrl, expiresIn: PDF_URL_EXPIRY_SECONDS });
});

// ─── explainClauseHandler ────────────────────────────────────────────────────

/**
 * POST /v1/documents/:id/explain-clause
 *
 * SSE stream — plain-language explanation of a legal clause.
 */
const explainClauseHandler = asyncHandler(async (req, res) => {
  const { id: documentId } = req.params;
  const { userId, plan }   = req.user;
  const { clauseText, clauseIndex } = req.body;

  if (!clauseText) throw createError(400, 'CLAUSE_REQUIRED', 'clauseText is required');

  const document = await DocumentModel.findById(documentId).select('user language isDeleted');
  if (!document || document.isDeleted) throw createError(404, 'DOCUMENT_NOT_FOUND', 'Document not found');
  if (!document.user.equals(userId))   throw createError(403, 'FORBIDDEN', 'Access denied');

  // Set SSE headers
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const language = req.query.language || document.language || 'en';

  let clientDisconnected = false;
  req.on('close', () => { clientDisconnected = true; });

  try {
    const stream = await explainClause(clauseText, language, true);
    for await (const delta of stream) {
      if (clientDisconnected) break;
      res.write(`data: ${JSON.stringify({ delta, done: false })}\n\n`);
      if (res.flush) res.flush();
    }
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  } catch (err) {
    logger.error('[document/explainClause] Error:', { error: err.message });
    res.write(`data: ${JSON.stringify({ error: true, message: 'Explanation failed. Please try again.', done: true })}\n\n`);
  }

  res.end();
});

// ─── shareDocument ────────────────────────────────────────────────────────────

/**
 * POST /v1/documents/:id/share
 */
const shareDocument = asyncHandler(async (req, res) => {
  const { id: documentId } = req.params;
  const { userId, plan }   = req.user;
  const { expiryDays } = req.body;

  const document = await DocumentModel.findById(documentId);
  if (!document || document.isDeleted) throw createError(404, 'DOCUMENT_NOT_FOUND', 'Document not found');
  if (!document.user.equals(userId))   throw createError(403, 'FORBIDDEN', 'Access denied');

  const maxDays = (plan === 'pro' || plan === 'professional' || plan === 'firm') ? 90
                : plan === 'basic' ? 30
                : 7; // free
  // Default to the caller's own plan cap (not a flat 30) so paid plans get
  // their full allotted expiry window without the client having to ask for it.
  const requestedDays = expiryDays !== undefined ? expiryDays : maxDays;
  const resolvedDays = Math.min(maxDays, Math.max(1, requestedDays));
  await document.generateShareToken(resolvedDays);

  const shareUrl = `${process.env.CLIENT_URL || 'https://nyayasetu.in'}/documents/shared/${document.shareToken}`;

  await AuditLog.log(req, 'document.shared', 'Document', document._id, {
    shareToken: document.shareToken,
    expiryDays: resolvedDays,
  });

  res.json({
    shareToken:   document.shareToken,
    shareUrl,
    expiresAt:    document.shareTokenExpiresAt,
  });
});

// ─── getSharedDocument ────────────────────────────────────────────────────────

/**
 * GET /v1/documents/shared/:shareToken   — public, no auth
 */
const getSharedDocument = asyncHandler(async (req, res) => {
  const { shareToken } = req.params;

  const document = await DocumentModel.findByShareToken(shareToken);
  if (!document) {
    throw createError(404, 'SHARE_LINK_INVALID',
      'This share link is invalid or has expired.');
  }

  // Return a limited view — no PDF URL, no internal fields
  const view = {
    title:              document.title,
    content:            document.content,
    legalCitations:     document.legalCitations,
    clauseExplanations: document.clauseExplanations,
    nextSteps:          document.nextSteps,
    jurisdiction:       document.jurisdiction,
    createdAt:          document.createdAt,
    template:           document.template,
    sharedBy:           document.user?.name,
    shareTokenExpiresAt: document.shareTokenExpiresAt,
    _isSharedView:      true,
  };

  res.json({ document: view });
});

// ─── deleteDocument ───────────────────────────────────────────────────────────

/**
 * DELETE /v1/documents/:id
 */
const deleteDocument = asyncHandler(async (req, res) => {
  const { id: documentId } = req.params;
  const { userId }         = req.user;

  const document = await DocumentModel.findById(documentId);
  if (!document || document.isDeleted) throw createError(404, 'DOCUMENT_NOT_FOUND', 'Document not found');
  if (!document.user.equals(userId))   throw createError(403, 'FORBIDDEN', 'Access denied');

  await document.softDelete();

  await AuditLog.log(req, 'document.deleted', 'Document', document._id, {
    templateSlug: document.templateSlug,
  });

  res.json({ message: 'Document deleted successfully' });
});

// ─── linkCase ────────────────────────────────────────────────────────────────

/**
 * PATCH /v1/documents/:id/link-case
 */
const linkCase = asyncHandler(async (req, res) => {
  const { id: documentId } = req.params;
  const { userId }         = req.user;
  const { caseId }         = req.body;

  const document = await DocumentModel.findById(documentId);
  if (!document || document.isDeleted) throw createError(404, 'DOCUMENT_NOT_FOUND', 'Document not found');
  if (!document.user.equals(userId))   throw createError(403, 'FORBIDDEN', 'Access denied');

  if (caseId) {
    const caseDoc = await CaseTracker.findOne({ _id: caseId, user: userId }).select('_id').lean();
    if (!caseDoc) throw createError(404, 'CASE_NOT_FOUND', 'Case not found');
  }

  document.linkedCase = caseId || null;
  await document.save();

  res.json({ message: 'Case linked successfully', documentId, caseId });
});

// ─── regenerate ───────────────────────────────────────────────────────────────

/**
 * POST /v1/documents/:id/regenerate
 *
 * Re-runs document generation with optional collectedData patches.
 * Saves the old version before overwriting.
 */
const regenerate = asyncHandler(async (req, res) => {
  const { id: documentId } = req.params;
  const { userId }         = req.user;
  const { patches = {} }   = req.body;

  const document = await DocumentModel.findById(documentId);
  if (!document || document.isDeleted) throw createError(404, 'DOCUMENT_NOT_FOUND', 'Document not found');
  if (!document.user.equals(userId))   throw createError(403, 'FORBIDDEN', 'Access denied');

  const session = await ChatSession.findById(document.session).populate('template');
  if (!session) throw createError(404, 'SESSION_NOT_FOUND', 'Original session not found');

  // Snapshot current version before overwriting
  document.previousVersions.push({
    version:   document.version,
    content:   document.content,
    contentHtml: document.contentHtml,
    pdfUrl:    null,
    regeneratedAt: new Date(),
    regenerationReason: 'User requested regeneration',
  });
  document.version += 1;

  // Apply patches to session collectedData
  if (Object.keys(patches).length > 0) {
    if (!session.collectedData) session.collectedData = new Map();
    Object.entries(patches).forEach(([k, v]) => {
      session.setField(k, v);
    });
    session.status = SESSION_STATUS.DATA_COMPLETE;
    await session.save();
  }

  // Reset document content and re-enqueue generation job
  document.content     = '';
  document.contentHtml = '';
  document.pdfUrl      = null;
  document.pdfStorageKey = null;
  await document.save();

  session.status = SESSION_STATUS.GENERATING;
  await session.save();

  const job = await getDocumentQueue().add(
    'generateDocument',
    { sessionId: session._id.toString(), userId, documentId: document._id.toString() },
    { jobId: `regen_${document._id}_v${document.version}` }
  );

  await AuditLog.log(req, 'document.regenerated', 'Document', document._id, {
    version: document.version,
    patches: Object.keys(patches),
  });

  res.status(202).json({
    documentId: document._id,
    version:    document.version,
    status:     'generating',
    pollUrl:    `/v1/documents/${document._id}`,
    jobId:      job.id,
  });
});

// ─── updateApprovalStatus ──────────────────────────────────────────────────────

/**
 * PATCH /v1/documents/:id/approval-status
 *
 * Citizen can move draft → shared_with_lawyer or finalized.
 * Lawyer can move shared_with_lawyer → under_review → lawyer_reviewed.
 */
const updateApprovalStatus = asyncHandler(async (req, res) => {
  const { id: documentId } = req.params;
  const { userId, persona } = req.user;
  const { status } = req.body;

  const ALLOWED_TRANSITIONS = {
    citizen: {
      draft:           ['shared_with_lawyer'],
      lawyer_reviewed: ['finalized'],
    },
    lawyer: {
      shared_with_lawyer: ['under_review'],
      under_review:       ['lawyer_reviewed'],
    },
  };

  const document = await DocumentModel.findById(documentId);
  if (!document || document.isDeleted) throw createError(404, 'DOCUMENT_NOT_FOUND', 'Document not found');

  const isCitizen = document.user.equals(userId) && persona === 'citizen';
  const isLawyer  = persona === 'lawyer';

  if (!isCitizen && !isLawyer) throw createError(403, 'FORBIDDEN', 'Access denied');

  // Lawyer access: must be linked via consultation
  if (isLawyer) {
    const lawyerProf = await LawyerProfile.findOne({ user: userId }).select('_id').lean();
    if (!lawyerProf) throw createError(403, 'FORBIDDEN', 'Lawyer profile not found');
    const ConsultModel = require('../models/Consultation.model');
    const linked = await ConsultModel.findOne({
      $or: [
        { sharedDocument: documentId },
        { _id: document.linkedConsultation },
      ],
      lawyer: userId,
    }).select('_id').lean();
    if (!linked) throw createError(403, 'FORBIDDEN', 'You are not the reviewing lawyer for this document');
  }

  const roleKey = isCitizen ? 'citizen' : 'lawyer';
  const allowed = ALLOWED_TRANSITIONS[roleKey]?.[document.approvalStatus] || [];

  if (!allowed.includes(status)) {
    throw createError(400, 'INVALID_TRANSITION',
      `Cannot move from "${document.approvalStatus}" to "${status}" as ${roleKey}`);
  }

  document.approvalStatus = status;
  if (isLawyer && !document.reviewedByLawyer) document.reviewedByLawyer = userId;
  await document.save();

  // Notify document owner via socket
  const io = req.app.get('io');
  if (io) {
    io.to(`user:${document.user.toString()}`).emit('document:status_changed', {
      documentId,
      approvalStatus: status,
    });
  }

  await AuditLog.log(req, 'document.approval_status.updated', 'Document', document._id, { status });

  res.json({ documentId, approvalStatus: status });
});

// ─── addAnnotation ────────────────────────────────────────────────────────────

/**
 * POST /v1/documents/:id/annotations
 * Lawyer only. Adds an inline note to the document.
 */
const addAnnotation = asyncHandler(async (req, res) => {
  const { id: documentId } = req.params;
  const { userId, persona } = req.user;
  const { note, clauseIndex, clauseText } = req.body;

  if (!note?.trim()) throw createError(400, 'NOTE_REQUIRED', 'Annotation note is required');
  if (persona !== 'lawyer')
    throw createError(403, 'FORBIDDEN', 'Only lawyers can annotate documents');

  const document = await DocumentModel.findById(documentId);
  if (!document || document.isDeleted) throw createError(404, 'DOCUMENT_NOT_FOUND', 'Document not found');

  const lawyerProf = await LawyerProfile.findOne({ user: userId }).select('_id').lean();
  if (!lawyerProf) throw createError(403, 'FORBIDDEN', 'Lawyer profile not found');
  const ConsultModel = require('../models/Consultation.model');
  const linked = await ConsultModel.findOne({
    $or: [
      { sharedDocument: documentId },
      { _id: document.linkedConsultation },
    ],
    lawyer: userId,
  }).select('_id').lean();
  if (!linked) throw createError(403, 'FORBIDDEN', 'You are not the reviewing lawyer for this document');

  const user = await User.findById(userId).select('name').lean();

  document.lawyerAnnotations.push({
    lawyer:      userId,
    lawyerName:  user?.name || 'Lawyer',
    clauseIndex: clauseIndex ?? null,
    clauseText:  clauseText?.slice(0, 500) || null,
    note:        note.trim(),
  });

  if (document.approvalStatus === 'shared_with_lawyer') {
    document.approvalStatus = 'under_review';
  }
  if (!document.reviewedByLawyer) document.reviewedByLawyer = userId;
  await document.save();

  await AuditLog.log(req, 'document.annotation.added', 'Document', document._id, { clauseIndex });

  res.status(201).json({
    annotation: document.lawyerAnnotations[document.lawyerAnnotations.length - 1],
    approvalStatus: document.approvalStatus,
  });
});

// ─── lawyerEditDocument ───────────────────────────────────────────────────────

/**
 * PATCH /v1/documents/:id/lawyer-edit
 * Lawyer submits an edited version of the document content.
 */
const lawyerEditDocument = asyncHandler(async (req, res) => {
  const { id: documentId } = req.params;
  const { userId, persona } = req.user;
  const { content } = req.body;

  if (!content?.trim()) throw createError(400, 'CONTENT_REQUIRED', 'Edited content is required');
  if (persona !== 'lawyer')
    throw createError(403, 'FORBIDDEN', 'Only lawyers can edit documents');

  const document = await DocumentModel.findById(documentId);
  if (!document || document.isDeleted) throw createError(404, 'DOCUMENT_NOT_FOUND', 'Document not found');

  const lawyerProf = await LawyerProfile.findOne({ user: userId }).select('_id').lean();
  if (!lawyerProf) throw createError(403, 'FORBIDDEN', 'Lawyer profile not found');
  const ConsultModel = require('../models/Consultation.model');
  const linked = await ConsultModel.findOne({
    $or: [
      { sharedDocument: documentId },
      { _id: document.linkedConsultation },
    ],
    lawyer: userId,
  }).select('_id').lean();
  if (!linked) throw createError(403, 'FORBIDDEN', 'You are not the reviewing lawyer for this document');

  document.lawyerEditedContent = content.trim();
  document.lawyerEditedAt      = new Date();
  document.lawyerEditedBy      = userId;
  if (!document.reviewedByLawyer) document.reviewedByLawyer = userId;
  if (document.approvalStatus === 'shared_with_lawyer') document.approvalStatus = 'under_review';
  await document.save();

  await AuditLog.log(req, 'document.lawyer_edit.saved', 'Document', document._id);

  // Notify document owner
  const io = req.app.get('io');
  if (io) {
    io.to(`user:${document.user.toString()}`).emit('document:lawyer_edited', { documentId });
  }

  res.json({ documentId, lawyerEditedAt: document.lawyerEditedAt });
});

// ─── getLinkedConsultation ────────────────────────────────────────────────────

/**
 * GET /v1/documents/:id/consultation
 * Returns the consultation (if any) where this document is shared,
 * so citizen can open the chat or check review status.
 */
const getLinkedConsultation = asyncHandler(async (req, res) => {
  const { id: documentId } = req.params;
  const { userId }         = req.user;

  const document = await DocumentModel.findById(documentId).select('user linkedConsultation isDeleted');
  if (!document || document.isDeleted) throw createError(404, 'DOCUMENT_NOT_FOUND', 'Document not found');
  if (!document.user.equals(userId)) throw createError(403, 'FORBIDDEN', 'Access denied');

  const ConsultModel = require('../models/Consultation.model');
  const consultation = await ConsultModel.findOne({
    $or: [
      { sharedDocument: documentId },
      { _id: document.linkedConsultation },
    ],
    citizen: userId,
  })
    .populate('lawyer', 'name avatar')
    .select('_id status mode scheduledAt lawyer sharedDocument')
    .lean();

  res.json({ consultation: consultation || null });
});

// ─── getDocumentForLawyer ─────────────────────────────────────────────────────

/**
 * GET /v1/consultations/:consultationId/document
 * Lawyer fetches the sharedDocument on a consultation they're party to.
 * Mounted separately in consultationChat.routes.js.
 */
const getDocumentForLawyer = asyncHandler(async (req, res) => {
  const { consultationId } = req.params;
  const { userId, persona } = req.user;

  if (persona !== 'lawyer')
    throw createError(403, 'FORBIDDEN', 'Lawyers only');

  const lawyerProf = await LawyerProfile.findOne({ user: userId }).select('_id').lean();
  if (!lawyerProf) throw createError(403, 'FORBIDDEN', 'Lawyer profile not found');
  const ConsultModel = require('../models/Consultation.model');
  const consultation = await ConsultModel.findOne({ _id: consultationId, lawyer: userId })
    .select('sharedDocument citizen')
    .lean();

  if (!consultation) throw createError(404, 'NOT_FOUND', 'Consultation not found or access denied');
  if (!consultation.sharedDocument) return res.json({ document: null });

  const document = await DocumentModel.findById(consultation.sharedDocument)
    .populate('template', 'name slug category icon')
    .lean();

  if (!document || document.isDeleted) return res.json({ document: null });

  // Remove pdfStorageKey
  delete document.pdfStorageKey;
  delete document.pdfUrl;

  res.json({ document });
});

// ─── initiateSign ─────────────────────────────────────────────────────────────

/**
 * POST /v1/documents/:id/sign
 *
 * Dev:  Signs synchronously in-place → returns signed PDF URL immediately.
 * Prod: Sends to SignDesk → returns { pending: true, redirectUrl } so the
 *       client can redirect the user to the Aadhaar eSign page.
 */
const initiateSign = asyncHandler(async (req, res) => {
  const { userId, persona } = req.user;
  const { id: documentId }  = req.params;

  const document = await DocumentModel.findById(documentId)
    .populate('template');

  if (!document)                       throw createError(404, 'NOT_FOUND',  'Document not found');
  if (!document.user.equals(userId))   throw createError(403, 'FORBIDDEN',  'Not your document');
  if (!document.isPaid && document.accessType === 'free_tier')
    throw createError(403, 'SIGN_REQUIRES_PAID', 'Document must be paid before signing');
  if (!document.pdfStorageKey)         throw createError(400, 'NO_PDF',     'PDF has not been generated yet');
  if (document.isSigned)               throw createError(409, 'ALREADY_SIGNED', 'Document is already signed');
  if (document.signatureStatus === 'pending')
    throw createError(409, 'SIGN_PENDING', 'A signing request is already in progress');

  const user     = await User.findById(userId).select('name email phone').lean();
  const template = document.template;

  const { initiateSign: providerInitiate, isProd } = require('../services/signature/signatureProvider');
  const { uploadPDF, getSignedPdfUrl }             = require('../services/storage/storageProvider');

  // ── Download current PDF buffer from storage ────────────────────────────
  // We need the raw bytes to send to SignDesk (prod) or to re-render (dev)
  let pdfBuffer = null;
  if (isProd()) {
    // Prod: fetch the PDF bytes to ship to SignDesk
    const signedUrl = await getSignedPdfUrl(document.pdfStorageKey);
    const response  = await fetch(signedUrl);
    if (!response.ok) throw createError(502, 'PDF_FETCH_FAILED', 'Could not retrieve PDF for signing');
    pdfBuffer = Buffer.from(await response.arrayBuffer());
  }

  // Webhook URL — SignDesk will POST the signed result here
  const webhookUrl = `${process.env.SERVER_URL || `http://localhost:${process.env.PORT || 5000}`}/v1/webhooks/signdesk`;

  const result = await providerInitiate(document, user, template, pdfBuffer, webhookUrl);

  // ── Prod: mark pending, return redirect URL ──────────────────────────────
  if (!result.done) {
    document.signatureStatus = 'pending';
    document.signatureMetadata = { ...document.signatureMetadata, sessionId: result.sessionId };
    await document.save();
    return res.json({ pending: true, redirectUrl: result.redirectUrl });
  }

  // ── Dev: sign complete — upload signed PDF and update document ───────────
  const signedKey  = `signed_${documentId}`;
  const { storageKey: signedPdfStorageKey } = await uploadPDF(result.signedPdfBuffer, signedKey);

  document.isSigned            = true;
  document.signatureStatus     = 'signed';
  document.signedAt            = result.signedAt;
  document.signedPdfStorageKey = signedPdfStorageKey;
  document.signatureProvider   = result.provider;
  document.signatureMetadata   = {
    signerName:  result.signerName,
    fingerprint: result.fingerprint,
    attestation: result.attestation,
  };
  await document.save();

  const signedPdfUrl = await getSignedPdfUrl(signedPdfStorageKey);

  await AuditLog.log(req, 'document.signed', 'Document', documentId, { provider: result.provider });

  return res.json({
    signed:        true,
    signedPdfUrl,
    signedAt:      result.signedAt,
    provider:      result.provider,
    fingerprint:   result.fingerprint,
  });
});

// ─── signWebhook ──────────────────────────────────────────────────────────────

/**
 * POST /v1/webhooks/signdesk
 *
 * Called by SignDesk after the citizen completes Aadhaar OTP verification.
 * No auth middleware — HMAC verification is done inside signatureProvider.
 * Must be registered BEFORE express.json() (needs raw body for HMAC check).
 */
const signWebhook = asyncHandler(async (req, res) => {
  const { handleWebhook } = require('../services/signature/signatureProvider');
  const { uploadPDF, getSignedPdfUrl } = require('../services/storage/storageProvider');

  if (!req.rawBody) {
    return res.status(400).json({ error: 'MISSING_RAW_BODY', message: 'Missing raw body' });
  }

  const signature = req.headers['x-signdesk-signature'] || '';
  const { valid, parsed } = handleWebhook(req.rawBody, signature, req.body);

  if (!valid) return res.status(401).json({ error: 'Invalid webhook signature' });

  const { sessionId, status, signedPdfBuffer, documentUrl, aadhaarName, transactionId } = parsed;

  // Look up document by SignDesk session id
  const document = await DocumentModel.findOne({ 'signatureMetadata.sessionId': sessionId });
  if (!document) {
    logger.warn(`[signWebhook] No document found for SignDesk session ${sessionId}`);
    return res.json({ ok: true }); // ACK to SignDesk even if we can't find it
  }

  if (status === 'failed') {
    document.signatureStatus = 'failed';
    await document.save();
    return res.json({ ok: true });
  }

  // Resolve PDF buffer — may be inline base64 or a URL to download
  let pdfBuf = signedPdfBuffer;
  if (!pdfBuf && documentUrl) {
    const dlRes = await fetch(documentUrl);
    if (!dlRes.ok) {
      logger.error(`[signWebhook] Failed to download signed PDF from ${documentUrl}`);
      document.signatureStatus = 'failed';
      await document.save();
      return res.json({ ok: true });
    }
    pdfBuf = Buffer.from(await dlRes.arrayBuffer());
  }

  if (!pdfBuf) {
    logger.error(`[signWebhook] No signed PDF in SignDesk payload for session ${sessionId}`);
    document.signatureStatus = 'failed';
    await document.save();
    return res.json({ ok: true });
  }

  // Upload signed PDF
  const signedKey = `signed_${document._id}`;
  const { storageKey: signedPdfStorageKey } = await uploadPDF(pdfBuf, signedKey);

  document.isSigned            = true;
  document.signatureStatus     = 'signed';
  document.signedAt            = new Date();
  document.signedPdfStorageKey = signedPdfStorageKey;
  document.signatureProvider   = 'signdesk';
  document.signatureMetadata   = {
    ...document.signatureMetadata,
    signerName:          aadhaarName || document.signatureMetadata?.signerName,
    signerAadhaarMasked: aadhaarName ? `${aadhaarName} (Aadhaar-verified)` : '',
    transactionId,
  };
  await document.save();

  // Notify the document owner
  try {
    await Notification.createForUser({
      userId:    document.user,
      type:      'document_signed',
      title:     'Document Signed!',
      body:      `Your document "${document.title}" has been digitally signed via Aadhaar eSign.`,
      data:      { documentId: document._id },
      actionUrl: `/documents/${document._id}`,
      io:        req.app.get('io'),
    });
  } catch (_) {}

  logger.info(`[signWebhook] Document ${document._id} signed via SignDesk (tx: ${transactionId})`);
  return res.json({ ok: true });
});

module.exports = {
  generateDocument,
  getDocument,
  listDocuments,
  getPDF,
  getSignedPDF,
  explainClauseHandler,
  shareDocument,
  getSharedDocument,
  deleteDocument,
  linkCase,
  regenerate,
  updateApprovalStatus,
  addAnnotation,
  lawyerEditDocument,
  getLinkedConsultation,
  getDocumentForLawyer,
  initiateSign,
  signWebhook,
};
