const express = require('express');
const prisma = require('../lib/prisma');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

/**
 * Loads the educator profile for the authenticated user, so entrants are
 * always scoped to the educator's own school. Responds and returns null if
 * the account has no educator profile.
 */
async function loadEducator(req, res) {
  const educator = await prisma.educator.findUnique({
    where: { userId: req.user.id },
  });
  if (!educator) {
    res.status(403).json({ error: 'No school linked to this account' });
    return null;
  }
  return educator;
}

// POST /entrants
// Creates a student (entrant) at the authenticated educator's school.
router.post('/entrants', ...requireRole('educator'), async (req, res) => {
  try {
    const { name, grade } = req.body;
    if (!name || !grade) {
      return res.status(400).json({ error: 'name and grade are required' });
    }

    const educator = await loadEducator(req, res);
    if (!educator) return;

    const entrant = await prisma.entrant.create({
      data: {
        name: String(name).trim(),
        grade: String(grade).trim(),
        schoolId: educator.schoolId,
      },
    });

    // Auto-register the new entrant for all currently open rounds,
    // so they can immediately take any active test.
    const openRounds = await prisma.round.findMany({
      where: { state: 'open' },
      select: { id: true },
    });
    if (openRounds.length > 0) {
      await prisma.roundEntrant.createMany({
        data: openRounds.map((r) => ({ roundId: r.id, entrantId: entrant.id })),
        skipDuplicates: true,
      });
    }

    res.status(201).json(entrant);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not create entrant' });
  }
});

// GET /entrants
// Lists the entrants registered at the authenticated educator's school.
router.get('/entrants', ...requireRole('educator'), async (req, res) => {
  try {
    const educator = await loadEducator(req, res);
    if (!educator) return;

    const entrants = await prisma.entrant.findMany({
      where: { schoolId: educator.schoolId },
      orderBy: { name: 'asc' },
    });
    res.json(entrants);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not fetch entrants' });
  }
});

module.exports = router;
