const ChatSession      = require('../models/ChatSession.model');
const DocumentTemplate = require('../models/DocumentTemplate.model');
const JurisdictionRule = require('../models/JurisdictionRule.model');
const User             = require('../models/User.model');
const AuditLog         = require('../models/AuditLog.model');
const Notification     = require('../models/Notification.model');
const { getNextQuestion, extractFieldsFromResponse } = require('../services/ai/questionEngine');
const asyncHandler     = require('../utils/asyncHandler');
const { createError }  = require('../middleware/error.middleware');
const logger           = require('../utils/logger');
const {
  SESSION_STATUS,
  ALWAYS_FREE_TEMPLATES,
} = require('../config/constants');

// ─── Plan hierarchy helpers ────────────────────────────────────────────────────

const CITIZEN_PLAN_RANK = { free: 0, basic: 1, pro: 2 };
const LAWYER_PLAN_RANK  = { free: 0, professional: 1, firm: 2 };

function getPlanRank(persona, plan) {
  if (persona === 'lawyer' || persona === 'paralegal') {
    return LAWYER_PLAN_RANK[plan] ?? 0;
  }
  return CITIZEN_PLAN_RANK[plan] ?? 0;
}

function meetsRequiredPlan(userPersona, userPlan, requiredPlan) {
  const personaKey = (userPersona === 'lawyer' || userPersona === 'paralegal') ? 'lawyer' : 'citizen';
  const required   = requiredPlan?.[personaKey] || 'free';
  return getPlanRank(userPersona, userPlan) >= getPlanRank(userPersona, required);
}

// ─── SSE helpers ───────────────────────────────────────────────────────────────

function setSSEHeaders(res) {
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
  res.flushHeaders();
}

function sseWrite(res, data) {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
  if (res.flush) res.flush(); // Flush for nginx/express-compression
}

function sseError(res, message) {
  sseWrite(res, { error: true, message, done: true });
  res.end();
}

// ─── createSession ─────────────────────────────────────────────────────────────

/**
 * POST /v1/chat/sessions
 *
 * Creates a new chat session for document data collection.
 * Runs quota check, plan check, and fires the first AI question.
 */
