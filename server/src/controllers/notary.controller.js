'use strict';

const multer = require('multer');
const NotaryProfile = require('../models/NotaryProfile.model');
const NotarizationRequest = require('../models/NotarizationRequest.model');
const Document = require('../models/Document.model');
const User = require('../models/User.model');
const Notification = require('../models/Notification.model');
const razorpayService = require('../services/payment/razorpayService');
const storageProvider = require('../services/storage/storageProvider');
const videoProvider = require('../services/video/videoProvider');
const logger = require('../utils/logger');
const { PERSONAS, NOTARIZATION_FEE } = require('../config/constants');
const { signTokenPair } = require('./auth.controller');

// ─── Multer (certificate upload) ─────────────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (['application/pdf', 'image/jpeg', 'image/png'].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, JPG, or PNG files are allowed'));
    }
  },
});

exports.uploadCertificate = upload.single('certificate');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateStampRef() {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `NS-${ts}-${rand}`;
}

// ─── Public: Search Notaries ──────────────────────────────────────────────────

exports.searchNotaries = async (req, res) => {
  try {
    const {
      state,
      language,
      minRating,
      page = 1,
      limit = 20,
    } = req.query;

    const filter = { isVerified: true, isPublic: true, isAcceptingRequests: true };
    if (state) filter.practicingStates = state;
    if (language) filter.languages = language;
    if (minRating) filter.averageRating = { $gte: parseFloat(minRating) };

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [items, total] = await Promise.all([
      NotaryProfile.find(filter)
        .populate('user', 'name avatar state preferredLanguage')
        .sort({ averageRating: -1, totalNotarizations: -1 })
        .skip(skip)
        .limit(limitNum),
      NotaryProfile.countDocuments(filter),
    ]);

    res.json({ items, total, page: pageNum, limit: limitNum });
  } catch (err) {
    logger.error('searchNotaries error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to search notaries' });
  }
};

// ─── Get Notary Profile ───────────────────────────────────────────────────────

exports.getNotaryProfile = async (req, res) => {
  try {
    const profile = await NotaryProfile.findById(req.params.id)
      .populate('user', 'name avatar state preferredLanguage createdAt');

    if (!profile) return res.status(404).json({ error: 'NOT_FOUND', message: 'Notary not found' });

    await NotaryProfile.findByIdAndUpdate(req.params.id, { $inc: { profileViews: 1 } });
    res.json(profile);
  } catch (err) {
    logger.error('getNotaryProfile error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to load notary profile' });
  }
};

// ─── Apply as Notary ──────────────────────────────────────────────────────────

exports.applyAsNotary = async (req, res) => {
  try {
    const userId = req.user.userId;

    const existing = await NotaryProfile.findOne({ user: userId });
    if (existing) {
      return res.status(409).json({ error: 'ALREADY_APPLIED', message: 'You have already applied as a notary' });
    }

    const {
      notaryRegistrationNumber,
      registrationState,
      appointingAuthority,
      appointmentYear,
      experience,
      languages,
      bio,
      practicingStates,
    } = req.body;

    const profileData = {
      user: userId,
      notaryRegistrationNumber: notaryRegistrationNumber?.trim(),
      registrationState: registrationState?.trim(),
      appointingAuthority: appointingAuthority?.trim(),
      appointmentYear: appointmentYear ? parseInt(appointmentYear) : undefined,
      experience: parseInt(experience),
      languages: Array.isArray(languages) ? languages : (languages ? [languages] : ['en']),
      bio: bio?.trim(),
      practicingStates: Array.isArray(practicingStates) ? practicingStates : (practicingStates ? [practicingStates] : []),
    };

    if (!req.file) {
      return res.status(400).json({ error: 'CERTIFICATE_REQUIRED', message: 'Notary certificate document is required' });
    }

    const uploaded = await storageProvider.upload(req.file.buffer, {
      folder: 'notary-certs',
      filename: `notary_cert_${userId}`,
      mimetype: req.file.mimetype,
    });
    profileData.verificationDocs = [{
      type: 'notary_certificate',
      url: uploaded.url,
      uploadedAt: new Date(),
    }];

    const profile = await NotaryProfile.create(profileData);

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { persona: PERSONAS.NOTARY },
      { new: true }
    );

    const { accessToken, refreshToken } = signTokenPair(updatedUser);
    await updatedUser.addRefreshToken(refreshToken);

    res.status(201).json({ message: 'Application submitted. Under review.', profile, accessToken, refreshToken });
  } catch (err) {
    logger.error('applyAsNotary error:', err);
    if (err.code === 11000) {
      return res.status(409).json({ error: 'DUPLICATE', message: 'Registration number already in use' });
    }
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Application failed' });
  }
};

