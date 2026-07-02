/**
 * server/src/controllers/payment.controller.js
 *
 * Handles:
 *   - Pay-per-document (createDocumentOrder, verifyDocumentPayment)
 *   - Subscriptions    (createSubscriptionOrder, verifySubscription,
 *                       getCurrentSubscription, cancelSubscription)
 *   - Payment history  (getPaymentHistory)
 *   - Razorpay webhooks (webhookHandler)
 */

'use strict';

const mongoose = require('mongoose');
const crypto = require('crypto');

const User = require('../models/User.model');
const Document = require('../models/Document.model');
const DocumentTemplate = require('../models/DocumentTemplate.model');
const Payment = require('../models/Payment.model');
const Subscription = require('../models/Subscription.model');
const Consultation = require('../models/Consultation.model');
const LawyerProfile = require('../models/LawyerProfile.model');
const NotarizationRequest = require('../models/NotarizationRequest.model');
const Notification = require('../models/Notification.model');

const razorpayService = require('../services/payment/razorpayService');
const emailService = require('../services/notification/emailService');
const asyncHandler = require('../utils/asyncHandler');
const logger = require('../utils/logger');
const AuditLog = require('../models/AuditLog.model');

/* ---------------------------------------------------------------------------
 * Constants
 * ------------------------------------------------------------------------ */

const PLANS = {
  citizen: {
    basic: { monthly: 9900, annual: 99900 },
    pro: { monthly: 19900, annual: 199900 },
  },
  lawyer: {
    professional: { monthly: 49900, annual: 499900 },
    firm: { monthly: 149900, annual: 1499900 },
  },
};

const PAY_PER_DOC = {
  simple: 4900,
  standard: 9900,
  complex: 19900,
  premium: 19900,
};

// New usage limits unlocked by each plan
const PLAN_LIMITS = {
  free: { docsLimit: 3, casesLimit: 1, aiChatsLimit: 5 },
  basic: { docsLimit: 15, casesLimit: 5, aiChatsLimit: 30 },
  pro: { docsLimit: 999999, casesLimit: 999999, aiChatsLimit: 999999 },
  professional: { docsLimit: 999999, casesLimit: 999999, aiChatsLimit: 999999 },
  firm: { docsLimit: 999999, casesLimit: 999999, aiChatsLimit: 999999 },
};

const VALID_CITIZEN_PLANS = ['basic', 'pro'];
const VALID_LAWYER_PLANS = ['professional', 'firm'];
const VALID_BILLING_CYCLES = ['monthly', 'annual'];

/* ---------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------ */

function getSubscriptionValidUntil(billingCycle) {
  const d = new Date();
  if (billingCycle === 'annual') {
    d.setFullYear(d.getFullYear() + 1);
  } else {
    d.setMonth(d.getMonth() + 1);
  }
  return d;
}

function getPlanAmount(persona, plan, billingCycle) {
  const group = PLANS[persona];
  if (!group) return null;
  const planPrices = group[plan];
  if (!planPrices) return null;
  return planPrices[billingCycle] || null;
}

/* ---------------------------------------------------------------------------
 * createDocumentOrder
 * POST /v1/payments/create-order
 * Body: { documentId }
 * ------------------------------------------------------------------------ */
