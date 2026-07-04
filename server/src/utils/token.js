/**
 * server/src/utils/token.js
 *
 * Shared JWT access/refresh token signing, used by auth.controller.js (login,
 * register, refresh) and anywhere else a user's token payload must be reissued
 * (e.g. after a subscription upgrade changes req.user.plan).
 */

const jwt = require('jsonwebtoken');
const { JWT } = require('../config/constants');

function signTokenPair(user) {
  const payload = {
    userId: user._id.toString(),
    persona: user.persona?.toLowerCase(),
    plan: user.subscription?.plan || 'free',
  };
  const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: JWT.ACCESS_EXPIRY,
  });
  const refreshToken = jwt.sign(
    { userId: user._id.toString(), type: 'refresh' },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: JWT.REFRESH_EXPIRY }
  );
  return { accessToken, refreshToken };
}

module.exports = { signTokenPair };
