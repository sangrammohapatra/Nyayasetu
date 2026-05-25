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
    return res.status(400).json({ error: 'Invalid lawyer profile id' });
  }

  const profile = await LawyerProfile.findById(id).populate('user', 'name email phone whatsappOptIn whatsappNumber');
  if (!profile) {
    return res.status(404).json({ error: 'Lawyer profile not found' });
  }

  if (profile.isVerified) {
    return res.status(409).json({ error: 'Lawyer is already verified' });
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
    await Notification.create({
      user: lawyerUser._id,
      type: 'lawyer_verified',
      title: 'Your profile is verified',
      body: 'Congratulations! Your lawyer profile has been verified. You are now visible to citizens on NyayaSetu.',
      data: { lawyerProfileId: profile._id },
      channel: 'web',
      isRead: false,
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
    return res.status(500).json({ error: 'Failed to load stats' });
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
    return res.status(500).json({ error: 'Failed to load users' });
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
    return res.status(400).json({ error: 'Invalid user id' });
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
      return res.status(404).json({ error: 'User not found' });
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
    return res.status(500).json({ error: 'Failed to load user' });
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
      return res.status(409).json({ error: 'A template with this slug already exists' });
    }
    logger.error('[admin.controller] createTemplate failed', { error: err.message });
    return res.status(400).json({ error: err.message });
  }
});

const updateTemplate = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid template id' });
  }

  try {
    const template = await DocumentTemplate.findByIdAndUpdate(
      id,
      { $set: req.body },
      { new: true, runValidators: true }
    );
    if (!template) return res.status(404).json({ error: 'Template not found' });
    return res.json({ template });
  } catch (err) {
    logger.error('[admin.controller] updateTemplate failed', { id, error: err.message });
    return res.status(400).json({ error: err.message });
  }
});

module.exports = {
  verifyLawyer,
  getStats,
  listUsers,
  getUser,
  listTemplates,
  createTemplate,
  updateTemplate,
};
