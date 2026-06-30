/**
 * server/src/controllers/admin.controller.js
 */

'use strict';

const mongoose = require('mongoose');

const User = require('../models/User.model');
const LawyerProfile = require('../models/LawyerProfile.model');
const NotaryProfile = require('../models/NotaryProfile.model');
const Document = require('../models/Document.model');
const Payment = require('../models/Payment.model');
const Consultation = require('../models/Consultation.model');
const CaseTracker = require('../models/CaseTracker.model');
const Notification = require('../models/Notification.model');
const Subscription = require('../models/Subscription.model');
const AuditLog = require('../models/AuditLog.model');

const razorpayService = require('../services/payment/razorpayService');

const whatsappService = require('../services/notification/whatsappService');
const emailService = require('../services/notification/emailService');
const asyncHandler = require('../utils/asyncHandler');
const logger = require('../utils/logger');
const { getRedisClient } = require('../config/redis');

/* ---------------------------------------------------------------------------
 * verifyLawyer
 * POST /v1/admin/lawyers/:id/verify
 * id = LawyerProfile._id
 * ------------------------------------------------------------------------ */
const verifyLawyer = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'INVALID_ID', message: 'Invalid lawyer profile id' });
  }

  const profile = await LawyerProfile.findById(id).populate('user', 'name email phone whatsappOptIn whatsappNumber');
  if (!profile) {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'Lawyer profile not found' });
  }

  if (profile.isVerified) {
    return res.status(409).json({ error: 'ALREADY_VERIFIED', message: 'Lawyer is already verified' });
  }

  profile.isVerified = true;
  profile.verificationStatus = 'approved';
  profile.verifiedAt = new Date();
  profile.verifiedBy = req.user.userId;
  await profile.save();

  const lawyerUser = profile.user;

  // WhatsApp notification (best-effort)
  if (lawyerUser && lawyerUser.whatsappOptIn && lawyerUser.whatsappNumber) {
    try {
      await whatsappService.sendMessage(
        lawyerUser.whatsappNumber,
        `✅ *NyayaSetu* — Congratulations, ${lawyerUser.name || ''}!\n\nYour lawyer profile has been verified. You are now live on the platform and can start accepting consultations.\n\nLog in at nyayasetu.in to complete your profile.`
      );
    } catch (err) {
      logger.warn('[admin.controller] verifyLawyer WA notify failed', { error: err.message });
    }
  }

  // Email notification (best-effort)
  if (lawyerUser && lawyerUser.email) {
    try {
      await emailService.sendEmail({
        to: lawyerUser.email,
        subject: 'Your NyayaSetu lawyer profile is now verified ✅',
        html: emailService.welcomeEmail(lawyerUser.name || 'Advocate'),
      });
    } catch (err) {
      logger.warn('[admin.controller] verifyLawyer email notify failed', { error: err.message });
    }
  }

  // In-app notification
  try {
    await Notification.createForUser({
      userId: lawyerUser._id,
      type: 'lawyer_verified',
      title: 'Your profile is verified',
      body: 'Congratulations! Your lawyer profile has been verified. You are now visible to citizens on NyayaSetu.',
      data: { lawyerProfileId: profile._id },
      actionUrl: '/lawyer/dashboard',
      io: req.app.get('io'),
    });
  } catch (_) {}

  logger.info('[admin.controller] Lawyer verified', {
    lawyerProfileId: profile._id,
    adminUserId: req.user.userId,
  });

  return res.json({ ok: true, lawyerProfileId: profile._id, isVerified: true });
});

/* ---------------------------------------------------------------------------
 * getStats
 * GET /v1/admin/stats
 * Returns platform-wide summary statistics.
 * ------------------------------------------------------------------------ */
