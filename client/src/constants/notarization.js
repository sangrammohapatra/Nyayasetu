/**
 * client/src/constants/notarization.js
 *
 * Shared display constants. The actual amount charged always comes from the
 * server (Razorpay order `amount`) — these are for UI copy only, so a fee
 * change doesn't require hunting down every hardcoded "₹199" string.
 */

// Mirrors server/src/config/constants.js NOTARIZATION_FEE (19900 paise = ₹199).
// Kept in rupees here since every client usage is a display string.
export const NOTARIZATION_FEE_RUPEES = 199;
export const NOTARIZATION_FEE_DISPLAY = `₹${NOTARIZATION_FEE_RUPEES}`;

// Mirrors NotaryProfile.model.js platformCommissionPercent default (15%).
// A given notary's actual rate can differ — this is only for the generic
// "what should I expect" copy shown before a notary profile exists.
export const DEFAULT_NOTARY_COMMISSION_PERCENT = 15;
export const DEFAULT_NOTARY_SHARE_RUPEES =
  Math.round(NOTARIZATION_FEE_RUPEES * (1 - DEFAULT_NOTARY_COMMISSION_PERCENT / 100) * 100) / 100;
