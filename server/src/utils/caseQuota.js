/**
 * Case-tracking quota helpers.
 *
 * Lawyers created before they could track their own matters still have
 * casesLimit 0 (plan config) or 1 (citizen schema default). Raise that
 * stored limit up to the plan's configured allowance the first time they
 * track a case, without lowering an admin override that is already higher.
 */

const User = require('../models/User.model');
const { FREE_TIER_LIMITS } = require('../config/constants');

function isPaidSubscriber(user) {
  const plan = user?.subscription?.plan;
  const validUntil = user?.subscription?.validUntil;
  return Boolean(
    plan &&
    plan !== 'free' &&
    validUntil &&
    new Date() < new Date(validUntil)
  );
}

function configuredCasesLimit(user) {
  const persona = user?.persona || 'citizen';
  const plan = isPaidSubscriber(user) ? user.subscription.plan : 'free';
  return (
    FREE_TIER_LIMITS[persona]?.[plan]?.casesLimit ??
    FREE_TIER_LIMITS.citizen.free.casesLimit
  );
}

/**
 * @param {object} user  Mongoose doc or lean user with _id, persona, subscription, freeUsage
 * @returns {Promise<number>} limit to enforce
 */
async function ensureCasesLimit(user) {
  const configured = configuredCasesLimit(user);
  const stored = user?.freeUsage?.casesLimit ?? 0;

  if (user?.persona === 'lawyer' && stored < configured) {
    await User.updateOne(
      { _id: user._id },
      { $max: { 'freeUsage.casesLimit': configured } }
    );
    if (user.freeUsage) user.freeUsage.casesLimit = configured;
    return configured;
  }

  return stored > 0 ? stored : configured;
}

module.exports = { ensureCasesLimit, configuredCasesLimit, isPaidSubscriber };
