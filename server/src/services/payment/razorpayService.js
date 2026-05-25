/**
 * server/src/services/payment/razorpayService.js
 *
 * Thin, testable wrapper around the Razorpay Node SDK.
 * All callers go through this module — no direct Razorpay SDK calls
 * anywhere else in the codebase.
 *
 * Lazy-initialised: the SDK client is created the first time any function
 * is called so that missing env vars at import time don't crash the server.
 */

'use strict';

const Razorpay = require('razorpay');
const crypto = require('crypto');
const logger = require('../../utils/logger');

let _client = null;

function getClient() {
  if (_client) return _client;

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    throw new Error(
      'RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be set in environment variables'
    );
  }

  _client = new Razorpay({ key_id: keyId, key_secret: keySecret });
  logger.info('[razorpayService] Razorpay client initialised');
  return _client;
}

/* ---------------------------------------------------------------------------
 * createOrder
 * Creates a one-time Razorpay order (pay-per-doc or subscription upfront).
 *
 * @param {number} amount     Amount in paise (INR). e.g. 9900 = ₹99
 * @param {string} currency   Default 'INR'
 * @param {string} receipt    Internal receipt reference (≤40 chars)
 * @param {object} notes      Key-value metadata stored on the order
 * @returns {Promise<object>} Razorpay order object
 * ------------------------------------------------------------------------ */
async function createOrder(amount, currency = 'INR', receipt, notes = {}) {
  if (!amount || amount <= 0) throw new Error('amount must be a positive integer in paise');

  const payload = {
    amount: Math.round(amount),
    currency,
    receipt: String(receipt || `rcpt_${Date.now()}`).substring(0, 40),
    notes,
    payment_capture: 1, // auto-capture on payment success
  };

  try {
    const order = await getClient().orders.create(payload);
    logger.info('[razorpayService] Order created', {
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
    });
    return order;
  } catch (err) {
    logger.error('[razorpayService] createOrder failed', {
      payload,
      status: err.statusCode,
      error: err.error || err.message,
    });
    throw err;
  }
}

/* ---------------------------------------------------------------------------
 * verifyPaymentSignature
 * Validates the Razorpay payment callback signature.
 * Signature = HMAC-SHA256(orderId + '|' + paymentId, keySecret)
 *
 * @returns {boolean}
 * ------------------------------------------------------------------------ */
function verifyPaymentSignature(orderId, paymentId, signature) {
  try {
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) throw new Error('RAZORPAY_KEY_SECRET not set');

    const body = `${orderId}|${paymentId}`;
    const expected = crypto
      .createHmac('sha256', keySecret)
      .update(body)
      .digest('hex');

    const isValid = crypto.timingSafeEqual(
      Buffer.from(expected, 'hex'),
      Buffer.from(signature, 'hex')
    );

    logger.debug('[razorpayService] verifyPaymentSignature', { orderId, paymentId, isValid });
    return isValid;
  } catch (err) {
    logger.error('[razorpayService] verifyPaymentSignature threw', { error: err.message });
    return false;
  }
}

/* ---------------------------------------------------------------------------
 * verifyWebhookSignature
 * Validates the X-Razorpay-Signature on webhook POST bodies.
 * Signature = HMAC-SHA256(rawBody, webhookSecret)
 *
 * @param {string|Buffer} rawBody   The raw request body (must NOT be JSON.parsed)
 * @param {string}        signature The X-Razorpay-Signature header value
 * @returns {boolean}
 * ------------------------------------------------------------------------ */
function verifyWebhookSignature(rawBody, signature) {
  try {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) throw new Error('RAZORPAY_WEBHOOK_SECRET not set');

    const body = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody);
    const expected = crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('hex');

    const isValid = crypto.timingSafeEqual(
      Buffer.from(expected, 'hex'),
      Buffer.from(signature, 'hex')
    );

    logger.debug('[razorpayService] verifyWebhookSignature', { isValid });
    return isValid;
  } catch (err) {
    logger.error('[razorpayService] verifyWebhookSignature threw', { error: err.message });
    return false;
  }
}

