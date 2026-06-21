'use strict';

const express = require('express');
const router = express.Router();
const { signWebhook } = require('../controllers/document.controller');

// POST /v1/webhooks/signdesk
// Raw body is captured by the middleware registered in app.js before express.json().
router.post('/signdesk', signWebhook);

module.exports = router;
