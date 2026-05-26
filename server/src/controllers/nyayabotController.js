/**
 * nyayabotController.js
 * Handles all NyayaBot API endpoints.
 *
 * Quota by persona + plan:
 *   Citizen  free=5,  basic=20,  pro=unlimited
 *   Lawyer   free=0,  professional=40, firm=unlimited
 *   Paralegal free=5, professional=20, firm=40
 *
 * All AI responses use Server-Sent Events (SSE) for real-time streaming.
 */

const NyayaBotSession = require('../models/NyayaBotSession');
const User = require('../models/User.model');
const asyncHandler = require('../utils/asyncHandler');
const logger = require('../utils/logger');
const {
  generateNyayaBotResponse,
  generateGreeting,
  suggestTemplatesForQuery,
} = require('../services/ai/aiNyayaBotService');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Write a single SSE event to the response */
function sseWrite(res, eventType, payload) {
  res.write(`event: ${eventType}\ndata: ${JSON.stringify(payload)}\n\n`);
}

/** Configure response headers for SSE */
function initSSE(res) {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable Nginx buffering
  res.flushHeaders?.();
}

// ─── CREATE SESSION ───────────────────────────────────────────────────────────
exports.createSession = asyncHandler(async (req, res) => {
  const { language, contextType, contextRefId, source } = req.body;
  const userId = req.user.userId;

  const user = await User.findById(userId)
    .select('firstName persona subscription preferredLanguage jurisdiction')
    .lean();

  if (!user) return res.status(404).json({ error: 'User not found' });

  const resolvedLanguage = language || user.preferredLanguage || 'en';

  // Create session
  const session = await NyayaBotSession.create({
    user: userId,
    persona: user.persona?.toLowerCase(),
    language: resolvedLanguage,
    jurisdiction: user.jurisdiction || null,
    contextType: contextType || 'general',
    contextRefId: contextRefId || null,
    source: source || 'widget',
    title: 'New Conversation',
  });

  // Generate greeting as first message
  const greetingText = await generateGreeting(user.persona?.toLowerCase(), resolvedLanguage, user.firstName);
  session.messages.push({
    role: 'nyayabot',
    content: greetingText,
    followUpQuestions: [],
    citations: [],
    suggestedTemplates: [],
  });
  await session.save();

  // Quota info
  const { limit, unlimited } = NyayaBotSession.getQuotaConfig(user.persona?.toLowerCase(), user.subscription?.plan || 'free');
  const used = await NyayaBotSession.getDailyUsage(userId);

  logger.info('NyayaBot session created', { userId, sessionId: session._id });

  res.status(201).json({
    sessionId: session._id,
    title: session.title,
    language: resolvedLanguage,
    greeting: greetingText,
    quota: {
      used,
      limit: unlimited ? null : limit,
      remaining: unlimited ? null : Math.max(0, limit - used),
      unlimited,
    },
    createdAt: session.createdAt,
  });
});

// ─── GET SINGLE SESSION ───────────────────────────────────────────────────────
exports.getSession = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const userId = req.user.userId;

  const session = await NyayaBotSession.findById(sessionId).lean();
  if (!session) return res.status(404).json({ error: 'Session not found' });

  // Only owner or shared lawyer
  if (
    session.user.toString() !== userId &&
    session.sharedWithLawyer?.toString() !== userId
  ) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  const { limit, unlimited } = NyayaBotSession.getQuotaConfig(req.user.persona, req.user.plan);
  const used = await NyayaBotSession.getDailyUsage(userId);

  res.json({
    sessionId: session._id,
    title: session.title,
    language: session.language,
    persona: session.persona,
    jurisdiction: session.jurisdiction,
    contextType: session.contextType,
    messages: session.messages,
    isArchived: session.isArchived,
    isPinned: session.isPinned,
    quota: {
      used,
      limit: unlimited ? null : limit,
      remaining: unlimited ? null : Math.max(0, limit - used),
      unlimited,
    },
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  });
});

