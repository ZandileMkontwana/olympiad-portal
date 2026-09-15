const PDFDocument = require('pdfkit');

/**
 * Generates a certificate of participation as a PDF, returned as a Buffer.
 * A certificate is only issued for an entrant with a scored Result for the
 * round — that eligibility check happens at the route level (#133), not
 * here; this function just renders whatever data it's given.
 *
 * @param {{
 *   entrantName: string,
 *   schoolName: string,
 *   roundName: string,
 *   olympiadName: string,
 *   score: number,
 * }} data
 * @returns {Promise<Buffer>}
 */
function generateCertificatePdf({ entrantName, schoolName, roundName, olympiadName, score }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 50 });
    const chunks = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageWidth = doc.page.width;

    // Decorative border
    doc
      .rect(20, 20, pageWidth - 40, doc.page.height - 40)
      .lineWidth(2)
      .strokeColor('#4C3F82')
      .stroke();

    doc
      .fontSize(12)
      .fillColor('#6B6480')
      .font('Helvetica')
      .text(olympiadName.toUpperCase(), 0, 90, { align: 'center', characterSpacing: 2 });

    doc
      .fontSize(32)
      .fillColor('#211B33')
      .font('Helvetica-Bold')
      .text('Certificate of Participation', 0, 120, { align: 'center' });

    doc
      .fontSize(14)
      .fillColor('#6B6480')
      .font('Helvetica')
      .text('This certifies that', 0, 190, { align: 'center' });

    doc
      .fontSize(26)
      .fillColor('#211B33')
      .font('Helvetica-Bold')
      .text(entrantName, 0, 220, { align: 'center' });

    doc
      .fontSize(14)
      .fillColor('#6B6480')
      .font('Helvetica')
      .text(`of ${schoolName}`, 0, 260, { align: 'center' });

    doc
      .fontSize(14)
      .fillColor('#211B33')
      .font('Helvetica')
      .text(`participated in ${roundName}, scoring ${score.toFixed(2)}%.`, 0, 300, {
        align: 'center',
      });

    doc
      .fontSize(10)
      .fillColor('#6B6480')
      .text(
        `Issued ${new Date().toLocaleDateString('en-ZA', { year: 'numeric', month: 'long', day: 'numeric' })}`,
        0,
        360,
        {
          align: 'center',
        }
      );

    doc.end();
  });
}

module.exports = { generateCertificatePdf };
