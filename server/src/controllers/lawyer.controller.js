/**
 * server/src/controllers/lawyer.controller.js
 */

'use strict';

const mongoose = require('mongoose');
const multer = require('multer');

const User = require('../models/User.model');
const LawyerProfile = require('../models/LawyerProfile.model');
const LawyerWithdrawal = require('../models/LawyerWithdrawal.model');
const Consultation = require('../models/Consultation.model');
const CaseTracker = require('../models/CaseTracker.model');
const Notification = require('../models/Notification.model');

const cloudinaryService = require('../services/storage/cloudinaryService');
const asyncHandler = require('../utils/asyncHandler');
const logger = require('../utils/logger');
const AuditLog = require('../models/AuditLog.model');

/* ---------------------------------------------------------------------------
 * redactReviewerName — "Priya Sharma" -> "Priya S." for public review display.
 * ------------------------------------------------------------------------ */
function redactReviewerName(name) {
  if (!name) return 'Anonymous';
  const parts = String(name).trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

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

  const isDev = process.env.NODE_ENV === 'development';
  const filter = isDev ? {} : { isVerified: true };

  if (state) {
    filter.$or = isDev
      // Dev: match state OR profiles with no states set yet (incomplete setup)
      ? [{ practicingStates: { $in: [state] } }, { practicingStates: { $size: 0 } }]
      : [{ practicingStates: { $in: [state] } }];
  }
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
        .populate('user', 'name preferredLanguage')
        .select('-ratings -barCouncilCertificateUrl -__v')
        .lean(),
      LawyerProfile.countDocuments(filter),
    ]);

    const items = profiles.map(p => ({
      id: p._id,
      userId: p.user && p.user._id,
      name: p.user && p.user.name,
      specialisations: p.specialisations,
      practicingStates: p.practicingStates,
      experience: p.experience,
      consultationFee: p.consultationFee,
      averageRating: p.averageRating,
      totalConsultations: p.totalConsultations,
      isVerified: p.isVerified,
      isAvailable: p.isAcceptingClients,
      consultationModes: p.consultationModes,
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
    // Phone is deliberately excluded — exposing it lets citizens contact lawyers
    // (e.g. via WhatsApp) outside the platform, bypassing tracking and commission.
    const profile = await LawyerProfile.findById(id)
      .populate('user', 'name email preferredLanguage createdAt')
      .lean();

    if (!profile) {
      return res.status(404).json({ error: 'Lawyer not found' });
    }

    if (!profile.isVerified && (!req.user || req.user.persona !== 'admin')) {
      return res.status(404).json({ error: 'Lawyer not found' });
    }

    // Last 5 ratings with reviewer first name.
    // Consultation.lawyer refs User (not LawyerProfile), and the citizen's
    // rating of the consultation lives in `citizenRating`, not `rating`.
    const ratedConsultations = await Consultation.find(
      { lawyer: profile.user?._id || profile.user, 'citizenRating.score': { $exists: true, $ne: null } },
      { 'citizenRating.score': 1, 'citizenRating.review': 1, 'citizenRating.ratedAt': 1, citizen: 1 }
    )
      .sort({ 'citizenRating.ratedAt': -1 })
      .limit(5)
      .populate('citizen', 'name')
      .lean();

    const recentRatings = ratedConsultations.map(c => ({
      score: c.citizenRating.score,
      review: c.citizenRating.review,
      createdAt: c.citizenRating.ratedAt,
      // Redact to "First L." — a citizen's full name on a public profile can identify
      // them as having sought advice on a sensitive matter (family, criminal, property).
      citizenName: redactReviewerName(c.citizen && c.citizen.name),
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
    barCouncilState,
    specialisations,
    practicingStates,
    experience,
    bio,
    consultationFee,
    district,
    availability: availabilityRaw,
  } = req.body;

  if (!barCouncilNumber || !barCouncilState || !specialisations || !practicingStates || !consultationFee) {
    return res.status(400).json({
      error: 'barCouncilNumber, barCouncilState, specialisations, practicingStates and consultationFee are required',
    });
  }

  const toArray = v =>
    Array.isArray(v) ? v : String(v).split(',').map(s => s.trim()).filter(Boolean);

  const user = await User.findById(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  if (user.persona?.toLowerCase() !== 'lawyer') {
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
          barCouncilState: barCouncilState.trim(),
          specialisations: toArray(specialisations),
          practicingStates: toArray(practicingStates),
          experience: Math.max(0, parseInt(experience, 10) || 0),
          bio: bio || '',
          consultationFee: parseInt(consultationFee, 10),
          district: district || '',
          isVerified: process.env.NODE_ENV === 'development',
          verificationStatus: process.env.NODE_ENV === 'development' ? 'approved' : 'pending',
          ...(certificateUrl ? { barCouncilCertificateUrl: certificateUrl } : {}),
          ...(availabilityRaw ? (() => {
            try {
              const parsed = typeof availabilityRaw === 'string' ? JSON.parse(availabilityRaw) : availabilityRaw;
              if (Array.isArray(parsed)) return { availability: parsed };
            } catch { /* ignore malformed availability */ }
            return {};
          })() : {}),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
    );

    // Notify admins (best-effort)
    try {
      const admins = await User.find({ persona: { $regex: /^admin$/i } }).select('_id').lean();
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

    await AuditLog.log(req, 'lawyer.applied', 'LawyerProfile', profile._id, {
      barCouncilNumber: barCouncilNumber.trim(),
      specialisations: toArray(specialisations),
    });

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
    'barCouncilNumber', 'barCouncilState', 'enrollmentYear',
    'specialisations', 'practicingStates', 'practicingCourts',
    'experience', 'languages', 'bio',
    'consultationFee', 'consultationModes', 'isAcceptingClients',
    'isPublic', 'district',
  ];

  const ARRAY_FIELDS = ['specialisations', 'practicingStates', 'practicingCourts', 'languages', 'consultationModes'];

  const updates = {};
  for (const field of ALLOWED) {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  }

  for (const field of ARRAY_FIELDS) {
    if (updates[field] !== undefined && !Array.isArray(updates[field])) {
      updates[field] = String(updates[field]).split(',').map(s => s.trim()).filter(Boolean);
    }
  }

  if (updates.experience !== undefined) {
    updates.experience = Math.max(0, parseInt(updates.experience, 10) || 0);
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

    await AuditLog.log(req, 'lawyer.profile.updated', 'LawyerProfile', profile._id, {
      fields: Object.keys(updates),
    });

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
      Consultation.find({ lawyer: userId })
        .select('citizen status scheduledAt mode fee sharedDocument createdAt')
        .populate('sharedDocument', 'title templateSlug approvalStatus lawyerAnnotations lawyerEditedContent lawyerEditedAt')
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

/* ---------------------------------------------------------------------------
 * getAvailableSlots
 * GET /v1/lawyers/:id/slots?date=YYYY-MM-DD
 *
 * Returns 30-minute slots the lawyer is free on the given date.
 * Filters out: days with no availability rule, past times (today only),
 * and slots already occupied by requested/accepted consultations.
 * ------------------------------------------------------------------------ */
const SLOT_DURATION_MINUTES = 30;

const getAvailableSlots = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { date } = req.query;

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'INVALID_DATE', message: 'Provide date as YYYY-MM-DD' });
  }
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'INVALID_ID', message: 'Invalid lawyer id' });
  }

  const profile = await LawyerProfile.findById(id).select('availability isAcceptingClients').lean();
  if (!profile) return res.status(404).json({ error: 'LAWYER_NOT_FOUND', message: 'Lawyer not found' });

  if (!profile.isAcceptingClients) {
    return res.json({ slots: [], date, reason: 'Lawyer is not currently accepting consultations' });
  }

  // dayOfWeek for the requested date (local time in IST)
  const [y, m, d] = date.split('-').map(Number);
  const localDate = new Date(y, m - 1, d);
  const dayOfWeek = localDate.getDay(); // 0 = Sunday

  const rules = (profile.availability || []).filter((a) => a.dayOfWeek === dayOfWeek && a.isActive !== false);
  if (!rules.length) {
    return res.json({ slots: [], date, dayOfWeek, reason: 'Lawyer is not available on this day' });
  }

  // A day can have multiple windows (e.g. 09:00–12:00 and 14:00–18:00) — generate
  // slots from every window, not just the first match.
  const allSlots = new Set();
  for (const rule of rules) {
    const [startH, startM] = rule.startTime.split(':').map(Number);
    const [endH,   endM]   = rule.endTime.split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes   = endH   * 60 + endM;
    for (let min = startMinutes; min + SLOT_DURATION_MINUTES <= endMinutes; min += SLOT_DURATION_MINUTES) {
      allSlots.add(min);
    }
  }

  if (!allSlots.size) return res.json({ slots: [], date });

  // Block past slots when date is today (IST)
  const nowIST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const isToday =
    nowIST.getFullYear() === y &&
    (nowIST.getMonth() + 1) === m &&
    nowIST.getDate() === d;
  // Add a 30-min buffer so users can't book for "right now"
  const nowMinutesIST = isToday ? (nowIST.getHours() * 60 + nowIST.getMinutes() + 30) : 0;

  // Fetch existing bookings for this day
  const dayStartIST = new Date(`${date}T00:00:00+05:30`);
  const dayEndIST   = new Date(`${date}T23:59:59+05:30`);

  const existingBookings = await Consultation.find({
    lawyer: id,
    scheduledAt: { $gte: dayStartIST, $lte: dayEndIST },
    status: { $in: ['requested', 'accepted'] },
  }).select('scheduledAt durationMinutes').lean();

  // Build blocked ranges in minutes-since-midnight (IST)
  const blockedRanges = existingBookings.map((c) => {
    const ist = new Date(new Date(c.scheduledAt).toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const slotStart = ist.getHours() * 60 + ist.getMinutes();
    const dur = c.durationMinutes || SLOT_DURATION_MINUTES;
    return { start: slotStart, end: slotStart + dur };
  });

  const available = Array.from(allSlots)
    .sort((a, b) => a - b)
    .filter((min) => min >= nowMinutesIST)
    .filter((min) => {
      const slotEnd = min + SLOT_DURATION_MINUTES;
      return !blockedRanges.some((b) => min < b.end && slotEnd > b.start);
    })
    .map((min) => {
      const hh = String(Math.floor(min / 60)).padStart(2, '0');
      const mm = String(min % 60).padStart(2, '0');
      return {
        time: `${hh}:${mm}`,
        iso:  `${date}T${hh}:${mm}:00+05:30`,
      };
    });

  return res.json({ slots: available, date, dayOfWeek });
});