const createSession = asyncHandler(async (req, res) => {
  const { userId, persona, plan } = req.user;
  const { templateSlug, language, source = 'web' } = req.body;

  if (!templateSlug) throw createError(400, 'TEMPLATE_REQUIRED', 'templateSlug is required');

  // ── Load user for quota check ──────────────────────────────────────────────
  const user = await User.findById(userId).select('freeUsage subscription state district preferredLanguage name');
  if (!user) throw createError(404, 'USER_NOT_FOUND', 'User not found');

  // ── Quota check: AI chat sessions ─────────────────────────────────────────
  const isSubscribed = plan !== 'free' &&
    user.subscription?.validUntil &&
    new Date() < new Date(user.subscription.validUntil);

  if (!isSubscribed) {
    const used  = user.freeUsage?.aiChatsUsed  ?? 0;
    const limit = user.freeUsage?.aiChatsLimit  ?? 5;
    if (used >= limit) {
      return res.status(403).json({
        error:       'QUOTA_EXCEEDED',
        message:     `You have used all ${limit} free AI chat sessions this month.`,
        used,
        limit,
        resetDate:   user.freeUsage?.resetDate,
        upgradeUrl:  '/pricing',
      });
    }
  }

  // ── Load template ─────────────────────────────────────────────────────────
  const template = await DocumentTemplate.findBySlug(templateSlug);
  if (!template) throw createError(404, 'TEMPLATE_NOT_FOUND', `Template "${templateSlug}" not found`);

  // ── Plan gate: check if user's plan allows this template ──────────────────
  const isAlwaysFree = ALWAYS_FREE_TEMPLATES.includes(templateSlug);
  if (!isAlwaysFree && !meetsRequiredPlan(persona, plan, template.requiredPlan)) {
    const personaKey = (persona === 'lawyer' || persona === 'paralegal') ? 'lawyer' : 'citizen';
    return res.status(403).json({
      error:           'PLAN_REQUIRED',
      message:         `This document type requires the "${template.requiredPlan[personaKey]}" plan or higher.`,
      upgradeRequired: true,
      requiredPlan:    template.requiredPlan,
      currentPlan:     plan,
      upgradeUrl:      '/pricing',
    });
  }

  // ── Resolve jurisdiction ───────────────────────────────────────────────────
  const userState = user.state || req.body.state || null;
  const jurisdictionRule = userState
    ? await JurisdictionRule.findForStateAndDocType(userState, templateSlug)
    : null;

  // ── Create session ────────────────────────────────────────────────────────
  const sessionLanguage = language || user.preferredLanguage || 'en';

  const session = await ChatSession.create({
    user:           userId,
    template:       template._id,
    templateSlug,
    status:         SESSION_STATUS.ACTIVE,
    source,
    userState,
    userLanguage:   sessionLanguage,
    totalQuestions: template.questionFlow?.filter((q) => q.isRequired).length || 0,
    collectedData:  new Map(),
    messages:       [],
  });

  // ── Increment AI chat usage ────────────────────────────────────────────────
  if (!isSubscribed) {
    await User.findByIdAndUpdate(userId, { $inc: { 'freeUsage.aiChatsUsed': 1 } });
  }

  // ── Kick off first AI question ─────────────────────────────────────────────
  // Inject a synthetic user message so the AI knows the context
  const seedMessage = {
    role:    'user',
    content: `I need help creating a ${template.name}. My state is ${userState || 'not specified'}. Please guide me.`,
  };
  session.messages.push({ ...seedMessage, createdAt: new Date() });

  let firstMessage = null;
  try {
    const { stream, getFullText } = await getNextQuestion(session, template, jurisdictionRule);

    // Collect full text for the first message (non-streaming for createSession)
    let aiText = '';
    for await (const delta of stream) {
      aiText += delta;
    }
    firstMessage = aiText.trim() || `Hello! I'm here to help you create your ${template.name}. Let's start.`;

    // Save the AI's first question to the session
    session.messages.push({ role: 'assistant', content: firstMessage, isQuestion: true, createdAt: new Date() });
    await session.save();
  } catch (aiErr) {
    logger.error('[chat/createSession] Failed to get first question:', { error: aiErr.message });
    // Don't crash — return session without first message, client will call sendMessage
    await session.save();
  }

  await AuditLog.log(req, 'chat.session.created', 'ChatSession', session._id, { templateSlug });

  res.status(201).json({
    sessionId:          session._id,
    firstMessage,
    template: {
      name:        template.name,
      slug:        template.slug,
      category:    template.category,
      complexity:  template.complexity,
      description: template.description,
    },
    estimatedQuestions: session.totalQuestions,
    progressPercent:    0,
    jurisdiction: jurisdictionRule ? {
      state:          userState,
      filingAuthority: jurisdictionRule.filingAuthority?.name,
    } : null,
  });
});

// ─── sendMessage ──────────────────────────────────────────────────────────────

/**
 * POST /v1/chat/sessions/:id/message
 *
 * Streams the AI response as SSE. Each chunk: `data: {"delta":"...","done":false}\n\n`
 * Final message: `data: {"done":true,"dataComplete":true}\n\n` or `data: {"done":true}\n\n`
 */
