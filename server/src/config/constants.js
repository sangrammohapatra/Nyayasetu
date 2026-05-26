/**
 * server/src/config/constants.js
 *
 * Platform-wide constants shared across server, worker, and seed scripts.
 * All monetary values in PAISE (₹1 = 100 paise).
 */

"use strict";

// ─── Subscription plan pricing (paise) ────────────────────────────────────────

const PLANS = {
  citizen: {
    basic: { monthly: 9900, annual: 99900 }, // ₹99/mo, ₹999/yr
    pro: { monthly: 19900, annual: 199900 }, // ₹199/mo, ₹1999/yr
  },
  lawyer: {
    professional: { monthly: 49900, annual: 499900 }, // ₹499/mo
    firm: { monthly: 149900, annual: 1499900 }, // ₹1499/mo
  },
};

// ─── PERSONAS ─────────────────────────────────────────

const PERSONAS = {
  CITIZEN: "CITIZEN",
  LAWYER: "LAWYER",
  PARALEGAL: "PARALEGAL",
  ADMIN: "ADMIN",
};

// ─── Pay-per-document pricing (paise) ─────────────────────────────────────────

const PAY_PER_DOC = {
  simple: 4900, // ₹49
  moderate: 9900, // ₹99  (also labelled 'standard' in some contexts)
  standard: 9900,
  complex: 19900, // ₹199
  premium: 19900,
};

// ─── Free tier usage limits ────────────────────────────────────────────────────

const FREE_TIER_LIMITS = {
  citizen: {
    free: {
      docsLimit: 3,
      casesLimit: 1,
      aiChatsLimit: 5,
    },
    basic: {
      docsLimit: 15,
      casesLimit: 5,
      aiChatsLimit: 30,
    },
    pro: {
      docsLimit: 999999,
      casesLimit: 999999,
      aiChatsLimit: 999999,
    },
  },
  lawyer: {
    free: {
      docsLimit: 0,
      casesLimit: 0,
      aiChatsLimit: 5,
    },
    professional: {
      docsLimit: 999999,
      casesLimit: 999999,
      aiChatsLimit: 999999,
    },
    firm: {
      docsLimit: 999999,
      casesLimit: 999999,
      aiChatsLimit: 999999,
    },
  },
};

// ─── All 28 Indian states + 8 Union Territories ───────────────────────────────

const INDIAN_STATES = [
  // 28 States
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  // 8 Union Territories
  "Andaman and Nicobar Islands",
  "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Jammu & Kashmir",
  "Ladakh",
  "Lakshadweep",
  "Puducherry",
];

// ─── Supported languages ──────────────────────────────────────────────────────

const LANGUAGES = [
  { code: "en", name: "English", nativeName: "English", dir: "ltr" },
  { code: "hi", name: "Hindi", nativeName: "हिन्दी", dir: "ltr" },
  { code: "bn", name: "Bengali", nativeName: "বাংলা", dir: "ltr" },
  { code: "mr", name: "Marathi", nativeName: "मराठी", dir: "ltr" },
  { code: "ta", name: "Tamil", nativeName: "தமிழ்", dir: "ltr" },
  { code: "te", name: "Telugu", nativeName: "తెలుగు", dir: "ltr" },
  { code: "gu", name: "Gujarati", nativeName: "ગુજરાતી", dir: "ltr" },
  { code: "kn", name: "Kannada", nativeName: "ಕನ್ನಡ", dir: "ltr" },
  { code: "ml", name: "Malayalam", nativeName: "മലയാളം", dir: "ltr" },
  { code: "pa", name: "Punjabi", nativeName: "ਪੰਜਾਬੀ", dir: "ltr" },
  { code: "ur", name: "Urdu", nativeName: "اردو", dir: "rtl" },
];

// ─── Document categories ──────────────────────────────────────────────────────

const DOCUMENT_CATEGORIES = [
  { slug: "consumer", label: "Consumer", icon: "🛒" },
  { slug: "property", label: "Property", icon: "🏠" },
  { slug: "employment", label: "Employment", icon: "💼" },
  { slug: "family", label: "Family", icon: "👨‍👩‍👧" },
  { slug: "criminal", label: "Criminal", icon: "⚖️" },
  { slug: "rti", label: "RTI", icon: "📑" },
  { slug: "civil", label: "Civil", icon: "🏛️" },
  { slug: "financial", label: "Financial", icon: "💰" },
  { slug: "labour", label: "Labour", icon: "👷" },
  { slug: "startup", label: "Startup", icon: "🚀" },
];

// ─── User persona types ───────────────────────────────────────────────────────

const PERSONA_TYPES = ["citizen", "lawyer", "paralegal", "admin"];

// ─── Document template slugs (for reference) ──────────────────────────────────