const getStats = asyncHandler(async (req, res) => {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  try {
    const [
      totalUsers,
      totalDocuments,
      activeLawyers,
      todaySignups,
      paymentAgg,
      activeSubscriptions,
    ] = await Promise.all([
      User.countDocuments({}),
      Document.countDocuments({}),
      LawyerProfile.countDocuments({ isVerified: true }),
      User.countDocuments({ createdAt: { $gte: todayStart } }),
      Payment.aggregate([
        { $match: { status: 'paid' } },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
      Subscription.countDocuments({ isActive: true }),
    ]);

    const totalPaymentsPaise = paymentAgg.length ? paymentAgg[0].total : 0;
    const totalPaymentCount = paymentAgg.length ? paymentAgg[0].count : 0;

    return res.json({
      totalUsers,
      totalDocuments,
      activeLawyers,
      todaySignups,
      totalPayments: {
        amountInPaise: totalPaymentsPaise,
        amountInRupees: (totalPaymentsPaise / 100).toFixed(2),
        count: totalPaymentCount,
      },
      activeSubscriptions,
    });
  } catch (err) {
    logger.error('[admin.controller] getStats failed', { error: err.message });
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to load stats' });
  }
});

/* ---------------------------------------------------------------------------
 * listUsers
 * GET /v1/admin/users
 * Query: persona, page, limit, search (name/phone/email), plan
 * ------------------------------------------------------------------------ */
const listUsers = asyncHandler(async (req, res) => {
  const {
    persona,
    plan,
    search,
    page = 1,
    limit = 20,
  } = req.query;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (pageNum - 1) * limitNum;

  const filter = {};

  if (persona) filter.persona = { $regex: new RegExp(`^${persona}$`, 'i') };
  if (plan) filter['subscription.plan'] = plan;

  if (search) {
    const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [
      { name: { $regex: escapedSearch, $options: 'i' } },
      { phone: { $regex: escapedSearch, $options: 'i' } },
      { email: { $regex: escapedSearch, $options: 'i' } },
    ];
  }

  try {
    const [users, total] = await Promise.all([
      User.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .select('-refreshTokens -__v')
        .lean(),
      User.countDocuments(filter),
    ]);

    return res.json({
      users,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.max(1, Math.ceil(total / limitNum)),
    });
  } catch (err) {
    logger.error('[admin.controller] listUsers failed', { error: err.message });
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to load users' });
  }
});

/* ---------------------------------------------------------------------------
 * getUser
 * GET /v1/admin/users/:id
 * Full profile + all documents + all cases
 * ------------------------------------------------------------------------ */
const getUser = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'INVALID_ID', message: 'Invalid user id' });
  }

  try {
    const [user, documents, cases, lawyerProfile, subscriptions] = await Promise.all([
      User.findById(id).select('-refreshTokens -__v').lean(),
      Document.find({ user: id })
        .sort({ createdAt: -1 })
        .select('title template status isPaid accessType createdAt pdfUrl')
        .populate('template', 'slug name')
        .lean(),
      CaseTracker.find({ user: id })
        .sort({ createdAt: -1 })
        .lean(),
      LawyerProfile.findOne({ user: id }).lean(),
      Subscription.find({ user: id }).sort({ createdAt: -1 }).lean(),
    ]);

    if (!user) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'User not found' });
    }

    return res.json({
      user,
      documents,
      cases,
      lawyerProfile: lawyerProfile || null,
      subscriptions,
    });
  } catch (err) {
    logger.error('[admin.controller] getUser failed', { id, error: err.message });
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to load user' });
  }
});

/* ---------------------------------------------------------------------------
 * getAuditLogs
 * GET /v1/admin/audit-logs
 * Query: action, entity, userId, success, page, limit
 * ------------------------------------------------------------------------ */