/* ---------------------------------------------------------------------------
 * updateAvailability
 * PUT /v1/lawyers/availability
 * Body: { availability: [{ dayOfWeek, startTime, endTime, isActive? }] }
 * ------------------------------------------------------------------------ */
const updateAvailability = asyncHandler(async (req, res) => {
  const { userId } = req.user;
  const { availability } = req.body;

  if (!Array.isArray(availability)) {
    return res.status(400).json({ error: 'INVALID_INPUT', message: 'availability must be an array' });
  }

  const TIME_RE = /^\d{2}:\d{2}$/;
  for (const slot of availability) {
    if (slot.dayOfWeek < 0 || slot.dayOfWeek > 6 || !Number.isInteger(slot.dayOfWeek)) {
      return res.status(400).json({ error: 'INVALID_DAY', message: 'dayOfWeek must be an integer 0–6' });
    }
    if (!TIME_RE.test(slot.startTime) || !TIME_RE.test(slot.endTime)) {
      return res.status(400).json({ error: 'INVALID_TIME', message: 'startTime and endTime must be HH:MM' });
    }
    if (slot.startTime >= slot.endTime) {
      return res.status(400).json({ error: 'INVALID_RANGE', message: 'startTime must be before endTime' });
    }
  }

  const profile = await LawyerProfile.findOneAndUpdate(
    { user: userId },
    {
      $set: {
        availability: availability.map((s) => ({
          dayOfWeek: s.dayOfWeek,
          startTime: s.startTime,
          endTime:   s.endTime,
          isActive:  s.isActive !== false,
        })),
      },
    },
    { new: true, runValidators: true }
  ).select('availability');

  if (!profile) {
    return res.status(404).json({ error: 'PROFILE_NOT_FOUND', message: 'Lawyer profile not found — please apply first' });
  }

  await AuditLog.log(req, 'lawyer.availability.updated', 'LawyerProfile', profile._id, {
    slots: availability.length,
  });
  return res.json({ ok: true, availability: profile.availability });
});

