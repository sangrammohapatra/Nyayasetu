/**
 * server/src/controllers/lawyer.controller.js
 */

'use strict';

const mongoose = require('mongoose');
const multer = require('multer');

const User = require('../models/User.model');
const LawyerProfile = require('../models/LawyerProfile.model');
const Consultation = require('../models/Consultation.model');
const CaseTracker = require('../models/CaseTracker.model');
const Notification = require('../models/Notification.model');

const cloudinaryService = require('../services/storage/cloudinaryService');
const asyncHandler = require('../utils/asyncHandler');
const logger = require('../utils/logger');

/* ---------------------------------------------------------------------------
 * Multer — memory storage, 5 MB cap, PDF/image only.
 * Buffer forwarded to Cloudinary; nothing touches disk.
 * ------------------------------------------------------------------------ */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    const allowed = ['application/pdf', 'image/jpeg', 'image/png'];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error('Only PDF, JPEG and PNG files are accepted'));
    }
    return cb(null, true);
  },
});

/** Exported so the route can apply it before applyAsLawyer. */
const uploadCertificate = upload.single('certificate');

/* ---------------------------------------------------------------------------
 * searchLawyers
 * GET /v1/lawyers
 * Query: state, specialisation, district, minRating, maxFee, availableOnly, page, limit
 * ------------------------------------------------------------------------ */
const searchLawyers = asyncHandler(async (req, res) => {
  const {
    state,
    specialisation,
    district,
    minRating,
    maxFee,
    availableOnly,
    page = 1,
    limit = 10,
  } = req.query;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
  const skip = (pageNum - 1) * limitNum;

  const filter = { isVerified: true };

  if (state) filter.practicingStates = { $in: [state] };
  if (specialisation) filter.specialisations = { $in: [specialisation] };
  if (district) filter.district = district;
  if (minRating) {
    filter.averageRating = { $gte: parseFloat(minRating) };
  }
  if (maxFee) {
    filter.consultationFee = { $lte: parseInt(maxFee, 10) };
  }
  if (availableOnly === 'true') {
    filter.isAvailableForConsultation = true;
  }

  try {
    const [profiles, total] = await Promise.all([
      LawyerProfile.find(filter)
        .sort({ averageRating: -1, totalConsultations: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate('user', 'name email phone preferredLanguage')
        .select('-ratings -barCouncilCertificateUrl -__v')
        .lean(),
      LawyerProfile.countDocuments(filter),
    ]);

    const items = profiles.map(p => ({
      id: p._id,
      userId: p.user && p.user._id,
      name: p.user && p.user.name,
      email: p.user && p.user.email,
      specialisations: p.specialisations,
      practicingStates: p.practicingStates,
      experience: p.experience,
      consultationFee: p.consultationFee,
      averageRating: p.averageRating,
      totalConsultations: p.totalConsultations,
      isVerified: p.isVerified,
      isAvailable: p.isAvailableForConsultation,
      lawyerPlan: p.lawyerPlan,
      bio: p.bio,
    }));

    return res.json({
      items,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.max(1, Math.ceil(total / limitNum)),
    });
  } catch (err) {
    logger.error('[lawyer.controller] searchLawyers failed', { error: err.message });
    return res.status(500).json({ error: 'Failed to search lawyers' });
  }
});

/* ---------------------------------------------------------------------------
 * getLawyerProfile
 * GET /v1/lawyers/:id
 * ------------------------------------------------------------------------ */
const getLawyerProfile = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid lawyer id' });
  }

  try {
    const profile = await LawyerProfile.findById(id)
      .populate('user', 'name email phone preferredLanguage createdAt')
      .lean();

    if (!profile) {
      return res.status(404).json({ error: 'Lawyer not found' });
    }

    if (!profile.isVerified && (!req.user || req.user.persona !== 'admin')) {
      return res.status(404).json({ error: 'Lawyer not found' });
    }

    // Last 5 ratings with reviewer first name
    const ratedConsultations = await Consultation.find(
      { lawyer: profile._id, 'rating.score': { $exists: true, $ne: null } },
      { 'rating.score': 1, 'rating.review': 1, 'rating.createdAt': 1, citizen: 1 }
    )
      .sort({ 'rating.createdAt': -1 })
      .limit(5)
      .populate('citizen', 'name')
      .lean();

    const recentRatings = ratedConsultations.map(c => ({
      score: c.rating.score,
      review: c.rating.review,
      createdAt: c.rating.createdAt,
      citizenName: c.citizen && c.citizen.name,
    }));

    return res.json({ ...profile, recentRatings });
  } catch (err) {
    logger.error('[lawyer.controller] getLawyerProfile failed', { id, error: err.message });
    return res.status(500).json({ error: 'Failed to load lawyer profile' });
  }
});