const getAuditLogs = asyncHandler(async (req, res) => {
  const {
    action,
    entity,
    userId,
    success,
    page  = 1,
    limit = 50,
  } = req.query;

  const pageNum  = Math.max(1, parseInt(page, 10)  || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
  const skip     = (pageNum - 1) * limitNum;

  const filter = {};
  if (action)  filter.action = { $regex: action.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
  if (entity)  filter.entity = entity;
  if (userId && mongoose.Types.ObjectId.isValid(userId)) filter.user = userId;
  if (success !== undefined) filter.success = success === 'true';

  try {
    const [logs, total] = await Promise.all([
      AuditLog.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate('user', 'name phone email persona')
        .lean(),
      AuditLog.countDocuments(filter),
    ]);

    return res.json({
      logs,
      total,
      page:       pageNum,
      limit:      limitNum,
      totalPages: Math.max(1, Math.ceil(total / limitNum)),
    });
  } catch (err) {
    logger.error('[admin.controller] getAuditLogs failed', { error: err.message });
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to load audit logs' });
  }
});

/* ---------------------------------------------------------------------------
 * listTemplates / createTemplate / updateTemplate
 * Basic CRUD exposed to admin so templates can be managed without a DB client.
 * ------------------------------------------------------------------------ */
const DocumentTemplate = require('../models/DocumentTemplate.model');

const listTemplates = asyncHandler(async (req, res) => {
  const templates = await DocumentTemplate.find({}).sort({ category: 1, name: 1 }).lean();
  return res.json({ templates });
});

const createTemplate = asyncHandler(async (req, res) => {
  try {
    const template = await DocumentTemplate.create(req.body);
    return res.status(201).json({ template });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'DUPLICATE_KEY', message: 'A template with this slug already exists' });
    }
    logger.error('[admin.controller] createTemplate failed', { error: err.message });
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: err.message });
  }
});

const updateTemplate = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'INVALID_ID', message: 'Invalid template id' });
  }

  try {
    const template = await DocumentTemplate.findByIdAndUpdate(
      id,
      { $set: req.body },
      { new: true, runValidators: true }
    );
    if (!template) return res.status(404).json({ error: 'NOT_FOUND', message: 'Template not found' });
    return res.json({ template });
  } catch (err) {
    logger.error('[admin.controller] updateTemplate failed', { id, error: err.message });
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: err.message });
  }
});

/* ---------------------------------------------------------------------------
 * listLawyers
 * GET /v1/admin/lawyers
 * Query: status (pending|under_review|approved|rejected), search, page, limit
 * Returns LawyerProfile documents with user populated — IDs returned are
 * LawyerProfile._id, which the verify/reject routes expect.
 * ------------------------------------------------------------------------ */