// ─── LIST SESSIONS ────────────────────────────────────────────────────────────
exports.listSessions = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const { archived = 'false', limit = 15, skip = 0 } = req.query;

  const filter = {
    user: userId,
    isArchived: archived === 'true',
  };

  const [sessions, total] = await Promise.all([
    NyayaBotSession.find(filter)
      .select('title language contextType isArchived isPinned updatedAt createdAt messages')
      .sort({ isPinned: -1, updatedAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .lean(),
    NyayaBotSession.countDocuments(filter),
  ]);

  // Attach message count and last message preview
  const enriched = sessions.map((s) => ({
    sessionId: s._id,
    title: s.title,
    language: s.language,
    contextType: s.contextType,
    isArchived: s.isArchived,
    isPinned: s.isPinned,
    messageCount: s.messages.length,
    lastMessage: s.messages.at(-1)
      ? {
          role: s.messages.at(-1).role,
          preview: s.messages.at(-1).content.slice(0, 80),
          createdAt: s.messages.at(-1).createdAt,
        }
      : null,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  }));

  res.json({ sessions: enriched, total, limit: parseInt(limit), skip: parseInt(skip) });
});

// ─── SEND MESSAGE (SSE streaming) ─────────────────────────────────────────────
exports.sendMessage = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const { content } = req.body;
  const userId = req.user.userId;

  // ── 1. Load session ──────────────────────────────────────────────────────
  const session = await NyayaBotSession.findById(sessionId);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  if (session.user.toString() !== userId) return res.status(403).json({ error: 'Unauthorized' });

  // ── 2. Quota check ───────────────────────────────────────────────────────
  const user = await User.findById(userId).select('persona subscription firstName').lean();
  const plan = user?.subscription?.plan || 'free';
  const { limit, unlimited } = NyayaBotSession.getQuotaConfig(user.persona?.toLowerCase(), plan);
  const used = await NyayaBotSession.getDailyUsage(userId);

  if (!unlimited && used >= limit) {
    return res.status(402).json({
      error: 'NYAYABOT_QUOTA_EXCEEDED',
      message: `You have used all ${limit} NyayaBot messages for today. Your quota resets at midnight IST.`,
      quota: { used, limit, remaining: 0, unlimited: false },
      upgradeUrl: '/pricing',
    });
  }

  // ── 3. Init SSE ──────────────────────────────────────────────────────────
  initSSE(res);

  // ── 4. Persist user message ──────────────────────────────────────────────
  session.messages.push({ role: 'user', content, createdAt: new Date() });
  // Auto-generate title from first message
  if (session.messages.filter((m) => m.role === 'user').length === 1) {
    session.autoTitle();
  }
  await session.save();

  // Send immediate acknowledgement over SSE
  sseWrite(res, 'status', { status: 'thinking' });

  // ── 5. Generate AI response ──────────────────────────────────────────────
  try {
    const aiResult = await generateNyayaBotResponse({
      userQuery: content,
      messageHistory: session.messages.slice(0, -1), // exclude the just-added user msg
      persona: session.persona,
      language: session.language,
      jurisdiction: session.jurisdiction,
      contextType: session.contextType,
      contextRefId: session.contextRefId,
    });

    // Keyword-based template suggestions as fallback if AI didn't return any
    if (!aiResult.suggestedTemplates.length) {
      aiResult.suggestedTemplates = await suggestTemplatesForQuery(content);
    }

    // ── 6. Persist NyayaBot response ─────────────────────────────────────
    const botMsg = {
      role: 'nyayabot',
      content: aiResult.content,
      citations: aiResult.citations || [],
      suggestedTemplates: aiResult.suggestedTemplates || [],
      followUpQuestions: aiResult.followUpQuestions || [],
      disclaimer: aiResult.disclaimer || '',
      createdAt: new Date(),
    };
    session.messages.push(botMsg);
    await session.save();

    const newUsed = used + 1;
    const remaining = unlimited ? null : Math.max(0, limit - newUsed);

    // ── 7. Send SSE events ───────────────────────────────────────────────
    sseWrite(res, 'message', {
      messageId: session.messages.at(-1)._id,
      role: 'nyayabot',
      content: aiResult.content,
      citations: aiResult.citations,
      suggestedTemplates: aiResult.suggestedTemplates,
      followUpQuestions: aiResult.followUpQuestions,
      disclaimer: aiResult.disclaimer,
    });

    sseWrite(res, 'quota', { used: newUsed, limit: unlimited ? null : limit, remaining, unlimited });
    sseWrite(res, 'done', { sessionId });
  } catch (err) {
    logger.error('NyayaBot message generation failed', { sessionId, error: err.message });
    sseWrite(res, 'error', { message: err.message || 'NyayaBot encountered an error. Please try again.' });
  } finally {
    res.end();
  }
});

