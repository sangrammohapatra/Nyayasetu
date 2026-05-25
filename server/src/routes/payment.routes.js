/**
 * server/src/routes/payment.routes.js
 *
 * CRITICAL: The webhook route captures the raw Buffer body so that
 * razorpayService.verifyWebhookSignature() can compute the HMAC correctly.
 * All other payment routes use the global express.json() middleware via the
 * normal app stack — nothing special is needed for them here.
 *
 * Register in app.js:
 *   app.use('/v1', require('./routes/payment.routes'));
 *
 * Resulting paths:
 *   POST /v1/payments/create-order
 *   POST /v1/payments/verify
 *   GET  /v1/payments/history
 *   POST /v1/payments/webhook         ← raw body, no auth middleware
 *   POST /v1/subscriptions/create
 *   POST /v1/subscriptions/verify
 *   GET  /v1/subscriptions/current
 *   POST /v1/subscriptions/cancel
 */

'use strict';

const express = require('express');
const router = express.Router();

const paymentController = require('../controllers/payment.controller');
const { verifyToken } = require('../middleware/auth.middleware');

/* ---------------------------------------------------------------------------
 * Razorpay webhook
 *
 * MUST be declared BEFORE any json() body-parser so that req.body is the
 * raw Buffer. We apply express.raw() only to this route.
 *
 * The route does NOT use verifyToken — Razorpay calls it server-to-server.
 * Authentication is achieved via HMAC signature verification inside the handler.
 * ------------------------------------------------------------------------ */
router.post(
  '/webhook',
  express.raw({ type: '*/*' }),  // capture raw body as Buffer
  paymentController.webhookHandler
);

/* ---------------------------------------------------------------------------
 * Pay-per-document
 * ------------------------------------------------------------------------ */

// Create a Razorpay order for a document
router.post(
  '/create-order',
  verifyToken,
  paymentController.createDocumentOrder
);

// Verify payment after Razorpay checkout success
router.post(
  '/verify',
  verifyToken,
  paymentController.verifyDocumentPayment
);

// Paginated payment history for the authenticated user
router.get(
  '/history',
  verifyToken,
  paymentController.getPaymentHistory
);

module.exports = router;