/* ---------------------------------------------------------------------------
 * saveBankAccount
 * PUT /v1/lawyers/bank-account
 * ------------------------------------------------------------------------ */
const saveBankAccount = asyncHandler(async (req, res) => {
  const { accountHolderName, accountNumber, ifscCode, bankName } = req.body;

  if (!accountHolderName || !accountNumber || !ifscCode || !bankName) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'All bank account fields are required' });
  }

  const profile = await LawyerProfile.findOneAndUpdate(
    { user: req.user.userId },
    {
      bankAccount: {
        accountHolderName: accountHolderName.trim(),
        accountNumber: accountNumber.trim(),
        ifscCode: ifscCode.trim().toUpperCase(),
        bankName: bankName.trim(),
      },
    },
    { new: true, select: 'bankAccount totalEarnings withdrawnAmount' }
  );

  if (!profile) return res.status(404).json({ error: 'NOT_FOUND', message: 'Lawyer profile not found' });

  await AuditLog.log(req, 'lawyer.bank_account.updated', 'LawyerProfile', profile._id, {
    bankName,
  });

  return res.json({ message: 'Bank account saved', bankAccount: profile.bankAccount });
});

/* ---------------------------------------------------------------------------
 * requestWithdrawal
 * POST /v1/lawyers/withdraw
 * ------------------------------------------------------------------------ */
