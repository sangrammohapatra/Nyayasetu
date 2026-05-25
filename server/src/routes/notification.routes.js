/**
 * server/src/routes/notification.routes.js
 *
 * All routes require an authenticated user via verifyToken middleware.
 */

const express = require('express');
const router = express.Router();

const { verifyToken } = require('../middleware/auth.middleware');
const notificationController = require('../controllers/notification.controller');

// Every endpoint in this router is auth-protected.
router.use(verifyToken);

/**
 * GET /v1/notifications
 * Paginated, sorted by createdAt desc.
 */
router.get('/', notificationController.getNotifications);

/**
 * POST /v1/notifications/read-all
 * Mark every notification as read.
 *
 * NOTE: Declared BEFORE the /:id route so 'read-all' is not interpreted as an ObjectId.
 */
router.post('/read-all', notificationController.markAllRead);

/**
 * PATCH /v1/notifications/:id/read
 */
router.patch('/:id/read', notificationController.markRead);

module.exports = router;