const createDocumentOrder = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const { documentId } = req.body;

  if (!documentId) {
    return res.status(400).json({ error: 'documentId is required' });
  }

  const doc = await Document.findOne({ _id: documentId, user: userId })
    .populate('template', 'slug name complexity pricePayPerDoc');

  if (!doc) {
    return res.status(404).json({ error: 'Document not found' });
  }
  if (doc.isPaid) {
    return res.status(400).json({ error: 'Already paid', pdfUrl: doc.pdfUrl });
  }
  if (!doc.template) {
    return res.status(400).json({ error: 'Document template not found — cannot determine price' });
  }

  // Price resolution: explicit template price → PAY_PER_DOC by complexity → fallback standard
  const amount =
    (doc.template.pricePayPerDoc > 0 ? doc.template.pricePayPerDoc : null) ||
    PAY_PER_DOC[doc.template.complexity] ||
    PAY_PER_DOC.standard;

  let order;
  try {
    order = await razorpayService.createOrder(
      amount,
      'INR',
      `doc_${documentId}_${Date.now()}`.substring(0, 40),
      {
        documentId: String(documentId),
        userId: String(userId),
        templateSlug: doc.template.slug,
      }
    );
  } catch (err) {
    logger.error('[payment.controller] createDocumentOrder: Razorpay failed', { error: err.message });
    return res.status(502).json({ error: 'Payment gateway error — please try again' });
  }

  const payment = await Payment.create({
    user: userId,
    type: 'pay_per_doc',
    razorpayOrderId: order.id,
    amount,
    currency: 'INR',
    status: 'created',
    relatedEntity: doc._id,
    relatedEntityType: 'Document',
    lawyerEarnings: 0,
    platformEarnings: amount,
  });

  await AuditLog.log(req, 'payment.order.created', 'Payment', payment._id, {
    documentId: String(documentId),
    amount,
    templateSlug: doc.template.slug,
    orderId: order.id,
  });

  return res.status(201).json({
    orderId: order.id,
    amount: order.amount,
    currency: order.currency,
    razorpayKeyId: process.env.RAZORPAY_KEY_ID,
    documentTitle: doc.title,
  });
});

/* ---------------------------------------------------------------------------
 * verifyDocumentPayment
 * POST /v1/payments/verify
 * Body: { orderId, paymentId, signature, documentId }
 * ------------------------------------------------------------------------ */
const verifyDocumentPayment = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const { orderId, paymentId, signature, documentId } = req.body;

  if (!orderId || !paymentId || !signature || !documentId) {
    return res.status(400).json({ error: 'orderId, paymentId, signature and documentId are required' });
  }

  const isValid = razorpayService.verifyPaymentSignature(orderId, paymentId, signature);
  if (!isValid) {
    logger.warn('[payment.controller] verifyDocumentPayment: invalid signature', {
      userId,
      orderId,
      paymentId,
    });
    await AuditLog.log(req, 'payment.signature.invalid', 'Payment', null, { orderId, documentId }, false);
    return res.status(400).json({ error: 'Payment signature verification failed' });
  }

  // Atomic transition created → paid. Only one concurrent request wins the update;
  // subsequent retries get null and fall into the idempotent path below.
  const payment = await Payment.findOneAndUpdate(
    { razorpayOrderId: orderId, status: { $ne: 'paid' } },
    { $set: { status: 'paid', razorpayPaymentId: paymentId, paidAt: new Date() } },
    { new: true }
  );

  if (!payment) {
    // Null can mean "already paid" or "record not found" — distinguish them.
    const existing = await Payment.findOne({ razorpayOrderId: orderId })
      .select('status')
      .lean();
    if (!existing) {
      return res.status(404).json({ error: 'Payment record not found' });
    }
    // Already paid — return success without re-running side effects.
    const doc = await Document.findById(documentId).select('pdfUrl').lean();
    return res.json({ success: true, pdfUrl: doc?.pdfUrl ?? null });
  }

  const doc = await Document.findOneAndUpdate(
    { _id: documentId, user: userId },
    {
      $set: {
        isPaid: true,
        accessType: 'pay_per_doc',
        payment: payment._id,
      },
    },
    { new: true }
  );

  if (!doc) {
    return res.status(404).json({ error: 'Document not found' });
  }

  await AuditLog.log(req, 'payment.document.verified', 'Payment', payment._id, {
    documentId: String(documentId),
    orderId,
  });

  // Trigger PDF generation if not yet generated
  let pdfUrl = doc.pdfUrl;
  if (!pdfUrl) {
    try {
      const documentQueue = require('../services/notification/documentQueueClient');
      await documentQueue.enqueueGenerateDocument({
        documentId: doc._id,
        userId,
        priority: 'high',
      });
    } catch (qErr) {
      logger.warn('[payment.controller] verifyDocumentPayment: failed to enqueue PDF generation', {
        documentId,
        error: qErr.message,
      });
    }
  }

  return res.json({ success: true, pdfUrl: pdfUrl || null });
});

/* ---------------------------------------------------------------------------
 * createSubscriptionOrder
 * POST /v1/subscriptions/create
 * Body: { plan, billingCycle, persona }
 * ------------------------------------------------------------------------ */
