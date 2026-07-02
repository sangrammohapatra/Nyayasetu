/**
 * server/src/routes/admin.routes.js
 *
 * All routes in this file require admin persona.
 * Register in app.js:
 *
 *   app.use('/v1/admin', require('./routes/admin.routes'));
 */

'use strict';

const express = require('express');
const router = express.Router();

const adminController = require('../controllers/admin.controller');
const { verifyToken, requirePersona } = require('../middleware/auth.middleware');
const { requireAdminSession } = require('../middleware/adminSession.middleware');

// Every route in this file requires a valid JWT and admin persona.
router.use(verifyToken, requirePersona('admin'));

/* ---------------------------------------------------------------------------
 * Re-auth — must be registered BEFORE requireAdminSession so it's reachable
 * when the session has already expired.
 * ------------------------------------------------------------------------ */
router.post('/reauth', adminController.reauth);

// All routes below require an active admin session (15-min sliding window).
router.use(requireAdminSession);

/* ---------------------------------------------------------------------------
 * Platform statistics
 * ------------------------------------------------------------------------ */
router.get('/stats',     adminController.getStats);
router.get('/analytics', adminController.getAnalytics);

/* ---------------------------------------------------------------------------
 * User management
 * ------------------------------------------------------------------------ */
router.get('/users', adminController.listUsers);
// bulk-action must be registered before /:id to avoid Express treating
// "bulk-action" as a user id parameter.
router.post('/users/bulk-action', adminController.bulkUserAction);
router.get('/users/:id', adminController.getUser);
router.patch('/users/:id/toggle-active', adminController.toggleUserActive);
router.patch('/users/:id/reset-quota', adminController.resetUserQuota);
router.post('/users/:id/revoke-subscription', adminController.revokeSubscription);

/* ---------------------------------------------------------------------------
 * Lawyer listing, verification, and rejection
 * ------------------------------------------------------------------------ */
router.get('/lawyers', adminController.listLawyers);
router.post('/lawyers/:id/verify', adminController.verifyLawyer);
router.post('/lawyers/:id/reject', adminController.rejectLawyer);
router.post('/lawyers/:id/reset-verification', adminController.resetLawyerVerification);

/* ---------------------------------------------------------------------------
 * Notary listing, verification, and rejection
 * ------------------------------------------------------------------------ */
router.get('/notaries', adminController.listNotaries);
router.post('/notaries/:id/verify', adminController.verifyNotary);
router.post('/notaries/:id/reject', adminController.rejectNotary);
router.post('/notaries/:id/reset-verification', adminController.resetNotaryVerification);

/* ---------------------------------------------------------------------------
 * Audit log
 * ------------------------------------------------------------------------ */
router.get('/audit-logs', adminController.getAuditLogs);

/* ---------------------------------------------------------------------------
 * Document template management
 * ------------------------------------------------------------------------ */
router.get('/templates', adminController.listTemplates);
router.post('/templates', adminController.createTemplate);
// preview and history before /:id to avoid param collision
router.get('/templates/:id/preview', adminController.getTemplatePreview);
router.get('/templates/:id/history', adminController.getTemplateHistory);
router.post('/templates/:id/rollback', adminController.rollbackTemplate);
router.put('/templates/:id', adminController.updateTemplate);

/* ---------------------------------------------------------------------------
 * Payment management
 * ------------------------------------------------------------------------ */
router.get('/payments', adminController.listPayments);
router.post('/payments/:id/refund', adminController.refundPayment);

/* ---------------------------------------------------------------------------
 * Consultation management
 * ------------------------------------------------------------------------ */
router.get('/consultations', adminController.listConsultations);
router.patch('/consultations/:id/cancel', adminController.cancelConsultation);

/* ---------------------------------------------------------------------------
 * Document moderation
 * ------------------------------------------------------------------------ */
router.get('/documents', adminController.listDocuments);
router.delete('/documents/:id', adminController.deleteDocument);

/* ---------------------------------------------------------------------------
 * RTI admin dashboard
 * ------------------------------------------------------------------------ */
router.get('/rti', adminController.listRTI);
router.patch('/rti/:id/extend-deadline', adminController.extendRTIDeadline);

/* ---------------------------------------------------------------------------
 * Notarization requests (admin oversight + dispute resolution)
 * ------------------------------------------------------------------------ */
router.get('/notarizations', adminController.listNotarizations);
router.get('/notarizations/:id', adminController.getNotarization);

/* ---------------------------------------------------------------------------
 * Notary withdrawal requests (payout management)
 * ------------------------------------------------------------------------ */
router.get('/withdrawals', adminController.listWithdrawals);
router.post('/withdrawals/:id/process', adminController.processWithdrawal);

/* ---------------------------------------------------------------------------
 * Broadcast notifications
 * ------------------------------------------------------------------------ */
router.post('/notifications/broadcast', adminController.broadcastNotification);

module.exports = router;