const listLawyers = asyncHandler(async (req, res) => {
  const { status, search, page = 1, limit = 20 } = req.query;

  const pageNum  = Math.max(1, parseInt(page,  10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip     = (pageNum - 1) * limitNum;

  const filter = {};
  if (status) filter.verificationStatus = status;

  if (search) {
    const esc = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const matchingUsers = await User.find({
      persona: 'lawyer',
      $or: [
        { name:  { $regex: esc, $options: 'i' } },
        { email: { $regex: esc, $options: 'i' } },
        { phone: { $regex: esc, $options: 'i' } },
      ],
    }).select('_id').lean();

    if (matchingUsers.length === 0) {
      return res.json({ lawyers: [], total: 0, page: pageNum, limit: limitNum, totalPages: 0 });
    }
    filter.user = { $in: matchingUsers.map((u) => u._id) };
  }

  try {
    const [lawyers, total] = await Promise.all([
      LawyerProfile.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate('user', 'name email phone isActive')
        .lean(),
      LawyerProfile.countDocuments(filter),
    ]);

    return res.json({
      lawyers,
      total,
      page:       pageNum,
      limit:      limitNum,
      totalPages: Math.max(1, Math.ceil(total / limitNum)),
    });
  } catch (err) {
    logger.error('[admin.controller] listLawyers failed', { error: err.message });
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to load lawyers' });
  }
});

/* ---------------------------------------------------------------------------
 * rejectLawyer
 * POST /v1/admin/lawyers/:id/reject
 * id = LawyerProfile._id
 * body: { reason?: string }
 * ------------------------------------------------------------------------ */
const rejectLawyer = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'INVALID_ID', message: 'Invalid lawyer profile id' });
  }

  const profile = await LawyerProfile.findById(id).populate('user', 'name email phone whatsappOptIn whatsappNumber');
  if (!profile) {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'Lawyer profile not found' });
  }

  profile.isVerified = false;
  profile.verificationStatus = 'rejected';
  profile.rejectedAt = new Date();
  profile.rejectedBy = req.user.userId;
  if (reason) profile.rejectionReason = reason;
  await profile.save();

  const lawyerUser = profile.user;

  // Invalidate any active sessions so a rejected/revoked lawyer cannot keep operating.
  if (lawyerUser) {
    await User.findByIdAndUpdate(lawyerUser._id, { $set: { refreshTokens: [] } });
    const redis = getRedisClient();
    if (redis) {
      await redis.set(`user:suspended:${lawyerUser._id}`, '1', 'EX', 3600);
    }
  }

  // WhatsApp notification (best-effort)
  if (lawyerUser && lawyerUser.whatsappOptIn && lawyerUser.whatsappNumber) {
    try {
      const reasonText = reason ? `\n\nReason: ${reason}` : '';
      await whatsappService.sendMessage(
        lawyerUser.whatsappNumber,
        `❌ *NyayaSetu* — Hi ${lawyerUser.name || ''},\n\nWe were unable to verify your lawyer profile at this time.${reasonText}\n\nPlease log in at nyayasetu.in to update your documents and resubmit.`
      );
    } catch (err) {
      logger.warn('[admin.controller] rejectLawyer WA notify failed', { error: err.message });
    }
  }

  // Email notification (best-effort)
  if (lawyerUser && lawyerUser.email) {
    try {
      await emailService.sendEmail({
        to: lawyerUser.email,
        subject: 'Update on your NyayaSetu lawyer profile verification',
        html: `<p>Dear ${lawyerUser.name || 'Advocate'},</p>
<p>We were unable to verify your lawyer profile at this time.</p>
${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
<p>Please log in to <a href="https://nyayasetu.in">nyayasetu.in</a>, update your documents, and resubmit for review.</p>
<p>If you have questions, please contact support@nyayasetu.in</p>`,
      });
    } catch (err) {
      logger.warn('[admin.controller] rejectLawyer email notify failed', { error: err.message });
    }
  }

  // In-app notification
  try {
    await Notification.createForUser({
      userId: lawyerUser._id,
      type: 'lawyer_rejected',
      title: 'Profile verification update',
      body: reason
        ? `Your lawyer profile could not be verified. Reason: ${reason}`
        : 'Your lawyer profile could not be verified at this time. Please update your documents and resubmit.',
      data: { lawyerProfileId: profile._id },
      actionUrl: '/lawyer/setup',
      io: req.app.get('io'),
    });
  } catch (_) {}

  logger.info('[admin.controller] Lawyer rejected', {
    lawyerProfileId: profile._id,
    adminUserId: req.user.userId,
    reason,
  });

  return res.json({ ok: true, lawyerProfileId: profile._id, verificationStatus: 'rejected' });
});

/* ---------------------------------------------------------------------------
 * listNotaries
 * GET /v1/admin/notaries
 * Query: status (pending|under_review|approved|rejected), search, page, limit
 * ------------------------------------------------------------------------ */
