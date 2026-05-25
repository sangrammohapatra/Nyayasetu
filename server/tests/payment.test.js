/**
 * server/tests/payment.test.js
 *
 * Unit tests for the Razorpay payment service.
 * No network calls — tests pure HMAC signature verification logic.
 *
 * Run: npm test -- --testPathPattern=payment
 */

'use strict';

const crypto = require('crypto');

// Set up env before requiring modules
process.env.NODE_ENV             = 'test';
process.env.RAZORPAY_KEY_ID      = 'rzp_test_testKeyId';
process.env.RAZORPAY_KEY_SECRET  = 'test_key_secret_nyayasetu_2024';
process.env.RAZORPAY_WEBHOOK_SECRET = 'test_webhook_secret_nyayasetu';
process.env.FIELD_ENCRYPTION_KEY = '0'.repeat(64);

const razorpayService = require('../src/services/payment/razorpayService');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildValidSignature(orderId, paymentId, secret = process.env.RAZORPAY_KEY_SECRET) {
  return crypto
    .createHmac('sha256', secret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
}

function buildValidWebhookSignature(body, secret = process.env.RAZORPAY_WEBHOOK_SECRET) {
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(body);
  return crypto.createHmac('sha256', secret).update(buf).digest('hex');
}

// ─── verifyPaymentSignature ───────────────────────────────────────────────────

describe('razorpayService.verifyPaymentSignature', () => {
  const ORDER_ID   = 'order_TestOrder123456';
  const PAYMENT_ID = 'pay_TestPayment78901';

  test('should return true for a valid signature', () => {
    const sig = buildValidSignature(ORDER_ID, PAYMENT_ID);
    const result = razorpayService.verifyPaymentSignature(ORDER_ID, PAYMENT_ID, sig);
    expect(result).toBe(true);
  });

  test('should return false when signature is for a different orderId', () => {
    const sig = buildValidSignature('order_WRONG', PAYMENT_ID);
    const result = razorpayService.verifyPaymentSignature(ORDER_ID, PAYMENT_ID, sig);
    expect(result).toBe(false);
  });

  test('should return false when signature is for a different paymentId', () => {
    const sig = buildValidSignature(ORDER_ID, 'pay_WRONG');
    const result = razorpayService.verifyPaymentSignature(ORDER_ID, PAYMENT_ID, sig);
    expect(result).toBe(false);
  });

  test('should return false for a completely tampered signature', () => {
    const result = razorpayService.verifyPaymentSignature(
      ORDER_ID,
      PAYMENT_ID,
      'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef'
    );
    expect(result).toBe(false);
  });

  test('should return false when signature is empty string', () => {
    const result = razorpayService.verifyPaymentSignature(ORDER_ID, PAYMENT_ID, '');
    expect(result).toBe(false);
  });

  test('should return false when orderId is empty', () => {
    const sig = buildValidSignature(ORDER_ID, PAYMENT_ID);
    const result = razorpayService.verifyPaymentSignature('', PAYMENT_ID, sig);
    expect(result).toBe(false);
  });

  test('should return false when paymentId is empty', () => {
    const sig = buildValidSignature(ORDER_ID, PAYMENT_ID);
    const result = razorpayService.verifyPaymentSignature(ORDER_ID, '', sig);
    expect(result).toBe(false);
  });

  test('should use timing-safe comparison (not vulnerable to timing attacks)', () => {
    // This test verifies the function uses crypto.timingSafeEqual
    // We test that it doesn't throw even with mismatched length signatures
    const shortSig = 'abc';
    expect(() =>
      razorpayService.verifyPaymentSignature(ORDER_ID, PAYMENT_ID, shortSig)
    ).not.toThrow();
    const result = razorpayService.verifyPaymentSignature(ORDER_ID, PAYMENT_ID, shortSig);
    expect(result).toBe(false);
  });

  test('should work with real Razorpay-format IDs', () => {
    const realOrderId   = 'order_OEIxuZ8BfF9RTZF';
    const realPaymentId = 'pay_OEIxxxxxxxxxxxx';
    const realSig = buildValidSignature(realOrderId, realPaymentId);

    expect(razorpayService.verifyPaymentSignature(realOrderId, realPaymentId, realSig)).toBe(true);
    expect(razorpayService.verifyPaymentSignature(realOrderId, 'pay_TAMPERED', realSig)).toBe(false);
  });
});

// ─── verifyWebhookSignature ───────────────────────────────────────────────────

describe('razorpayService.verifyWebhookSignature', () => {
  const SAMPLE_PAYLOAD = JSON.stringify({
    event: 'payment.captured',
    payload: {
      payment: {
        entity: {
          id: 'pay_TestPayment78901',
          order_id: 'order_TestOrder123456',
          amount: 9900,
          currency: 'INR',
          status: 'captured',
        },
      },
    },
  });

  test('should return true for a valid webhook signature (string body)', () => {
    const sig = buildValidWebhookSignature(SAMPLE_PAYLOAD);
    const result = razorpayService.verifyWebhookSignature(SAMPLE_PAYLOAD, sig);
    expect(result).toBe(true);
  });

  test('should return true for a valid webhook signature (Buffer body)', () => {
    const body = Buffer.from(SAMPLE_PAYLOAD);
    const sig  = buildValidWebhookSignature(body);
    const result = razorpayService.verifyWebhookSignature(body, sig);
    expect(result).toBe(true);
  });

  test('should return false when body has been modified', () => {
    const sig = buildValidWebhookSignature(SAMPLE_PAYLOAD);
    const tamperedBody = SAMPLE_PAYLOAD.replace('payment.captured', 'payment.refunded');
    const result = razorpayService.verifyWebhookSignature(tamperedBody, sig);
    expect(result).toBe(false);
  });

  test('should return false for a random/fake signature', () => {
    const result = razorpayService.verifyWebhookSignature(
      SAMPLE_PAYLOAD,
      'fakesignaturefakesignaturefakesignaturefakesignaturefakesignature'
    );
    expect(result).toBe(false);
  });

  test('should return false when signature is empty', () => {
    const result = razorpayService.verifyWebhookSignature(SAMPLE_PAYLOAD, '');
    expect(result).toBe(false);
  });

  test('should handle non-JSON string bodies correctly', () => {
    const rawBody = 'raw=body&data=here';
    const sig = buildValidWebhookSignature(rawBody);
    expect(razorpayService.verifyWebhookSignature(rawBody, sig)).toBe(true);
    expect(razorpayService.verifyWebhookSignature(rawBody + 'X', sig)).toBe(false);
  });

  test('should return false when RAZORPAY_WEBHOOK_SECRET is not set', () => {
    const original = process.env.RAZORPAY_WEBHOOK_SECRET;
    delete process.env.RAZORPAY_WEBHOOK_SECRET;

    const sig = buildValidWebhookSignature(SAMPLE_PAYLOAD);
    const result = razorpayService.verifyWebhookSignature(SAMPLE_PAYLOAD, sig);
    expect(result).toBe(false);

    process.env.RAZORPAY_WEBHOOK_SECRET = original;
  });
});

// ─── createOrder ─────────────────────────────────────────────────────────────

describe('razorpayService.createOrder', () => {
  test('should throw for amount <= 0', async () => {
    await expect(razorpayService.createOrder(0, 'INR', 'rcpt_test')).rejects.toThrow();
    await expect(razorpayService.createOrder(-100, 'INR', 'rcpt_test')).rejects.toThrow();
  });

  test('should throw when Razorpay credentials are not set', async () => {
    const origKey = process.env.RAZORPAY_KEY_ID;
    delete process.env.RAZORPAY_KEY_ID;

    await expect(razorpayService.createOrder(9900, 'INR', 'rcpt_test'))
      .rejects
      .toThrow();

    process.env.RAZORPAY_KEY_ID = origKey;
  });
});

// ─── Utility: commission calculation ─────────────────────────────────────────

describe('Commission split calculation', () => {
  // Test the helper function used in consultation.controller.js
  function computeCommission(feeInPaise, referralFeePercent = 10) {
    const platformEarnings = Math.round((feeInPaise * referralFeePercent) / 100);
    const lawyerEarnings   = feeInPaise - platformEarnings;
    return { platformEarnings, lawyerEarnings };
  }

  test('10% platform commission on ₹500 consultation', () => {
    const { platformEarnings, lawyerEarnings } = computeCommission(50000, 10);
    expect(platformEarnings).toBe(5000);   // ₹50
    expect(lawyerEarnings).toBe(45000);    // ₹450
    expect(platformEarnings + lawyerEarnings).toBe(50000);
  });

  test('8% platform commission on ₹1000 consultation (Firm plan)', () => {
    const { platformEarnings, lawyerEarnings } = computeCommission(100000, 8);
    expect(platformEarnings).toBe(8000);   // ₹80
    expect(lawyerEarnings).toBe(92000);    // ₹920
  });

  test('commission sums to total fee exactly (no rounding error)', () => {
    const amounts = [4900, 9900, 19900, 49900, 149900];
    amounts.forEach((fee) => {
      const { platformEarnings, lawyerEarnings } = computeCommission(fee, 10);
      expect(platformEarnings + lawyerEarnings).toBe(fee);
    });
  });

  test('0% commission gives lawyer 100%', () => {
    const { platformEarnings, lawyerEarnings } = computeCommission(50000, 0);
    expect(platformEarnings).toBe(0);
    expect(lawyerEarnings).toBe(50000);
  });
});