const sendMessage = asyncHandler(async (req, res) => {
  const { id: sessionId } = req.params;
  const { userId }        = req.user;
  const { message }       = req.body;

  if (!message || !message.trim()) {
    throw createError(400, 'MESSAGE_REQUIRED', 'message is required');
  }

  // ── Load and verify session ownership ─────────────────────────────────────
  const session = await ChatSession.findById(sessionId)
    .populate('template')
    .populate({ path: 'template', model: 'DocumentTemplate' });

  if (!session)                           throw createError(404, 'SESSION_NOT_FOUND', 'Session not found');
  if (!session.user.equals(userId))       throw createError(403, 'FORBIDDEN', 'This session does not belong to you');
  if (session.status === SESSION_STATUS.ABANDONED) throw createError(400, 'SESSION_ABANDONED', 'This session has been abandoned');
  if (session.status === SESSION_STATUS.COMPLETED)  throw createError(400, 'SESSION_COMPLETED', 'This session is already complete');

  const template = session.template;
  if (!template) throw createError(500, 'TEMPLATE_MISSING', 'Session template not found');

  // ── Resolve jurisdiction (cached on session or re-fetched) ─────────────────
  const jurisdictionRule = session.userState
    ? await JurisdictionRule.findForStateAndDocType(session.userState, session.templateSlug)
    : null;

  // ── Append user message to session ────────────────────────────────────────
  session.messages.push({ role: 'user', content: message.trim(), createdAt: new Date() });

  // ── Set SSE headers — from this point response is streaming ───────────────
  setSSEHeaders(res);

  // Handle client disconnect
  let clientDisconnected = false;
  req.on('close', () => { clientDisconnected = true; });

  let fullAiResponse = '';
  let isComplete     = false;
  let summary        = null;

  try {
    const { stream, getExtractionResult } = await getNextQuestion(session, template, jurisdictionRule);

    // ── Stream deltas to client ────────────────────────────────────────────
    for await (const delta of stream) {
      if (clientDisconnected) break;
      fullAiResponse += delta;
      sseWrite(res, { delta, done: false });
    }

    if (clientDisconnected) {
      logger.warn(`[chat/sendMessage] Client disconnected mid-stream, session: ${sessionId}`);
    }

    // ── Post-stream: extract fields and check completion ───────────────────
    const extraction = getExtractionResult();
    isComplete = extraction.isComplete;
    summary    = extraction.summary;

    // ── Update collectedData from AI-extracted fields ──────────────────────
    if (extraction.fields && Object.keys(extraction.fields).length > 0) {
      if (!session.collectedData) session.collectedData = new Map();
      Object.entries(extraction.fields).forEach(([k, v]) => {
        session.setField(k, v);
      });
    }

    // ── Recompute progress ─────────────────────────────────────────────────
    const requiredKeys       = (template.questionFlow || []).filter((q) => q.isRequired).map((q) => q.key);
    const collectedObj       = session.toCollectedDataObject();
    const answeredCount      = requiredKeys.filter((k) => collectedObj[k] !== undefined).length;
    session.answeredQuestions = answeredCount;
    session.totalQuestions   = requiredKeys.length;

    // ── Append AI message to session history ───────────────────────────────
    const assistantContent = isComplete
      ? (summary || 'All information collected! Generating your document now...')
      : fullAiResponse.trim();

    session.messages.push({
      role:           'assistant',
      content:        assistantContent,
      isQuestion:     !isComplete,
      isDataComplete: isComplete,
      createdAt:      new Date(),
    });

    // ── Update session status ──────────────────────────────────────────────
    if (isComplete) {
      session.status = SESSION_STATUS.DATA_COMPLETE;
    }

    await session.save();

    // ── Send final SSE event ───────────────────────────────────────────────
    if (isComplete) {
      sseWrite(res, {
        done:           true,
        dataComplete:   true,
        summary,
        sessionId:      session._id,
        progressPercent: 100,
        message:        'All information collected! You can now generate your document.',
      });
    } else {
      sseWrite(res, {
        done:            true,
        dataComplete:    false,
        progressPercent: session.progressPercent,
        answeredQuestions: answeredCount,
        totalQuestions:  requiredKeys.length,
      });
    }
  } catch (err) {
    logger.error(`[chat/sendMessage] Stream error for session ${sessionId}:`, { error: err.message });
    sseError(res, 'An error occurred while processing your message. Please try again.');
    return;
  }

  res.end();
});

// ─── getSession ───────────────────────────────────────────────────────────────

/**
 * GET /v1/chat/sessions/:id
 */
const getSession = asyncHandler(async (req, res) => {
  const { id: sessionId } = req.params;
  const { userId }        = req.user;

  const session = await ChatSession.findById(sessionId)
    .populate('template', 'name slug category complexity icon description')
    .populate('generatedDocument', 'title status isPaid pdfUrl');

  if (!session)                     throw createError(404, 'SESSION_NOT_FOUND', 'Session not found');
  if (!session.user.equals(userId)) throw createError(403, 'FORBIDDEN', 'This session does not belong to you');

  res.json({
    session: {
      _id:              session._id,
      status:           session.status,
      source:           session.source,
      userState:        session.userState,
      userLanguage:     session.userLanguage,
      progressPercent:  session.progressPercent,
      answeredQuestions: session.answeredQuestions,
      totalQuestions:   session.totalQuestions,
      messages:         session.messages,
      collectedData:    session.toCollectedDataObject(),
      template:         session.template,
      generatedDocument: session.generatedDocument,
      lastMessageAt:    session.lastMessageAt,
      completedAt:      session.completedAt,
      createdAt:        session.createdAt,
    },
  });
});