const TEMPLATE_SLUGS = [
  "legal_notice_landlord",
  "consumer_complaint",
  "rti_application",
  "employment_termination",
  "bail_application",
  "divorce_petition",
  "property_sale_agreement",
  "power_of_attorney",
  "cheque_bounce_notice",
  "labour_dispute",
  "startup_founders_agreement",
  "domestic_violence_complaint", // always free
  "police_complaint", // always free
  "insurance_claim",
  "landlord_eviction",
];

// Free-for-all templates (social good)
const FREE_TEMPLATE_SLUGS = [
  "domestic_violence_complaint",
  "police_complaint",
  "rti_application",
];

// Alias used by DocumentTemplate model pre-save hook
const ALWAYS_FREE_TEMPLATES = FREE_TEMPLATE_SLUGS;

// Pay-per-doc price alias used by DocumentTemplate model
const PRICES = PAY_PER_DOC;

// ─── CNR number validation regex ──────────────────────────────────────────────
// Format: 2 uppercase letters + 2 digits + 6 digits + 4-digit year = 16 chars
// Example: DLHC010012342024

const CNR_REGEX = /^[A-Z]{2}\d{2}\d{6}\d{4}$/;

// ─── Indian phone number regex ────────────────────────────────────────────────
// E.164 format: +91XXXXXXXXXX (10 digits after +91)

const INDIAN_PHONE_REGEX = /^\+91[6-9]\d{9}$/;

// ─── Pagination defaults ──────────────────────────────────────────────────────

const PAGINATION = {
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
};

// ─── Rate limits ──────────────────────────────────────────────────────────────

const RATE_LIMITS = {
  general: { windowMs: 15 * 60 * 1000, max: 100 }, // 100 req / 15 min
  ai: { windowMs: 60 * 1000, max: 10 }, // 10 req / min (AI endpoints)
  otp: { windowMs: 15 * 60 * 1000, max: 3 }, // 3 OTP requests / 15 min
  webhook: { windowMs: 60 * 1000, max: 200 }, // webhooks higher limit
};

// ─── JWT defaults ─────────────────────────────────────────────────────────────

const JWT = {
  ACCESS_EXPIRY: process.env.JWT_EXPIRES_IN || "15m",
  REFRESH_EXPIRY: process.env.JWT_REFRESH_EXPIRES_IN || "30d",
  MAX_REFRESH_TOKENS: 5, // max devices simultaneously logged in
};

const MAX_REFRESH_TOKENS = JWT.MAX_REFRESH_TOKENS;
const SUPPORTED_LANGUAGES = LANGUAGES.map(({ code }) => code);

// ─── File upload limits ───────────────────────────────────────────────────────

const UPLOAD = {
  MAX_SIZE_BYTES: 5 * 1024 * 1024, // 5 MB
  ALLOWED_MIMETYPES: ["application/pdf", "image/jpeg", "image/png"],
  PDF_URL_EXPIRY_SECONDS: 15 * 60, // 15 minutes for signed URLs
};

// ─── Bull queue names ─────────────────────────────────────────────────────────

const QUEUE_NAMES = {
  HEARING_ALERTS: "hearingAlerts",
  DOCUMENTS: "documents",
  SUBSCRIPTIONS: "subscriptions",
  NOTIFICATIONS: "notifications",
};

// ─── Lawyer commission defaults ───────────────────────────────────────────────

const COMMISSION = {
  DEFAULT_PLATFORM_PERCENT: 10, // platform takes 10%, lawyer gets 90%
  PROFESSIONAL_PERCENT: 10,
  FIRM_PERCENT: 8, // 92% to lawyer on firm plan
};

// ─── Consultation modes ───────────────────────────────────────────────────────

const CONSULTATION_MODES = ["chat", "video", "phone", "in_person"];

// ─── Hearing alert defaults ───────────────────────────────────────────────────

const HEARING_ALERTS = {
  DEFAULT_DAYS_BEFORE: 2,
  ALERT_DAYS_OPTIONS: [1, 2, 3, 7],
};

module.exports = {
  PLANS,
  PERSONAS,
  PAY_PER_DOC,
  FREE_TIER_LIMITS,
  INDIAN_STATES,
  LANGUAGES,
  DOCUMENT_CATEGORIES,
  PERSONA_TYPES,
  TEMPLATE_SLUGS,
  FREE_TEMPLATE_SLUGS,
  ALWAYS_FREE_TEMPLATES,
  PRICES,
  CNR_REGEX,
  INDIAN_PHONE_REGEX,
  PAGINATION,
  RATE_LIMITS,
  JWT,
  MAX_REFRESH_TOKENS,
  SUPPORTED_LANGUAGES,
  UPLOAD,
  QUEUE_NAMES,
  COMMISSION,
  CONSULTATION_MODES,
  HEARING_ALERTS,
};
