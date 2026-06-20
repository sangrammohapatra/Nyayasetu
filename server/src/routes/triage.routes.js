const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth.middleware');
const { analyzeSituation, getTriageQuota } = require('../controllers/triage.controller');

// GET /v1/triage/quota  — check remaining daily uses
router.get('/quota', verifyToken, getTriageQuota);

// POST /v1/triage  — submit emergency description
router.post('/', verifyToken, analyzeSituation);

module.exports = router;
