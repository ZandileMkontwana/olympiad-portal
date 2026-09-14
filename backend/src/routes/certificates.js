const express = require('express');
const prisma = require('../lib/prisma');
const { requireRole } = require('../middleware/auth');
const { generateCertificate } = require('../lib/certificate');

const router = express.Router();

// GET /rounds/:id/certificates/:entrantId
// Generates a PDF certificate for an entrant who completed a released round.
// Requires educator role; the entrant must belong to the educator's school.
router.get('/rounds/:id/certificates/:entrantId', ...requireRole('educator'), async (req, res) => {
  try {
    const { id: roundId, entrantId } = req.params;

    // Fetch round with olympiad — must be released
    const round = await prisma.round.findUnique({
      where: { id: roundId },
      include: { olympiad: true },
    });
    if (!round) {
      return res.status(404).json({ error: 'Round not found' });
    }
    if (round.state !== 'released') {
      return res.status(403).json({
        error: 'Certificates are only available after results are released',
      });
    }

    // Verify the educator is linked to a school
    const educator = await prisma.educator.findUnique({
      where: { userId: req.user.id },
    });
    if (!educator) {
      return res.status(403).json({ error: 'No school linked to this account' });
    }

    // Fetch entrant with school and their submission + result for this round
    const entrant = await prisma.entrant.findUnique({
      where: { id: entrantId },
      include: {
        school: true,
        submissions: {
          where: { roundId },
          include: { result: true },
        },
      },
    });
    if (!entrant) {
      return res.status(404).json({ error: 'Entrant not found' });
    }

    // Entrant must be at the educator's school
    if (entrant.schoolId !== educator.schoolId) {
      return res.status(403).json({ error: 'Entrant belongs to a different school' });
    }

    // Must have a submission with a result for this round
    const submission = entrant.submissions[0];
    if (!submission || !submission.result) {
      return res.status(404).json({ error: 'No result found for this entrant in this round' });
    }

    // Generate the PDF
    const pdfBuffer = await generateCertificate({
      entrantName: entrant.name,
      roundName: round.name,
      olympiadName: round.olympiad.name,
      schoolName: entrant.school.name,
      score: submission.result.score,
      issuedDate: new Date().toLocaleDateString('en-ZA', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
    });

    const filename = `${entrant.name.replace(/[^a-zA-Z0-9 ]/g, '')}-${round.name}-certificate.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate certificate' });
  }
});

module.exports = router;