const listNotaries = asyncHandler(async (req, res) => {
  const { status, search, page = 1, limit = 20 } = req.query;

  const pageNum  = Math.max(1, parseInt(page,  10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip     = (pageNum - 1) * limitNum;

  const filter = {};
  if (status) filter.verificationStatus = status;

  if (search) {
    const esc = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const matchingUsers = await User.find({
      persona: { $regex: /^notary$/i },
      $or: [
        { name:  { $regex: esc, $options: 'i' } },
        { email: { $regex: esc, $options: 'i' } },
        { phone: { $regex: esc, $options: 'i' } },
      ],
    }).select('_id').lean();

    if (matchingUsers.length === 0) {
      return res.json({ notaries: [], total: 0, page: pageNum, limit: limitNum, totalPages: 0 });
    }
    filter.user = { $in: matchingUsers.map((u) => u._id) };
  }

  try {
    const [notaries, total] = await Promise.all([
      NotaryProfile.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate('user', 'name email phone isActive')
        .lean(),
      NotaryProfile.countDocuments(filter),
    ]);

    return res.json({
      notaries,
      total,
      page:       pageNum,
      limit:      limitNum,
      totalPages: Math.max(1, Math.ceil(total / limitNum)),
    });
  } catch (err) {
    logger.error('[admin.controller] listNotaries failed', { error: err.message });
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to load notaries' });
  }
});

/* ---------------------------------------------------------------------------
 * verifyNotary
 * POST /v1/admin/notaries/:id/verify
 * id = NotaryProfile._id
 * ------------------------------------------------------------------------ */
const verifyNotary = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'INVALID_ID', message: 'Invalid notary profile id' });
  }

  const profile = await NotaryProfile.findById(id).populate('user', 'name email phone whatsappOptIn whatsappNumber');
  if (!profile) {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'Notary profile not found' });
  }

  if (profile.isVerified) {
    return res.status(409).json({ error: 'ALREADY_VERIFIED', message: 'Notary is already verified' });
  }

  profile.isVerified = true;
  profile.verificationStatus = 'approved';
  profile.verifiedAt = new Date();
  profile.verifiedBy = req.user.userId;
  await profile.save();

  const notaryUser = profile.user;

  if (notaryUser && notaryUser.whatsappOptIn && notaryUser.whatsappNumber) {
    try {
      await whatsappService.sendMessage(
        notaryUser.whatsappNumber,
        `✅ *NyayaSetu* — Congratulations, ${notaryUser.name || ''}!\n\nYour notary profile has been verified. You are now live on the platform and can start accepting notarization requests.\n\nLog in at nyayasetu.in to complete your profile.`
      );
    } catch (err) {
      logger.warn('[admin.controller] verifyNotary WA notify failed', { error: err.message });
    }
  }

  if (notaryUser && notaryUser.email) {
    try {
      await emailService.sendEmail({
        to: notaryUser.email,
        subject: 'Your NyayaSetu notary profile is now verified ✅',
        html: emailService.welcomeEmail(notaryUser.name || 'Notary'),
      });
    } catch (err) {
      logger.warn('[admin.controller] verifyNotary email notify failed', { error: err.message });
    }
  }

  try {
    await Notification.createForUser({
      userId: notaryUser._id,
      type: 'notary_verified',
      title: 'Your profile is verified',
      body: 'Congratulations! Your notary profile has been verified. You are now visible to citizens on NyayaSetu.',
      data: { notaryProfileId: profile._id },
      actionUrl: '/notary/dashboard',
      io: req.app.get('io'),
    });
  } catch (_) {}

  logger.info('[admin.controller] Notary verified', {
    notaryProfileId: profile._id,
    adminUserId: req.user.userId,
  });

  return res.json({ ok: true, notaryProfileId: profile._id, isVerified: true });
});

/* ---------------------------------------------------------------------------
 * rejectNotary
 * POST /v1/admin/notaries/:id/reject
 * id = NotaryProfile._id
 * body: { reason?: string }
 * ------------------------------------------------------------------------ */
const rejectNotary = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'INVALID_ID', message: 'Invalid notary profile id' });
  }

  const profile = await NotaryProfile.findById(id).populate('user', 'name email phone whatsappOptIn whatsappNumber');
  if (!profile) {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'Notary profile not found' });
  }

  if (profile.isVerified) {
    return res.status(409).json({ error: 'ALREADY_VERIFIED', message: 'Cannot reject an already verified notary' });
  }

  profile.verificationStatus = 'rejected';
  profile.rejectedAt = new Date();
  profile.rejectedBy = req.user.userId;
  if (reason) profile.rejectionReason = reason;
  await profile.save();

  const notaryUser = profile.user;

  if (notaryUser && notaryUser.whatsappOptIn && notaryUser.whatsappNumber) {
    try {
      const reasonText = reason ? `\n\nReason: ${reason}` : '';
      await whatsappService.sendMessage(
        notaryUser.whatsappNumber,
        `❌ *NyayaSetu* — Hi ${notaryUser.name || ''},\n\nWe were unable to verify your notary profile at this time.${reasonText}\n\nPlease log in at nyayasetu.in to update your documents and resubmit.`
      );
    } catch (err) {
      logger.warn('[admin.controller] rejectNotary WA notify failed', { error: err.message });
    }
  }

  if (notaryUser && notaryUser.email) {
    try {
      await emailService.sendEmail({
        to: notaryUser.email,
        subject: 'Update on your NyayaSetu notary profile verification',
        html: `<p>Dear ${notaryUser.name || 'Notary'},</p>
<p>We were unable to verify your notary profile at this time.</p>
${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
<p>Please log in to <a href="https://nyayasetu.in">nyayasetu.in</a>, update your documents, and resubmit for review.</p>
<p>If you have questions, please contact support@nyayasetu.in</p>`,
      });
    } catch (err) {
      logger.warn('[admin.controller] rejectNotary email notify failed', { error: err.message });
    }
  }

  try {
    await Notification.createForUser({
      userId: notaryUser._id,
      type: 'notary_rejected',
      title: 'Profile verification update',
      body: reason
        ? `Your notary profile could not be verified. Reason: ${reason}`
        : 'Your notary profile could not be verified at this time. Please update your documents and resubmit.',
      data: { notaryProfileId: profile._id },
      actionUrl: '/notary/settings',
      io: req.app.get('io'),
    });
  } catch (_) {}

  logger.info('[admin.controller] Notary rejected', {
    notaryProfileId: profile._id,
    adminUserId: req.user.userId,
    reason,
  });

  return res.json({ ok: true, notaryProfileId: profile._id, verificationStatus: 'rejected' });
});

