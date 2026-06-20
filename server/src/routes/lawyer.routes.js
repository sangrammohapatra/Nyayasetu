/**
 * server/src/routes/lawyer.routes.js
 *
 * Mounts lawyer profile endpoints AND consultation endpoints under the same router
 * so they can be registered together in app.js:
 *
 *   app.use('/v1', require('./routes/lawyer.routes'));
 *
 * Resulting paths:
 *   GET    /v1/lawyers                    searchLawyers
 *   GET    /v1/lawyers/me/clients         getMyClients         (lawyer only)
 *   GET    /v1/lawyers/:id                getLawyerProfile
 *   POST   /v1/lawyers/apply              applyAsLawyer        (lawyer only)
 *   PUT    /v1/lawyers/profile            updateLawyerProfile  (lawyer only)
 *
 *   POST   /v1/consultations              createConsultation   (citizen only)
 *   GET    /v1/consultations              listConsultations    (citizen + lawyer)
 *   PATCH  /v1/consultations/:id/accept   acceptConsultation   (lawyer only)
 *   PATCH  /v1/consultations/:id/reject   rejectConsultation   (lawyer only)
 *   PATCH  /v1/consultations/:id/complete completeConsultation (lawyer only)
 *   POST   /v1/consultations/:id/rate     rateConsultation     (citizen only)
 */

'use strict';

const express = require('express');
const router = express.Router();

const lawyerController = require('../controllers/lawyer.controller');
const consultationController = require('../controllers/consultation.controller');
const { verifyToken, requirePersona } = require('../middleware/auth.middleware');
const { PERSONAS } = require('../config/constants');

/* ===========================================================================
 *  LAWYER ROUTES
 * ========================================================================= */

/**
 * GET /v1/lawyers
 * Public search — only verified lawyers returned.
 * Auth required (optionalAuth could be used, but context spec says 'auth').
 */
router.get('/lawyers', verifyToken, lawyerController.searchLawyers);

/**
 * GET /v1/lawyers/me/clients
 * Must be declared BEFORE /lawyers/:id to prevent 'me' being treated as an ObjectId.
 */
router.get(
  '/lawyers/me/clients',
  verifyToken,
  requirePersona('lawyer'),
  lawyerController.getMyClients
);

/**
 * GET /v1/lawyers/:id/slots?date=YYYY-MM-DD
 * Returns available 30-min slots for the given date.
 * Must be declared before /lawyers/:id so the router doesn't treat 'slots' sub-path incorrectly.
 */
router.get('/lawyers/:id/slots', verifyToken, lawyerController.getAvailableSlots);

/**
 * GET /v1/lawyers/:id
 * Full profile with last 5 ratings.
 */
router.get('/lawyers/:id', verifyToken, lawyerController.getLawyerProfile);

/**
 * POST /v1/lawyers/apply
 * Accepts multipart/form-data (certificate file optional).
 * uploadCertificate is multer middleware; must run before applyAsLawyer.
 */
router.post(
  '/lawyers/apply',
  verifyToken,
  requirePersona(PERSONAS.LAWYER, PERSONAS.CITIZEN), // citizens may apply to become lawyers
  lawyerController.uploadCertificate,
  lawyerController.applyAsLawyer
);

/**
 * PUT /v1/lawyers/profile
 * Update own profile fields (no file upload on this route).
 */
router.put(
  '/lawyers/profile',
  verifyToken,
  requirePersona(PERSONAS.LAWYER),
  lawyerController.updateLawyerProfile
);

/**
 * PUT /v1/lawyers/availability
 * Replace the authenticated lawyer's weekly availability schedule.
 */
router.put(
  '/lawyers/availability',
  verifyToken,
  requirePersona(PERSONAS.LAWYER),
  lawyerController.updateAvailability
);

/* ===========================================================================
 *  CONSULTATION ROUTES
 * ========================================================================= */

/**
 * POST /v1/consultations
 * Citizen initiates a booking + Razorpay order creation.
 */
router.post(
  '/consultations',
  verifyToken,
  requirePersona(PERSONAS.CITIZEN),
  consultationController.createConsultation
);

/**
 * GET /v1/consultations
 * Works for both citizens (own bookings) and lawyers (incoming bookings).
 */
router.get(
  '/consultations',
  verifyToken,
  consultationController.listConsultations
);

/**
 * PATCH /v1/consultations/:id/accept
 */
router.patch(
  '/consultations/:id/accept',
  verifyToken,
  requirePersona(PERSONAS.LAWYER),
  consultationController.acceptConsultation
);

/**
 * PATCH /v1/consultations/:id/reject
 * Initiates refund if payment was already captured.
 */
router.patch(
  '/consultations/:id/reject',
  verifyToken,
  requirePersona(PERSONAS.LAWYER),
  consultationController.rejectConsultation
);

/**
 * PATCH /v1/consultations/:id/complete
 * Triggers commission split calculation and updates lawyer earnings.
 */
router.patch(
  '/consultations/:id/complete',
  verifyToken,
  requirePersona(PERSONAS.LAWYER),
  consultationController.completeConsultation
);

/**
 * POST /v1/consultations/:id/rate
 * Citizen rates after completion. Recalculates lawyer averageRating.
 */
router.post(
  '/consultations/:id/rate',
  verifyToken,
  requirePersona(PERSONAS.CITIZEN),
  consultationController.rateConsultation
);

module.exports = router;
