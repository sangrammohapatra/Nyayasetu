/**
 * server/src/controllers/consultation.controller.js
 */

'use strict';

const mongoose = require('mongoose');
const Razorpay = require('razorpay');
const crypto = require('crypto');

const User = require('../models/User.model');
const LawyerProfile = require('../models/LawyerProfile.model');
const Consultation = require('../models/Consultation.model');
const Payment = require('../models/Payment.model');
const Notification = require('../models/Notification.model');
const Document = require('../models/Document.model');

const whatsappService = require('../services/notification/whatsappService');
const emailService = require('../services/notification/emailService');
const asyncHandler = require('../utils/asyncHandler');
const logger = require('../utils/logger');

/* ---------------------------------------------------------------------------
 * Razorpay client — lazy init so missing creds don't crash at require time.
 * ------------------------------------------------------------------------ */
let razorpayClient = null;
function getRazorpay() {
  if (!razorpayClient) {
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      throw new Error('Razorpay credentials not configured');
    }
    razorpayClient = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  }
  return razorpayClient;
}

/* ---------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------ */

function computeCommission(feeInPaise, referralFeePercent = 10) {
  const platformEarnings = Math.round((feeInPaise * referralFeePercent) / 100);
  const lawyerEarnings = feeInPaise - platformEarnings;
  return { platformEarnings, lawyerEarnings };
}

async function notifyLawyer(lawyerUser, consultation, subject) {
  if (!lawyerUser) return;
  try {
    const message =
      subject === 'new_booking'
        ? `⚖️ *NyayaSetu* — New consultation request!\n\nMode: ${consultation.mode}\nScheduled: ${new Date(consultation.scheduledAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}\n\nPlease accept or decline from your dashboard: nyayasetu.in/lawyer/dashboard`
        : subject === 'cancelled'
        ? `⚠️ *NyayaSetu* — A consultation has been cancelled.\n\nConsultation ID: ${consultation._id}`
        : null;

    if (message && lawyerUser.whatsappOptIn && lawyerUser.whatsappNumber) {
      await whatsappService.sendMessage(lawyerUser.whatsappNumber, message);
    }
  } catch (err) {
    logger.warn('[consultation.controller] notifyLawyer failed', { error: err.message });
  }
}