/* ---------------------------------------------------------------------------
 * applyAsLawyer
 * POST /v1/lawyers/apply
 * Body (multipart/form-data):
 *   barCouncilNumber, specialisations (csv or array), practicingStates (csv or array),
 *   experience, bio, consultationFee, district
 *   certificate: file (optional at apply time — admin may follow up)
 * ------------------------------------------------------------------------ */
const applyAsLawyer = asyncHandler(async (req, res) => {
  const userId = req.user.userId;

  const {
    barCouncilNumber,
    specialisations,
    practicingStates,
    experience,
    bio,
    consultationFee,
    district,
  } = req.body;

  if (!barCouncilNumber || !specialisations || !practicingStates || !consultationFee) {
    return res.status(400).json({
      error: 'barCouncilNumber, specialisations, practicingStates and consultationFee are required',
    });
  }

  const toArray = v =>
    Array.isArray(v) ? v : String(v).split(',').map(s => s.trim()).filter(Boolean);

  const user = await User.findById(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  if (user.persona !== 'lawyer') {
    user.persona = 'lawyer';
    await user.save();
  }

  let certificateUrl = null;
  if (req.file) {
    try {
      const result = await cloudinaryService.uploadBuffer(
        req.file.buffer,
        req.file.mimetype,
        {
          folder: 'nyayasetu/bar_certificates',
          public_id: `bc_${userId}_${Date.now()}`,
          resource_type: 'auto',
        }
      );
      certificateUrl = result.secure_url;
    } catch (err) {
      logger.error('[lawyer.controller] Certificate upload failed', { userId, error: err.message });
      return res.status(502).json({ error: 'Certificate upload failed — please try again' });
    }
  }

  try {
    const profile = await LawyerProfile.findOneAndUpdate(
      { user: userId },
      {
        $set: {
          user: userId,
          barCouncilNumber: barCouncilNumber.trim(),
          specialisations: toArray(specialisations),
          practicingStates: toArray(practicingStates),
          experience: parseInt(experience, 10) || 0,
          bio: bio || '',
          consultationFee: parseInt(consultationFee, 10),
          district: district || '',
          isVerified: false,
          ...(certificateUrl ? { barCouncilCertificateUrl: certificateUrl } : {}),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Notify admins (best-effort)
    try {
      const admins = await User.find({ persona: 'admin' }).select('_id').lean();
      if (admins.length) {
        await Notification.insertMany(
          admins.map(a => ({
            user: a._id,
            type: 'lawyer_application',
            title: 'New lawyer application',
            body: `${user.name || user.phone} applied as a lawyer. Bar council: ${barCouncilNumber}`,
            data: { lawyerProfileId: profile._id, userId },
            channel: 'web',
            isRead: false,
          }))
        );
      }
    } catch (notifErr) {
      logger.warn('[lawyer.controller] Admin notification failed', { error: notifErr.message });
    }

    return res.status(201).json({
      message: 'Application submitted. An admin will verify your profile within 2-3 business days.',
      lawyerProfileId: profile._id,
      isVerified: false,
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'A lawyer profile already exists for this account' });
    }
    logger.error('[lawyer.controller] applyAsLawyer failed', { userId, error: err.message });
    return res.status(500).json({ error: 'Failed to submit application' });
  }
});

/* ---------------------------------------------------------------------------
 * updateLawyerProfile
 * PUT /v1/lawyers/profile
 * ------------------------------------------------------------------------ */
const updateLawyerProfile = asyncHandler(async (req, res) => {
  const userId = req.user.userId;

  const ALLOWED = [
    'specialisations', 'practicingStates', 'experience', 'bio',
    'consultationFee', 'district', 'isAvailableForConsultation', 'preferredModes',
  ];

  const updates = {};
  for (const field of ALLOWED) {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  }

  if (updates.specialisations && !Array.isArray(updates.specialisations)) {
    updates.specialisations = String(updates.specialisations).split(',').map(s => s.trim()).filter(Boolean);
  }
  if (updates.practicingStates && !Array.isArray(updates.practicingStates)) {
    updates.practicingStates = String(updates.practicingStates).split(',').map(s => s.trim()).filter(Boolean);
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No updatable fields provided' });
  }

  try {
    const profile = await LawyerProfile.findOneAndUpdate(
      { user: userId },
      { $set: updates },
      { new: true, runValidators: true }
    ).populate('user', 'name email phone');

    if (!profile) {
      return res.status(404).json({ error: 'Lawyer profile not found — please apply first' });
    }

    return res.json({ profile });
  } catch (err) {
    logger.error('[lawyer.controller] updateLawyerProfile failed', { userId, error: err.message });
    return res.status(500).json({ error: 'Failed to update profile' });
  }
});

/* ---------------------------------------------------------------------------
 * getMyClients
 * GET /v1/lawyers/me/clients
 * Returns citizens who shared a case OR booked a consultation with this lawyer.
 * ------------------------------------------------------------------------ */
const getMyClients = asyncHandler(async (req, res) => {
  const userId = req.user.userId;

  const profile = await LawyerProfile.findOne({ user: userId }).lean();
  if (!profile) {
    return res.status(404).json({ error: 'Lawyer profile not found' });
  }

  try {
    const [consultations, sharedCases] = await Promise.all([
      Consultation.find({ lawyer: profile._id })
        .select('citizen status scheduledAt mode fee createdAt')
        .sort({ createdAt: -1 })
        .lean(),
      CaseTracker.find({ sharedWithLawyer: profile._id })
        .select('user cnrNumber caseTitle court nextHearingDate status')
        .lean(),
    ]);

    const consultationMap = {};
    for (const c of consultations) {
      const uid = String(c.citizen);
      if (!consultationMap[uid]) consultationMap[uid] = [];
      consultationMap[uid].push(c);
    }

    const caseMap = {};
    for (const c of sharedCases) {
      const uid = String(c.user);
      if (!caseMap[uid]) caseMap[uid] = [];
      caseMap[uid].push(c);
    }

    const allClientIds = [
      ...new Set([...Object.keys(consultationMap), ...Object.keys(caseMap)]),
    ];

    if (allClientIds.length === 0) {
      return res.json({ clients: [] });
    }

    const clientUsers = await User.find({ _id: { $in: allClientIds } })
      .select('name phone email preferredLanguage createdAt')
      .lean();

    const clients = clientUsers.map(u => {
      const uid = String(u._id);
      return {
        user: {
          id: u._id,
          name: u.name,
          phone: u.phone,
          email: u.email,
          preferredLanguage: u.preferredLanguage,
          joinedAt: u.createdAt,
        },
        consultations: consultationMap[uid] || [],
        sharedCases: caseMap[uid] || [],
      };
    });

    return res.json({ clients });
  } catch (err) {
    logger.error('[lawyer.controller] getMyClients failed', { userId, error: err.message });
    return res.status(500).json({ error: 'Failed to load clients' });
  }
});

module.exports = {
  uploadCertificate,
  searchLawyers,
  getLawyerProfile,
  applyAsLawyer,
  updateLawyerProfile,
  getMyClients,
};
