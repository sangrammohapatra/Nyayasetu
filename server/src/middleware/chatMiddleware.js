/**
 * Chat Quota Middleware — enforces daily message quotas
 * Placed BEFORE route handlers to prevent unauthorized usage
 *
 * Usage in routes:
 *   router.post('/chat/sessions/:id/message', checkChatQuota, controller.sendMessage)
 */

const Chat = require('../models/Chat');
const User = require('../models/User');
const logger = require('../../utils/logger');

/**
 * Check if user has daily chat quota remaining
 * Blocks request if quota exceeded (unless user is on unlimited plan)
 */
const checkChatQuota = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const userPlan = req.user.plan; // from JWT

    // Unlimited plans skip quota checks
    if (userPlan === 'pro') {
      return next();
    }

    // Get quota limits by plan
    const quotaMap = {
      free: 5,
      basic: 15,
    };

    const dailyLimit = quotaMap[userPlan] || 5;

    // Get remaining quota
    const remainingQuota = await Chat.getDailyQuota(userId, userPlan);

    if (remainingQuota <= 0) {
      logger.warn('Chat quota exceeded', { userId, plan: userPlan });

      return res.status(402).json({
        error: 'QUOTA_EXCEEDED',
        message: `You have reached your daily message limit (${dailyLimit}). Upgrade to ${
          userPlan === 'free' ? 'Basic' : 'Pro'
        } for more messages.`,
        plan: userPlan,
        dailyLimit,
        remainingQuota: 0,
        resetTime: new Date().toISOString().split('T')[0] + 'T00:00:00Z',
        upgradeUrl: '/pricing',
      });
    }

    // Attach quota info to request
    req.chatQuota = {
      remaining: remainingQuota,
      limit: dailyLimit,
      unlimited: userPlan === 'pro',
    };

    next();
  } catch (error) {
    logger.error('Chat quota check failed', { error: error.message });
    // Don't block on error; log and continue
    next();
  }
};

/**
 * Check if user has voice input feature enabled
 * Voice input is a premium feature (Basic+)
 */
const checkVoiceInputAccess = async (req, res, next) => {
  try {
    const userPlan = req.user.plan;

    // Voice input disabled for free users
    if (userPlan === 'free') {
      return res.status(402).json({
        error: 'FEATURE_LOCKED',
        message: 'Voice input is available in Basic plan and above',
        requiredPlan: 'basic',
        upgradeUrl: '/pricing',
      });
    }

    next();
  } catch (error) {
    logger.error('Voice input access check failed', { error: error.message });
    next();
  }
};

/**
 * Limit message length to prevent abuse
 */
const validateMessageLength = (req, res, next) => {
  const { content } = req.body;

  if (!content || typeof content !== 'string') {
    return res.status(400).json({
      error: 'INVALID_MESSAGE',
      message: 'Message content is required and must be text',
    });
  }

  const maxLength = 5000; // 5KB per message
  if (content.length > maxLength) {
    return res.status(413).json({
      error: 'MESSAGE_TOO_LONG',
      message: `Message must be under ${maxLength} characters`,
      limit: maxLength,
      provided: content.length,
    });
  }

  // Warn on very short messages (likely accidental)
  if (content.trim().length < 3) {
    return res.status(400).json({
      error: 'MESSAGE_TOO_SHORT',
      message: 'Message must be at least 3 characters',
    });
  }

  next();
};

/**
 * Rate limit for chat endpoints
 * Prevents brute-force attempts to spam chats
 */
const chatRateLimiter = require('express-rate-limit');

const chatMessageLimiter = chatRateLimiter({
  windowMs: 1 * 60 * 1000, // 1 minute window
  max: 5, // 5 messages per minute per user
  keyGenerator: (req) => req.user?.userId || req.ip,
  handler: (req, res) => {
    res.status(429).json({
      error: 'RATE_LIMITED',
      message: 'Too many messages. Please wait before sending another message.',
      retryAfter: '1 minute',
    });
  },
  skip: (req) => {
    // Skip rate limiting for pro users
    return req.user?.plan === 'pro';
  },
});

const voiceMessageLimiter = chatRateLimiter({
  windowMs: 1 * 60 * 1000, // 1 minute window
  max: 2, // 2 voice messages per minute
  keyGenerator: (req) => req.user?.userId || req.ip,
  handler: (req, res) => {
    res.status(429).json({
      error: 'RATE_LIMITED',
      message: 'Too many voice messages. Please wait before sending another.',
      retryAfter: '1 minute',
    });
  },
});

/**
 * Log chat activity for analytics
 */
const logChatActivity = async (req, res, next) => {
  const userId = req.user?.userId;
  const sessionId = req.params.sessionId;

  // Log in background (don't block)
  setImmediate(async () => {
    try {
      const AuditLog = require('../models/AuditLog');
      await AuditLog.create({
        user: userId,
        action: 'CHAT_MESSAGE',
        entity: 'Chat',
        entityId: sessionId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        metadata: {
          messageType: req.body.audioUrl ? 'voice' : 'text',
          quotaRemaining: req.chatQuota?.remaining,
        },
      });
    } catch (error) {
      logger.warn('Failed to log chat activity', { error: error.message });
    }
  });

  next();
};

/**
 * Export all middleware
 */
module.exports = {
  checkChatQuota,
  checkVoiceInputAccess,
  validateMessageLength,
  chatMessageLimiter,
  voiceMessageLimiter,
  logChatActivity,
};