async function notifyCitizen(citizenUser, consultation, subject) {
  if (!citizenUser) return;
  try {
    let message = null;
    if (subject === 'accepted') {
      const scheduledStr = new Date(consultation.scheduledAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
      const linkLine = consultation.mode === 'video' && consultation.meetingLink
        ? `\n\n📹 Join video call: ${consultation.meetingLink}`
        : '';
      message = `✅ *NyayaSetu* — Your consultation has been accepted!\n\nLawyer will meet you on ${scheduledStr}.\n\nMode: ${consultation.mode}${linkLine}`;
    } else if (subject === 'rejected') {
      message = `❌ *NyayaSetu* — Your consultation request was declined. A refund (if applicable) will be processed in 5-7 business days.\n\nPlease book with another lawyer at nyayasetu.in/lawyers`;
    } else if (subject === 'completed') {
      message = `🎉 *NyayaSetu* — Your consultation is complete! Please rate your experience at nyayasetu.in`;
    }

    if (message && citizenUser.whatsappOptIn && citizenUser.whatsappNumber) {
      await whatsappService.sendMessage(citizenUser.whatsappNumber, message);
    }
  } catch (err) {
    logger.warn('[consultation.controller] notifyCitizen failed', { error: err.message });
  }
}

/* ---------------------------------------------------------------------------
 * createConsultation
 * POST /v1/consultations
 * Body: { lawyerId, mode, scheduledAt, notes, documentId? }
 * ------------------------------------------------------------------------ */
const createConsultation = asyncHandler(async (req, res) => {
  const citizenUserId = req.user.userId;
  const { lawyerId, mode, scheduledAt, notes, documentId } = req.body;

  if (!lawyerId || !mode || !scheduledAt) {
    return res.status(400).json({ error: 'lawyerId, mode and scheduledAt are required' });
  }

  const VALID_MODES = ['chat', 'video', 'phone', 'in_person'];
  if (!VALID_MODES.includes(mode)) {
    return res.status(400).json({ error: `mode must be one of: ${VALID_MODES.join(', ')}` });
  }

  const scheduledDate = new Date(scheduledAt);
  if (isNaN(scheduledDate.getTime()) || scheduledDate < new Date()) {
    return res.status(400).json({ error: 'scheduledAt must be a valid future date' });
  }

  if (!mongoose.Types.ObjectId.isValid(lawyerId)) {
    return res.status(400).json({ error: 'Invalid lawyerId' });
  }

  const lawyerProfile = await LawyerProfile.findById(lawyerId).populate('user', 'name email phone whatsappOptIn whatsappNumber');
  if (!lawyerProfile) {
    return res.status(404).json({ error: 'Lawyer not found' });
  }
  if (!lawyerProfile.isVerified) {
    return res.status(400).json({ error: 'Lawyer is not yet verified' });
  }
  if (!lawyerProfile.isAcceptingClients) {
    return res.status(400).json({ error: 'Lawyer is not currently accepting consultations' });
  }
  if (!lawyerProfile.consultationModes.includes(mode)) {
    return res.status(400).json({
      error: `Lawyer does not offer ${mode} consultations. Available modes: ${lawyerProfile.consultationModes.join(', ')}`,
    });
  }

  // Validate optional documentId
  if (documentId) {
    if (!mongoose.Types.ObjectId.isValid(documentId)) {
      return res.status(400).json({ error: 'Invalid documentId' });
    }
    const doc = await Document.findOne({ _id: documentId, user: citizenUserId }).lean();
    if (!doc) {
      return res.status(404).json({ error: 'Document not found or does not belong to you' });
    }
  }

  // ── Availability + conflict check ────────────────────────────────────────
  // 1. Check the lawyer's weekly availability schedule for this dayOfWeek
  const dayOfWeek = scheduledDate.getDay(); // scheduler sends IST ISO string, JS Date handles it
  if (lawyerProfile.availability && lawyerProfile.availability.length > 0) {
    const rule = lawyerProfile.availability.find((a) => a.dayOfWeek === dayOfWeek && a.isActive !== false);
    if (!rule) {
      const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      return res.status(409).json({
        error: 'LAWYER_UNAVAILABLE',
        message: `Lawyer is not available on ${DAY_NAMES[dayOfWeek]}. Please choose another date.`,
      });
    }
    // Verify the slot time falls within the rule's window
    const istDate = new Date(scheduledDate.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const slotMinutes = istDate.getHours() * 60 + istDate.getMinutes();
    const [sH, sM] = rule.startTime.split(':').map(Number);
    const [eH, eM] = rule.endTime.split(':').map(Number);
    if (slotMinutes < sH * 60 + sM || slotMinutes >= eH * 60 + eM) {
      return res.status(409).json({
        error: 'OUTSIDE_HOURS',
        message: `Slot is outside the lawyer's working hours (${rule.startTime}–${rule.endTime} IST).`,
      });
    }
  }

  // 2. Check for an overlapping booking (same lawyer, overlapping time range, active statuses)
  const slotDuration = 30; // minutes
  const slotEnd = new Date(scheduledDate.getTime() + slotDuration * 60 * 1000);
  const overlap = await Consultation.findOne({
    lawyer: lawyerId,
    status: { $in: ['requested', 'accepted'] },
    scheduledAt: { $lt: slotEnd },
    $expr: {
      $gt: [
        { $add: ['$scheduledAt', { $multiply: [{ $ifNull: ['$durationMinutes', 30] }, 60000] }] },
        scheduledDate,
      ],
    },
  }).lean();

  if (overlap) {
    return res.status(409).json({
      error: 'SLOT_TAKEN',
      message: 'This slot is already booked. Please choose a different time.',
    });
  }

  const feeInPaise = lawyerProfile.consultationFee; // stored in paise per Section 12 spec

  // Create Razorpay order first (atomic: if this fails, no consultation record is saved)
  // Receipt max length is 40 chars; last 8 chars of userId + base-36 timestamp = 21 chars total
  const receipt = `c_${String(citizenUserId).slice(-8)}_${Date.now().toString(36)}`;

  let razorpayOrder;
  try {
    razorpayOrder = await getRazorpay().orders.create({
      amount: feeInPaise,
      currency: 'INR',
      receipt,
      notes: {
        lawyerId: String(lawyerId),
        citizenId: String(citizenUserId),
        mode,
      },
    });
  } catch (err) {
    const razorpayError = err?.error?.description || err?.message || JSON.stringify(err);
    logger.error('[consultation.controller] Razorpay order creation failed', {
      razorpayError,
      receipt,
      amount: feeInPaise,
    });
    return res.status(502).json({ error: 'Payment gateway error — please try again' });
  }

  // Save Payment record (status: created — webhook will update it to paid/failed)
  const payment = await Payment.create({
    user: citizenUserId,
    type: 'consultation',
    razorpayOrderId: razorpayOrder.id,
    amount: feeInPaise,
    currency: 'INR',
    status: 'created',
    lawyerEarnings: 0,
    platformEarnings: 0,
  });

  // Create Consultation record
  const consultation = await Consultation.create({
    citizen: citizenUserId,
    lawyer: lawyerId,
    mode,
    scheduledAt: scheduledDate,
    notes: notes || '',
    status: 'requested',
    fee: feeInPaise,
    payment: payment._id,
    ...(documentId ? { linkedDocument: documentId } : {}),
  });

  // Link payment back to consultation
  payment.relatedEntity = consultation._id;
  payment.relatedEntityType = 'Consultation';
  await payment.save();

  // Notify lawyer (best-effort)
  await notifyLawyer(lawyerProfile.user, consultation, 'new_booking');

  // In-app notification for lawyer
  try {
    await Notification.create({
      user: lawyerProfile.user._id,
      type: 'new_consultation_request',
      title: 'New consultation request',
      body: `A citizen has requested a ${mode} consultation on ${scheduledDate.toLocaleDateString('en-IN')}`,
      data: { consultationId: consultation._id },
      channel: 'web',
      isRead: false,
    });
  } catch (_) {}

  return res.status(201).json({
    consultationId: consultation._id,
    status: consultation.status,
    paymentOrder: {
      orderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
    },
  });
});

/* ---------------------------------------------------------------------------
 * acceptConsultation
 * PATCH /v1/consultations/:id/accept
 * ------------------------------------------------------------------------ */
const acceptConsultation = asyncHandler(async (req, res) => {
  const lawyerUserId = req.user.userId;
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid consultation id' });
  }

  const lawyerProfile = await LawyerProfile.findOne({ user: lawyerUserId }).lean();
  if (!lawyerProfile) {
    return res.status(403).json({ error: 'Lawyer profile not found' });
  }

  const consultation = await Consultation.findOne({ _id: id, lawyer: lawyerProfile._id });
  if (!consultation) {
    return res.status(404).json({ error: 'Consultation not found' });
  }
  if (consultation.status !== 'requested') {
    return res.status(400).json({ error: `Cannot accept a consultation with status '${consultation.status}'` });
  }

  consultation.status = 'accepted';
  consultation.acceptedAt = new Date();

  // Generate a video room for video consultations before saving
  if (consultation.mode === 'video') {
    try {
      const { createRoom } = require('../services/video/videoProvider');
      consultation.meetingLink = await createRoom(consultation);
    } catch (err) {
      logger.error('[consultation/accept] Video room creation failed', { error: err.message, id });
      // Don't block acceptance — lawyer can share a link manually
    }
  }

  await consultation.save();

  const citizenUser = await User.findById(consultation.citizen).select('name email phone whatsappOptIn whatsappNumber').lean();

  await notifyCitizen(citizenUser, consultation, 'accepted');

  const notifBody = consultation.mode === 'video' && consultation.meetingLink
    ? `Your video consultation on ${new Date(consultation.scheduledAt).toLocaleDateString('en-IN')} has been accepted. Join here: ${consultation.meetingLink}`
    : `Your ${consultation.mode} consultation on ${new Date(consultation.scheduledAt).toLocaleDateString('en-IN')} has been accepted.`;

  try {
    await Notification.create({
      user: consultation.citizen,
      type: 'consultation_accepted',
      title: 'Consultation accepted',
      body: notifBody,
      data: {
        consultationId: consultation._id,
        ...(consultation.meetingLink ? { meetingLink: consultation.meetingLink } : {}),
      },
      channel: 'web',
      isRead: false,
    });
  } catch (_) {}

  return res.json({ consultation });
});

/* ---------------------------------------------------------------------------
 * rejectConsultation
 * PATCH /v1/consultations/:id/reject
 * ------------------------------------------------------------------------ */
const rejectConsultation = asyncHandler(async (req, res) => {
  const lawyerUserId = req.user.userId;
  const { id } = req.params;
  const { reason } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid consultation id' });
  }

  const lawyerProfile = await LawyerProfile.findOne({ user: lawyerUserId }).lean();
  if (!lawyerProfile) {
    return res.status(403).json({ error: 'Lawyer profile not found' });
  }

  const consultation = await Consultation.findOne({ _id: id, lawyer: lawyerProfile._id });
  if (!consultation) {
    return res.status(404).json({ error: 'Consultation not found' });
  }
  if (!['requested', 'accepted'].includes(consultation.status)) {
    return res.status(400).json({ error: `Cannot reject a consultation with status '${consultation.status}'` });
  }

  consultation.status = 'rejected';
  consultation.rejectedAt = new Date();
  if (reason) consultation.rejectionReason = reason;
  await consultation.save();

  // Initiate refund if payment was captured
  const payment = await Payment.findById(consultation.payment);
  let refundInitiated = false;
  if (payment && payment.status === 'paid' && payment.razorpayPaymentId) {
    try {
      await getRazorpay().payments.refund(payment.razorpayPaymentId, {
        amount: payment.amount,
        speed: 'normal',
        notes: { reason: 'Consultation rejected by lawyer' },
      });
      payment.status = 'refunded';
      await payment.save();
      refundInitiated = true;
    } catch (err) {
      logger.error('[consultation.controller] Refund failed', {
        paymentId: payment.razorpayPaymentId,
        error: err.message,
      });
    }
  }

  const citizenUser = await User.findById(consultation.citizen).select('name email phone whatsappOptIn whatsappNumber').lean();
  await notifyCitizen(citizenUser, consultation, 'rejected');

  try {
    await Notification.create({
      user: consultation.citizen,
      type: 'consultation_rejected',
      title: 'Consultation declined',
      body: `Your consultation request was declined by the lawyer.${refundInitiated ? ' A refund will be processed in 5-7 business days.' : ''}`,
      data: { consultationId: consultation._id },
      channel: 'web',
      isRead: false,
    });
  } catch (_) {}

  return res.json({ consultation, refundInitiated });
});

