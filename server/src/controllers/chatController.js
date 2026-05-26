/**
 * Chat Controller — manages chat sessions, messages, and real-time streaming
 * Integrates quota checking, AI responses, and payment gating
 */

const Chat = require('../models/Chat');
const User = require('../models/User');
const Document = require('../models/Document');
const CaseTracker = require('../models/CaseTracker');
const aiChatService = require('../services/ai/aiChatService');
const voiceService = require('../services/voice/voiceService');
const asyncHandler = require('../../utils/asyncHandler');
const logger = require('../../utils/logger');
const { v4: uuidv4 } = require('uuid');

// ============================================================================
// CREATE CHAT SESSION
// ============================================================================
exports.createChatSession = asyncHandler(async (req, res) => {
  const { title, description, linkedDocuments, linkedCases, language } = req.body;
  const userId = req.user.userId;

  const user = await User.findById(userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const chatSession = new Chat({
    user: userId,
    persona: user.persona?.toLowerCase(),
    title: title || `Legal Query #${Date.now().toString(36).toUpperCase()}`,
    description,
    linkedDocuments,
    linkedCases,
    language: language || user.preferredLanguage || 'en',
    jurisdiction: user.jurisdiction,
    source: req.body.source || 'web',
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });

  await chatSession.save();

  logger.info('Chat session created', { userId, sessionId: chatSession._id });

  res.status(201).json({
    sessionId: chatSession._id,
    title: chatSession.title,
    createdAt: chatSession.createdAt,
    messageQuotaRemaining: await Chat.getDailyQuota(userId, user.subscription.plan),
  });
});

// ============================================================================
// GET SINGLE CHAT SESSION
// ============================================================================
exports.getChatSession = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const userId = req.user.userId;

  const chat = await Chat.findById(sessionId).populate([
    { path: 'user', select: 'phone email persona' },
    { path: 'linkedDocuments', select: 'title template createdAt' },
    { path: 'linkedCases', select: 'caseTitle cnrNumber nextHearingDate' },
  ]);

  if (!chat) {
    return res.status(404).json({ error: 'Chat not found' });
  }

  // Authorization: user owns chat OR chat is shared with them
  if (chat.user._id.toString() !== userId && chat.sharedWithLawyer?.toString() !== userId) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  res.json({
    sessionId: chat._id,
    title: chat.title,
    description: chat.description,
    messages: chat.messages,
    linkedDocuments: chat.linkedDocuments,
    linkedCases: chat.linkedCases,
    messageCount: chat.messages.length,
    quotaRemaining: await Chat.getDailyQuota(userId, req.user.plan),
    isArchived: chat.isArchived,
    createdAt: chat.createdAt,
  });
});

// ============================================================================
// LIST ALL CHATS FOR USER
// ============================================================================
exports.listChats = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const { status = 'active', limit = 10, skip = 0 } = req.query;

  const filter = {
    $or: [{ user: userId }, { sharedWithLawyer: userId }],
  };

  if (status === 'active') {
    filter.isArchived = false;
  } else if (status === 'archived') {
    filter.isArchived = true;
  }

  const chats = await Chat.find(filter)
    .select('title description messageCount status createdAt updatedAt isArchived')
    .sort({ updatedAt: -1 })
    .limit(parseInt(limit))
    .skip(parseInt(skip));

  const total = await Chat.countDocuments(filter);

  res.json({
    chats,
    total,
    limit: parseInt(limit),
    skip: parseInt(skip),
  });
});

