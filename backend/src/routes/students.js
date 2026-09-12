const express = require('express');
const prisma = require('../lib/prisma');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

/**
 * Loads the claimed Entrant for the authenticated student, so both
 * /students/me routes are scoped to the student's own record.
 * Responds and returns null if the account is not linked to an entrant.
 */
async function loadEntrant(req, res) {
  const entrant = await prisma.entrant.findFirst({
    where: { userId: req.user.id },
  });
  if (!entrant) {
    res.status(404).json({ error: 'No entrant record linked to this account' });
    return null;
  }
  return entrant;
}

// GET /students/me/sittings
// Lists the student's own sittings with round names and states, newest first.
// An in-progress sitting includes its expiry so the UI can show a countdown.
router.get('/students/me/sittings', ...requireRole('student'), async (req, res) => {
  try {
    const entrant = await loadEntrant(req, res);
    if (!entrant) return;

    const sittings = await prisma.sitting.findMany({
      where: { entrantId: entrant.id },
      include: {
        round: { select: { id: true, name: true, state: true, closeTime: true } },
      },
      orderBy: { startedAt: 'desc' },
    });

    res.json(sittings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not fetch sittings' });
  }
});

// GET /students/me/results
// Lists the student's own released results — a submission result is only
// visible once its releasedAt is set, so unreleased marks stay hidden.
router.get('/students/me/results', ...requireRole('student'), async (req, res) => {
  try {
    const entrant = await loadEntrant(req, res);
    if (!entrant) return;

    const submissions = await prisma.submission.findMany({
      where: {
        entrantId: entrant.id,
        result: { releasedAt: { not: null } },
      },
      include: {
        round: { select: { id: true, name: true } },
        result: true,
      },
      orderBy: { submittedAt: 'desc' },
    });

    const results = submissions.map((submission) => ({
      id: submission.result.id,
      score: submission.result.score,
      releasedAt: submission.result.releasedAt,
      submittedAt: submission.submittedAt,
      round: { id: submission.round.id, name: submission.round.name },
    }));

    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not fetch results' });
  }
});

module.exports = router;