/* ---------------------------------------------------------------------------
 * completeConsultation
 * PATCH /v1/consultations/:id/complete
 * Calculates commission split, updates lawyer earnings.
 * ------------------------------------------------------------------------ */
const completeConsultation = asyncHandler(async (req, res) => {
  const lawyerUserId = req.user.userId;
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid consultation id' });
  }

  const lawyerProfile = await LawyerProfile.findOne({ user: lawyerUserId });
  if (!lawyerProfile) {
    return res.status(403).json({ error: 'Lawyer profile not found' });
  }

  const consultation = await Consultation.findOne({ _id: id, lawyer: lawyerProfile._id });
  if (!consultation) {
    return res.status(404).json({ error: 'Consultation not found' });
  }
  if (consultation.status !== 'accepted') {
    return res.status(400).json({ error: `Cannot complete a consultation with status '${consultation.status}'` });
  }

  consultation.status = 'completed';
  consultation.completedAt = new Date();
  await consultation.save();

  // Commission split
  const referralFeePercent = lawyerProfile.referralFeePercent || 10;
  const { platformEarnings, lawyerEarnings } = computeCommission(consultation.fee, referralFeePercent);

  // Update Payment record
  if (consultation.payment) {
    await Payment.findByIdAndUpdate(consultation.payment, {
      $set: { lawyerEarnings, platformEarnings },
    });
  }

  // Update lawyer aggregate totals
  lawyerProfile.totalEarnings = (lawyerProfile.totalEarnings || 0) + lawyerEarnings;
  lawyerProfile.totalConsultations = (lawyerProfile.totalConsultations || 0) + 1;
  await lawyerProfile.save();

  const citizenUser = await User.findById(consultation.citizen).select('name email phone whatsappOptIn whatsappNumber').lean();
  await notifyCitizen(citizenUser, consultation, 'completed');

  try {
    await Notification.create({
      user: consultation.citizen,
      type: 'consultation_completed',
      title: 'Consultation complete',
      body: 'Your consultation is complete. How did it go? Please take a moment to rate your lawyer.',
      data: { consultationId: consultation._id },
      channel: 'web',
      isRead: false,
    });
  } catch (_) {}

  return res.json({
    consultation,
    commission: {
      totalFee: consultation.fee,
      lawyerEarnings,
      platformEarnings,
      referralFeePercent,
    },
  });
});