// ─── Update Notary Profile ────────────────────────────────────────────────────

exports.updateNotaryProfile = async (req, res) => {
  try {
    const profile = await NotaryProfile.findOne({ user: req.user.userId });
    if (!profile) return res.status(404).json({ error: 'NOT_FOUND', message: 'Profile not found' });

    const allowed = ['bio', 'languages', 'practicingStates', 'experience', 'isAcceptingRequests', 'availability'];
    allowed.forEach((key) => {
      if (req.body[key] !== undefined) profile[key] = req.body[key];
    });

    await profile.save();
    res.json({ message: 'Profile updated', profile });
  } catch (err) {
    logger.error('updateNotaryProfile error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Update failed' });
  }
};

// ─── Create Notarization Request (Citizen) ────────────────────────────────────

exports.createNotarizationRequest = async (req, res) => {
  try {
    const citizenId = req.user.userId;
    const { notaryId, documentId, notes, courierRequested, courierAddress } = req.body;

    // Validate notary
    const notaryProfile = await NotaryProfile.findById(notaryId).populate('user', '_id');
    if (!notaryProfile || !notaryProfile.isVerified || !notaryProfile.isAcceptingRequests) {
      return res.status(400).json({ error: 'NOTARY_UNAVAILABLE', message: 'Notary is not available' });
    }

    // Validate document belongs to citizen
    const doc = await Document.findOne({ _id: documentId, user: citizenId });
    if (!doc) return res.status(404).json({ error: 'NOT_FOUND', message: 'Document not found' });

    // Check for existing active request on this document
    const existingActive = await NotarizationRequest.findOne({
      document: documentId,
      citizen: citizenId,
      status: { $nin: ['rejected', 'cancelled'] },
    });
    if (existingActive) {
      return res.status(409).json({ error: 'ALREADY_REQUESTED', message: 'A notarization request already exists for this document' });
    }

    const notarizationReq = await NotarizationRequest.create({
      citizen: citizenId,
      notary: notaryProfile.user._id,
      notaryProfile: notaryProfile._id,
      document: documentId,
      notes: notes?.trim(),
      courierRequested: !!courierRequested,
      courierAddress: courierRequested ? courierAddress : undefined,
      payment: { amount: NOTARIZATION_FEE, status: 'pending' },
    });

    // Notify notary of new request
    try {
      await Notification.createForUser({
        userId: notaryProfile.user._id,
        type: 'notarization_requested',
        title: 'New notarization request',
        body: `A citizen has requested notarization for document "${doc.title}".`,
        data: { notarizationRequestId: notarizationReq._id },
        actionUrl: `/notary/requests/${notarizationReq._id}`,
        io: req.app.get('io'),
      });
    } catch (_) {}

    res.status(201).json({ notarizationRequest: notarizationReq });
  } catch (err) {
    logger.error('createNotarizationRequest error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to create notarization request' });
  }
};

// ─── Verify Payment ───────────────────────────────────────────────────────────