// ─── THUMBS UP / DOWN feedback ────────────────────────────────────────────────
exports.rateMessage = asyncHandler(async (req, res) => {
  const { sessionId, messageId } = req.params;
  const { thumbsUp } = req.body; // boolean
  const userId = req.user.userId;

  const session = await NyayaBotSession.findById(sessionId);
  if (!session || session.user.toString() !== userId) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  const msg = session.messages.id(messageId);
  if (!msg) return res.status(404).json({ error: 'Message not found' });

  msg.thumbsUp = !!thumbsUp;
  await session.save();

  res.json({ ok: true, messageId, thumbsUp: msg.thumbsUp });
});

// ─── RATE SESSION ─────────────────────────────────────────────────────────────
exports.rateSession = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const { rating, feedback } = req.body;
  const userId = req.user.userId;

  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'Rating must be 1-5' });
  }

  const session = await NyayaBotSession.findOneAndUpdate(
    { _id: sessionId, user: userId },
    { sessionRating: rating, sessionFeedback: feedback || '' },
    { new: true }
  );

  if (!session) return res.status(404).json({ error: 'Session not found' });

  res.json({ ok: true, sessionId, rating });
});

// ─── ARCHIVE / UNARCHIVE ──────────────────────────────────────────────────────
exports.archiveSession = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const { archive = true } = req.body;
  const userId = req.user.userId;

  const session = await NyayaBotSession.findOneAndUpdate(
    { _id: sessionId, user: userId },
    { isArchived: archive },
    { new: true }
  );

  if (!session) return res.status(404).json({ error: 'Session not found' });

  res.json({ ok: true, sessionId, isArchived: session.isArchived });
});

// ─── PIN SESSION ──────────────────────────────────────────────────────────────
exports.pinSession = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const { pinned } = req.body;
  const userId = req.user.userId;

  const session = await NyayaBotSession.findOneAndUpdate(
    { _id: sessionId, user: userId },
    { isPinned: !!pinned },
    { new: true }
  );

  if (!session) return res.status(404).json({ error: 'Session not found' });

  res.json({ ok: true, sessionId, isPinned: session.isPinned });
});

// ─── DELETE SESSION ───────────────────────────────────────────────────────────
exports.deleteSession = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const userId = req.user.userId;

  const deleted = await NyayaBotSession.findOneAndDelete({ _id: sessionId, user: userId });
  if (!deleted) return res.status(404).json({ error: 'Session not found or unauthorized' });

  logger.info('NyayaBot session deleted', { userId, sessionId });
  res.json({ ok: true, sessionId });
});

// ─── SHARE SESSION WITH LAWYER ────────────────────────────────────────────────
exports.shareSession = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const { lawyerId, expiryDays = 30 } = req.body;
  const userId = req.user.userId;

  const session = await NyayaBotSession.findOne({ _id: sessionId, user: userId });
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const token = session.generateShareToken(expiryDays);
  if (lawyerId) session.sharedWithLawyer = lawyerId;
  await session.save();

  res.json({
    ok: true,
    shareToken: token,
    shareUrl: `${process.env.CLIENT_URL}/nyayabot/shared/${token}`,
    expiryDate: session.shareTokenExpiry,
  });
});

// ─── GET SHARED SESSION (public) ──────────────────────────────────────────────
exports.getSharedSession = asyncHandler(async (req, res) => {
  const { shareToken } = req.params;

  const session = await NyayaBotSession.findOne({ shareToken })
    .populate('user', 'firstName phone persona')
    .lean();

  if (!session) return res.status(404).json({ error: 'Shared session not found' });
  if (session.shareTokenExpiry && session.shareTokenExpiry < new Date()) {
    return res.status(410).json({ error: 'Share link has expired' });
  }

  res.json({
    sessionId: session._id,
    title: session.title,
    language: session.language,
    persona: session.persona,
    messages: session.messages,
    owner: session.user,
    createdAt: session.createdAt,
  });
});

// ─── GET QUOTA STATUS ─────────────────────────────────────────────────────────
exports.getQuota = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const { persona, plan } = req.user;

  const { limit, unlimited } = NyayaBotSession.getQuotaConfig(persona || 'citizen', plan || 'free');
  const used = await NyayaBotSession.getDailyUsage(userId);
  const remaining = unlimited ? null : Math.max(0, limit - used);

  // Next reset: next midnight IST
  const nextReset = new Date(NyayaBotSession.todayMidnightIST().getTime() + 24 * 60 * 60 * 1000);

  res.json({
    persona: persona || 'citizen',
    plan: plan || 'free',
    quota: { used, limit: unlimited ? null : limit, remaining, unlimited },
    nextResetIST: nextReset.toISOString(),
  });
});