const requestWithdrawal = asyncHandler(async (req, res) => {
  const { amount } = req.body;

  if (!amount || amount < 1) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Invalid withdrawal amount' });
  }

  const profile = await LawyerProfile.findOne({ user: req.user.userId });
  if (!profile) return res.status(404).json({ error: 'NOT_FOUND', message: 'Lawyer profile not found' });

  if (!profile.bankAccount?.accountNumber) {
    return res.status(400).json({ error: 'NO_BANK_ACCOUNT', message: 'Please add your bank account before requesting a withdrawal' });
  }

  // Calculate pending withdrawal sum to prevent over-withdrawal
  const pendingSum = await LawyerWithdrawal.aggregate([
    { $match: { lawyerProfile: profile._id, status: { $in: ['pending', 'processing'] } } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);
  const pendingTotal = pendingSum[0]?.total || 0;

  const withdrawable = profile.totalEarnings - (profile.withdrawnAmount || 0) - pendingTotal;
  if (amount > withdrawable) {
    return res.status(400).json({
      error: 'INSUFFICIENT_BALANCE',
      message: `Withdrawable balance is ₹${(withdrawable / 100).toFixed(2)}`,
    });
  }

  const acct = profile.bankAccount;
  const masked = acct.accountNumber.replace(/.(?=.{4})/g, '*');

  const withdrawal = await LawyerWithdrawal.create({
    lawyerProfile: profile._id,
    lawyerUser: req.user.userId,
    amount,
    bankSnapshot: {
      accountHolderName: acct.accountHolderName,
      maskedAccountNumber: masked,
      ifscCode: acct.ifscCode,
      bankName: acct.bankName,
    },
  });

  await AuditLog.log(req, 'lawyer.withdrawal.requested', 'LawyerWithdrawal', withdrawal._id, {
    amount,
  });

  return res.status(201).json({ message: 'Withdrawal request submitted', withdrawal });
});

/* ---------------------------------------------------------------------------
 * listWithdrawals
 * GET /v1/lawyers/me/withdrawals
 * ------------------------------------------------------------------------ */
const listWithdrawals = asyncHandler(async (req, res) => {
  const profile = await LawyerProfile.findOne({ user: req.user.userId }, '_id totalEarnings withdrawnAmount bankAccount');
  if (!profile) return res.status(404).json({ error: 'NOT_FOUND', message: 'Lawyer profile not found' });

  const withdrawals = await LawyerWithdrawal.find({ lawyerProfile: profile._id }).sort({ createdAt: -1 });

  const pendingSum = withdrawals
    .filter((w) => ['pending', 'processing'].includes(w.status))
    .reduce((s, w) => s + w.amount, 0);

  const withdrawable = profile.totalEarnings - (profile.withdrawnAmount || 0) - pendingSum;

  return res.json({
    totalEarnings: profile.totalEarnings,
    withdrawnAmount: profile.withdrawnAmount || 0,
    withdrawable: Math.max(0, withdrawable),
    hasBankAccount: !!profile.bankAccount?.accountNumber,
    bankAccount: profile.bankAccount?.accountNumber
      ? {
          accountHolderName: profile.bankAccount.accountHolderName,
          maskedAccountNumber: profile.bankAccount.accountNumber.replace(/.(?=.{4})/g, '*'),
          ifscCode: profile.bankAccount.ifscCode,
          bankName: profile.bankAccount.bankName,
        }
      : null,
    withdrawals,
  });
});

module.exports = {
  uploadCertificate,
  searchLawyers,
  getLawyerProfile,
  applyAsLawyer,
  updateLawyerProfile,
  updateAvailability,
  getAvailableSlots,
  getMyClients,
  saveBankAccount,
  requestWithdrawal,
  listWithdrawals,
};
