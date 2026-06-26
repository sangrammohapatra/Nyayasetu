const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { randomUUID } = require('crypto');
const { RATE_LIMITS } = require('./config/constants');

const mongoose = require('mongoose');
const { getRedisClient } = require('./config/redis');

// Route imports
const authRoutes = require('./routes/auth.routes');
const documentRoutes = require('./routes/document.routes');
const chatRoutes = require('./routes/chat.routes');
const caseRoutes = require('./routes/case.routes');
const lawyerRoutes = require('./routes/lawyer.routes');
const paymentRoutes = require('./routes/payment.routes');
const subscriptionRoutes = require('./routes/subscription.routes');
const whatsappRoutes = require('./routes/whatsapp.routes');
const jurisdictionRoutes = require('./routes/jurisdiction.routes');
const notificationRoutes = require('./routes/notification.routes');
const adminRoutes = require('./routes/admin.routes');
const templateRoutes = require('./routes/template.routes');
const nyayabotRoutes = require('./routes/nyayabotRoutes');
const profileRoutes = require('./routes/profile.routes');
const consultationChatRoutes = require('./routes/consultationChat.routes');
const triageRoutes = require('./routes/triage.routes');
const { notaryProfileRouter, notarizationRouter } = require('./routes/notary.routes');
const rtiRoutes = require('./routes/rti.routes');
const webhookRoutes = require('./routes/webhook.routes');
// Error handler middleware
const { errorHandler } = require('./middleware/error.middleware');

const app = express();

// Trust Render/nginx reverse proxy so express-rate-limit reads the real client IP
// from X-Forwarded-For instead of the proxy's internal IP.
app.set('trust proxy', 1);

// ─── Request ID ───────────────────────────────────────────────────────────────
// Attach a unique ID to every request so log lines can be correlated.
app.use((req, _res, next) => {
  req.id = req.headers['x-request-id'] || randomUUID();
  next();
});

// ─── Security Headers ─────────────────────────────────────────────────────────
// This is a JSON API server — it serves no HTML, stylesheets, or fonts.
// styleSrc / fontSrc CSP rules belong on the static-file server (nginx/CDN)
// that serves index.html. MUI nonce support must be configured there.
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        scriptSrc: ["'self'"],
        imgSrc:    ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'", process.env.CLIENT_URL || 'http://localhost:5173'],
      },
    },
  })
);

// ─── CORS ─────────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: function (origin, callback) {
      const allowedOrigins = [
        process.env.CLIENT_URL || 'http://localhost:5173',
        'http://localhost:5173',
        'http://localhost:3000',
      ];
      // Allow requests with no origin (mobile apps, Postman, curl)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  })
);

// ─── Raw-body routes — must come BEFORE express.json() ───────────────────────
// Razorpay and SignDesk both require the raw request bytes for HMAC verification.

app.use(
  '/v1/payments/webhook',
  express.raw({ type: 'application/json' }),
  (req, res, next) => { req.rawBody = req.body; next(); }
);

app.use(
  '/v1/webhooks',
  express.raw({ type: '*/*' }),
  (req, res, next) => { req.rawBody = req.body; next(); },
  webhookRoutes
);

// ─── Body Parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── Request Logging ──────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  morgan.token('req-id', (req) => req.id);
  app.use(morgan(':req-id :method :url :status :res[content-length] - :response-time ms'));
}

// ─── Global Rate Limiter ──────────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: RATE_LIMITS.general.windowMs,
  max:      RATE_LIMITS.general.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'TOO_MANY_REQUESTS',
    message: 'Too many requests from this IP. Please try again after 15 minutes.',
    retryAfter: RATE_LIMITS.general.retryAfterSeconds,
  },
  skip: (req) => req.path === '/health',
});

// Strict limiter for AI endpoints (10 req/min)
const aiLimiter = rateLimit({
  windowMs: RATE_LIMITS.ai.windowMs,
  max:      RATE_LIMITS.ai.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'AI_RATE_LIMIT',
    message: 'AI request limit reached. Please wait a moment before sending another message.',
    retryAfter: RATE_LIMITS.ai.retryAfterSeconds,
  },
});

// OTP limiter (5 requests per 15 minutes per IP)
const otpLimiter = rateLimit({
  windowMs: RATE_LIMITS.otp.windowMs,
  max:      RATE_LIMITS.otp.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'OTP_RATE_LIMIT',
    message: 'Too many OTP requests. Please wait 15 minutes before requesting another OTP.',
    retryAfter: RATE_LIMITS.otp.retryAfterSeconds,
  },
});

app.use('/v1', globalLimiter);
app.use('/v1/auth/send-otp', otpLimiter);

// AI endpoints — all invoke the LLM/PDF pipeline; keep under the same budget
app.use('/v1/chat/sessions/:id/message', aiLimiter);
app.use('/v1/chat/sessions',             aiLimiter);
app.use('/v1/documents/generate',        aiLimiter);
app.use('/v1/triage',                    aiLimiter);
app.use('/v1/nyayabot/message',          aiLimiter);

// ─── Health Check ─────────────────────────────────────────────────────────────
async function healthCheck(req, res) {
  const mongoOk = mongoose.connection.readyState === 1;
  const rc      = getRedisClient();
  const redisOk = rc ? await rc.ping().then(() => true).catch(() => false) : false;
  const status  = mongoOk && redisOk ? 'ok' : 'degraded';
  res.status(status === 'ok' ? 200 : 503).json({
    status,
    service:     'nyayasetu-api',
    timestamp:   new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version:     process.env.npm_package_version || '1.0.0',
    mongo:       mongoOk,
    redis:       redisOk,
  });
}

app.get('/health',    healthCheck);
app.get('/v1/health', healthCheck);

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/v1/auth', authRoutes);
app.use('/v1/templates', templateRoutes);
app.use('/v1/chat', chatRoutes);
app.use('/v1/documents', documentRoutes);
app.use('/v1/cases', caseRoutes);
app.use('/v1', lawyerRoutes);
app.use('/v1/payments', paymentRoutes);
app.use('/v1/subscriptions', subscriptionRoutes);
app.use('/v1/whatsapp', whatsappRoutes);
app.use('/v1/jurisdiction', jurisdictionRoutes);
app.use('/v1/notifications', notificationRoutes);
app.use('/v1/admin', adminRoutes);
app.use('/v1/profile', profileRoutes);
app.use('/v1/nyayabot', nyayabotRoutes);
app.use('/v1/consultations', consultationChatRoutes);
app.use('/v1/triage', triageRoutes);
app.use('/v1/notaries', notaryProfileRouter);
app.use('/v1/notarizations', notarizationRouter);
app.use('/v1/rti', rtiRoutes);

// ─── 404 Handler ──────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    error: 'NOT_FOUND',
    message: `Route ${req.method} ${req.originalUrl} not found`,
  });
});

// ─── Global Error Handler (must be last) ──────────────────────────────────────
app.use(errorHandler);

module.exports = app;
