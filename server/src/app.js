const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

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
const notaryRoutes = require('./routes/notary.routes');
// Error handler middleware
const { errorHandler } = require('./middleware/error.middleware');

const app = express();

// ─── Security Headers ─────────────────────────────────────────────────────────
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
        scriptSrc: ["'self'"],
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
  '/v1/webhooks/signdesk',
  express.raw({ type: '*/*' }),
  (req, res, next) => { req.rawBody = req.body; next(); },
  (() => {
    const { signWebhook } = require('./controllers/document.controller');
    return signWebhook;
  })()
);

// ─── Body Parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── Request Logging ──────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// ─── Global Rate Limiter ──────────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'TOO_MANY_REQUESTS',
    message: 'Too many requests from this IP. Please try again after 15 minutes.',
    retryAfter: 900,
  },
  skip: (req) => req.path === '/health',
});

// Strict limiter for AI endpoints (10 req/min)
const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'AI_RATE_LIMIT',
    message: 'AI request limit reached. Please wait a moment before sending another message.',
    retryAfter: 60,
  },
});

// OTP limiter (3 requests per 15 minutes per IP)
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'OTP_RATE_LIMIT',
    message: 'Too many OTP requests. Please wait 15 minutes before requesting another OTP.',
    retryAfter: 900,
  },
});

app.use('/v1', globalLimiter);
app.use('/v1/chat/sessions/:id/message', aiLimiter);
app.use('/v1/auth/send-otp', otpLimiter);

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'nyayasetu-api',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0',
  });
});

app.get('/v1/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'nyayasetu-api',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

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
app.use('/v1', notaryRoutes);

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
