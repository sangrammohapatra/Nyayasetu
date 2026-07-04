const jwt = require('jsonwebtoken');
const { createError } = require('./error.middleware');
const asyncHandler = require('../utils/asyncHandler');
const { getRedisClient } = require('../config/redis');
const User = require('../models/User.model');

// ─── verifyToken ───────────────────────────────────────────────────────────────

/**
 * verifyToken — extracts the JWT Bearer token from the Authorization header,
 * verifies it with JWT_SECRET, and attaches the decoded payload to req.user.
 *
 * req.user shape: { userId, persona, plan, iat }   ← Rule #12: payload contains ONLY these four
 *
 * Throws 401 if token is missing, malformed, or expired.
 * The error middleware maps JsonWebTokenError / TokenExpiredError → 401 automatically.
 */
const verifyToken = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw createError(401, 'NO_TOKEN', 'Authentication token is required');
  }

  const token = authHeader.slice(7); // Remove "Bearer " prefix

  // jwt.verify throws JsonWebTokenError or TokenExpiredError on failure —
  // those bubble to errorHandler via asyncHandler → mapped to 401.
  const decoded = jwt.verify(token, process.env.JWT_SECRET);

  // Check Redis suspension blocklist — set by admin toggleUserActive on deactivation.
  // Fail open if Redis is unavailable so a Redis outage doesn't lock out all users.
  const redis = getRedisClient();
  if (redis) {
    const suspended = await redis.exists(`user:suspended:${decoded.userId}`);
    if (suspended) {
      throw createError(401, 'ACCOUNT_SUSPENDED', 'Your account has been suspended');
    }
  }

  req.user = {
    userId:  decoded.userId,
    persona: decoded.persona?.toLowerCase(),
    plan:    decoded.plan,
    iat:     decoded.iat,
  };

  next();
});

// ─── optionalAuth ──────────────────────────────────────────────────────────────

/**
 * optionalAuth — same as verifyToken but silently sets req.user = null when
 * no token is present or the token is invalid.
 *
 * Use on public routes that behave differently when authenticated:
 *   router.get('/templates', optionalAuth, listTemplates);
 */
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }

  const token = authHeader.slice(7);

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = {
      userId:  decoded.userId,
      persona: decoded.persona?.toLowerCase(),
      plan:    decoded.plan,
    };
  } catch {
    // Invalid / expired token on an optional-auth route is not an error
    req.user = null;
  }

  next();
};

// ─── requirePersona ───────────────────────────────────────────────────────────

/**
 * requirePersona — factory that returns middleware restricting access to
 * the specified persona(s). Must be used AFTER verifyToken.
 *
 * Usage:
 *   router.delete('/:id', verifyToken, requirePersona('admin'), handler);
 *   router.post('/apply', verifyToken, requirePersona('lawyer'), handler);
 *
 * Returns 401 if req.user is missing (verifyToken wasn't called first).
 * Returns 403 if the user's persona is not in the allowed list.
 *
 * @param {...string} personas — one or more persona strings
 */
function requirePersona(...personas) {
  const allowed = personas.map((p) => p.toLowerCase());
  return (req, res, next) => {
    if (!req.user) {
      return next(createError(401, 'UNAUTHORIZED', 'Authentication required'));
    }

    if (!allowed.includes(req.user.persona)) {
      return next(
        createError(
          403,
          'WRONG_PERSONA',
          `This endpoint requires one of: [${personas.join(', ')}]. ` +
          `Your role: ${req.user.persona}`
        )
      );
    }

    next();
  };
}

// ─── requireCompleteProfile ────────────────────────────────────────────────────

/**
 * requireCompleteProfile — blocks features that depend on name/state (document
 * jurisdiction, case tracking's required `state` field, etc.) until the user
 * has finished POST /v1/auth/register. A user can otherwise hold a valid
 * token after OTP verification alone, with name/state still null, if they
 * abandon the registration form. Must be used AFTER verifyToken.
 */
const requireCompleteProfile = asyncHandler(async (req, res, next) => {
  if (!req.user) {
    return next(createError(401, 'UNAUTHORIZED', 'Authentication required'));
  }

  const user = await User.findById(req.user.userId).select('name state').lean();
  if (!user) {
    return next(createError(404, 'USER_NOT_FOUND', 'User not found'));
  }

  if (!user.name || !user.state) {
    return next(createError(
      403,
      'PROFILE_INCOMPLETE',
      'Please complete your profile (name and state) before continuing.'
    ));
  }

  next();
});

// ─── Convenience shorthands ───────────────────────────────────────────────────

/** requireAdmin — blocks anyone who isn't an admin */
const requireAdmin = requirePersona('admin');

/** requireLawyer — allows lawyers and admins */
const requireLawyer = requirePersona('lawyer', 'admin');

/** requireCitizen — allows citizens and admins */
const requireCitizen = requirePersona('citizen', 'admin');

/** requireNotary — allows notaries and admins */
const requireNotary = requirePersona('notary', 'admin');

module.exports = {
  verifyToken,
  optionalAuth,
  requirePersona,
  requireAdmin,
  requireLawyer,
  requireCitizen,
  requireNotary,
  requireCompleteProfile,
};