/* ---------------------------------------------------------------------------
 * toggleUserActive
 * PATCH /v1/admin/users/:id/toggle-active
 * Enables or disables a user account.
 * ------------------------------------------------------------------------ */
const toggleUserActive = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'INVALID_ID', message: 'Invalid user id' });
  }

  const user = await User.findById(id).select('name email phone isActive persona');
  if (!user) {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'User not found' });
  }

  // Prevent admins from deactivating other admins
  if (user.persona?.toLowerCase() === 'admin') {
    return res.status(403).json({ error: 'FORBIDDEN', message: 'Cannot toggle active status of admin accounts' });
  }

  const deactivating = user.isActive; // true means we're about to set it false
  user.isActive = !user.isActive;

  if (deactivating) {
    // Invalidate all existing sessions immediately.
    // Clearing refreshTokens prevents new access tokens; the Redis blocklist key
    // blocks the current access token for the remainder of its 1-hour lifetime.
    user.refreshTokens = [];
    const redis = getRedisClient();
    if (redis) {
      await redis.set(`user:suspended:${user._id}`, '1', 'EX', 3600);
    }
  } else {
    // Reactivating — lift the suspension blocklist entry.
    const redis = getRedisClient();
    if (redis) {
      await redis.del(`user:suspended:${user._id}`);
    }
  }

  await user.save();

  logger.info('[admin.controller] User active status toggled', {
    targetUserId: user._id,
    isActive: user.isActive,
    adminUserId: req.user.userId,
  });

  return res.json({ ok: true, userId: user._id, isActive: user.isActive });
});

/* ---------------------------------------------------------------------------
 * revokeSubscription
 * POST /v1/admin/users/:id/revoke-subscription
 * Immediately expires a user's paid subscription — used for chargebacks,
 * policy violations, or fraud. Normal cancellation honours the paid period;
 * this does not.
 * ------------------------------------------------------------------------ */

const revokeSubscription = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'INVALID_ID', message: 'Invalid user id' });
  }

  const user = await User.findById(id).select('name subscription');
  if (!user) {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'User not found' });
  }

  const now = new Date();

  // Expire the embedded subscription on User immediately
  await User.findByIdAndUpdate(id, {
    $set: {
      'subscription.plan':       'free',
      'subscription.validUntil': now,
      'subscription.autoRenew':  false,
    },
  });

  // Also close the Subscription document record if one exists
  await Subscription.findOneAndUpdate(
    { user: id, isActive: true },
    { $set: { isActive: false, cancelledAt: now, endDate: now, autoRenew: false } }
  );

  logger.info('[admin.controller] Subscription force-revoked', {
    targetUserId: id,
    adminUserId: req.user.userId,
  });

  return res.json({ ok: true, userId: id, revokedAt: now });
});

/* ---------------------------------------------------------------------------
 * getAnalytics
 * GET /v1/admin/analytics
 * Returns 30-day time-series for signups, revenue, and documents.
 * ------------------------------------------------------------------------ */
