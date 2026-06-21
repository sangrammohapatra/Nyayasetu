'use strict';

/**
 * rtiPdfService.js
 *
 * Generates legally-formatted PDFs for:
 *  1. RTI Application (under Section 6(1) of RTI Act, 2005)
 *  2. First Appeal (under Section 19(1))
 *  3. Second Appeal / CIC Complaint (under Section 19(3))
 */

const PDFDocument = require('pdfkit');

const COLORS = {
  primary:   '#1565C0',
  dark:      '#0D1B2A',
  secondary: '#455A64',
  divider:   '#CFD8DC',
  accent:    '#E65100',
  success:   '#1B5E20',
  saffron:   '#FF6F00',
  light:     '#E3F2FD',
};

function formatDate(date) {
  return new Date(date || Date.now()).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

function addPageFooter(doc, pageNum, totalPages, ML, contentW, pageH) {
  const footerY = pageH - 42;
  doc.moveTo(ML, footerY)
     .lineTo(ML + contentW, footerY)
     .strokeColor(COLORS.divider)
     .lineWidth(0.5)
     .stroke();
  doc.font('Helvetica')
     .fontSize(7.5)
     .fillColor(COLORS.secondary)
     .text(
       `NyayaSetu — RTI Tracker | Filed under Right to Information Act, 2005 | Page ${pageNum} of ${totalPages}`,
       ML, footerY + 8, { width: contentW, align: 'center' }
     );
}

// ─── RTI Application PDF ──────────────────────────────────────────────────────

/**
 * generateRTIApplicationPDF — produces the formal RTI request letter.
 * @param {Object} rti — RTIApplication document
 * @returns {Promise<Buffer>}
 */
exports.generateRTIApplicationPDF = async (rti) => {
  return new Promise((resolve, reject) => {
    try {
      const chunks = [];
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 55, bottom: 65, left: 65, right: 65 },
        info: {
          Title: `RTI Application — ${rti.title}`,
          Author: rti.applicantName || 'NyayaSetu User',
          Subject: 'Right to Information Application under RTI Act, 2005',
          Keywords: 'rti, right to information, india, nyayasetu',
        },
        bufferPages: true,
      });

      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const pageW = doc.page.width;
      const pageH = doc.page.height;
      const ML = 65;
      const MR = 65;
      const contentW = pageW - ML - MR;

      // ── Header Bar ────────────────────────────────────────────────────────────
      doc.rect(ML, 30, contentW, 28)
         .fill(COLORS.primary);

      doc.font('Helvetica-Bold')
         .fontSize(10)
         .fillColor('#FFFFFF')
         .text('RIGHT TO INFORMATION APPLICATION', ML + 10, 38, { width: contentW - 20, align: 'center' });

      doc.font('Helvetica')
         .fontSize(7.5)
         .fillColor('#FFFFFF')
         .text('Under Section 6(1) of the Right to Information Act, 2005', ML + 10, 50, { width: contentW - 20, align: 'center' });

      // ── Date & Reference ──────────────────────────────────────────────────────
      let y = 76;
      doc.font('Helvetica')
         .fontSize(9.5)
         .fillColor(COLORS.dark)
         .text(`Date: ${formatDate(rti.filedDate || rti.createdAt)}`, ML, y, { align: 'right', width: contentW });
      y += 16;
      if (rti.referenceNumber) {
        doc.text(`Reference No.: ${rti.referenceNumber}`, ML, y, { align: 'right', width: contentW });
        y += 16;
      }
      y += 4;

      // ── Addressee ─────────────────────────────────────────────────────────────
      doc.font('Helvetica-Bold').fontSize(9.5).fillColor(COLORS.dark)
         .text('To,', ML, y);
      y += 14;
      doc.font('Helvetica-Bold').fontSize(9.5).fillColor(COLORS.dark)
         .text('The Public Information Officer,', ML, y);
      y += 14;
      doc.font('Helvetica').fontSize(9.5).fillColor(COLORS.dark)
         .text(rti.ministry || 'Concerned Ministry/Department', ML, y, { width: contentW * 0.7 });
      y += 14;
      if (rti.department) {
        doc.text(rti.department, ML, y, { width: contentW * 0.7 });
        y += 14;
      }
      doc.text(rti.pioAddress || 'New Delhi', ML, y, { width: contentW * 0.7 });
      y += 22;

      // ── Subject ───────────────────────────────────────────────────────────────
      doc.font('Helvetica-Bold').fontSize(9.5).fillColor(COLORS.dark)
         .text('Subject: ', ML, y, { continued: true });
      doc.font('Helvetica').fontSize(9.5).fillColor(COLORS.dark)
         .text(`Application under Right to Information Act, 2005 — ${rti.title}`);
      y = doc.y + 14;

      // ── Salutation ────────────────────────────────────────────────────────────
      doc.font('Helvetica').fontSize(9.5).fillColor(COLORS.dark)
         .text('Sir/Madam,', ML, y);
      y = doc.y + 12;

      // ── Opening Para ──────────────────────────────────────────────────────────
      const applicantInfo = [
        rti.applicantName,
        rti.applicantAddress,
        rti.applicantPhone ? `Phone: ${rti.applicantPhone}` : null,
        rti.applicantEmail ? `Email: ${rti.applicantEmail}` : null,
      ].filter(Boolean).join(', ');

      doc.font('Helvetica').fontSize(9.5).fillColor(COLORS.dark).text(
        `I, ${applicantInfo || '[Applicant Details]'}, wish to seek the following information under the provisions of the Right to Information Act, 2005. The information sought is not exempt from disclosure under the Act, and I request the Public Information Officer to provide the same.`,
        ML, y, { width: contentW, lineGap: 3 }
      );
      y = doc.y + 16;

      // ── Information Sought ────────────────────────────────────────────────────
      doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.primary)
         .text('INFORMATION SOUGHT', ML, y);
      y = doc.y + 6;

      doc.moveTo(ML, y).lineTo(ML + contentW, y)
         .strokeColor(COLORS.primary).lineWidth(1).stroke();
      y += 10;

      const subjects = rti.subjects || [];
      for (let i = 0; i < subjects.length; i++) {
        if (y > pageH - 100) {
          doc.addPage();
          y = 55;
        }
        doc.font('Helvetica-Bold').fontSize(9.5).fillColor(COLORS.dark)
           .text(`${i + 1}.`, ML, y, { continued: true });
        doc.font('Helvetica').fontSize(9.5).fillColor(COLORS.dark)
           .text(` ${subjects[i]}`, ML + 18, y, { width: contentW - 18, lineGap: 3 });
        y = doc.y + 10;
      }

      y += 8;

      // ── Fee Details ───────────────────────────────────────────────────────────
      if (y > pageH - 140) { doc.addPage(); y = 55; }
      doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.primary)
         .text('FEE DETAILS', ML, y);
      y = doc.y + 6;
      doc.moveTo(ML, y).lineTo(ML + contentW, y)
         .strokeColor(COLORS.primary).lineWidth(1).stroke();
      y += 10;

      const feeModeLabel = {
        online: 'Online Payment (RTI Portal)',
        ipo: 'Indian Postal Order (IPO)',
        court_fee_stamp: 'Court Fee Stamp',
        demand_draft: 'Demand Draft',
        free: 'BPL — Fee Exempt',
      };

      doc.font('Helvetica').fontSize(9.5).fillColor(COLORS.dark)
         .text(
           rti.applicantBpl
             ? 'I am a BPL (Below Poverty Line) card holder and am exempt from payment of fee as per Rule 3 of the RTI (Fee and Cost) Rules, 2005.'
             : `I am enclosing a fee of ₹${rti.feeAmount || 10}/- (Rupees ${rti.feeAmount === 10 ? 'Ten' : rti.feeAmount} Only) via ${feeModeLabel[rti.feeMode] || 'Online Payment'} being the prescribed application fee.`,
           ML, y, { width: contentW, lineGap: 3 }
         );
      y = doc.y + 16;

      // ── Transfer Clause ───────────────────────────────────────────────────────
      if (y > pageH - 120) { doc.addPage(); y = 55; }
      doc.font('Helvetica').fontSize(9).fillColor(COLORS.secondary)
         .text(
           'If the information sought above or any part thereof is not held by or not related to this office, I request you to transfer this application to the concerned Public Information Officer under Sub-section (3) of Section 6 of the RTI Act, 2005, within 5 working days.',
           ML, y, { width: contentW, lineGap: 3 }
         );
      y = doc.y + 20;

      // ── Signature block ───────────────────────────────────────────────────────
      if (y > pageH - 100) { doc.addPage(); y = 55; }
      doc.font('Helvetica').fontSize(9.5).fillColor(COLORS.dark)
         .text('Yours faithfully,', ML, y);
      y += 40; // space for signature

      doc.font('Helvetica-Bold').fontSize(9.5).fillColor(COLORS.dark)
         .text(rti.applicantName || '________________________', ML, y);
      y += 14;
      if (rti.applicantAddress) {
        doc.font('Helvetica').fontSize(9).fillColor(COLORS.secondary)
           .text(rti.applicantAddress, ML, y, { width: contentW * 0.6 });
        y = doc.y + 6;
      }
      if (rti.applicantPhone) {
        doc.text(`Phone: ${rti.applicantPhone}`, ML, y);
        y = doc.y + 6;
      }
      doc.text(`Date: ${formatDate(rti.filedDate || rti.createdAt)}`, ML, y);

      // ── NyayaSetu badge ───────────────────────────────────────────────────────
      y = doc.y + 20;
      if (y > pageH - 60) { doc.addPage(); y = 55; }
      doc.rect(ML, y, contentW, 28).fill(COLORS.light);
      doc.font('Helvetica').fontSize(7.5).fillColor(COLORS.primary)
         .text(
           '⚖ Drafted via NyayaSetu RTI Tracker. Track your 30-day response deadline and auto-generate First Appeal at nyayasetu.in',
           ML + 8, y + 8, { width: contentW - 16, align: 'center' }
         );

      // ── Page numbers ──────────────────────────────────────────────────────────
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        addPageFooter(doc, i - range.start + 1, range.count, ML, contentW, pageH);
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};

