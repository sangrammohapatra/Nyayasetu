'use strict';

const express = require('express');
const router  = express.Router();

const { protect } = require('../middleware/auth.middleware');
const {
  listRTIs,
  getRTIDetail,
  aiDraftRTI,
  createRTI,
  markAsFiled,
  updateStatus,
  generateFirstAppealDraft,
  generateCICAppealDraft,
  downloadPDF,
  deleteRTI,
  getMinistries,
} = require('../controllers/rti.controller');

// All RTI routes require authentication
router.use(protect);

// Ministry reference data
router.get('/ministries',                    getMinistries);

// AI Draft — no DB save, returns draft for review
router.post('/ai-draft',                     aiDraftRTI);

// CRUD
router.get('/',                              listRTIs);
router.post('/',                             createRTI);
router.get('/:id',                           getRTIDetail);
router.delete('/:id',                        deleteRTI);

// Status transitions
router.patch('/:id/file',                    markAsFiled);
router.patch('/:id/status',                  updateStatus);

// AI appeal drafts (returns content, does not change status)
router.post('/:id/draft-first-appeal',       generateFirstAppealDraft);
router.post('/:id/draft-cic-appeal',         generateCICAppealDraft);

// PDF downloads — GET for application, POST for appeals (content can be in body)
router.get('/:id/download/:docType',         downloadPDF);
router.post('/:id/download/:docType',        downloadPDF);

module.exports = router;