const createSubscriptionOrder = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const userPersona = req.user.persona;

  const { plan, billingCycle, persona } = req.body;

  // Persona from body, falling back to token persona
  const effectivePersona = persona || userPersona;

  if (!plan || !billingCycle) {
    return res.status(400).json({ error: 'plan and billingCycle are required' });
  }
  if (!VALID_BILLING_CYCLES.includes(billingCycle)) {
    return res.status(400).json({ error: `billingCycle must be one of: ${VALID_BILLING_CYCLES.join(', ')}` });
  }

  const validPlans = effectivePersona === 'lawyer' ? VALID_LAWYER_PLANS : VALID_CITIZEN_PLANS;
  if (!validPlans.includes(plan)) {
    return res.status(400).json({
      error: `For persona '${effectivePersona}' plan must be one of: ${validPlans.join(', ')}`,
    });
  }

  const amount = getPlanAmount(effectivePersona, plan, billingCycle);
  if (!amount) {
    return res.status(400).json({ error: 'Invalid plan / billingCycle combination' });
  }

  let order;
  try {
    order = await razorpayService.createOrder(
      amount,
      'INR',
      `sub_${userId}_${Date.now()}`.substring(0, 40),
      {
        userId: String(userId),
        plan,
        billingCycle,
        persona: effectivePersona,
      }
    );
  } catch (err) {
    logger.error('[payment.controller] createSubscriptionOrder: Razorpay failed', { error: err.message });
    return res.status(502).json({ error: 'Payment gateway error — please try again' });
  }

  await AuditLog.log(req, 'payment.subscription.order.created', 'Subscription', null, {
    plan,
    billingCycle,
    amount,
    orderId: order.id,
  });

  return res.status(201).json({
    orderId: order.id,
    amount: order.amount,
    currency: order.currency,
    plan,
    billingCycle,
    razorpayKeyId: process.env.RAZORPAY_KEY_ID,
  });
});

/* ---------------------------------------------------------------------------
 * verifySubscription
 * POST /v1/subscriptions/verify
 * Body: { orderId, paymentId, signature, plan, billingCycle, persona }
 * ------------------------------------------------------------------------ */
const verifySubscription = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const {
    orderId,
    paymentId,
    signature,
    plan,
    billingCycle,
    persona,
  } = req.body;

  if (!orderId || !paymentId || !signature || !plan || !billingCycle) {
    return res.status(400).json({
      error: 'orderId, paymentId, signature, plan and billingCycle are required',
    });
  }

  const isValid = razorpayService.verifyPaymentSignature(orderId, paymentId, signature);
  if (!isValid) {
    logger.warn('[payment.controller] verifySubscription: invalid signature', {
      userId,
      orderId,
    });
    await AuditLog.log(req, 'payment.subscription.signature.invalid', 'Subscription', null, { orderId, plan }, false);
    return res.status(400).json({ error: 'Payment signature verification failed' });
  }

  const effectivePersona = persona || req.user.persona;
  const amount = getPlanAmount(effectivePersona, plan, billingCycle);
  if (!amount) {
    return res.status(400).json({ error: 'Invalid plan / billingCycle combination' });
  }

  const validUntil = getSubscriptionValidUntil(billingCycle);
  const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.free;

  // Upsert Subscription record (idempotent on razorpayOrderId)
  const subscription = await Subscription.findOneAndUpdate(
    { razorpayOrderId: orderId },
    {
      $setOnInsert: {
        user: userId,
        plan,
        persona: effectivePersona,
        billingCycle,
        startDate: new Date(),
        endDate: validUntil,
        isActive: true,
        autoRenew: true,
        razorpayOrderId: orderId,
        razorpayPaymentId: paymentId,
        amountPaid: amount,
      },
    },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
  );

  // Update User subscription + usage limits
  await User.findByIdAndUpdate(userId, {
    $set: {
      'subscription.plan': plan,
      'subscription.validUntil': validUntil,
      'subscription.autoRenew': true,
      'freeUsage.docsLimit': limits.docsLimit,
      'freeUsage.casesLimit': limits.casesLimit,
      'freeUsage.aiChatsLimit': limits.aiChatsLimit,
    },
  });

  // Payment record
  const existingPayment = await Payment.findOne({ razorpayOrderId: orderId });
  if (!existingPayment) {
    await Payment.create({
      user: userId,
      type: 'subscription',
      razorpayOrderId: orderId,
      razorpayPaymentId: paymentId,
      amount,
      currency: 'INR',
      status: 'paid',
      paidAt: new Date(),
      relatedEntity: subscription._id,
      relatedEntityType: 'Subscription',
      platformEarnings: amount,
      lawyerEarnings: 0,
    });
  } else if (existingPayment.status !== 'paid') {
    existingPayment.status = 'paid';
    existingPayment.razorpayPaymentId = paymentId;
    existingPayment.paidAt = new Date();
    await existingPayment.save();
  }

  // Welcome / upgrade email (best-effort)
  const user = await User.findById(userId).select('name email').lean();
  if (user && user.email) {
    try {
      await emailService.sendEmail({
        to: user.email,
        subject: `Your NyayaSetu ${plan.charAt(0).toUpperCase() + plan.slice(1)} plan is active 🎉`,
        html: emailService.welcomeEmail(user.name || ''),
      });
    } catch (emailErr) {
      logger.warn('[payment.controller] verifySubscription: email failed', { error: emailErr.message });
    }
  }

  await AuditLog.log(req, 'payment.subscription.verified', 'Subscription', subscription._id, {
    plan,
    billingCycle,
    amount,
    orderId,
  });

  return res.json({ success: true, subscription });
});

