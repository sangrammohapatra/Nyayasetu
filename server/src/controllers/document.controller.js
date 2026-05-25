const Bull             = require('bull');
const { v4: uuidv4 }   = require('uuid');
const DocumentModel    = require('../models/Document.model');
const ChatSession      = require('../models/ChatSession.model');
const DocumentTemplate = require('../models/DocumentTemplate.model');
const JurisdictionRule = require('../models/JurisdictionRule.model');
const User             = require('../models/User.model');
const AuditLog         = require('../models/AuditLog.model');
const Notification     = require('../models/Notification.model');
const { getSignedPdfUrl } = require('../services/storage/storageProvider');
const { explainClause }   = require('../services/ai/clauseExplainer');
const asyncHandler     = require('../utils/asyncHandler');
const { createError }  = require('../middleware/error.middleware');
const logger           = require('../utils/logger');
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
    _documentQueue = new Bull(QUEUE_NAMES.DOCUMENTS, redisUrl, {
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
const generateDocument = asyncHandler(async (req, res) => {
  const { sessionId } = req.body;
  const { userId, plan } = req.user;

  if (!sessionId) throw createError(400, 'SESSION_ID_REQUIRED', 'sessionId is required');

  // ── Load and validate session ──────────────────────────────────────────────
  const session = await ChatSession.findById(sessionId).populate('template');
  if (!session)                     throw createError(404, 'SESSION_NOT_FOUND', 'Session not found');
  if (!session.user.equals(userId)) throw createError(403, 'FORBIDDEN', 'Session does not belong to you');

  if (session.status !== SESSION_STATUS.DATA_COMPLETE) {
    throw createError(400, 'SESSION_NOT_READY',
      `Session must be in "data_complete" status. Current status: "${session.status}". ` +
      'Complete the chat conversation first.'
    );
  }

  const template = session.template;
  if (!template) throw createError(500, 'TEMPLATE_MISSING', 'Session template missing');

  // ── Load user for access type resolution ──────────────────────────────────
  const user = await User.findById(userId).select('name subscription state freeUsage');

  // ── Determine access type ─────────────────────────────────────────────────
  const accessType = resolveAccessType(user, template, plan);
  const isPaid     = accessType !== DOCUMENT_ACCESS_TYPES.FREE_TIER || template.isAlwaysFree;

  // ── Update session status ─────────────────────────────────────────────────
  session.status = SESSION_STATUS.GENERATING;
  await session.save();

  // ── Create Document stub ──────────────────────────────────────────────────
  const document = await DocumentModel.create({
    user:         userId,
    session:      sessionId,
    template:     template._id,
    templateSlug: template.slug,
    title:        `${template.name}${session.userState ? ` — ${session.userState}` : ''}`,
    content:      '',           // Populated by the Bull job
    contentHtml:  '',
    language:     session.userLanguage || 'en',
    accessType,
    isPaid,
    jurisdiction: {
      state:    session.userState,
      district: user.state,
    },
    version: 1,
  });

  // ── Increment document usage for free-tier users ───────────────────────────
  if (accessType === DOCUMENT_ACCESS_TYPES.FREE_TIER && !template.isAlwaysFree) {
    await User.findByIdAndUpdate(userId, { $inc: { 'freeUsage.docsGenerated': 1 } });
  }

  // ── Enqueue generation job ────────────────────────────────────────────────
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
    .populate('template', 'name slug category complexity icon')
    .populate('session',  'status progressPercent userState userLanguage');

  if (!document)                       throw createError(404, 'DOCUMENT_NOT_FOUND', 'Document not found');
  if (document.isDeleted)              throw createError(404, 'DOCUMENT_NOT_FOUND', 'Document not found');
  if (!document.user.equals(userId))   throw createError(403, 'FORBIDDEN', 'This document does not belong to you');

  const docObj = document.toObject();

  // ── PDF access gate ───────────────────────────────────────────────────────
  const isSubscribed = plan !== 'free' &&
    (await User.findById(userId).select('subscription').lean())?.subscription?.validUntil &&
    new Date() < new Date((await User.findById(userId).select('subscription').lean())?.subscription?.validUntil);

  const canDownloadPdf = isSubscribed || document.isPaid;

  if (!canDownloadPdf) {
    // Free-tier: return content preview but suppress PDF URL
    delete docObj.pdfUrl;
    delete docObj.pdfStorageKey;
    docObj._pdfGated = true;
    docObj._upgradeUrl = '/pricing';
    docObj._upgradeMessage = 'Upgrade to Basic or Pro to download the PDF.';
  } else if (document.pdfStorageKey) {
    // Generate a fresh 15-min signed URL on each access (Rule #9)
    try {
      docObj.pdfUrl = await getSignedPdfUrl(document.pdfStorageKey);
    } catch (err) {
      logger.error(`[document/get] Failed to sign PDF URL: ${err.message}`);
      docObj.pdfUrl = null;
    }
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
  if (status) filter['session.status'] = status;

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
    logger.error('[document/explainClause] Error:', err.message);
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
  const { userId }         = req.user;
  const { expiryDays = 30 } = req.body;

  const document = await DocumentModel.findById(documentId);
  if (!document || document.isDeleted) throw createError(404, 'DOCUMENT_NOT_FOUND', 'Document not found');
  if (!document.user.equals(userId))   throw createError(403, 'FORBIDDEN', 'Access denied');

  await document.generateShareToken(Math.min(90, Math.max(1, expiryDays)));

  const shareUrl = `${process.env.CLIENT_URL || 'https://nyayasetu.in'}/documents/shared/${document.shareToken}`;

  await AuditLog.log(req, 'document.shared', 'Document', document._id, {
    shareToken: document.shareToken,
    expiryDays,
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

module.exports = {
  generateDocument,
  getDocument,
  listDocuments,
  getPDF,
  explainClauseHandler,
  shareDocument,
  getSharedDocument,
  deleteDocument,
  linkCase,
  regenerate,
};
