'use strict';

/**
 * Notary routes — two routers exported for explicit mounting in app.js:
 *
 *   notaryProfileRouter  → app.use('/v1/notaries', notaryProfileRouter)
 *   notarizationRouter   → app.use('/v1/notarizations', notarizationRouter)
 *
 * Resulting paths:
 *   GET    /v1/notaries                           searchNotaries
 *   GET    /v1/notaries/:id                       getNotaryProfile
 *   POST   /v1/notaries/apply                     applyAsNotary
 *   PUT    /v1/notaries/profile                   updateNotaryProfile
 *   GET    /v1/notaries/me/profile                own profile (notary dashboard)
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

const notaryController = require('../controllers/notary.controller');
const { verifyToken, optionalAuth, requirePersona } = require('../middleware/auth.middleware');
const { PERSONAS } = require('../config/constants');

// ─── Notary Profile Router ────────────────────────────────────────────────────
// Mount at: app.use('/v1/notaries', notaryProfileRouter)

const notaryProfileRouter = express.Router();

notaryProfileRouter.get('/', optionalAuth, notaryController.searchNotaries);

notaryProfileRouter.post(
  '/apply',
  verifyToken,
  notaryController.uploadCertificate,
  notaryController.applyAsNotary
);

notaryProfileRouter.put(
  '/profile',
  verifyToken,
  requirePersona(PERSONAS.NOTARY),
  notaryController.updateNotaryProfile
);

// Must be before /:id
notaryProfileRouter.get(
  '/me/profile',
  verifyToken,
  requirePersona(PERSONAS.NOTARY),
  async (req, res) => {
    try {
      const NotaryProfile = require('../models/NotaryProfile.model');
      const profile = await NotaryProfile.findOne({ user: req.user.userId });
      if (!profile) return res.status(404).json({ error: 'NOT_FOUND', message: 'Profile not found' });
      res.json(profile);
    } catch (err) {
      res.status(500).json({ error: 'SERVER_ERROR' });
    }
  }
);

notaryProfileRouter.get('/:id', verifyToken, notaryController.getNotaryProfile);

// ─── Notarization Request Router ──────────────────────────────────────────────
// Mount at: app.use('/v1/notarizations', notarizationRouter)

const notarizationRouter = express.Router();

notarizationRouter.post(
  '/',
  verifyToken,
  requirePersona(PERSONAS.CITIZEN),
  notaryController.createNotarizationRequest
);

notarizationRouter.post(
  '/verify-payment',
  verifyToken,
  requirePersona(PERSONAS.CITIZEN),
  notaryController.verifyNotarizationPayment
);

notarizationRouter.get('/', verifyToken, notaryController.listNotarizationRequests);

// Static sub-path must be before /:id
notarizationRouter.get(
  '/document/:documentId',
  verifyToken,
  notaryController.getDocumentNotarizationStatus
);

notarizationRouter.get('/:id', verifyToken, notaryController.getNotarizationRequest);

notarizationRouter.patch(
  '/:id/accept',
  verifyToken,
  requirePersona(PERSONAS.NOTARY),
  notaryController.acceptRequest
);

notarizationRouter.patch(
  '/:id/schedule-kyc',
  verifyToken,
  requirePersona(PERSONAS.NOTARY),
  notaryController.scheduleKYC
);

notarizationRouter.patch(
  '/:id/complete-kyc',
  verifyToken,
  requirePersona(PERSONAS.NOTARY),
  notaryController.completeKYC
);

notarizationRouter.patch(
  '/:id/stamp',
  verifyToken,
  requirePersona(PERSONAS.NOTARY),
  notaryController.stampDocument
);

notarizationRouter.patch(
  '/:id/reject',
  verifyToken,
  requirePersona(PERSONAS.NOTARY),
  notaryController.rejectRequest
);

notarizationRouter.patch(
  '/:id/request-courier',
  verifyToken,
  requirePersona(PERSONAS.CITIZEN),
  notaryController.requestCourier
);

notarizationRouter.patch(
  '/:id/dispatch',
  verifyToken,
  requirePersona(PERSONAS.NOTARY),
  notaryController.markDispatched
);

notarizationRouter.post(
  '/:id/rate',
  verifyToken,
  requirePersona(PERSONAS.CITIZEN),
  notaryController.rateNotary
);

module.exports = { notaryProfileRouter, notarizationRouter };
