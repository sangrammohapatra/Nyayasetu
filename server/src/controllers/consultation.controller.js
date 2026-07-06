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
const AuditLog = require('../models/AuditLog.model');

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

// Shared by completeConsultation and markNoShow — both credit the lawyer for
// the full fee (the lawyer held the slot; only the citizen's own cancellation
// path is refund-eligible).
async function creditLawyerEarnings(lawyerProfile, payment, feeInPaise) {
  const referralFeePercent = lawyerProfile.referralFeePercent || 10;
  const { platformEarnings, lawyerEarnings } = computeCommission(feeInPaise, referralFeePercent);

  payment.lawyerEarnings = lawyerEarnings;
  payment.platformEarnings = platformEarnings;
  await payment.save();

  // $inc (not read-modify-write) so two different consultations for the same
  // lawyer completing concurrently don't lose one increment to the other.
  await LawyerProfile.findByIdAndUpdate(lawyerProfile._id, {
    $inc: { totalEarnings: lawyerEarnings, totalConsultations: 1 },
  });

  return { platformEarnings, lawyerEarnings, referralFeePercent };
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
  // Both the day-of-week and time-window checks must use IST, since scheduledDate
  // is a UTC instant and the server may not run in IST (getDay() would use server tz).
  const istDate = new Date(scheduledDate.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const dayOfWeek = istDate.getDay();
  if (!lawyerProfile.availability || lawyerProfile.availability.length === 0) {
    // No schedule configured yet — refuse rather than silently allowing any time.
    return res.status(409).json({
      error: 'LAWYER_SCHEDULE_NOT_SET',
      message: 'This lawyer has not set up their availability schedule yet. Please choose another lawyer or check back later.',
    });
  }
  const rule = lawyerProfile.availability.find((a) => a.dayOfWeek === dayOfWeek && a.isActive !== false);
  if (!rule) {
    const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return res.status(409).json({
      error: 'LAWYER_UNAVAILABLE',
      message: `Lawyer is not available on ${DAY_NAMES[dayOfWeek]}. Please choose another date.`,
    });
  }
  // Verify the slot time falls within the rule's window
  const slotMinutes = istDate.getHours() * 60 + istDate.getMinutes();
  const [sH, sM] = rule.startTime.split(':').map(Number);
  const [eH, eM] = rule.endTime.split(':').map(Number);
  if (slotMinutes < sH * 60 + sM || slotMinutes >= eH * 60 + eM) {
    return res.status(409).json({
      error: 'OUTSIDE_HOURS',
      message: `Slot is outside the lawyer's working hours (${rule.startTime}–${rule.endTime} IST).`,
    });
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
  if (!feeInPaise || feeInPaise < 100) {
    return res.status(400).json({ error: 'Invalid consultation fee configured by this lawyer' });
  }

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
  // lawyer stores User._id (ref: 'User'); lawyerProfile stores LawyerProfile._id (ref: 'LawyerProfile')
  let consultation;
  try {
    consultation = await Consultation.create({
      citizen: citizenUserId,
      lawyer: lawyerProfile.user._id,
      lawyerProfile: lawyerId,
      mode,
      scheduledAt: scheduledDate,
      notes: notes || '',
      status: 'requested',
      fee: feeInPaise,
      payment: payment._id,
      ...(documentId ? { linkedDocument: documentId } : {}),
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({
        error: 'SLOT_TAKEN',
        message: 'This slot was just booked by someone else. Please choose a different time.',
      });
    }
    throw err;
  }

  // Link payment back to consultation
  payment.relatedEntity = consultation._id;
  payment.relatedEntityType = 'Consultation';
  await payment.save();

  await AuditLog.log(req, 'consultation.requested', 'Consultation', consultation._id, {
    lawyerId: String(lawyerId),
    mode,
    scheduledAt,
    fee: feeInPaise,
  });

  // Notify lawyer (best-effort)
  await notifyLawyer(lawyerProfile.user, consultation, 'new_booking');

  // In-app notification for lawyer
  try {
    await Notification.createForUser({
      userId: lawyerProfile.user._id,
      type: 'consultation_requested',
      title: 'New consultation request',
      body: `A citizen has requested a ${mode} consultation on ${scheduledDate.toLocaleDateString('en-IN')}`,
      data: { consultationId: consultation._id },
      actionUrl: `/consultations/${consultation._id}`,
      io: req.app.get('io'),
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

  const existing = await Consultation.findOne({ _id: id, lawyer: lawyerUserId }).lean();
  if (!existing) {
    return res.status(404).json({ error: 'Consultation not found' });
  }
  if (existing.status !== 'requested') {
    return res.status(400).json({ error: `Cannot accept a consultation with status '${existing.status}'` });
  }

  // A citizen can dismiss checkout without paying, leaving the slot reserved with
  // nothing to show for it. Refusing to accept until payment is captured means an
  // unpaid request stays in 'requested' (auto-swept by consultationSla after 48h)
  // instead of becoming a permanently-blocked 'accepted'-but-unpaid slot.
  const existingPayment = existing.payment ? await Payment.findById(existing.payment).select('status').lean() : null;
  if (!existingPayment || existingPayment.status !== 'paid') {
    return res.status(400).json({ error: 'Cannot accept a consultation whose payment has not been captured yet' });
  }

  // Atomic claim — prevents a concurrent duplicate accept from both passing the
  // status check above and both proceeding (e.g. double-click, client retry).
  const consultation = await Consultation.findOneAndUpdate(
    { _id: id, lawyer: lawyerUserId, status: 'requested' },
    { $set: { status: 'accepted', acceptedAt: new Date() } },
    { new: true }
  );
  if (!consultation) {
    return res.status(400).json({ error: 'Cannot accept — consultation status changed concurrently' });
  }

  // Generate a video room for video consultations after the claim succeeds
  if (consultation.mode === 'video') {
    try {
      const { createRoom } = require('../services/video/videoProvider');
      consultation.meetingLink = await createRoom(consultation);
      await consultation.save();
    } catch (err) {
      logger.error('[consultation/accept] Video room creation failed', { error: err.message, id });
      // Don't block acceptance — lawyer can share a link manually
    }
  }

  await AuditLog.log(req, 'consultation.accepted', 'Consultation', consultation._id, {
    mode: consultation.mode,
    scheduledAt: consultation.scheduledAt,
    ...(consultation.meetingLink ? { meetingLink: consultation.meetingLink } : {}),
  });

  const citizenUser = await User.findById(consultation.citizen).select('name email phone whatsappOptIn whatsappNumber').lean();

  await notifyCitizen(citizenUser, consultation, 'accepted');

  const notifBody = consultation.mode === 'video' && consultation.meetingLink
    ? `Your video consultation on ${new Date(consultation.scheduledAt).toLocaleDateString('en-IN')} has been accepted. Join here: ${consultation.meetingLink}`
    : `Your ${consultation.mode} consultation on ${new Date(consultation.scheduledAt).toLocaleDateString('en-IN')} has been accepted.`;

  try {
    await Notification.createForUser({
      userId: consultation.citizen,
      type: 'consultation_accepted',
      title: 'Consultation accepted',
      body: notifBody,
      data: {
        consultationId: consultation._id,
        ...(consultation.meetingLink ? { meetingLink: consultation.meetingLink } : {}),
      },
      actionUrl: `/consultations/${consultation._id}`,
      io: req.app.get('io'),
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

  const existing = await Consultation.findOne({ _id: id, lawyer: lawyerUserId }).lean();
  if (!existing) {
    return res.status(404).json({ error: 'Consultation not found' });
  }
  if (!['requested', 'accepted'].includes(existing.status)) {
    return res.status(400).json({ error: `Cannot reject a consultation with status '${existing.status}'` });
  }

  // Atomic claim BEFORE the refund attempt — prevents a concurrent duplicate
  // reject from both passing the status check and both triggering a refund.
  // If the refund below fails, we revert this claim so the lawyer can retry.
  const consultation = await Consultation.findOneAndUpdate(
    { _id: id, lawyer: lawyerUserId, status: existing.status },
    { $set: { status: 'rejected', rejectedAt: new Date(), ...(reason ? { rejectionReason: reason } : {}) } },
    { new: true }
  );
  if (!consultation) {
    return res.status(400).json({ error: 'Cannot reject — consultation status changed concurrently' });
  }

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
      // Revert the claim so the citizen isn't left paid-and-rejected with no
      // automatic retry path, and the lawyer can retry the reject later.
      await Consultation.findOneAndUpdate(
        { _id: id, status: 'rejected' },
        { $set: { status: existing.status }, $unset: { rejectedAt: '', rejectionReason: '' } }
      );
      return res.status(502).json({ error: 'Refund initiation failed — please try again' });
    }
  }

  await AuditLog.log(req, 'consultation.rejected', 'Consultation', consultation._id, {
    reason,
    refundInitiated,
  });

  const citizenUser = await User.findById(consultation.citizen).select('name email phone whatsappOptIn whatsappNumber').lean();
  await notifyCitizen(citizenUser, consultation, 'rejected');

  try {
    await Notification.createForUser({
      userId: consultation.citizen,
      type: 'consultation_rejected',
      title: 'Consultation declined',
      body: `Your consultation request was declined by the lawyer.${refundInitiated ? ' A refund will be processed in 5-7 business days.' : ''}`,
      data: { consultationId: consultation._id },
      actionUrl: `/consultations/${consultation._id}`,
      io: req.app.get('io'),
    });
  } catch (_) {}

  return res.json({ consultation, refundInitiated });
});

/* ---------------------------------------------------------------------------
 * cancelConsultation
 * PATCH /v1/consultations/:id/cancel
 * Citizen self-service cancellation. Full refund only if cancelled >=24h
 * before the scheduled time; no refund inside that window.
 * ------------------------------------------------------------------------ */
const CANCELLATION_REFUND_WINDOW_HOURS = 24;

const cancelConsultation = asyncHandler(async (req, res) => {
  const citizenUserId = req.user.userId;
  const { id } = req.params;
  const { reason } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid consultation id' });
  }

  const existing = await Consultation.findOne({ _id: id, citizen: citizenUserId }).lean();
  if (!existing) {
    return res.status(404).json({ error: 'Consultation not found' });
  }
  if (!['requested', 'accepted'].includes(existing.status)) {
    return res.status(400).json({ error: `Cannot cancel a consultation with status '${existing.status}'` });
  }

  const hoursUntilScheduled = (existing.scheduledAt.getTime() - Date.now()) / (1000 * 60 * 60);
  const eligibleForRefund = hoursUntilScheduled >= CANCELLATION_REFUND_WINDOW_HOURS;

  // Atomic claim BEFORE the refund attempt — prevents a concurrent duplicate
  // cancel from both passing the status check and both triggering a refund.
  // If the refund below fails, we revert this claim so the citizen can retry.
  const consultation = await Consultation.findOneAndUpdate(
    { _id: id, citizen: citizenUserId, status: existing.status },
    { $set: { status: 'cancelled', cancelledBy: 'citizen', ...(reason ? { cancellationReason: reason } : {}) } },
    { new: true }
  );
  if (!consultation) {
    return res.status(400).json({ error: 'Cannot cancel — consultation status changed concurrently' });
  }

  const payment = await Payment.findById(consultation.payment);
  let refundInitiated = false;
  if (eligibleForRefund && payment && payment.status === 'paid' && payment.razorpayPaymentId) {
    try {
      await getRazorpay().payments.refund(payment.razorpayPaymentId, {
        amount: payment.amount,
        speed: 'normal',
        notes: { reason: 'Consultation cancelled by citizen (>=24h notice)' },
      });
      payment.status = 'refunded';
      await payment.save();
      refundInitiated = true;
    } catch (err) {
      logger.error('[consultation.controller] Cancellation refund failed', {
        paymentId: payment.razorpayPaymentId,
        error: err.message,
      });
      // Revert the claim so the citizen isn't left paid-and-cancelled with no
      // automatic retry path, and can retry the cancellation later.
      await Consultation.findOneAndUpdate(
        { _id: id, status: 'cancelled' },
        { $set: { status: existing.status }, $unset: { cancelledBy: '', cancellationReason: '' } }
      );
      return res.status(502).json({ error: 'Refund initiation failed — please try again' });
    }
  }

  await AuditLog.log(req, 'consultation.cancelled', 'Consultation', consultation._id, {
    reason,
    refundInitiated,
    eligibleForRefund,
  });

  const lawyerUser = await User.findById(consultation.lawyer).select('name email phone whatsappOptIn whatsappNumber').lean();
  await notifyLawyer(lawyerUser, consultation, 'cancelled');

  try {
    await Notification.createForUser({
      userId: consultation.lawyer,
      type: 'consultation_cancelled',
      title: 'Consultation cancelled',
      body: `The citizen cancelled their ${consultation.mode} consultation scheduled for ${new Date(consultation.scheduledAt).toLocaleDateString('en-IN')}.`,
      data: { consultationId: consultation._id },
      actionUrl: `/consultations/${consultation._id}`,
      io: req.app.get('io'),
    });
  } catch (_) {}

  return res.json({ consultation, refundInitiated, eligibleForRefund });
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

  const existing = await Consultation.findOne({ _id: id, lawyer: lawyerUserId }).lean();
  if (!existing) {
    return res.status(404).json({ error: 'Consultation not found' });
  }
  if (existing.status !== 'accepted') {
    return res.status(400).json({ error: `Cannot complete a consultation with status '${existing.status}'` });
  }

  // Earnings must never be credited on uncaptured money — payment.status only
  // becomes 'paid' via the client verify call or the Razorpay webhook.
  const payment = existing.payment ? await Payment.findById(existing.payment) : null;
  if (!payment || payment.status !== 'paid') {
    return res.status(400).json({ error: 'Cannot complete a consultation whose payment has not been captured yet' });
  }

  // Atomic claim — prevents a concurrent duplicate complete (double-click, retry)
  // from both passing the status check and both crediting the lawyer's earnings.
  const consultation = await Consultation.findOneAndUpdate(
    { _id: id, lawyer: lawyerUserId, status: 'accepted' },
    { $set: { status: 'completed', completedAt: new Date() } },
    { new: true }
  );
  if (!consultation) {
    return res.status(400).json({ error: 'Cannot complete — consultation status changed concurrently' });
  }

  await AuditLog.log(req, 'consultation.completed', 'Consultation', consultation._id, {
    fee: consultation.fee,
  });

  const { platformEarnings, lawyerEarnings, referralFeePercent } =
    await creditLawyerEarnings(lawyerProfile, payment, consultation.fee);

  const citizenUser = await User.findById(consultation.citizen).select('name email phone whatsappOptIn whatsappNumber').lean();
  await notifyCitizen(citizenUser, consultation, 'completed');

  try {
    await Notification.createForUser({
      userId: consultation.citizen,
      type: 'consultation_completed',
      title: 'Consultation complete',
      body: 'Your consultation is complete. How did it go? Please take a moment to rate your lawyer.',
      data: { consultationId: consultation._id },
      actionUrl: `/consultations/${consultation._id}`,
      io: req.app.get('io'),
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
 * markNoShow
 * PATCH /v1/consultations/:id/no-show
 * Lawyer marks the citizen as a no-show. The lawyer held the slot and showed
 * up, so they're credited the full fee just like a completed consultation —
 * the citizen forfeits the fee for not attending.
 * ------------------------------------------------------------------------ */
const markNoShow = asyncHandler(async (req, res) => {
  const lawyerUserId = req.user.userId;
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid consultation id' });
  }

  const lawyerProfile = await LawyerProfile.findOne({ user: lawyerUserId });
  if (!lawyerProfile) {
    return res.status(403).json({ error: 'Lawyer profile not found' });
  }

  const existing = await Consultation.findOne({ _id: id, lawyer: lawyerUserId }).lean();
  if (!existing) {
    return res.status(404).json({ error: 'Consultation not found' });
  }
  if (existing.status !== 'accepted') {
    return res.status(400).json({ error: `Cannot mark no-show for a consultation with status '${existing.status}'` });
  }

  const payment = existing.payment ? await Payment.findById(existing.payment) : null;
  if (!payment || payment.status !== 'paid') {
    return res.status(400).json({ error: 'Cannot mark no-show for a consultation whose payment has not been captured yet' });
  }

  // Atomic claim — prevents a concurrent duplicate no-show (double-click, retry)
  // from both passing the status check and both crediting the lawyer's earnings.
  const consultation = await Consultation.findOneAndUpdate(
    { _id: id, lawyer: lawyerUserId, status: 'accepted' },
    { $set: { status: 'no_show', endedAt: new Date() } },
    { new: true }
  );
  if (!consultation) {
    return res.status(400).json({ error: 'Cannot mark no-show — consultation status changed concurrently' });
  }

  await AuditLog.log(req, 'consultation.no_show', 'Consultation', consultation._id, {
    fee: consultation.fee,
  });

  const { platformEarnings, lawyerEarnings, referralFeePercent } =
    await creditLawyerEarnings(lawyerProfile, payment, consultation.fee);

  try {
    await Notification.createForUser({
      userId: consultation.citizen,
      type: 'consultation_no_show',
      title: 'Missed consultation',
      body: `You missed your ${consultation.mode} consultation. Please book a new slot if you'd still like to speak with the lawyer.`,
      data: { consultationId: consultation._id },
      actionUrl: `/citizen/lawyers/${consultation.lawyerProfile}`,
      io: req.app.get('io'),
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
  if (consultation.citizenRating && consultation.citizenRating.score) {
    return res.status(409).json({ error: 'You have already rated this consultation' });
  }

  consultation.citizenRating = {
    score: numScore,
    review: review ? String(review).substring(0, 1000) : '',
    ratedAt: new Date(),
  };
  await consultation.save();

  // Recompute lawyer's averageRating from ALL rated consultations
  const ratingAgg = await Consultation.aggregate([
    { $match: { lawyer: consultation.lawyer, 'citizenRating.score': { $exists: true, $ne: null } } },
    { $group: { _id: null, avg: { $avg: '$citizenRating.score' }, count: { $sum: 1 } } },
  ]);

  if (ratingAgg.length > 0) {
    await LawyerProfile.findByIdAndUpdate(consultation.lawyerProfile, {
      $set: {
        averageRating: Math.round(ratingAgg[0].avg * 10) / 10,
        totalRatings: ratingAgg[0].count,
      },
    });
  }

  await AuditLog.log(req, 'consultation.rated', 'Consultation', consultation._id, { score: numScore });

  return res.json({ ok: true, rating: consultation.citizenRating });
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
    filter.lawyer = userId;
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
        .populate('lawyer', 'name email phone avatar')
        .populate('lawyerProfile', 'specialisations averageRating consultationFee')
        .lean(),
      Consultation.countDocuments(filter),
    ]);

    // lawyerNotes are the lawyer's private session notes — never expose them to citizens.
    if (persona !== 'lawyer') {
      for (const item of items) delete item.lawyerNotes;
    }

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
  cancelConsultation,
  completeConsultation,
  markNoShow,
  rateConsultation,
  listConsultations,
  creditLawyerEarnings,
};