/* ---------------------------------------------------------------------------
 * getCurrentSubscription
 * GET /v1/subscriptions/current
 * ------------------------------------------------------------------------ */
const getCurrentSubscription = asyncHandler(async (req, res) => {
  const userId = req.user.userId;

  const [user, subscription] = await Promise.all([
    User.findById(userId)
      .select('subscription freeUsage preferredLanguage')
      .lean(),
    Subscription.findOne({ user: userId, isActive: true })
      .sort({ createdAt: -1 })
      .lean(),
  ]);

  if (!user) return res.status(404).json({ error: 'User not found' });

  return res.json({
    plan: (user.subscription && user.subscription.plan) || 'free',
    validUntil: user.subscription && user.subscription.validUntil,
    autoRenew: user.subscription && user.subscription.autoRenew,
    freeUsage: user.freeUsage,
    subscription: subscription || null,
  });
});

/* ---------------------------------------------------------------------------
 * cancelUserSubscription
 * POST /v1/subscriptions/cancel
 * ------------------------------------------------------------------------ */
const cancelUserSubscription = asyncHandler(async (req, res) => {
  const userId = req.user.userId;

  const subscription = await Subscription.findOne({ user: userId, isActive: true })
    .sort({ createdAt: -1 });

  if (!subscription) {
    return res.status(404).json({ error: 'No active subscription found' });
  }

  // Cancel at Razorpay if a subscription ID exists (recurring billing)
  if (subscription.razorpaySubscriptionId) {
    try {
      await razorpayService.cancelSubscription(subscription.razorpaySubscriptionId, true);
    } catch (err) {
      logger.error('[payment.controller] cancelUserSubscription: Razorpay cancel failed', {
        subscriptionId: subscription.razorpaySubscriptionId,
        error: err.message,
      });
      // Do not abort — mark as cancelled in DB regardless
    }
  }

  subscription.isActive = false;
  subscription.cancelledAt = new Date();
  subscription.autoRenew = false;
  await subscription.save();

  // Downgrade user to free but let them keep access until validUntil
  await User.findByIdAndUpdate(userId, {
    $set: {
      'subscription.autoRenew': false,
    },
  });

  await AuditLog.log(req, 'payment.subscription.cancelled', 'Subscription', subscription._id, {
    plan: subscription.plan,
    billingCycle: subscription.billingCycle,
    validUntil: subscription.endDate,
  });

  return res.json({
    ok: true,
    message: 'Subscription cancelled. You will retain access until the end of your current billing period.',
    validUntil: subscription.endDate,
  });
});

/* ---------------------------------------------------------------------------
 * getPaymentHistory
 * GET /v1/payments/history
 * Query: page, limit, type
 * ------------------------------------------------------------------------ */
