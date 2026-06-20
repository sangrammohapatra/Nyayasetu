const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const { verifyToken } = require('../middleware/auth.middleware');
const { analyzeSituation, getTriageQuota, publicAnalyzeSituation } = require('../controllers/triage.controller');

// Stricter rate limit for the public (unauthenticated) endpoint
const publicTriageLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'TOO_MANY_REQUESTS',
    message: 'Too many triage requests from this IP. Please wait 15 minutes.',
  },
});

// Public (guest) endpoint — no auth, email-gated
router.post('/public', publicTriageLimiter, publicAnalyzeSituation);

// Authenticated endpoints
router.get('/quota', verifyToken, getTriageQuota);
router.post('/', verifyToken, analyzeSituation);

module.exports = router;