// ============================================================================
// SEND MESSAGE & GET AI RESPONSE (with quota check)
// ============================================================================
exports.sendMessage = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const { content, audioUrl } = req.body;
  const userId = req.user.userId;

  // 1. Fetch chat session
  const chat = await Chat.findById(sessionId);
  if (!chat) {
    return res.status(404).json({ error: 'Chat session not found' });
  }

  // 2. Authorization
  if (chat.user.toString() !== userId) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  // 3. Check daily quota
  const user = await User.findById(userId);
  const remainingQuota = await Chat.getDailyQuota(userId, user.subscription.plan);

  if (remainingQuota <= 0) {
    return res.status(402).json({
      error: 'QUOTA_EXCEEDED',
      message: `You have reached your daily message limit (${
        user.subscription.plan === 'free' ? 5 : user.subscription.plan === 'basic' ? 15 : 'unlimited'
      }). Upgrade to ${user.subscription.plan === 'free' ? 'Basic' : 'Pro'} for more messages.`,
      upgradeUrl: '/pricing',
      nextResetTime: chat.lastMessageResetDate,
    });
  }

  // 4. Add user message to chat
  const userMessage = {
    role: 'user',
    content,
    timestamp: new Date(),
    audioUrl: audioUrl || null,
  };

  chat.messages.push(userMessage);
  chat.dailyMessageCount++;
  chat.updatedAt = new Date();
  await chat.save();

  // 5. Send SSE streaming response for AI
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  try {
    // 6. Generate AI response with context
    const aiContext = {
      userId,
      linkedDocuments: chat.linkedDocuments,
      linkedCases: chat.linkedCases,
      recentQuestions: chat.messages
        .filter((m) => m.role === 'user')
        .slice(-3)
        .map((m) => m.content),
    };

    const aiResponse = await aiChatService.generateChatResponse({
      userQuery: content,
      jurisdiction: chat.jurisdiction,
      language: chat.language,
      persona: chat.persona,
      context: aiContext,
    });

    // 7. Save AI response to chat
    const assistantMessage = {
      role: 'assistant',
      content: aiResponse.response,
      timestamp: new Date(),
    };

    chat.messages.push(assistantMessage);
    await chat.save();

    // 8. Stream response back in real-time
    res.write(`data: ${JSON.stringify({ type: 'response', ...aiResponse })}\n\n`);
    res.write(
      `data: ${JSON.stringify({
        type: 'complete',
        remainingQuota: remainingQuota - 1,
      })}\n\n`
    );
  } catch (error) {
    logger.error('AI response generation failed', {
      sessionId,
      userId,
      error: error.message,
    });
    res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
  } finally {
    res.end();
  }
});

// ============================================================================
// VOICE MESSAGE INPUT (audio → transcription → AI)
// ============================================================================
exports.sendVoiceMessage = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const userId = req.user.userId;

  if (!req.file) {
    return res.status(400).json({ error: 'No audio file provided' });
  }

  // 1. Fetch chat session
  const chat = await Chat.findById(sessionId);
  if (!chat) {
    return res.status(404).json({ error: 'Chat session not found' });
  }

  // 2. Check authorization
  if (chat.user.toString() !== userId) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  // 3. Transcribe audio
  let transcript;
  try {
    transcript = await voiceService.transcribeAudio(req.file.buffer);
  } catch (error) {
    logger.error('Voice transcription failed', { sessionId, error: error.message });
    return res.status(500).json({ error: 'Failed to transcribe audio' });
  }

  // 4. Add voice message with transcript
  const voiceMessage = {
    role: 'user',
    content: transcript,
    audioUrl: req.file.location || `audio-${uuidv4()}`, // from storage provider
    audioTranscript: transcript,
    timestamp: new Date(),
  };

  chat.messages.push(voiceMessage);
  chat.dailyMessageCount++;
  await chat.save();

  // 5. Generate AI response (same as text)
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const user = await User.findById(userId);
    const aiContext = {
      userId,
      linkedDocuments: chat.linkedDocuments,
      linkedCases: chat.linkedCases,
    };

    const aiResponse = await aiChatService.generateChatResponse({
      userQuery: transcript,
      jurisdiction: chat.jurisdiction,
      language: chat.language,
      persona: chat.persona,
      context: aiContext,
    });

    // Save AI response
    const assistantMessage = {
      role: 'assistant',
      content: aiResponse.response,
      timestamp: new Date(),
    };

    chat.messages.push(assistantMessage);
    await chat.save();

    // Stream response
    res.write(
      `data: ${JSON.stringify({
        type: 'voiceTranscript',
        transcript,
      })}\n\n`
    );
    res.write(`data: ${JSON.stringify({ type: 'response', ...aiResponse })}\n\n`);
    res.write(
      `data: ${JSON.stringify({
        type: 'complete',
        remainingQuota: (await Chat.getDailyQuota(userId, user.subscription.plan)) - 1,
      })}\n\n`
    );
  } catch (error) {
    logger.error('Voice response generation failed', { sessionId, error: error.message });
    res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
  } finally {
    res.end();
  }
});