const getPaymentHistory = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const { page = 1, limit = 20, type } = req.query;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (pageNum - 1) * limitNum;

  const filter = { user: userId };
  const VALID_TYPES = ['pay_per_doc', 'subscription', 'consultation'];
  if (type && VALID_TYPES.includes(type)) filter.type = type;

  try {
    const [items, total] = await Promise.all([
      Payment.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Payment.countDocuments(filter),
    ]);

    return res.json({
      items,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.max(1, Math.ceil(total / limitNum)),
    });
  } catch (err) {
    logger.error('[payment.controller] getPaymentHistory failed', { userId, error: err.message });
    return res.status(500).json({ error: 'Failed to load payment history' });
  }
});

/* ---------------------------------------------------------------------------
 * webhookHandler
 * POST /v1/payments/webhook
 *
 * IMPORTANT: This route must use express.raw() (NOT express.json()) so the raw
 * body is preserved for HMAC verification. See payment.routes.js.
 *
 * Handles:
 *   payment.captured          → mark Payment paid + unlock Document
 *   subscription.activated    → activate Subscription record
 *   subscription.charged      → extend subscription validity
 *   subscription.cancelled    → downgrade user to free plan
 *   payment.failed            → mark Payment failed
 * ------------------------------------------------------------------------ */
const webhookHandler = asyncHandler(async (req, res) => {
  const signature = req.header('X-Razorpay-Signature') || '';

  const isValid = razorpayService.verifyWebhookSignature(req.body, signature);
  if (!isValid) {
    logger.warn('[payment.controller] webhookHandler: invalid signature', {
      ip: req.ip,
    });
    return res.status(400).json({ error: 'Invalid webhook signature' });
  }

  // req.body is a Buffer at this point — parse it
  let event;
  try {
    event = JSON.parse(req.body.toString('utf8'));
  } catch (parseErr) {
    logger.error('[payment.controller] webhookHandler: failed to parse body', {
      error: parseErr.message,
    });
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  const eventType = event.event;
  const payload = event.payload;

  logger.info('[payment.controller] Webhook received', { eventType });

  try {
    switch (eventType) {
      case 'payment.captured':
        await handlePaymentCaptured(payload, req.app.get('io'));
        await AuditLog.log(req, 'payment.webhook.captured', 'Payment', null, {
          orderId: payload?.payment?.entity?.order_id,
          paymentId: payload?.payment?.entity?.id,
        });
        break;
      case 'subscription.activated':
        await handleSubscriptionActivated(payload);
        await AuditLog.log(req, 'payment.webhook.subscription.activated', 'Subscription', null, {
          razorpaySubscriptionId: payload?.subscription?.entity?.id,
        });
        break;
      case 'subscription.charged':
        await handleSubscriptionCharged(payload);
        await AuditLog.log(req, 'payment.webhook.subscription.charged', 'Subscription', null, {
          razorpaySubscriptionId: payload?.subscription?.entity?.id,
          paymentId: payload?.payment?.entity?.id,
        });
        break;
      case 'subscription.cancelled':
        await handleSubscriptionCancelled(payload);
        await AuditLog.log(req, 'payment.webhook.subscription.cancelled', 'Subscription', null, {
          razorpaySubscriptionId: payload?.subscription?.entity?.id,
        });
        break;
      case 'payment.failed':
        await handlePaymentFailed(payload);
        await AuditLog.log(req, 'payment.webhook.failed', 'Payment', null, {
          orderId: payload?.payment?.entity?.order_id,
        }, false);
        break;
      default:
        logger.debug('[payment.controller] Unhandled webhook event', { eventType });
    }
  } catch (handlerErr) {
    // Log but return 200 to prevent Razorpay retries for application-level errors
    logger.error('[payment.controller] webhookHandler: handler threw', {
      eventType,
      error: handlerErr.message,
      stack: handlerErr.stack,
    });
  }

  return res.status(200).json({ ok: true });
});

/* ---------------------------------------------------------------------------
 * Webhook event handlers (all idempotent)
 * ------------------------------------------------------------------------ */

async function handlePaymentCaptured(payload, io = null) {
  const paymentEntity = payload && payload.payment && payload.payment.entity;
  if (!paymentEntity) return;

  const razorpayOrderId = paymentEntity.order_id;
  const razorpayPaymentId = paymentEntity.id;

  let foundPaymentRecord = false;
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const payment = await Payment.findOne({ razorpayOrderId }).session(session);
      if (!payment) {
        logger.debug('[payment.controller] handlePaymentCaptured: no Payment record for orderId — may be a notarization order', { razorpayOrderId });
        return;
      }
      foundPaymentRecord = true;
      if (payment.status === 'paid') return; // idempotent

      payment.status = 'paid';
      payment.razorpayPaymentId = razorpayPaymentId;
      payment.paidAt = new Date();

      if (payment.type === 'consultation' && payment.relatedEntity) {
        const consultation = await Consultation.findById(payment.relatedEntity)
          .select('lawyer')
          .session(session)
          .lean();
        if (consultation) {
          const profile = await LawyerProfile.findById(consultation.lawyer)
            .select('referralFeePercent')
            .session(session)
            .lean();
          const referralFeePercent = profile?.referralFeePercent ?? 10;
          payment.platformEarnings = Math.round(payment.amount * referralFeePercent / 100);
          payment.lawyerEarnings   = payment.amount - payment.platformEarnings;
        }
      }

      await payment.save({ session });

      if (payment.type === 'pay_per_doc' && payment.relatedEntity) {
        await Document.findByIdAndUpdate(payment.relatedEntity, {
          $set: {
            isPaid: true,
            accessType: 'pay_per_doc',
            payment: payment._id,
          },
        }, { session });
        logger.info('[payment.controller] handlePaymentCaptured: document unlocked', {
          documentId: payment.relatedEntity,
        });
      }

      if (payment.type === 'subscription') {
        const sub = await Subscription.findOne({ razorpayOrderId }).session(session);
        if (sub && !sub.isActive) {
          sub.isActive = true;
          sub.razorpayPaymentId = razorpayPaymentId;
          await sub.save({ session });
        }
      }
    });
  } finally {
    await session.endSession();
  }

  // If no Payment record matched, check whether this is a notarization payment.
  // Notarization orders are tracked on NotarizationRequest.payment, not a Payment doc.
  if (!foundPaymentRecord) {
    const notarizationReq = await NotarizationRequest.findOneAndUpdate(
      { 'payment.razorpayOrderId': razorpayOrderId, 'payment.status': { $ne: 'paid' } },
      {
        'payment.status': 'paid',
        'payment.razorpayPaymentId': razorpayPaymentId,
        'payment.paidAt': new Date(),
      },
      { new: true }
    );

    if (notarizationReq) {
      logger.info('[payment.controller] webhook: notarization payment captured', {
        notarizationRequestId: notarizationReq._id,
        razorpayPaymentId,
      });
      try {
        await Notification.createForUser({
          userId: notarizationReq.notary,
          type: 'notarization_paid',
          title: 'Notarization payment received',
          body: 'The citizen has paid ₹199. You can now schedule the Video KYC session.',
          data: { notarizationRequestId: notarizationReq._id },
          actionUrl: `/notary/requests/${notarizationReq._id}`,
          priority: 'high',
          io,
        });
      } catch (err) {
        logger.error('[payment.controller] webhook: notary notification failed', { error: err.message });
      }
      try {
        await Notification.createForUser({
          userId: notarizationReq.citizen,
          type: 'payment_success',
          title: 'Payment successful',
          body: 'Your payment of ₹199 for notarization has been received. The notary will schedule a Video KYC shortly.',
          data: { notarizationRequestId: notarizationReq._id },
          actionUrl: `/notarization/${notarizationReq._id}`,
          io,
        });
      } catch (err) {
        logger.error('[payment.controller] webhook: citizen notification failed', { error: err.message });
      }
    } else {
      logger.warn('[payment.controller] handlePaymentCaptured: orderId matched no Payment or NotarizationRequest', { razorpayOrderId });
    }
  }
}

