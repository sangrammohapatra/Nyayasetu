/**
 * server/src/routes/admin.routes.js
 *
 * All routes in this file require admin persona.
 * Register in app.js:
 *
 *   app.use('/v1/admin', require('./routes/admin.routes'));
 *
 * Resulting paths:
 *   GET    /v1/admin/stats
 *   GET    /v1/admin/users
 *   GET    /v1/admin/users/:id
 *   POST   /v1/admin/lawyers/:id/verify
 *   GET    /v1/admin/templates
 *   POST   /v1/admin/templates
 *   PUT    /v1/admin/templates/:id
 */

'use strict';

const express = require('express');
const router = express.Router();

const adminController = require('../controllers/admin.controller');
const { verifyToken, requirePersona } = require('../middleware/auth.middleware');

// Every route in this file requires a valid JWT and admin persona.
router.use(verifyToken, requirePersona('admin'));

/* ---------------------------------------------------------------------------
 * Platform statistics
 * ------------------------------------------------------------------------ */
router.get('/stats', adminController.getStats);

/* ---------------------------------------------------------------------------
 * User management
 * ------------------------------------------------------------------------ */
router.get('/users', adminController.listUsers);
router.get('/users/:id', adminController.getUser);
router.patch('/users/:id/toggle-active', adminController.toggleUserActive);

/* ---------------------------------------------------------------------------
 * Lawyer listing, verification, and rejection
 * ------------------------------------------------------------------------ */
router.get('/lawyers', adminController.listLawyers);
router.post('/lawyers/:id/verify', adminController.verifyLawyer);
router.post('/lawyers/:id/reject', adminController.rejectLawyer);

/* ---------------------------------------------------------------------------
 * Audit log
 * ------------------------------------------------------------------------ */
router.get('/audit-logs', adminController.getAuditLogs);

/* ---------------------------------------------------------------------------
 * Document template management
 * ------------------------------------------------------------------------ */
router.get('/templates', adminController.listTemplates);
router.post('/templates', adminController.createTemplate);
router.put('/templates/:id', adminController.updateTemplate);

module.exports = router;