/* ---------------------------------------------------------------------------
 * rateConsultation
 * POST /v1/consultations/:id/rate
 * Body: { score: 1-5, review: string }
 * ------------------------------------------------------------------------ */
const rateConsultation = asyncHandler(async (req, res) => {
  const citizenUserId = req.user.userId;
  const { id } = req.params;
  const { score, review } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid consultation id' });
  }

  const numScore = parseInt(score, 10);
  if (!numScore || numScore < 1 || numScore > 5) {
    return res.status(400).json({ error: 'score must be an integer between 1 and 5' });
  }

  const consultation = await Consultation.findOne({
    _id: id,
    citizen: citizenUserId,
    status: 'completed',
  });
  if (!consultation) {
    return res.status(404).json({ error: 'Consultation not found or not yet completed' });
  }
  if (consultation.rating && consultation.rating.score) {
    return res.status(409).json({ error: 'You have already rated this consultation' });
  }

  consultation.rating = {
    score: numScore,
    review: review ? String(review).substring(0, 1000) : '',
    createdAt: new Date(),
  };
  await consultation.save();

  // Recompute lawyer's averageRating from ALL rated consultations
  const ratingAgg = await Consultation.aggregate([
    { $match: { lawyer: consultation.lawyer, 'rating.score': { $exists: true, $ne: null } } },
    { $group: { _id: null, avg: { $avg: '$rating.score' }, count: { $sum: 1 } } },
  ]);

  if (ratingAgg.length > 0) {
    await LawyerProfile.findByIdAndUpdate(consultation.lawyer, {
      $set: {
        averageRating: Math.round(ratingAgg[0].avg * 10) / 10,
        totalRatings: ratingAgg[0].count,
      },
    });
  }

  return res.json({ ok: true, rating: consultation.rating });
});

