/**
 * server/src/controllers/admin.controller.js
 */

'use strict';

const mongoose = require('mongoose');

const User = require('../models/User.model');
const LawyerProfile = require('../models/LawyerProfile.model');
const Document = require('../models/Document.model');
const Payment = require('../models/Payment.model');
const CaseTracker = require('../models/CaseTracker.model');
const Notification = require('../models/Notification.model');
const Subscription = require('../models/Subscription.model');
const AuditLog = require('../models/AuditLog.model');

const whatsappService = require('../services/notification/whatsappService');
const emailService = require('../services/notification/emailService');
const asyncHandler = require('../utils/asyncHandler');
const logger = require('../utils/logger');

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

  if (persona) filter.persona = persona;
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

  if (profile.isVerified) {
    return res.status(409).json({ error: 'ALREADY_VERIFIED', message: 'Cannot reject an already verified lawyer' });
  }

  profile.verificationStatus = 'rejected';
  profile.rejectedAt = new Date();
  profile.rejectedBy = req.user.userId;
  if (reason) profile.rejectionReason = reason;
  await profile.save();

  const lawyerUser = profile.user;

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
  if (user.persona === 'admin') {
    return res.status(403).json({ error: 'FORBIDDEN', message: 'Cannot toggle active status of admin accounts' });
  }

  user.isActive = !user.isActive;
  await user.save();

  logger.info('[admin.controller] User active status toggled', {
    targetUserId: user._id,
    isActive: user.isActive,
    adminUserId: req.user.userId,
  });

  return res.json({ ok: true, userId: user._id, isActive: user.isActive });
});

module.exports = {
  verifyLawyer,
  rejectLawyer,
  toggleUserActive,
  getStats,
  listUsers,
  getUser,
  getAuditLogs,
  listTemplates,
  createTemplate,
  updateTemplate,
};
