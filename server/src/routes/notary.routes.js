'use strict';

/**
 * Notary routes
 *
 *   GET    /v1/notaries                           searchNotaries
 *   GET    /v1/notaries/:id                       getNotaryProfile
 *   POST   /v1/notaries/apply                     applyAsNotary
 *   PUT    /v1/notaries/profile                   updateNotaryProfile
 *
 *   POST   /v1/notarizations                      createNotarizationRequest (citizen)
 *   POST   /v1/notarizations/verify-payment       verifyNotarizationPayment (citizen)
 *   GET    /v1/notarizations                      listNotarizationRequests
 *   GET    /v1/notarizations/:id                  getNotarizationRequest
 *   GET    /v1/notarizations/document/:documentId getDocumentNotarizationStatus
 *   PATCH  /v1/notarizations/:id/accept           acceptRequest (notary)
 *   PATCH  /v1/notarizations/:id/schedule-kyc     scheduleKYC (notary)
 *   PATCH  /v1/notarizations/:id/complete-kyc     completeKYC (notary)
 *   PATCH  /v1/notarizations/:id/stamp            stampDocument (notary)
 *   PATCH  /v1/notarizations/:id/reject           rejectRequest (notary)
 *   PATCH  /v1/notarizations/:id/request-courier  requestCourier (citizen)
 *   PATCH  /v1/notarizations/:id/dispatch         markDispatched (notary)
 *   POST   /v1/notarizations/:id/rate             rateNotary (citizen)
 */

const express = require('express');
const router = express.Router();

const notaryController = require('../controllers/notary.controller');
const { verifyToken, requirePersona } = require('../middleware/auth.middleware');
const { PERSONAS } = require('../config/constants');

// ─── Notary Profile ────────────────────────────────────────────────────────────

router.get('/notaries', verifyToken, notaryController.searchNotaries);

router.post(
  '/notaries/apply',
  verifyToken,
  notaryController.uploadCertificate,
  notaryController.applyAsNotary
);

router.put(
  '/notaries/profile',
  verifyToken,
  requirePersona(PERSONAS.NOTARY),
  notaryController.updateNotaryProfile
);

// GET /v1/notaries/me/profile — own profile for the notary dashboard
router.get(
  '/notaries/me/profile',
  verifyToken,
  requirePersona(PERSONAS.NOTARY),
  async (req, res) => {
    try {
      const NotaryProfile = require('../models/NotaryProfile.model');
      const profile = await NotaryProfile.findOne({ user: req.user._id });
      if (!profile) return res.status(404).json({ error: 'NOT_FOUND', message: 'Profile not found' });
      res.json(profile);
    } catch (err) {
      res.status(500).json({ error: 'SERVER_ERROR' });
    }
  }
);

// Must be after /notaries/apply, /notaries/profile, /notaries/me/profile
router.get('/notaries/:id', verifyToken, notaryController.getNotaryProfile);

// ─── Notarization Requests ────────────────────────────────────────────────────

router.post(
  '/notarizations',
  verifyToken,
  requirePersona(PERSONAS.CITIZEN),
  notaryController.createNotarizationRequest
);

router.post(
  '/notarizations/verify-payment',
  verifyToken,
  requirePersona(PERSONAS.CITIZEN),
  notaryController.verifyNotarizationPayment
);

router.get('/notarizations', verifyToken, notaryController.listNotarizationRequests);

// Static sub-path must be before /:id
router.get(
  '/notarizations/document/:documentId',
  verifyToken,
  notaryController.getDocumentNotarizationStatus
);

router.get('/notarizations/:id', verifyToken, notaryController.getNotarizationRequest);

router.patch(
  '/notarizations/:id/accept',
  verifyToken,
  requirePersona(PERSONAS.NOTARY),
  notaryController.acceptRequest
);

router.patch(
  '/notarizations/:id/schedule-kyc',
  verifyToken,
  requirePersona(PERSONAS.NOTARY),
  notaryController.scheduleKYC
);

router.patch(
  '/notarizations/:id/complete-kyc',
  verifyToken,
  requirePersona(PERSONAS.NOTARY),
  notaryController.completeKYC
);

router.patch(
  '/notarizations/:id/stamp',
  verifyToken,
  requirePersona(PERSONAS.NOTARY),
  notaryController.stampDocument
);

router.patch(
  '/notarizations/:id/reject',
  verifyToken,
  requirePersona(PERSONAS.NOTARY),
  notaryController.rejectRequest
);

router.patch(
  '/notarizations/:id/request-courier',
  verifyToken,
  requirePersona(PERSONAS.CITIZEN),
  notaryController.requestCourier
);

router.patch(
  '/notarizations/:id/dispatch',
  verifyToken,
  requirePersona(PERSONAS.NOTARY),
  notaryController.markDispatched
);

router.post(
  '/notarizations/:id/rate',
  verifyToken,
  requirePersona(PERSONAS.CITIZEN),
  notaryController.rateNotary
);

module.exports = router;