exports.verifyNotarizationPayment = async (req, res) => {
  try {
    const { requestId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

    // Fetch the request first so signature is verified against the server-stored
    // orderId, not the client-supplied one. This prevents an attacker from
    // replaying a valid (orderId, paymentId, signature) tuple from any other
    // Razorpay context against a different request.
    const pending = await NotarizationRequest.findOne({
      _id: requestId,
      citizen: req.user.userId,
      'payment.status': 'pending',
    });

    if (!pending) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Request not found' });
    }

    if (pending.payment.razorpayOrderId !== razorpayOrderId) {
      return res.status(400).json({ error: 'ORDER_MISMATCH', message: 'Payment verification failed' });
    }

    const isValid = razorpayService.verifySignature(
      pending.payment.razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    );
    if (!isValid) {
      return res.status(400).json({ error: 'INVALID_SIGNATURE', message: 'Payment verification failed' });
    }

    const notarizationReq = await NotarizationRequest.findByIdAndUpdate(
      pending._id,
      {
        'payment.status': 'paid',
        'payment.razorpayPaymentId': razorpayPaymentId,
        'payment.razorpaySignature': razorpaySignature,
        'payment.paidAt': new Date(),
      },
      { new: true }
    );

    if (!notarizationReq) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Request not found' });
    }

    // Notify notary that payment has been received
    try {
      await Notification.createForUser({
        userId: notarizationReq.notary,
        type: 'notarization_paid',
        title: 'Notarization payment received',
        body: 'The citizen has paid ₹199. You can now schedule the Video KYC session.',
        data: { notarizationRequestId: notarizationReq._id },
        actionUrl: `/notary/requests/${notarizationReq._id}`,
        priority: 'high',
        io: req.app.get('io'),
      });
    } catch (_) {}

    // Notify citizen that payment was successful
    try {
      await Notification.createForUser({
        userId: notarizationReq.citizen,
        type: 'payment_success',
        title: 'Payment successful',
        body: 'Your payment of ₹199 for notarization has been received. The notary will schedule a Video KYC shortly.',
        data: { notarizationRequestId: notarizationReq._id },
        actionUrl: `/notarization/${notarizationReq._id}`,
        io: req.app.get('io'),
      });
    } catch (_) {}

    res.json({ message: 'Payment verified. Notary will be notified.', notarizationRequest: notarizationReq });
  } catch (err) {
    logger.error('verifyNotarizationPayment error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Payment verification failed' });
  }
};

// ─── List Notarization Requests ───────────────────────────────────────────────

exports.listNotarizationRequests = async (req, res) => {
  try {
    const userId = req.user.userId;
    const persona = req.user.persona?.toLowerCase();
    const { status, page = 1, limit = 20 } = req.query;

    let filter = {};
    if (persona === 'admin') {
      // no restriction — admins see all requests
    } else if (persona === 'notary') {
      filter.notary = userId;
    } else {
      filter.citizen = userId;
    }

    if (status) filter.status = status;

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [items, total] = await Promise.all([
      NotarizationRequest.find(filter)
        .populate('citizen', 'name avatar phone')
        .populate('notary', 'name avatar')
        .populate('notaryProfile', 'notaryRegistrationNumber registrationState averageRating')
        .populate('document', 'title template createdAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      NotarizationRequest.countDocuments(filter),
    ]);

    res.json({ items, total, page: pageNum, limit: limitNum });
  } catch (err) {
    logger.error('listNotarizationRequests error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to load requests' });
  }
};

// ─── Get single request ────────────────────────────────────────────────────────

exports.getNotarizationRequest = async (req, res) => {
  try {
    const userId = req.user.userId;
    const request = await NotarizationRequest.findById(req.params.id)
      .populate('citizen', 'name avatar phone')
      .populate('notary', 'name avatar')
      .populate('notaryProfile', 'notaryRegistrationNumber registrationState averageRating')
      .populate('document', 'title template createdAt content');

    if (!request) return res.status(404).json({ error: 'NOT_FOUND' });
    if (!request.citizen._id.equals(userId) && !request.notary._id.equals(userId)) {
      return res.status(403).json({ error: 'FORBIDDEN' });
    }

    res.json(request);
  } catch (err) {
    logger.error('getNotarizationRequest error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to load request' });
  }
};

// ─── Accept Request (Notary) ──────────────────────────────────────────────────

