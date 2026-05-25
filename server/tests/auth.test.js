/**
 * server/tests/auth.test.js
 *
 * Integration tests for the auth routes.
 * Uses supertest against the Express app + an in-memory MongoDB (mongodb-memory-server).
 *
 * Run: npm test -- --testPathPattern=auth
 */

'use strict';

const request  = require('supertest');
const mongoose = require('mongoose');
const jwt      = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server');

// Set test env before requiring app
process.env.NODE_ENV    = 'test';
process.env.JWT_SECRET  = 'test-secret-nyayasetu-auth';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
process.env.JWT_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_EXPIRES_IN = '30d';
process.env.FIELD_ENCRYPTION_KEY = '0'.repeat(64); // 32 zero-bytes in hex for tests
process.env.AI_PROVIDER  = 'gemini';
process.env.SMS_PROVIDER = 'twilio';

let app;
let mongod;

// ─── Setup / Teardown ─────────────────────────────────────────────────────────

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongod.getUri();
  process.env.REDIS_URL = 'redis://localhost:6379'; // worker not used in tests

  // Require app after env vars are set
  app = require('../src/app');
  await mongoose.connect(process.env.MONGO_URI);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

afterEach(async () => {
  // Clear all collections between tests
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

// ─── Helper ───────────────────────────────────────────────────────────────────

const VALID_PHONE   = '+919999999999';  // dev shortcut phone
const DEV_OTP       = '123456';         // dev shortcut OTP
const INVALID_OTP   = '000000';
const INVALID_PHONE = '+91123';         // too short

// ─── POST /v1/auth/send-otp ───────────────────────────────────────────────────

describe('POST /v1/auth/send-otp', () => {
  test('should return 200 and otpSent=true for a valid Indian phone number', async () => {
    const res = await request(app)
      .post('/v1/auth/send-otp')
      .send({ phone: VALID_PHONE })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('otpSent', true);
    expect(res.body).not.toHaveProperty('otp'); // never return OTP in response
  });

  test('should return 400 for an invalid phone number', async () => {
    const res = await request(app)
      .post('/v1/auth/send-otp')
      .send({ phone: INVALID_PHONE });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  test('should return 400 when phone is missing', async () => {
    const res = await request(app)
      .post('/v1/auth/send-otp')
      .send({});

    expect(res.status).toBe(400);
  });

  test('should return 400 for a non-Indian phone number', async () => {
    const res = await request(app)
      .post('/v1/auth/send-otp')
      .send({ phone: '+12025551234' }); // US number

    expect(res.status).toBe(400);
  });
});

// ─── POST /v1/auth/verify-otp ────────────────────────────────────────────────

describe('POST /v1/auth/verify-otp', () => {
  beforeEach(async () => {
    // Trigger OTP send so the record exists
    await request(app)
      .post('/v1/auth/send-otp')
      .send({ phone: VALID_PHONE });
  });

  test('should return 200 with token and user for correct OTP (dev shortcut)', async () => {
    const res = await request(app)
      .post('/v1/auth/verify-otp')
      .send({ phone: VALID_PHONE, otp: DEV_OTP });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body).toHaveProperty('refreshToken');
    expect(res.body).toHaveProperty('user');
    expect(res.body.user.phone).toBe(VALID_PHONE);

    // Token must be a valid JWT
    const decoded = jwt.verify(res.body.token, process.env.JWT_SECRET);
    expect(decoded).toHaveProperty('userId');
    expect(decoded).toHaveProperty('persona');
  });

  test('should include isNewUser=true for first-time sign-up', async () => {
    const res = await request(app)
      .post('/v1/auth/verify-otp')
      .send({ phone: VALID_PHONE, otp: DEV_OTP });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('isNewUser', true);
  });

  test('should return 400 for wrong OTP', async () => {
    const res = await request(app)
      .post('/v1/auth/verify-otp')
      .send({ phone: VALID_PHONE, otp: INVALID_OTP });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
    expect(res.body).not.toHaveProperty('token');
  });

  test('should return 400 when OTP length is not 6', async () => {
    const res = await request(app)
      .post('/v1/auth/verify-otp')
      .send({ phone: VALID_PHONE, otp: '123' });

    expect(res.status).toBe(400);
  });

  test('should return 400 when phone is missing', async () => {
    const res = await request(app)
      .post('/v1/auth/verify-otp')
      .send({ otp: DEV_OTP });

    expect(res.status).toBe(400);
  });

  test('should return isNewUser=false on second sign-in with same phone', async () => {
    // First sign-in — creates user
    await request(app)
      .post('/v1/auth/verify-otp')
      .send({ phone: VALID_PHONE, otp: DEV_OTP });

    // Second sign-in
    const res = await request(app)
      .post('/v1/auth/verify-otp')
      .send({ phone: VALID_PHONE, otp: DEV_OTP });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('isNewUser', false);
  });
});

// ─── GET /v1/auth/me ─────────────────────────────────────────────────────────

describe('GET /v1/auth/me', () => {
  let validToken;

  beforeEach(async () => {
    // Trigger OTP + verify to get a real token
    await request(app).post('/v1/auth/send-otp').send({ phone: VALID_PHONE });
    const res = await request(app)
      .post('/v1/auth/verify-otp')
      .send({ phone: VALID_PHONE, otp: DEV_OTP });
    validToken = res.body.token;
  });

  test('should return 200 with user profile for a valid JWT', async () => {
    const res = await request(app)
      .get('/v1/auth/me')
      .set('Authorization', `Bearer ${validToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('user');
    expect(res.body.user.phone).toBe(VALID_PHONE);
    // Never return sensitive fields
    expect(res.body.user).not.toHaveProperty('refreshTokens');
    expect(res.body.user).not.toHaveProperty('passwordHash');
  });

  test('should return 401 with no token', async () => {
    const res = await request(app).get('/v1/auth/me');

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });

  test('should return 401 with an expired JWT', async () => {
    const expiredToken = jwt.sign(
      { userId: new mongoose.Types.ObjectId().toString(), persona: 'citizen', plan: 'free' },
      process.env.JWT_SECRET,
      { expiresIn: '-1s' } // already expired
    );

    const res = await request(app)
      .get('/v1/auth/me')
      .set('Authorization', `Bearer ${expiredToken}`);

    expect(res.status).toBe(401);
  });

  test('should return 401 with a tampered JWT', async () => {
    const tampered = validToken.slice(0, -3) + 'XXX';

    const res = await request(app)
      .get('/v1/auth/me')
      .set('Authorization', `Bearer ${tampered}`);

    expect(res.status).toBe(401);
  });

  test('should return 401 with a malformed Authorization header', async () => {
    const res = await request(app)
      .get('/v1/auth/me')
      .set('Authorization', validToken); // missing "Bearer " prefix

    expect(res.status).toBe(401);
  });
});

// ─── POST /v1/auth/logout ────────────────────────────────────────────────────

describe('POST /v1/auth/logout', () => {
  test('should return 200 and clear the refresh token', async () => {
    await request(app).post('/v1/auth/send-otp').send({ phone: VALID_PHONE });
    const loginRes = await request(app)
      .post('/v1/auth/verify-otp')
      .send({ phone: VALID_PHONE, otp: DEV_OTP });

    const { token, refreshToken } = loginRes.body;

    const res = await request(app)
      .post('/v1/auth/logout')
      .set('Authorization', `Bearer ${token}`)
      .send({ refreshToken });

    expect(res.status).toBe(200);
  });

  test('should return 401 when logging out without a token', async () => {
    const res = await request(app)
      .post('/v1/auth/logout')
      .send({ refreshToken: 'fake' });

    expect(res.status).toBe(401);
  });
});
