/**
 * generateDocument — Bull job processor.
 *
 * Runs in the SEPARATE worker process (worker/src/worker.js).
 * Never runs inside the Express server (Rule #7, Section 15).
 *
 * Pipeline:
 *   1. Load session + template + jurisdictionRule + legalActSections
 *   2. Call documentEngine.generateDocument()
 *   3. Generate PDF via pdfGenerator
 *   4. Upload PDF via storageProvider
 *   5. Update Document record with full content
 *   6. Set session.status = 'completed'
 *   7. Send notification (WhatsApp/email/web push)
 *   8. On error: mark document with error, notify user
 */

// Load env before anything else (worker is a standalone process)
require('dotenv').config({ path: require('path').join(__dirname, '../../../server/.env') });

const mongoose   = require('mongoose');
const logger     = require('../../../server/src/utils/logger');

// ─── Lazy DB connection (only connect once per worker process) ─────────────────

let dbConnected = false;

async function ensureDbConnected() {
  if (dbConnected) return;
  const { connectDB } = require('../../../server/src/config/db');
  await connectDB();
  dbConnected = true;
}

// ─── Job processor ────────────────────────────────────────────────────────────

module.exports = async function processGenerateDocument(job) {
  const { sessionId, userId, documentId } = job.data;

  logger.info(`[job/generateDocument] Starting job ${job.id}: doc=${documentId}, session=${sessionId}`);
  await job.progress(5);

  await ensureDbConnected();

  // ── Lazy-load models and services (after DB connection) ───────────────────
  const ChatSession      = require('../../../server/src/models/ChatSession.model');
  const DocumentModel    = require('../../../server/src/models/Document.model');
  const DocumentTemplate = require('../../../server/src/models/DocumentTemplate.model');
  const JurisdictionRule = require('../../../server/src/models/JurisdictionRule.model');
  const LegalAct         = require('../../../server/src/models/LegalAct.model');
  const User             = require('../../../server/src/models/User.model');
  const Notification     = require('../../../server/src/models/Notification.model');

  const { generateDocument }      = require('../../../server/src/services/ai/documentEngine');
  const { generateLegalDocument } = require('../../../server/src/services/pdf/pdfGenerator');
  const { uploadPDF }             = require('../../../server/src/services/storage/storageProvider');
  const { SESSION_STATUS }        = require('../../../server/src/config/constants');

  let document = null;
  let session  = null;

  try {
    // ── 1. Load all required data ────────────────────────────────────────────
    [document, session] = await Promise.all([
      DocumentModel.findById(documentId),
      ChatSession.findById(sessionId).populate('template'),
    ]);

    if (!document) throw new Error(`Document ${documentId} not found`);
    if (!session)  throw new Error(`Session ${sessionId} not found`);
    if (!session.template) throw new Error(`Template not found on session ${sessionId}`);

    const template = session.template;
    await job.progress(10);

    // Load jurisdiction rule
    const jurisdictionRule = session.userState
      ? await JurisdictionRule.findForStateAndDocType(session.userState, template.slug)
      : null;

    // Load relevant legal act sections
    const legalActs = await LegalAct.findRelevantForDocType(template.slug);
    const legalActSections = legalActs.map((act) => ({
      act,
      sections: act.getSectionsForDocType(template.slug, 8),
    }));

    await job.progress(20);
    logger.info(`[job/generateDocument] Data loaded: template=${template.slug}, acts=${legalActs.length}, jurisdiction=${!!jurisdictionRule}`);

    // ── 2. Generate document content via AI ───────────────────────────────────
    const { documentText, legalCitations, clauseExplanations, nextSteps } =
      await generateDocument(session, template, jurisdictionRule, legalActSections);

    await job.progress(55);
    logger.info(`[job/generateDocument] AI generation complete: ${documentText.length} chars, ${legalCitations.length} citations`);

    // ── 3. Update Document with AI content ────────────────────────────────────
    document.content            = documentText;
    document.contentHtml        = textToHtml(documentText);
    document.legalCitations     = legalCitations;
    document.clauseExplanations = clauseExplanations;
    document.nextSteps          = nextSteps;
    document.jurisdiction       = {
      ...document.jurisdiction,
      applicableActs:  legalCitations.map((c) => c.act).filter(Boolean),
      filingAuthority: jurisdictionRule?.filingAuthority?.name || null,
    };
    await document.save();

    await job.progress(60);

    // ── 4. Generate PDF ───────────────────────────────────────────────────────
    const user = await User.findById(userId).select('name email phone preferredLanguage whatsappOptIn whatsappNumber subscription').lean();

    const pdfBuffer = await generateLegalDocument(document, user, template);
    await job.progress(80);
    logger.info(`[job/generateDocument] PDF generated: ${pdfBuffer.length} bytes`);

    // ── 5. Upload PDF to storage ──────────────────────────────────────────────
    const { storageKey } = await uploadPDF(pdfBuffer, documentId);

    document.pdfStorageKey  = storageKey;
    document.pdfGeneratedAt = new Date();
    document.pdfSizeBytes   = pdfBuffer.length;
    await document.save();

    await job.progress(90);
    logger.info(`[job/generateDocument] PDF uploaded: ${storageKey}`);

    // ── 6. Mark session as completed ─────────────────────────────────────────
    session.status             = SESSION_STATUS.COMPLETED;
    session.generatedDocument  = document._id;
    session.completedAt        = new Date();
    await session.save();

    // ── 7. Increment template usage counter ───────────────────────────────────
    await DocumentTemplate.findByIdAndUpdate(template._id, {
      $inc: { totalGenerated: 1 },
    });

    await job.progress(95);

    // ── 8. Send notifications ─────────────────────────────────────────────────
    await sendCompletionNotifications({ user, document, template });

    await job.progress(100);
    logger.info(`[job/generateDocument] Job ${job.id} completed successfully: doc=${documentId}`);

    return { success: true, documentId, pdfSize: pdfBuffer.length };

  } catch (err) {
    logger.error(`[job/generateDocument] Job ${job.id} FAILED:`, {
      error:      err.message,
      stack:      err.stack,
      documentId,
      sessionId,
    });

    // ── Error recovery: mark document as failed ───────────────────────────────
    try {
      if (document) {
        // Store error state without crashing the error handler
        await DocumentModel.findByIdAndUpdate(documentId, {
          $set: {
            content:    '',
            isActive:   false,
            'metadata.generationError': err.message,
            'metadata.failedAt': new Date(),
          },
        });
      }
      if (session) {
        await ChatSession.findByIdAndUpdate(sessionId, {
          $set: { status: SESSION_STATUS.DATA_COMPLETE }, // Allow retry
        });
      }

      // Notify user of failure
      await Notification.createForUser({
        userId,
        type:      'document_ready',
        title:     'Document Generation Failed',
        body:      'We could not generate your document. Please try again from the chat.',
        actionUrl: `/chat/${sessionId}`,
        channel:   'web',
        priority:  'high',
      });
    } catch (recoveryErr) {
      logger.error('[job/generateDocument] Recovery also failed:', recoveryErr.message);
    }

    throw err; // Re-throw so Bull marks job as failed and triggers retry
  }
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * textToHtml — minimal converter from legal text to HTML for web display.
 * Preserves paragraph structure and highlights section headings.
 */
function textToHtml(text) {
  if (!text) return '';

  const paragraphs = text.split(/\n{2,}/).filter((p) => p.trim());

  return paragraphs.map((para) => {
    const trimmed = para.trim();
    // Detect ALL-CAPS headings
    if (trimmed === trimmed.toUpperCase() && trimmed.length < 80 && /[A-Z]{3}/.test(trimmed)) {
      return `<h3 class="doc-section-heading">${escapeHtml(trimmed)}</h3>`;
    }
    // Numbered items
    if (/^(\d+\.|[ivx]+\.)/.test(trimmed)) {
      return `<p class="doc-numbered">${escapeHtml(trimmed).replace(/\n/g, '<br>')}</p>`;
    }
    return `<p>${escapeHtml(trimmed).replace(/\n/g, '<br>')}</p>`;
  }).join('\n');
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * sendCompletionNotifications — fires web, WhatsApp, and email alerts.
 */
async function sendCompletionNotifications({ user, document, template }) {
  try {
    const Notification = require('../../../server/src/models/Notification.model');

    // Always send in-app web notification
    await Notification.createForUser({
      userId:    user._id || document.user,
      type:      'document_ready',
      title:     'Your Document is Ready!',
      body:      `Your ${template.name} has been generated successfully. Tap to view.`,
      data:      { documentId: document._id, templateName: template.name },
      actionUrl: `/documents/${document._id}`,
      channel:   'web',
      priority:  'high',
    });

    // WhatsApp notification if opted in
    if (user.whatsappOptIn && user.whatsappNumber) {
      try {
        const { sendSMS } = require('../../../server/src/services/notification/smsService');
        const message = `✅ NyayaSetu: Your ${template.name} is ready! View it here: ${process.env.CLIENT_URL}/documents/${document._id}`;
        await sendSMS(user.whatsappNumber, message);
      } catch (smsErr) {
        logger.warn('[job/generateDocument] WhatsApp notification failed:', smsErr.message);
      }
    }

    logger.info(`[job/generateDocument] Notifications sent for doc: ${document._id}`);
  } catch (err) {
    // Notification failure must never crash the job
    logger.error('[job/generateDocument] Notification error:', err.message);
  }
}
