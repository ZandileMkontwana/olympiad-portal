const PDFDocument = require('pdfkit');

/**
 * Generates a certificate PDF buffer for an entrant's round completion.
 *
 * @param {{
 *   entrantName: string,
 *   roundName: string,
 *   olympiadName: string,
 *   schoolName: string,
 *   score: number|null,
 *   issuedDate: string,
 * }} data
 * @returns {Promise<Buffer>}
 */
function generateCertificate({
  entrantName,
  roundName,
  olympiadName,
  schoolName,
  score,
  issuedDate,
}) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', landscape: true, margin: 0 });
      const chunks = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const { width, height } = doc.page;

      // ── Background ──────────────────────────────────────────────────
      doc.rect(0, 0, width, height).fill('#fdfcff');

      // ── Outer border ────────────────────────────────────────────────
      doc.rect(24, 24, width - 48, height - 48).stroke('#7c3aed');

      // ── Inner border (thinner) ──────────────────────────────────────
      doc.lineWidth(0.5);
      doc.rect(34, 34, width - 68, height - 68).stroke('#a78bfa');

      // ── Olympiad name ───────────────────────────────────────────────
      doc
        .fontSize(14)
        .fillColor('#6b7280')
        .text(olympiadName.toUpperCase(), 0, 70, { width, align: 'center' });

      // ── "Certificate of Achievement" ────────────────────────────────
      doc
        .fontSize(36)
        .fillColor('#7c3aed')
        .text('Certificate of Achievement', 0, 110, { width, align: 'center' });

      // ── Divider line ────────────────────────────────────────────────
      const lineY = 165;
      doc
        .moveTo(width * 0.3, lineY)
        .lineTo(width * 0.7, lineY)
        .strokeColor('#a78bfa')
        .lineWidth(1)
        .stroke();

      // ── "This is presented to" ──────────────────────────────────────
      doc.fontSize(14).fillColor('#6b7280').text('This is presented to', 0, 185, {
        width,
        align: 'center',
      });

      // ── Entrant name ────────────────────────────────────────────────
      doc.fontSize(32).fillColor('#1f2937').text(entrantName, 0, 215, {
        width,
        align: 'center',
      });

      // ── Underline beneath name ──────────────────────────────────────
      const nameLineY = 260;
      doc
        .moveTo(width * 0.25, nameLineY)
        .lineTo(width * 0.75, nameLineY)
        .strokeColor('#d1d5db')
        .lineWidth(0.5)
        .stroke();

      // ── School ──────────────────────────────────────────────────────
      doc.fontSize(12).fillColor('#6b7280').text(schoolName, 0, 275, {
        width,
        align: 'center',
      });

      // ── Achievement description ─────────────────────────────────────
      const description = `for successfully completing ${roundName}`;
      doc.fontSize(14).fillColor('#374151').text(description, 0, 310, {
        width,
        align: 'center',
      });

      // ── Score (if available) ────────────────────────────────────────
      if (score !== null && score !== undefined) {
        doc.fontSize(18).fillColor('#7c3aed').text(`Score: ${score}`, 0, 345, {
          width,
          align: 'center',
        });
      }

      // ── Date issued ─────────────────────────────────────────────────
      const dateY = score !== null && score !== undefined ? 385 : 355;
      doc.fontSize(10).fillColor('#9ca3af').text(`Issued: ${issuedDate}`, 0, dateY, {
        width,
        align: 'center',
      });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { generateCertificate };