// ─── First Appeal PDF ─────────────────────────────────────────────────────────

/**
 * generateFirstAppealPDF — Section 19(1) first appeal to the FAA.
 * @param {Object} rti — RTIApplication document
 * @param {Object} appealContent — { appealBody, groundsOfAppeal, reliefSought }
 * @returns {Promise<Buffer>}
 */
exports.generateFirstAppealPDF = async (rti, appealContent = {}) => {
  return new Promise((resolve, reject) => {
    try {
      const chunks = [];
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 55, bottom: 65, left: 65, right: 65 },
        info: {
          Title: `First Appeal — ${rti.title}`,
          Author: rti.applicantName || 'NyayaSetu User',
          Subject: 'First Appeal under Section 19(1) of RTI Act, 2005',
        },
        bufferPages: true,
      });

      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const pageW = doc.page.width;
      const pageH = doc.page.height;
      const ML = 65;
      const MR = 65;
      const contentW = pageW - ML - MR;

      // ── Header Bar ────────────────────────────────────────────────────────────
      doc.rect(ML, 30, contentW, 28).fill(COLORS.accent);
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#FFFFFF')
         .text('FIRST APPEAL — RIGHT TO INFORMATION ACT, 2005', ML + 10, 38, { width: contentW - 20, align: 'center' });
      doc.font('Helvetica').fontSize(7.5).fillColor('#FFFFFF')
         .text('Under Section 19(1) of the RTI Act, 2005', ML + 10, 50, { width: contentW - 20, align: 'center' });

      let y = 76;

      doc.font('Helvetica').fontSize(9.5).fillColor(COLORS.dark)
         .text(`Date: ${formatDate(rti.firstAppealFiledDate || new Date())}`, ML, y, { align: 'right', width: contentW });
      y += 20;

      // ── Addressee ─────────────────────────────────────────────────────────────
      doc.font('Helvetica-Bold').fontSize(9.5).fillColor(COLORS.dark).text('To,', ML, y);
      y += 14;
      doc.font('Helvetica-Bold').fontSize(9.5).text('The First Appellate Authority,', ML, y);
      y += 14;
      doc.font('Helvetica').fontSize(9.5)
         .text(rti.faaName || `(Concerned Appellate Authority for ${rti.ministry})`, ML, y, { width: contentW * 0.7 });
      y += 14;
      doc.text(rti.faaAddress || rti.pioAddress || 'New Delhi', ML, y, { width: contentW * 0.7 });
      y += 24;

      // ── Subject ───────────────────────────────────────────────────────────────
      doc.font('Helvetica-Bold').fontSize(9.5).fillColor(COLORS.dark)
         .text('Subject: ', ML, y, { continued: true });
      doc.font('Helvetica').text(`First Appeal against non-response/inadequate response to RTI Application — ${rti.title}`);
      y = doc.y + 14;

      // ── Reference ─────────────────────────────────────────────────────────────
      doc.font('Helvetica-Bold').fontSize(9.5)
         .text('Reference: ', ML, y, { continued: true });
      doc.font('Helvetica')
         .text(`RTI Application dated ${formatDate(rti.filedDate)} to ${rti.ministry}${rti.referenceNumber ? `, Reference No. ${rti.referenceNumber}` : ''}`);
      y = doc.y + 14;

      doc.font('Helvetica').fontSize(9.5).fillColor(COLORS.dark).text('Sir/Madam,', ML, y);
      y = doc.y + 12;

      // ── Body ──────────────────────────────────────────────────────────────────
      if (appealContent.appealBody) {
        doc.font('Helvetica').fontSize(9.5).fillColor(COLORS.dark)
           .text(appealContent.appealBody, ML, y, { width: contentW, lineGap: 3 });
        y = doc.y + 16;
      } else {
        // Fallback body
        const noResponse = !rti.responseDate;
        doc.font('Helvetica').fontSize(9.5).fillColor(COLORS.dark).text(
          `I, ${rti.applicantName || '[Applicant]'}, had filed an RTI Application dated ${formatDate(rti.filedDate)} with the Public Information Officer, ${rti.ministry}, seeking information regarding "${rti.title}". ${noResponse ? `As of today (${formatDate(new Date())}), I have not received any response within the stipulated 30-day period as mandated under Section 7(1) of the RTI Act, 2005.` : `The response received on ${formatDate(rti.responseDate)} is incomplete/unsatisfactory as it does not address the information sought.`}`,
          ML, y, { width: contentW, lineGap: 3 }
        );
        y = doc.y + 16;
      }

      // ── Grounds ───────────────────────────────────────────────────────────────
      if (y > pageH - 150) { doc.addPage(); y = 55; }
      doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.accent).text('GROUNDS OF APPEAL', ML, y);
      y = doc.y + 6;
      doc.moveTo(ML, y).lineTo(ML + contentW, y).strokeColor(COLORS.accent).lineWidth(1).stroke();
      y += 10;

      const grounds = appealContent.groundsOfAppeal?.length
        ? appealContent.groundsOfAppeal
        : [
            'The Public Information Officer has failed to provide the requested information within 30 days as mandated under Section 7(1) of the RTI Act, 2005.',
            'The delay in providing information is in contravention of the spirit and mandate of the RTI Act, 2005.',
          ];

      for (let i = 0; i < grounds.length; i++) {
        if (y > pageH - 80) { doc.addPage(); y = 55; }
        doc.font('Helvetica').fontSize(9.5).fillColor(COLORS.dark)
           .text(`${i + 1}. ${grounds[i]}`, ML, y, { width: contentW, lineGap: 3 });
        y = doc.y + 8;
      }

      y += 8;

      // ── Relief Sought ─────────────────────────────────────────────────────────
      if (y > pageH - 120) { doc.addPage(); y = 55; }
      doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.accent).text('RELIEF SOUGHT', ML, y);
      y = doc.y + 6;
      doc.moveTo(ML, y).lineTo(ML + contentW, y).strokeColor(COLORS.accent).lineWidth(1).stroke();
      y += 10;

      doc.font('Helvetica').fontSize(9.5).fillColor(COLORS.dark)
         .text(
           appealContent.reliefSought || 'The Appellant humbly prays that this Honourable Authority may be pleased to direct the Public Information Officer to furnish all the requested information within 15 days and impose appropriate penalty under Section 20 of the RTI Act, 2005.',
           ML, y, { width: contentW, lineGap: 3 }
         );
      y = doc.y + 20;

      // ── Signature ─────────────────────────────────────────────────────────────
      if (y > pageH - 100) { doc.addPage(); y = 55; }
      doc.font('Helvetica').fontSize(9.5).fillColor(COLORS.dark).text('Yours faithfully,', ML, y);
      y += 40;
      doc.font('Helvetica-Bold').fontSize(9.5).text(rti.applicantName || '________________________', ML, y);
      y += 14;
      if (rti.applicantPhone) {
        doc.font('Helvetica').fontSize(9).fillColor(COLORS.secondary).text(`Phone: ${rti.applicantPhone}`, ML, y);
        y = doc.y + 6;
      }
      doc.text(`Date: ${formatDate(rti.firstAppealFiledDate || new Date())}`, ML, y);

      // ── Enclosures ────────────────────────────────────────────────────────────
      y = doc.y + 16;
      doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.dark).text('Enclosures:', ML, y);
      y = doc.y + 8;
      const enclosures = [
        'Copy of original RTI Application',
        rti.referenceNumber ? `Copy of acknowledgement (Ref: ${rti.referenceNumber})` : 'Copy of proof of submission of RTI Application',
      ];
      if (rti.responseDate) enclosures.push('Copy of PIO response');
      enclosures.forEach((enc, i) => {
        doc.font('Helvetica').fontSize(9).fillColor(COLORS.secondary).text(`${i + 1}. ${enc}`, ML + 12, doc.y + 4);
      });

      // ── Footer with page numbers ──────────────────────────────────────────────
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        addPageFooter(doc, i - range.start + 1, range.count, ML, contentW, pageH);
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};