exports.acceptRequest = async (req, res) => {
  try {
    const existing = await NotarizationRequest.findOne({
      _id: req.params.id, notary: req.user.userId, status: 'pending',
    });
    if (!existing) return res.status(404).json({ error: 'NOT_FOUND', message: 'Request not found' });

    // Create the Razorpay order now that notary has accepted — citizen will pay next
    const order = await razorpayService.createOrder({
      amount: NOTARIZATION_FEE,
      currency: 'INR',
      receipt: `notarize_${existing._id}_${Date.now()}`,
      notes: {
        notarizationRequestId: String(existing._id),
        citizenId: String(existing.citizen),
      },
    });

    const request = await NotarizationRequest.findByIdAndUpdate(
      existing._id,
      {
        status: 'accepted',
        'payment.razorpayOrderId': order.id,
        'payment.amount': NOTARIZATION_FEE,
      },
      { new: true }
    );

    // Notify citizen that request was accepted and payment is due
    try {
      await Notification.createForUser({
        userId: existing.citizen,
        type: 'notarization_accepted',
        title: 'Notarization request accepted',
        body: 'The notary has accepted your request. Please complete the payment of ₹199 to proceed.',
        data: { notarizationRequestId: request._id, razorpayOrderId: order.id },
        actionUrl: `/notarization/${request._id}`,
        priority: 'high',
        io: req.app.get('io'),
      });
    } catch (_) {}

    res.json({ message: 'Request accepted. Citizen will be prompted to pay.', request });
  } catch (err) {
    logger.error('acceptRequest error:', err);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
};

// ─── Schedule Video KYC (Notary) ──────────────────────────────────────────────

exports.scheduleKYC = async (req, res) => {
  try {
    const { scheduledAt } = req.body;

    // Create a video room via the existing videoProvider
    const room = await videoProvider.createRoom({
      name: `notary-kyc-${req.params.id}`,
      expiresAt: new Date(scheduledAt).getTime() / 1000 + 3600,
    });

    const request = await NotarizationRequest.findOneAndUpdate(
      { _id: req.params.id, notary: req.user.userId, status: 'accepted', 'payment.status': 'paid' },
      {
        status: 'kyc_scheduled',
        scheduledAt: new Date(scheduledAt),
        videoLink: room.url,
      },
      { new: true }
    );

    if (!request) return res.status(404).json({ error: 'NOT_FOUND', message: 'Request not found or citizen payment not yet received' });

    // Notify citizen of scheduled KYC
    try {
      await Notification.createForUser({
        userId: request.citizen,
        type: 'notarization_kyc_scheduled',
        title: 'Video KYC scheduled',
        body: `Your notarization Video KYC is scheduled for ${new Date(scheduledAt).toLocaleString('en-IN')}. Join the link at the scheduled time.`,
        data: { notarizationRequestId: request._id, videoLink: room.url, scheduledAt },
        actionUrl: `/notarization/${request._id}`,
        priority: 'high',
        io: req.app.get('io'),
      });
    } catch (_) {}

    res.json({ message: 'KYC session scheduled', request });
  } catch (err) {
    logger.error('scheduleKYC error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to schedule KYC' });
  }
};

// ─── Complete KYC (Notary) ────────────────────────────────────────────────────

