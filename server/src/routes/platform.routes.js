const express = require('express');
const { getPlatformStats } = require('../controllers/platform.controller');

const router = express.Router();

/**
 * GET /v1/platform/stats
 * Public — powers the animated stat counters on the landing page and citizen home.
 */
router.get('/stats', getPlatformStats);

module.exports = router;
