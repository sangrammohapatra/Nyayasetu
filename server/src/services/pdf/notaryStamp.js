'use strict';

/**
 * notaryStamp.js
 *
 * Generates a notarized PDF by appending an official notary seal page
 * to the existing document content.
 */

const PDFDocument = require('pdfkit');

const COLORS = {
  primary:   '#1565C0',
  dark:      '#0D1B2A',
  secondary: '#455A64',
  divider:   '#CFD8DC',
  seal:      '#1A237E',
  sealBg:    '#E8EAF6',
  green:     '#1B5E20',
};

function formatDate(date) {
  return new Date(date || Date.now()).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

/**
 * generateNotarizedPDF
 *
 * Appends a notary seal certification page to the document content
 * and returns a Buffer of the complete PDF.
 */
exports.generateNotarizedPDF = async ({
  document,
  notaryName,
  notaryRegistrationNumber,
  registrationState,
  stampRef,
  stampedAt,
}) => {
  return new Promise((resolve, reject) => {
    try {
      const chunks = [];
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 60, bottom: 70, left: 70, right: 70 },
        info: {
          Title: `[NOTARIZED] ${document.title || 'Legal Document'}`,
          Author: `NyayaSetu — Notarized by ${notaryName}`,
          Subject: 'Notarized Legal Document',
          Keywords: 'notarized, legal, nyayasetu',
        },
        bufferPages: true,
      });

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const pageW = doc.page.width;
      const pageH = doc.page.height;
      const ML = 70;
      const MR = 70;
      const contentW = pageW - ML - MR;

      // ── Page 1: Document Header ──────────────────────────────────────────────
      doc.font('Helvetica-Bold')
         .fontSize(9)
         .fillColor(COLORS.green)
         .text('✓ NOTARIZED DOCUMENT — NyayaSetu', ML, 30, { width: contentW, align: 'center' });

      doc.moveTo(ML, 46)
         .lineTo(pageW - MR, 46)
         .strokeColor(COLORS.green)
         .lineWidth(1)
         .stroke();

      // Title
      doc.moveDown(1.5);
      doc.font('Helvetica-Bold')
         .fontSize(18)
         .fillColor(COLORS.dark)
         .text(document.title || 'Legal Document', { align: 'center' });

      doc.font('Helvetica')
         .fontSize(10)
         .fillColor(COLORS.secondary)
         .text(`Generated on ${formatDate(document.createdAt)}`, { align: 'center' });

      doc.moveDown(1.5);

      // Divider
      doc.moveTo(ML, doc.y)
         .lineTo(pageW - MR, doc.y)
         .strokeColor(COLORS.divider)
         .lineWidth(0.5)
         .stroke();

      doc.moveDown(1.5);

      // ── Document Content ──────────────────────────────────────────────────────
      if (document.content) {
        const paragraphs = document.content.split(/\n{2,}/).filter(Boolean);
        for (const para of paragraphs) {
          if (doc.y > pageH - 120) doc.addPage();

          const isHeading = /^#+\s/.test(para.trim());
          const isClause = /^\d+\.|^[IVX]+\./.test(para.trim());

          if (isHeading) {
            doc.font('Helvetica-Bold')
               .fontSize(12)
               .fillColor(COLORS.dark)
               .text(para.replace(/^#+\s/, ''), ML, doc.y, { width: contentW });
          } else if (isClause) {
            doc.font('Helvetica')
               .fontSize(10)
               .fillColor(COLORS.dark)
               .text(para.trim(), ML, doc.y, { width: contentW, lineGap: 3 });
          } else {
            doc.font('Helvetica')
               .fontSize(10)
               .fillColor(COLORS.secondary)
               .text(para.trim(), ML, doc.y, { width: contentW, lineGap: 3 });
          }
          doc.moveDown(0.75);
        }
      }

      // ── Notary Seal Page ──────────────────────────────────────────────────────
      doc.addPage();

      const sealY = 80;

      // Outer seal border — double rectangle
      doc.rect(ML, sealY, contentW, 320)
         .strokeColor(COLORS.seal)
         .lineWidth(2)
         .stroke();

      doc.rect(ML + 6, sealY + 6, contentW - 12, 308)
         .strokeColor(COLORS.seal)
         .lineWidth(0.5)
         .stroke();

      // Seal fill
      doc.rect(ML + 7, sealY + 7, contentW - 14, 306)
         .fill(COLORS.sealBg);

      // Seal icon area (circular emblem)
      const cx = pageW / 2;
      const cy = sealY + 70;
      const r = 42;

      doc.circle(cx, cy, r)
         .strokeColor(COLORS.seal)
         .lineWidth(2)
         .fillAndStroke('#FFFFFF');

      doc.circle(cx, cy, r - 6)
         .strokeColor(COLORS.seal)
         .lineWidth(0.75)
         .stroke();

      doc.font('Helvetica-Bold')
         .fontSize(22)
         .fillColor(COLORS.seal)
         .text('⚖', cx - 14, cy - 14, { width: 28, align: 'center' });

      doc.font('Helvetica-Bold')
         .fontSize(7)
         .fillColor(COLORS.seal)
         .text('NOTARY PUBLIC', cx - 30, cy + 16, { width: 60, align: 'center' });

      // Seal header
      doc.font('Helvetica-Bold')
         .fontSize(15)
         .fillColor(COLORS.seal)
         .text('NOTARIAL CERTIFICATE', ML + 20, sealY + 130, { width: contentW - 40, align: 'center' });

      doc.font('Helvetica')
         .fontSize(9)
         .fillColor(COLORS.secondary)
         .text('Issued via NyayaSetu Online Notarization Platform', ML + 20, sealY + 150, { width: contentW - 40, align: 'center' });

      // Divider
      doc.moveTo(ML + 30, sealY + 168)
         .lineTo(pageW - MR - 30, sealY + 168)
         .strokeColor(COLORS.divider)
         .lineWidth(0.5)
         .stroke();

      // Details
      const detailX = ML + 30;
      const detailW = contentW - 60;
      let dy = sealY + 182;
      const lineGap = 22;

      const details = [
        ['Notarized By', notaryName],
        ['Registration No.', notaryRegistrationNumber],
        ['Issuing State', registrationState],
        ['Document Title', document.title || '—'],
        ['Date of Notarization', formatDate(stampedAt)],
        ['Stamp Reference', stampRef],
      ];

      doc.font('Helvetica')
         .fontSize(9)
         .fillColor(COLORS.secondary);

      for (const [label, value] of details) {
        doc.font('Helvetica-Bold')
           .fontSize(8)
           .fillColor(COLORS.secondary)
           .text(label + ':', detailX, dy, { width: 130, continued: false });

        doc.font('Helvetica')
           .fontSize(9)
           .fillColor(COLORS.dark)
           .text(value, detailX + 135, dy, { width: detailW - 135 });

        dy += lineGap;
      }

      // Footer note
      doc.font('Helvetica')
         .fontSize(7.5)
         .fillColor(COLORS.secondary)
         .text(
           'This document has been notarized online in accordance with Indian Information Technology Act, 2000 and ' +
           'The Notaries Act, 1952 via Video KYC. The notary has verified the identity of the signatory and the ' +
           'authenticity of this document. Stamp Reference: ' + stampRef,
           ML + 20, sealY + 310,
           { width: contentW - 40, align: 'center' }
         );

      // ── Footer disclaimer ─────────────────────────────────────────────────────
      const footerY = pageH - 55;
      doc.moveTo(ML, footerY)
         .lineTo(pageW - MR, footerY)
         .strokeColor(COLORS.divider)
         .lineWidth(0.5)
         .stroke();

      doc.font('Helvetica')
         .fontSize(7)
         .fillColor(COLORS.secondary)
         .text(
           'NyayaSetu — Online Legal Services Platform | This is a legally valid notarized document.',
           ML, footerY + 8, { width: contentW, align: 'center' }
         );

      // Page numbers
      const pageRange = doc.bufferedPageRange();
      for (let i = pageRange.start; i < pageRange.start + pageRange.count; i++) {
        doc.switchToPage(i);
        doc.font('Helvetica')
           .fontSize(8)
           .fillColor(COLORS.secondary)
           .text(
             `Page ${i - pageRange.start + 1} of ${pageRange.count}`,
             ML, pageH - 30, { width: contentW, align: 'center' }
           );
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};