exports.completeKYC = async (req, res) => {
  try {
    const request = await NotarizationRequest.findOneAndUpdate(
      { _id: req.params.id, notary: req.user.userId, status: 'kyc_scheduled' },
      { status: 'kyc_completed', kycCompletedAt: new Date() },
      { new: true }
    );
    if (!request) return res.status(404).json({ error: 'NOT_FOUND' });

    // Notify citizen that KYC is done and stamping is next
    try {
      await Notification.createForUser({
        userId: request.citizen,
        type: 'notarization_kyc_completed',
        title: 'Video KYC completed',
        body: 'Your Video KYC verification is complete. The notary will stamp your document shortly.',
        data: { notarizationRequestId: request._id },
        actionUrl: `/notarization/${request._id}`,
        io: req.app.get('io'),
      });
    } catch (_) {}

    res.json({ message: 'KYC completed. Ready to stamp.', request });
  } catch (err) {
    logger.error('completeKYC error:', err);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
};

// ─── Stamp Document (Notary) ──────────────────────────────────────────────────

exports.stampDocument = async (req, res) => {
  try {
    const request = await NotarizationRequest.findOne({
      _id: req.params.id,
      notary: req.user.userId,
      status: 'kyc_completed',
    }).populate('document').populate('notaryProfile');

    if (!request) return res.status(404).json({ error: 'NOT_FOUND' });

    const notaryProfile = request.notaryProfile;
    const notary = await User.findById(req.user.userId);

    // Generate stamp reference
    const stampRef = generateStampRef();

    // Build notarized PDF using pdfGenerator with notary stamp overlay
    const { generateNotarizedPDF } = require('../services/pdf/notaryStamp');
    const pdfBuffer = await generateNotarizedPDF({
      document: request.document,
      notaryName: notary.name,
      notaryRegistrationNumber: notaryProfile.notaryRegistrationNumber,
      registrationState: notaryProfile.registrationState,
      stampRef,
      stampedAt: new Date(),
    });

    // Upload notarized PDF
    const uploaded = await storageProvider.upload(pdfBuffer, {
      folder: 'notarized-pdfs',
      filename: `notarized_${request.document._id}_${stampRef}`,
      mimetype: 'application/pdf',
    });

    // Update request + document
    const updatedRequest = await NotarizationRequest.findByIdAndUpdate(
      request._id,
      {
        status: 'stamped',
        notarizedPdfUrl: uploaded.url,
        stampedAt: new Date(),
        notaryStampRef: stampRef,
      },
      { new: true }
    );

    // Record on the document itself
    await Document.findByIdAndUpdate(request.document._id, {
      notarizationStatus: 'notarized',
      notarizedPdfUrl: uploaded.url,
      notaryStampRef: stampRef,
    });

    // Update notary earnings + stats
    const notaryEarnings = Math.round(NOTARIZATION_FEE * (1 - (notaryProfile.platformCommissionPercent / 100)));
    await NotaryProfile.findByIdAndUpdate(notaryProfile._id, {
      $inc: { totalEarnings: notaryEarnings, totalNotarizations: 1 },
    });

    // Notify citizen that document is stamped and ready to download
    try {
      await Notification.createForUser({
        userId: updatedRequest.citizen,
        type: 'notarization_stamped',
        title: 'Document notarized!',
        body: `Your document has been officially notarized (Ref: ${stampRef}). Download your notarized PDF from the request page.`,
        data: { notarizationRequestId: updatedRequest._id, notarizedPdfUrl: uploaded.url, stampRef },
        actionUrl: `/notarization/${updatedRequest._id}`,
        priority: 'high',
        io: req.app.get('io'),
      });
    } catch (_) {}

    res.json({ message: 'Document stamped and notarized', request: updatedRequest, notarizedPdfUrl: uploaded.url });
  } catch (err) {
    logger.error('stampDocument error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to stamp document' });
  }
};

// ─── Reject Request (Notary) ──────────────────────────────────────────────────