const getAnalytics = asyncHandler(async (req, res) => {
  const days = 30;
  const since = new Date();
  since.setDate(since.getDate() - days + 1);
  since.setHours(0, 0, 0, 0);

  try {
    const [signups, revenue, documents] = await Promise.all([
      User.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
        { $project: { _id: 0, date: '$_id', count: 1 } },
      ]),
      Payment.aggregate([
        { $match: { status: 'paid', createdAt: { $gte: since } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, amount: { $sum: '$amount' } } },
        { $sort: { _id: 1 } },
        { $project: { _id: 0, date: '$_id', amount: { $divide: ['$amount', 100] } } },
      ]),
      Document.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
        { $project: { _id: 0, date: '$_id', count: 1 } },
      ]),
    ]);

    // Fill missing dates with 0 so charts are continuous
    const fillDates = (data, valueKey) => {
      const map = new Map(data.map((d) => [d.date, d[valueKey]]));
      const result = [];
      for (let i = 0; i < days; i++) {
        const d = new Date(since);
        d.setDate(since.getDate() + i);
        const key = d.toISOString().slice(0, 10);
        result.push({ date: key, [valueKey]: map.get(key) ?? 0 });
      }
      return result;
    };

    return res.json({
      signups:   fillDates(signups,   'count'),
      revenue:   fillDates(revenue,   'amount'),
      documents: fillDates(documents, 'count'),
    });
  } catch (err) {
    logger.error('[admin.controller] getAnalytics failed', { error: err.message });
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to load analytics' });
  }
});

/* ---------------------------------------------------------------------------
 * listPayments
 * GET /v1/admin/payments?page&limit&status&type&search
 * ------------------------------------------------------------------------ */
const listPayments = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status, type, search } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  const filter = {};
  if (status) filter.status = status;
  if (type)   filter.type   = type;

  if (search) {
    const regex = new RegExp(search, 'i');
    const users = await User.find({ $or: [{ name: regex }, { email: regex }] }).select('_id').lean();
    filter.user = { $in: users.map((u) => u._id) };
  }

  const [payments, total] = await Promise.all([
    Payment.find(filter)
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    Payment.countDocuments(filter),
  ]);

  return res.json({ payments, pagination: { total, page: Number(page), limit: Number(limit) } });
});

/* ---------------------------------------------------------------------------
 * refundPayment
 * POST /v1/admin/payments/:id/refund
 * Body: { amount?: number (paise), reason?: string }
 * ------------------------------------------------------------------------ */
const refundPayment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { amount, reason } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'INVALID_ID', message: 'Invalid payment id' });
  }

  const payment = await Payment.findById(id);
  if (!payment) return res.status(404).json({ error: 'NOT_FOUND', message: 'Payment not found' });
  if (payment.status !== 'paid') {
    return res.status(400).json({ error: 'NOT_PAID', message: 'Only paid payments can be refunded' });
  }
  if (!payment.razorpayPaymentId) {
    return res.status(400).json({ error: 'NO_PAYMENT_ID', message: 'No Razorpay payment ID on record' });
  }

  const refundAmount = amount ? Number(amount) : payment.amount;
  if (refundAmount > payment.amount) {
    return res.status(400).json({ error: 'EXCESSIVE_REFUND', message: 'Refund amount cannot exceed the original payment' });
  }

  const refund = await razorpayService.initiateRefund(
    payment.razorpayPaymentId,
    refundAmount,
    { reason: reason || 'Admin refund', adminUserId: String(req.user.userId) }
  );

  payment.status       = refundAmount < payment.amount ? 'partially_refunded' : 'refunded';
  payment.refundId     = refund.id;
  payment.refundAmount = refundAmount;
  payment.refundedAt   = new Date();
  payment.refundReason = reason || 'Admin refund';
  await payment.save();

  logger.info('[admin.controller] Payment refunded', {
    paymentId: id, refundId: refund.id, amount: refundAmount, adminUserId: req.user.userId,
  });

  return res.json({ ok: true, refundId: refund.id, status: payment.status, refundAmount });
});

/* ---------------------------------------------------------------------------
 * listConsultations
 * GET /v1/admin/consultations?page&limit&status&search
 * ------------------------------------------------------------------------ */