/* ---------------------------------------------------------------------------
 * listConsultations
 * GET /v1/consultations
 * Works for both citizens (their own bookings) and lawyers (their client bookings).
 * Query: status, page, limit
 * ------------------------------------------------------------------------ */
const listConsultations = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const persona = req.user.persona;
  const { status, page = 1, limit = 20 } = req.query;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (pageNum - 1) * limitNum;

  let filter = {};

  if (persona === 'lawyer') {
    const profile = await LawyerProfile.findOne({ user: userId }).lean();
    if (!profile) return res.status(404).json({ error: 'Lawyer profile not found' });
    filter.lawyer = profile._id;
  } else {
    filter.citizen = userId;
  }

  if (status) {
    const VALID_STATUSES = ['requested', 'accepted', 'rejected', 'completed', 'cancelled'];
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` });
    }
    filter.status = status;
  }

  try {
    const [items, total] = await Promise.all([
      Consultation.find(filter)
        .sort({ scheduledAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate('citizen', 'name phone email')
        .populate('lawyer', 'specialisations averageRating consultationFee')
        .lean(),
      Consultation.countDocuments(filter),
    ]);

    return res.json({
      items,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.max(1, Math.ceil(total / limitNum)),
    });
  } catch (err) {
    logger.error('[consultation.controller] listConsultations failed', { userId, error: err.message });
    return res.status(500).json({ error: 'Failed to load consultations' });
  }
});

module.exports = {
  createConsultation,
  acceptConsultation,
  rejectConsultation,
  completeConsultation,
  rateConsultation,
  listConsultations,
};