// ─── CIC Second Appeal PDF ────────────────────────────────────────────────────

/**
 * generateCICAppealPDF — Section 19(3) second appeal to CIC/SIC.
 * @param {Object} rti — RTIApplication document
 * @param {Object} cicContent — { complaintBody, groundsForCIC, reliefFromCIC }
 * @returns {Promise<Buffer>}
 */
exports.generateCICAppealPDF = async (rti, cicContent = {}) => {
  return new Promise((resolve, reject) => {
    try {
      const chunks = [];
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 55, bottom: 65, left: 65, right: 65 },
        info: {
          Title: `CIC Second Appeal — ${rti.title}`,
          Author: rti.applicantName || 'NyayaSetu User',
          Subject: 'Second Appeal under Section 19(3) of RTI Act, 2005 to CIC/SIC',
        },
        bufferPages: true,
      });

      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const pageW = doc.page.width;
      const pageH = doc.page.height;
      const ML = 65;
      const MR = 65;
      const contentW = pageW - ML - MR;

      // ── Header ────────────────────────────────────────────────────────────────
      doc.rect(ML, 30, contentW, 28).fill(COLORS.saffron);
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#FFFFFF')
         .text('SECOND APPEAL TO CENTRAL INFORMATION COMMISSION', ML + 10, 35, { width: contentW - 20, align: 'center' });
      doc.font('Helvetica').fontSize(7.5).fillColor('#FFFFFF')
         .text('Under Section 19(3) of the Right to Information Act, 2005', ML + 10, 48, { width: contentW - 20, align: 'center' });

      let y = 76;
      doc.font('Helvetica').fontSize(9.5).fillColor(COLORS.dark)
         .text(`Date: ${formatDate(rti.cicFiledDate || new Date())}`, ML, y, { align: 'right', width: contentW });
      y += 20;

      // ── Addressee ─────────────────────────────────────────────────────────────
      doc.font('Helvetica-Bold').fontSize(9.5).text('To,', ML, y); y += 14;
      doc.font('Helvetica-Bold').fontSize(9.5).text('The Central Information Commissioner,', ML, y); y += 14;
      doc.font('Helvetica').fontSize(9.5)
         .text('Central Information Commission (CIC)', ML, y); y += 14;
      doc.text('Club Building (Near Post Office), Old JNU Campus, New Delhi - 110067', ML, y, { width: contentW * 0.7 }); y += 24;

      doc.font('Helvetica-Bold').fontSize(9.5).text('Subject: ', ML, y, { continued: true });
      doc.font('Helvetica').text(`Second Appeal under Section 19(3) of RTI Act, 2005 against ${rti.ministry} — "${rti.title}"`);
      y = doc.y + 14;

      doc.font('Helvetica').fontSize(9.5).text('Sir/Madam,', ML, y);
      y = doc.y + 12;

      // ── Complaint Body ────────────────────────────────────────────────────────
      const body = cicContent.complaintBody || `I, ${rti.applicantName || '[Applicant]'}, respectfully submit this Second Appeal under Section 19(3) of the Right to Information Act, 2005 against the inaction/unsatisfactory response of the Public Information Officer and First Appellate Authority of ${rti.ministry}.\n\nI had filed an RTI Application dated ${formatDate(rti.filedDate)} (Reference: ${rti.referenceNumber || 'N/A'}) seeking information about "${rti.title}". ${rti.firstAppealFiledDate ? `A First Appeal dated ${formatDate(rti.firstAppealFiledDate)} (Reference: ${rti.firstAppealReferenceNumber || 'N/A'}) was filed but the matter remains unresolved.` : 'Despite the statutory 30-day period having elapsed, no adequate response has been received.'} I therefore pray for the relief of this Honourable Commission.`;

      doc.font('Helvetica').fontSize(9.5).fillColor(COLORS.dark)
         .text(body, ML, y, { width: contentW, lineGap: 3 });
      y = doc.y + 16;

      // ── Chronology ────────────────────────────────────────────────────────────
      if (y > pageH - 180) { doc.addPage(); y = 55; }
      doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.saffron).text('CHRONOLOGY OF EVENTS', ML, y);
      y = doc.y + 6;
      doc.moveTo(ML, y).lineTo(ML + contentW, y).strokeColor(COLORS.saffron).lineWidth(1).stroke();
      y += 10;

      const events = [
        rti.filedDate && `${formatDate(rti.filedDate)} — RTI Application filed with ${rti.ministry}`,
        rti.referenceNumber && `Reference No. ${rti.referenceNumber} issued`,
        rti.responseDeadline && `${formatDate(rti.responseDeadline)} — 30-day response deadline under Section 7(1)`,
        rti.responseDate ? `${formatDate(rti.responseDate)} — Response received (found unsatisfactory)` : 'Response not received within statutory period',
        rti.firstAppealFiledDate && `${formatDate(rti.firstAppealFiledDate)} — First Appeal filed under Section 19(1)`,
        rti.firstAppealDecisionDate ? `${formatDate(rti.firstAppealDecisionDate)} — First Appeal decision received (unsatisfactory)` : rti.firstAppealFiledDate ? 'First Appeal: No decision within statutory period' : null,
        `${formatDate(rti.cicFiledDate || new Date())} — Second Appeal filed before CIC`,
      ].filter(Boolean);

      events.forEach((event, i) => {
        if (y > pageH - 60) { doc.addPage(); y = 55; }
        doc.font('Helvetica').fontSize(9.5).fillColor(COLORS.dark)
           .text(`${i + 1}. ${event}`, ML, y, { width: contentW, lineGap: 2 });
        y = doc.y + 8;
      });

      y += 8;

      // ── Grounds ───────────────────────────────────────────────────────────────
      if (y > pageH - 150) { doc.addPage(); y = 55; }
      doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.saffron).text('GROUNDS FOR SECOND APPEAL', ML, y);
      y = doc.y + 6;
      doc.moveTo(ML, y).lineTo(ML + contentW, y).strokeColor(COLORS.saffron).lineWidth(1).stroke();
      y += 10;

      const grounds = cicContent.groundsForCIC?.length
        ? cicContent.groundsForCIC
        : [
            'The CPIO failed to provide the requested information within the stipulated 30-day period under Section 7(1) of the RTI Act, 2005.',
            'The First Appellate Authority either failed to dispose of the First Appeal within the 30-day statutory period or provided an unsatisfactory order.',
            'The information sought is not exempt under any of the sections (8 or 9) of the RTI Act, 2005.',
          ];

      grounds.forEach((g, i) => {
        if (y > pageH - 60) { doc.addPage(); y = 55; }
        doc.font('Helvetica').fontSize(9.5).fillColor(COLORS.dark)
           .text(`${i + 1}. ${g}`, ML, y, { width: contentW, lineGap: 3 });
        y = doc.y + 8;
      });

      y += 8;

      // ── Prayer/Relief ─────────────────────────────────────────────────────────
      if (y > pageH - 120) { doc.addPage(); y = 55; }
      doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.saffron).text('PRAYER / RELIEF SOUGHT', ML, y);
      y = doc.y + 6;
      doc.moveTo(ML, y).lineTo(ML + contentW, y).strokeColor(COLORS.saffron).lineWidth(1).stroke();
      y += 10;

      doc.font('Helvetica').fontSize(9.5).fillColor(COLORS.dark)
         .text(
           cicContent.reliefFromCIC || `The Appellant most respectfully prays that this Honourable Commission may be pleased to:\n1. Direct the CPIO, ${rti.ministry}, to provide all the requested information within 15 days;\n2. Impose penalty under Section 20(1) of the RTI Act for the delay;\n3. Award compensation under Section 19(8)(b) of the RTI Act;\n4. Pass any other order deemed fit in the interest of justice.`,
           ML, y, { width: contentW, lineGap: 3 }
         );
      y = doc.y + 20;

      // ── Signature ─────────────────────────────────────────────────────────────
      if (y > pageH - 80) { doc.addPage(); y = 55; }
      doc.font('Helvetica').fontSize(9.5).text('Yours faithfully,', ML, y);
      y += 40;
      doc.font('Helvetica-Bold').fontSize(9.5).text(rti.applicantName || '________________________', ML, y);
      y += 14;
      if (rti.applicantPhone) {
        doc.font('Helvetica').fontSize(9).fillColor(COLORS.secondary).text(`Phone: ${rti.applicantPhone}`, ML, y);
        y = doc.y + 6;
      }
      if (rti.applicantEmail) {
        doc.text(`Email: ${rti.applicantEmail}`, ML, y);
        y = doc.y + 6;
      }
      doc.text(`Date: ${formatDate(rti.cicFiledDate || new Date())}`, ML, y);

      // ── Page numbers ──────────────────────────────────────────────────────────
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        addPageFooter(doc, i - range.start + 1, range.count, ML, contentW, pageH);
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};