exports.rejectRequest = async (req, res) => {
  try {
    const { reason } = req.body;
    const request = await NotarizationRequest.findOneAndUpdate(
      { _id: req.params.id, notary: req.user.userId, status: { $in: ['pending', 'accepted'] } },
      { status: 'rejected', rejectionReason: reason?.trim() },
      { new: true }
    );
    if (!request) return res.status(404).json({ error: 'NOT_FOUND' });

    // Refund if payment was captured
    if (request.payment?.status === 'paid' && request.payment?.razorpayPaymentId) {
      try {
        await razorpayService.refund(request.payment.razorpayPaymentId, request.payment.amount);
        await NotarizationRequest.findByIdAndUpdate(request._id, { 'payment.status': 'refunded' });
      } catch (refundErr) {
        logger.error('Refund failed for notarization rejection:', refundErr);
      }
    }

    // Notify citizen of rejection
    try {
      await Notification.createForUser({
        userId: request.citizen,
        type: 'notarization_rejected',
        title: 'Notarization request declined',
        body: reason
          ? `Your notarization request was declined. Reason: ${reason}.${request.payment?.status === 'refunded' ? ' A refund will be processed in 5-7 business days.' : ''}`
          : `Your notarization request was declined by the notary.${request.payment?.status === 'refunded' ? ' A refund will be processed in 5-7 business days.' : ''}`,
        data: { notarizationRequestId: request._id },
        actionUrl: `/notarization/${request._id}`,
        io: req.app.get('io'),
      });
    } catch (_) {}

    res.json({ message: 'Request rejected', request });
  } catch (err) {
    logger.error('rejectRequest error:', err);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
};

// ─── Request Courier Dispatch (Citizen) ───────────────────────────────────────

exports.requestCourier = async (req, res) => {
  try {
    const { courierAddress } = req.body;
    const request = await NotarizationRequest.findOneAndUpdate(
      { _id: req.params.id, citizen: req.user.userId, status: 'stamped', courierRequested: false },
      { courierRequested: true, courierAddress },
      { new: true }
    );
    if (!request) return res.status(404).json({ error: 'NOT_FOUND' });
    res.json({ message: 'Courier dispatch requested', request });
  } catch (err) {
    logger.error('requestCourier error:', err);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
};

// ─── Mark Dispatched (Notary) ─────────────────────────────────────────────────

exports.markDispatched = async (req, res) => {
  try {
    const { courierTrackingId } = req.body;
    const request = await NotarizationRequest.findOneAndUpdate(
      { _id: req.params.id, notary: req.user.userId, status: 'stamped', courierRequested: true },
      {
        status: 'dispatched',
        courierTrackingId: courierTrackingId?.trim(),
        dispatchedAt: new Date(),
      },
      { new: true }
    );
    if (!request) return res.status(404).json({ error: 'NOT_FOUND' });

    // Notify citizen of dispatch
    try {
      await Notification.createForUser({
        userId: request.citizen,
        type: 'notarization_dispatched',
        title: 'Document dispatched via courier',
        body: courierTrackingId
          ? `Your notarized document is on its way! Tracking ID: ${courierTrackingId}`
          : 'Your notarized document has been dispatched via courier.',
        data: { notarizationRequestId: request._id, courierTrackingId },
        actionUrl: `/notarization/${request._id}`,
        io: req.app.get('io'),
      });
    } catch (_) {}

    res.json({ message: 'Marked as dispatched', request });
  } catch (err) {
    logger.error('markDispatched error:', err);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
};

// ─── Rate Notary (Citizen) ────────────────────────────────────────────────────

exports.rateNotary = async (req, res) => {
  try {
    const { score, review } = req.body;
    if (!score || score < 1 || score > 5) {
      return res.status(400).json({ error: 'INVALID_SCORE', message: 'Score must be 1–5' });
    }

    const request = await NotarizationRequest.findOneAndUpdate(
      {
        _id: req.params.id,
        citizen: req.user.userId,
        status: { $in: ['stamped', 'dispatched'] },
        'rating.score': { $exists: false },
      },
      { rating: { score, review: review?.trim(), ratedAt: new Date() } },
      { new: true }
    );

    if (!request) return res.status(404).json({ error: 'NOT_FOUND', message: 'Request not found or already rated' });

    const notaryProfile = await NotaryProfile.findById(request.notaryProfile);
    if (notaryProfile) {
      await notaryProfile.addRating({ citizenId: req.user.userId, requestId: request._id, score, review });
    }

    res.json({ message: 'Rating submitted', request });
  } catch (err) {
    logger.error('rateNotary error:', err);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
};

// ─── Get document's notarization status (Citizen) ─────────────────────────────

exports.getDocumentNotarizationStatus = async (req, res) => {
  try {
    const request = await NotarizationRequest.findOne({
      document: req.params.documentId,
      citizen: req.user.userId,
      status: { $nin: ['rejected', 'cancelled'] },
    })
      .populate('notary', 'name avatar')
      .populate('notaryProfile', 'notaryRegistrationNumber registrationState averageRating')
      .sort({ createdAt: -1 });

    res.json({ notarizationRequest: request || null });
  } catch (err) {
    logger.error('getDocumentNotarizationStatus error:', err);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
};