const listConsultations = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status, search } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  const filter = {};
  if (status) filter.status = status;

  if (search) {
    const regex = new RegExp(search, 'i');
    const users = await User.find({ $or: [{ name: regex }, { email: regex }] }).select('_id').lean();
    const ids = users.map((u) => u._id);
    filter.$or = [{ citizen: { $in: ids } }, { lawyer: { $in: ids } }];
  }

  const [consultations, total] = await Promise.all([
    Consultation.find(filter)
      .populate('citizen', 'name email')
      .populate('lawyer', 'name email')
      .select('citizen lawyer mode status fee isPaid scheduledAt caseArea subject cancelledBy cancellationReason createdAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    Consultation.countDocuments(filter),
  ]);

  return res.json({ consultations, pagination: { total, page: Number(page), limit: Number(limit) } });
});

/* ---------------------------------------------------------------------------
 * cancelConsultation
 * PATCH /v1/admin/consultations/:id/cancel
 * Body: { reason?: string }
 * ------------------------------------------------------------------------ */
const cancelConsultation = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'INVALID_ID', message: 'Invalid consultation id' });
  }

  const consultation = await Consultation.findById(id);
  if (!consultation) return res.status(404).json({ error: 'NOT_FOUND', message: 'Consultation not found' });

  if (['cancelled', 'completed', 'rejected'].includes(consultation.status)) {
    return res.status(400).json({
      error: 'INVALID_STATUS',
      message: `Cannot cancel a consultation that is already ${consultation.status}`,
    });
  }

  consultation.status             = 'cancelled';
  consultation.cancelledBy        = 'admin';
  consultation.cancellationReason = reason || 'Cancelled by admin';
  await consultation.save();

  logger.info('[admin.controller] Consultation cancelled by admin', {
    consultationId: id, adminUserId: req.user.userId,
  });

  return res.json({ ok: true, consultationId: id, status: 'cancelled' });
});

/* ---------------------------------------------------------------------------
 * listDocuments
 * GET /v1/admin/documents?page&limit&search&accessType&templateSlug
 * ------------------------------------------------------------------------ */
const listDocuments = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, search, accessType, templateSlug } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  // isDeleted: false is injected by the Document model's pre-query hook
  const filter = {};
  if (accessType)   filter.accessType   = accessType;
  if (templateSlug) filter.templateSlug = templateSlug;

  if (search) {
    const regex = new RegExp(search, 'i');
    const users = await User.find({ $or: [{ name: regex }, { email: regex }] }).select('_id').lean();
    const ids = users.map((u) => u._id);
    filter.$or = [{ user: { $in: ids } }, { title: regex }];
  }

  const [documents, total] = await Promise.all([
    Document.find(filter)
      .populate('user', 'name email')
      .select('title templateSlug accessType isPaid isActive createdAt user')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    Document.countDocuments(filter),
  ]);

  return res.json({ documents, pagination: { total, page: Number(page), limit: Number(limit) } });
});

/* ---------------------------------------------------------------------------
 * deleteDocument
 * DELETE /v1/admin/documents/:id
 * Soft-deletes the document (sets isDeleted = true, deletedAt = now)
 * ------------------------------------------------------------------------ */
const deleteDocument = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'INVALID_ID', message: 'Invalid document id' });
  }

  // findById triggers the pre-query hook which automatically adds isDeleted: false
  const document = await Document.findById(id);
  if (!document) return res.status(404).json({ error: 'NOT_FOUND', message: 'Document not found' });

  await document.softDelete();

  logger.info('[admin.controller] Document soft-deleted by admin', {
    documentId: id, adminUserId: req.user.userId,
  });

  return res.json({ ok: true, documentId: id, deletedAt: document.deletedAt });
});

module.exports = {
  verifyLawyer,
  rejectLawyer,
  listLawyers,
  verifyNotary,
  rejectNotary,
  listNotaries,
  toggleUserActive,
  revokeSubscription,
  getStats,
  getAnalytics,
  listUsers,
  getUser,
  getAuditLogs,
  listTemplates,
  createTemplate,
  updateTemplate,
  listPayments,
  refundPayment,
  listConsultations,
  cancelConsultation,
  listDocuments,
  deleteDocument,
};