// ─── listSessions ─────────────────────────────────────────────────────────────

/**
 * GET /v1/chat/sessions
 */
const listSessions = asyncHandler(async (req, res) => {
  const { userId } = req.user;
  const page  = Math.max(1, parseInt(req.query.page)  || 1);
  const limit = Math.min(20, parseInt(req.query.limit) || 20);
  const status = req.query.status; // Optional filter

  const filter = { user: userId };
  if (status) filter.status = status;
  if (req.query.templateSlug) filter.templateSlug = req.query.templateSlug;

  const [sessions, total] = await Promise.all([
    ChatSession.find(filter)
      .populate('template', 'name slug category icon complexity')
      .select('-messages -collectedData') // Exclude heavy fields from list
      .sort({ lastMessageAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    ChatSession.countDocuments(filter),
  ]);

  res.json({
    sessions,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasMore:    page * limit < total,
    },
  });
});

// ─── abandonSession ───────────────────────────────────────────────────────────

/**
 * POST /v1/chat/sessions/:id/abandon
 */
const abandonSession = asyncHandler(async (req, res) => {
  const { id: sessionId } = req.params;
  const { userId }        = req.user;

  const session = await ChatSession.findById(sessionId);
  if (!session)                     throw createError(404, 'SESSION_NOT_FOUND', 'Session not found');
  if (!session.user.equals(userId)) throw createError(403, 'FORBIDDEN', 'This session does not belong to you');

  if ([SESSION_STATUS.COMPLETED, SESSION_STATUS.ABANDONED].includes(session.status)) {
    return res.json({ message: 'Session already finalised', status: session.status });
  }

  session.status      = SESSION_STATUS.ABANDONED;
  session.abandonedAt = new Date();
  await session.save();

  await AuditLog.log(req, 'chat.session.abandoned', 'ChatSession', session._id, {
    templateSlug: session.templateSlug,
    progressPercent: session.progressPercent,
  });

  res.json({ message: 'Session abandoned successfully', sessionId: session._id });
});

// ─── voiceMessage ─────────────────────────────────────────────────────────────

/**
 * POST /v1/chat/sessions/:id/voice
 * Accepts audio upload, transcribes via voice service, then processes as text.
 * Transcription is injected as a user message; rest flows through sendMessage logic.
 */
const voiceMessage = asyncHandler(async (req, res) => {
  const { id: sessionId } = req.params;
  const { userId }        = req.user;

  if (!req.file) throw createError(400, 'AUDIO_REQUIRED', 'Audio file is required');

  const session = await ChatSession.findById(sessionId);
  if (!session)                     throw createError(404, 'SESSION_NOT_FOUND', 'Session not found');
  if (!session.user.equals(userId)) throw createError(403, 'FORBIDDEN', 'This session does not belong to you');

  // Transcribe via voice service (HuggingFace Whisper in dev, OpenAI in prod)
  let transcribedText;
  try {
    const { transcribe } = require('../services/voice/voiceService');
    transcribedText = await transcribe(req.file.buffer, req.file.mimetype, session.userLanguage);
  } catch (err) {
    logger.error('[chat/voiceMessage] Transcription failed:', { error: err.message });
    throw createError(503, 'TRANSCRIPTION_FAILED', 'Audio transcription failed. Please try typing your response.');
  }

  if (!transcribedText || !transcribedText.trim()) {
    throw createError(400, 'TRANSCRIPTION_EMPTY', 'Could not transcribe audio. Please speak clearly and try again.');
  }

  // Return transcription — client shows it then calls sendMessage with it
  res.json({
    transcribedText: transcribedText.trim(),
    sessionId,
  });
});

module.exports = {
  createSession,
  sendMessage,
  getSession,
  listSessions,
  abandonSession,
  voiceMessage,
};
