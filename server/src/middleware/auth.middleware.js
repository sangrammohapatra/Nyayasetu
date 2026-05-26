const jwt = require('jsonwebtoken');
const { createError } = require('./error.middleware');
const asyncHandler = require('../utils/asyncHandler');

// ─── verifyToken ───────────────────────────────────────────────────────────────

/**
 * verifyToken — extracts the JWT Bearer token from the Authorization header,
 * verifies it with JWT_SECRET, and attaches the decoded payload to req.user.
 *
 * req.user shape: { userId, persona, plan }   ← Rule #12: payload contains ONLY these three
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

  req.user = {
    userId:  decoded.userId,
    persona: decoded.persona?.toLowerCase(),
    plan:    decoded.plan,
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
 *   router.post('/apply', verifyToken, requirePersona('lawyer', 'paralegal'), handler);
 *
 * Returns 401 if req.user is missing (verifyToken wasn't called first).
 * Returns 403 if the user's persona is not in the allowed list.
 *
 * @param {...string} personas — one or more persona strings
 */
function requirePersona(...personas) {
  return (req, res, next) => {
    if (!req.user) {
      return next(createError(401, 'UNAUTHORIZED', 'Authentication required'));
    }

    if (!personas.includes(req.user.persona)) {
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

// ─── Convenience shorthands ───────────────────────────────────────────────────

/** requireAdmin — blocks anyone who isn't an admin */
const requireAdmin = requirePersona('admin');

/** requireLawyer — allows lawyers, paralegals, and admins */
const requireLawyer = requirePersona('lawyer', 'paralegal', 'admin');

/** requireCitizen — allows citizens and admins */
const requireCitizen = requirePersona('citizen', 'admin');

module.exports = {
  verifyToken,
  optionalAuth,
  requirePersona,
  requireAdmin,
  requireLawyer,
  requireCitizen,
};