/* ---------------------------------------------------------------------------
 * createSubscription
 * Creates a Razorpay Subscription for recurring billing.
 *
 * @param {string} planId       Razorpay plan_id (pre-created in dashboard)
 * @param {number} totalCount   Number of billing cycles (e.g. 12 for annual)
 * @param {string} customerId   Razorpay customer_id (optional, improves UX)
 * @returns {Promise<object>}   Razorpay subscription object
 * ------------------------------------------------------------------------ */
async function createSubscription(planId, totalCount, customerId = null) {
  if (!planId) throw new Error('planId is required');

  const payload = {
    plan_id: planId,
    total_count: totalCount || 12,
    quantity: 1,
    ...(customerId ? { customer_id: customerId } : {}),
  };

  try {
    const subscription = await getClient().subscriptions.create(payload);
    logger.info('[razorpayService] Subscription created', {
      subscriptionId: subscription.id,
      planId,
      totalCount,
    });
    return subscription;
  } catch (err) {
    logger.error('[razorpayService] createSubscription failed', {
      planId,
      status: err.statusCode,
      error: err.error || err.message,
    });
    throw err;
  }
}

/* ---------------------------------------------------------------------------
 * cancelSubscription
 *
 * @param {string}  subscriptionId
 * @param {boolean} cancelAtCycleEnd  If true, cancels after the current billing period
 * @returns {Promise<object>}
 * ------------------------------------------------------------------------ */
async function cancelSubscription(subscriptionId, cancelAtCycleEnd = true) {
  if (!subscriptionId) throw new Error('subscriptionId is required');

  try {
    const result = await getClient().subscriptions.cancel(subscriptionId, cancelAtCycleEnd);
    logger.info('[razorpayService] Subscription cancelled', {
      subscriptionId,
      cancelAtCycleEnd,
    });
    return result;
  } catch (err) {
    logger.error('[razorpayService] cancelSubscription failed', {
      subscriptionId,
      status: err.statusCode,
      error: err.error || err.message,
    });
    throw err;
  }
}

/* ---------------------------------------------------------------------------
 * fetchPayment
 *
 * @param {string} paymentId  Razorpay payment_id (pay_*)
 * @returns {Promise<object>} Razorpay payment object
 * ------------------------------------------------------------------------ */
async function fetchPayment(paymentId) {
  if (!paymentId) throw new Error('paymentId is required');

  try {
    const payment = await getClient().payments.fetch(paymentId);
    return payment;
  } catch (err) {
    logger.error('[razorpayService] fetchPayment failed', {
      paymentId,
      status: err.statusCode,
      error: err.error || err.message,
    });
    throw err;
  }
}

/* ---------------------------------------------------------------------------
 * initiateRefund
 *
 * @param {string} paymentId  Razorpay payment_id
 * @param {number} amount     Refund amount in paise (omit for full refund)
 * @param {object} notes
 * @returns {Promise<object>} Razorpay refund object
 * ------------------------------------------------------------------------ */
async function initiateRefund(paymentId, amount, notes = {}) {
  if (!paymentId) throw new Error('paymentId is required');

  const payload = { speed: 'normal', notes };
  if (amount) payload.amount = Math.round(amount);

  try {
    const refund = await getClient().payments.refund(paymentId, payload);
    logger.info('[razorpayService] Refund initiated', {
      paymentId,
      refundId: refund.id,
      amount: refund.amount,
    });
    return refund;
  } catch (err) {
    logger.error('[razorpayService] initiateRefund failed', {
      paymentId,
      status: err.statusCode,
      error: err.error || err.message,
    });
    throw err;
  }
}

module.exports = {
  createOrder,
  verifyPaymentSignature,
  verifyWebhookSignature,
  createSubscription,
  cancelSubscription,
  fetchPayment,
  initiateRefund,
};