async function handleSubscriptionActivated(payload) {
  const subEntity = payload && payload.subscription && payload.subscription.entity;
  if (!subEntity) return;

  const rzpSubId = subEntity.id;
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const subscription = await Subscription.findOne({ razorpaySubscriptionId: rzpSubId }).session(session);
      if (!subscription) {
        logger.warn('[payment.controller] handleSubscriptionActivated: no Subscription record', { rzpSubId });
        return;
      }

      if (!subscription.isActive) {
        subscription.isActive = true;
        await subscription.save({ session });

        const limits = PLAN_LIMITS[subscription.plan] || PLAN_LIMITS.free;
        await User.findByIdAndUpdate(subscription.user, {
          $set: {
            'subscription.plan': subscription.plan,
            'subscription.validUntil': subscription.endDate,
            'subscription.autoRenew': true,
            'freeUsage.docsLimit': limits.docsLimit,
            'freeUsage.casesLimit': limits.casesLimit,
            'freeUsage.aiChatsLimit': limits.aiChatsLimit,
          },
        }, { session });
      }
    });
  } finally {
    await session.endSession();
  }
}

async function handleSubscriptionCharged(payload) {
  const subEntity = payload && payload.subscription && payload.subscription.entity;
  const paymentEntity = payload && payload.payment && payload.payment.entity;
  if (!subEntity || !paymentEntity) return;

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const subscription = await Subscription.findOne({ razorpaySubscriptionId: subEntity.id }).session(session);
      if (!subscription) return;

      // Extend validity by one billing cycle
      const newValidUntil = getSubscriptionValidUntil(subscription.billingCycle);
      subscription.endDate = newValidUntil;
      subscription.isActive = true;
      await subscription.save({ session });

      await User.findByIdAndUpdate(subscription.user, {
        $set: { 'subscription.validUntil': newValidUntil },
      }, { session });

      // Record the renewal payment
      const existingPayment = await Payment.findOne({ razorpayPaymentId: paymentEntity.id }).session(session);
      if (!existingPayment) {
        await Payment.create([{
          user: subscription.user,
          type: 'subscription',
          razorpayPaymentId: paymentEntity.id,
          razorpayOrderId: paymentEntity.order_id || '',
          amount: paymentEntity.amount,
          currency: 'INR',
          status: 'paid',
          paidAt: new Date(),
          relatedEntity: subscription._id,
          relatedEntityType: 'Subscription',
          platformEarnings: paymentEntity.amount,
          lawyerEarnings: 0,
        }], { session });
      }

      logger.info('[payment.controller] handleSubscriptionCharged: renewed', {
        subscriptionId: subscription._id,
        newValidUntil,
      });
    });
  } finally {
    await session.endSession();
  }
}

