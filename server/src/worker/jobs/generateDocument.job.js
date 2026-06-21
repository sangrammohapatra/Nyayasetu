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


const mongoose      = require('mongoose');
const sanitizeHtml  = require('sanitize-html');
const logger        = require('../../utils/logger');

// Allowlist used when sanitizing AI-generated HTML before storage (defense-in-depth).
// textToHtml already escapes all content via escapeHtml(), but an explicit allowlist
// ensures any future code path that bypasses escapeHtml cannot store XSS payloads.
const SANITIZE_OPTIONS = {
  allowedTags: ['h3', 'p', 'br'],
  allowedAttributes: { h3: ['class'], p: ['class'] },
  disallowedTagsMode: 'discard',
};

// ─── Lazy DB connection (only connect once per worker process) ─────────────────

let dbConnected = false;

async function ensureDbConnected() {
  if (dbConnected) return;
  const { connectDB } = require('../../config/db');
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
  const ChatSession      = require('../../models/ChatSession.model');
  const DocumentModel    = require('../../models/Document.model');
  const DocumentTemplate = require('../../models/DocumentTemplate.model');
  const JurisdictionRule = require('../../models/JurisdictionRule.model');
  const LegalAct         = require('../../models/LegalAct.model');
  const User             = require('../../models/User.model');
  const Notification     = require('../../models/Notification.model');

  const { generateDocument, reviewDocument } = require('../../services/ai/documentEngine');
  const { generateLegalDocument } = require('../../services/pdf/pdfGenerator');
  const { uploadPDF }             = require('../../services/storage/storageProvider');
  const { SESSION_STATUS }        = require('../../config/constants');

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

    await job.progress(50);
    logger.info(`[job/generateDocument] Pass 1 complete: ${documentText.length} chars, ${legalCitations.length} citations`);

    // ── 2b. Pass 2: AI self-review ────────────────────────────────────────────
    const aiReview = await reviewDocument(documentText, session, template, jurisdictionRule);
    await job.progress(55);

    // ── 3. Update Document with AI content ────────────────────────────────────
    document.content            = documentText;
    document.contentHtml        = sanitizeHtml(textToHtml(documentText), SANITIZE_OPTIONS);
    document.legalCitations     = legalCitations;
    document.clauseExplanations = clauseExplanations;
    document.nextSteps          = nextSteps;
    document.aiReview           = aiReview;
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

    // ── 5b. Increment free-tier quota — only on success ───────────────────────
    // Quota is consumed here (not in the HTTP controller) so that a failed job
    // never permanently costs the user a document slot.
    if (document.accessType === 'free_tier' && !document.isPaid) {
      await User.findByIdAndUpdate(userId, { $inc: { 'freeUsage.docsGenerated': 1 } });
    }

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
      logger.error('[job/generateDocument] Recovery also failed:', { error: recoveryErr.message });
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
    const Notification = require('../../models/Notification.model');

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
        const { sendSMS } = require('../../services/notification/smsService');
        const message = `✅ NyayaSetu: Your ${template.name} is ready! View it here: ${process.env.CLIENT_URL}/documents/${document._id}`;
        await sendSMS(user.whatsappNumber, message);
      } catch (smsErr) {
        logger.warn('[job/generateDocument] WhatsApp notification failed:', { error: smsErr.message });
      }
    }

    logger.info(`[job/generateDocument] Notifications sent for doc: ${document._id}`);
  } catch (err) {
    // Notification failure must never crash the job
    logger.error('[job/generateDocument] Notification error:', { error: err.message });
  }
}