// ============================================================================
// SHARE CHAT WITH LAWYER
// ============================================================================
exports.shareChat = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const { lawyerId, expiryDays = 30 } = req.body;
  const userId = req.user.userId;

  // 1. Check user owns chat
  const chat = await Chat.findById(sessionId);
  if (!chat || chat.user.toString() !== userId) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  // 2. Generate share token
  const shareToken = chat.generateShareToken();
  chat.shareTokenExpiry = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000);
  if (lawyerId) {
    chat.sharedWithLawyer = lawyerId;
  }
  await chat.save();

  res.json({
    shareToken,
    shareUrl: `${process.env.CLIENT_URL}/chat/shared/${shareToken}`,
    expiryDate: chat.shareTokenExpiry,
  });
});

// ============================================================================
// GET SHARED CHAT (public, requires valid token)
// ============================================================================
exports.getSharedChat = asyncHandler(async (req, res) => {
  const { shareToken } = req.params;

  const chat = await Chat.findOne({ shareToken })
    .populate('user', 'phone email firstName')
    .populate('linkedDocuments', 'title template')
    .populate('linkedCases', 'caseTitle cnrNumber');

  if (!chat) {
    return res.status(404).json({ error: 'Chat not found or expired' });
  }

  // Check expiry
  if (chat.shareTokenExpiry && chat.shareTokenExpiry < new Date()) {
    return res.status(410).json({ error: 'Share link expired' });
  }

  res.json({
    sessionId: chat._id,
    title: chat.title,
    description: chat.description,
    messages: chat.messages,
    owner: chat.user,
    linkedDocuments: chat.linkedDocuments,
    linkedCases: chat.linkedCases,
    createdAt: chat.createdAt,
  });
});

// ============================================================================
// ARCHIVE CHAT
// ============================================================================
exports.archiveChat = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const userId = req.user.userId;

  const chat = await Chat.findById(sessionId);
  if (!chat || chat.user.toString() !== userId) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  chat.isArchived = true;
  await chat.save();

  res.json({ message: 'Chat archived', sessionId });
});

// ============================================================================
// DELETE CHAT (soft delete via archive)
// ============================================================================
exports.deleteChat = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const userId = req.user.userId;

  const chat = await Chat.findById(sessionId);
  if (!chat || chat.user.toString() !== userId) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  await Chat.findByIdAndDelete(sessionId);

  res.json({ message: 'Chat deleted', sessionId });
});

// ============================================================================
// RATE CHAT RESPONSE
// ============================================================================
exports.rateChatResponse = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const { rating, feedback } = req.body;
  const userId = req.user.userId;

  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'Rating must be between 1 and 5' });
  }

  const chat = await Chat.findById(sessionId);
  if (!chat || chat.user.toString() !== userId) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  chat.userRating = rating;
  chat.userFeedback = feedback || '';
  await chat.save();

  logger.info('Chat rated', { sessionId, rating, userId });

  res.json({ message: 'Rating saved', rating });
});

// ============================================================================
// GET DAILY QUOTA STATUS
// ============================================================================
exports.getQuotaStatus = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const user = await User.findById(userId).select('subscription.plan');

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const quotaMap = {
    free: 5,
    basic: 15,
    pro: null, // unlimited
  };

  const totalQuota = quotaMap[user.subscription.plan] || 5;
  const remainingQuota = await Chat.getDailyQuota(userId, user.subscription.plan);

  res.json({
    plan: user.subscription.plan,
    totalDailyQuota: totalQuota,
    remainingMessages: remainingQuota,
    unlimited: totalQuota === null,
    resetTime: new Date().toISOString().split('T')[0] + 'T00:00:00Z', // Next midnight IST
  });
});