async function handleSubscriptionCancelled(payload) {
  const subEntity = payload && payload.subscription && payload.subscription.entity;
  if (!subEntity) return;

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const subscription = await Subscription.findOne({ razorpaySubscriptionId: subEntity.id }).session(session);
      if (!subscription) return;

      subscription.isActive = false;
      subscription.cancelledAt = new Date();
      subscription.autoRenew = false;
      await subscription.save({ session });

      // Revert user to free plan
      await User.findByIdAndUpdate(subscription.user, {
        $set: {
          'subscription.plan': 'free',
          'subscription.autoRenew': false,
          'freeUsage.docsLimit': PLAN_LIMITS.free.docsLimit,
          'freeUsage.casesLimit': PLAN_LIMITS.free.casesLimit,
          'freeUsage.aiChatsLimit': PLAN_LIMITS.free.aiChatsLimit,
        },
      }, { session });

      logger.info('[payment.controller] handleSubscriptionCancelled', { subscriptionId: subscription._id });
    });
  } finally {
    await session.endSession();
  }
}

async function handlePaymentFailed(payload) {
  const paymentEntity = payload && payload.payment && payload.payment.entity;
  if (!paymentEntity) return;

  const razorpayOrderId = paymentEntity.order_id;
  await Payment.findOneAndUpdate(
    { razorpayOrderId },
    { $set: { status: 'failed', failedAt: new Date() } }
  );

  logger.info('[payment.controller] handlePaymentFailed', { razorpayOrderId });
}

module.exports = {
  createDocumentOrder,
  verifyDocumentPayment,
  createSubscriptionOrder,
  verifySubscription,
  getCurrentSubscription,
  cancelUserSubscription,
  getPaymentHistory,
  webhookHandler,
};
