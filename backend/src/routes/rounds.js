const express = require('express');
const prisma = require('../lib/prisma');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

router.post('/olympiads', async (req, res) => {
  try {
    const { name, timezone } = req.body;
    if (!name || !timezone) {
      return res.status(400).json({ error: 'name and timezone are required' });
    }
    const olympiad = await prisma.olympiad.create({ data: { name, timezone } });
    res.status(201).json(olympiad);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create olympiad' });
  }
});

router.get('/olympiads', async (req, res) => {
  try {
    const olympiads = await prisma.olympiad.findMany({
      include: {
        rounds: {
          orderBy: { openTime: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });
    res.json(olympiads);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch olympiads' });
  }
});

router.post('/rounds', async (req, res) => {
  try {
    const { olympiadId, name, openTime, closeTime, qualifyingThreshold } = req.body;
    if (!olympiadId || !name || !openTime || !closeTime) {
      return res
        .status(400)
        .json({ error: 'olympiadId, name, openTime, and closeTime are required' });
    }
    if (new Date(closeTime) <= new Date(openTime)) {
      return res.status(400).json({ error: 'closeTime must be after openTime' });
    }
    if (
      qualifyingThreshold !== undefined &&
      qualifyingThreshold !== null &&
      (typeof qualifyingThreshold !== 'number' ||
        qualifyingThreshold < 0 ||
        qualifyingThreshold > 100)
    ) {
      return res
        .status(400)
        .json({ error: 'qualifyingThreshold must be a number between 0 and 100' });
    }
    const round = await prisma.round.create({
      data: {
        olympiadId,
        name,
        openTime: new Date(openTime),
        closeTime: new Date(closeTime),
        qualifyingThreshold: qualifyingThreshold ?? null,
      },
    });
    res.status(201).json(round);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create round' });
  }
});

router.get('/rounds', async (req, res) => {
  try {
    const rounds = await prisma.round.findMany({
      include: { olympiad: true },
      orderBy: { openTime: 'asc' },
    });
    res.json(rounds);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch rounds' });
  }
});

router.get('/rounds/:id', async (req, res) => {
  try {
    const round = await prisma.round.findUnique({ where: { id: req.params.id } });
    if (!round) return res.status(404).json({ error: 'Round not found' });
    res.json(round);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch round' });
  }
});

router.get('/olympiads/:id/rounds', async (req, res) => {
  try {
    const rounds = await prisma.round.findMany({
      where: { olympiadId: req.params.id },
      orderBy: { openTime: 'asc' },
    });
    res.json(rounds);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch rounds' });
  }
});

// POST /rounds/:id/entrants
// Registers one of the educator's own entrants to sit a round. Registration
// is only accepted while the round is scheduled or open.
router.post('/rounds/:id/entrants', ...requireRole('educator'), async (req, res) => {
  try {
    const { entrantId } = req.body;
    if (!entrantId) {
      return res.status(400).json({ error: 'entrantId is required' });
    }

    const round = await prisma.round.findUnique({ where: { id: req.params.id } });
    if (!round) {
      return res.status(404).json({ error: 'Round not found' });
    }

    if (round.state !== 'scheduled' && round.state !== 'open') {
      return res.status(403).json({
        error: `Registration not accepted - round is currently '${round.state}'`,
      });
    }

    const educator = await prisma.educator.findUnique({
      where: { userId: req.user.id },
    });
    if (!educator) {
      return res.status(403).json({ error: 'No school linked to this account' });
    }

    const entrant = await prisma.entrant.findUnique({ where: { id: entrantId } });
    if (!entrant) {
      return res.status(404).json({ error: 'Entrant not found' });
    }

    if (entrant.schoolId !== educator.schoolId) {
      return res.status(403).json({ error: 'Entrant belongs to a different school' });
    }

    const existing = await prisma.roundEntrant.findUnique({
      where: { roundId_entrantId: { roundId: round.id, entrantId } },
    });
    if (existing) {
      return res.status(409).json({ error: 'Entrant is already registered for this round' });
    }

    const registration = await prisma.roundEntrant.create({
      data: { roundId: round.id, entrantId },
    });
    res.status(201).json(registration);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not register entrant' });
  }
});

router.get('/rounds/:id/entrants', async (req, res) => {
  try {
    const roundEntrants = await prisma.roundEntrant.findMany({
      where: { roundId: req.params.id },
      include: { entrant: true },
    });
    res.json(roundEntrants.map((re) => re.entrant));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch entrants' });
  }
});

router.get('/rounds/:id/submissions', async (req, res) => {
  try {
    const submissions = await prisma.submission.findMany({
      where: { roundId: req.params.id },
      include: { result: true, entrant: true, remarkRequests: true },
    });
    res.json(submissions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch submissions' });
  }
});

// GET /rounds/:id/progression
// A read-only preview of who would qualify for the next round based on
// this round's qualifyingThreshold, without actually registering anyone.
// Useful for organisers to check before/after a round closes.
router.get('/rounds/:id/progression', async (req, res) => {
  try {
    const round = await prisma.round.findUnique({
      where: { id: req.params.id },
      include: {
        roundEntrants: {
          include: {
            entrant: {
              include: {
                submissions: {
                  where: { roundId: req.params.id },
                  include: { result: true },
                },
              },
            },
          },
        },
      },
    });

    if (!round) {
      return res.status(404).json({ error: 'Round not found' });
    }

    if (round.qualifyingThreshold === null || round.qualifyingThreshold === undefined) {
      return res.json({
        roundId: round.id,
        qualifyingThreshold: null,
        entrants: [],
        message: 'This round has no qualifyingThreshold set, so no entrants will be auto-advanced.',
      });
    }

    const entrants = round.roundEntrants.map((roundEntrant) => {
      const entrant = roundEntrant.entrant;
      const submission = entrant.submissions[0];
      const score = submission?.result?.score ?? null;
      return {
        entrantId: entrant.id,
        name: entrant.name,
        score,
        qualifies: score !== null && score >= round.qualifyingThreshold,
      };
    });

    res.json({
      roundId: round.id,
      qualifyingThreshold: round.qualifyingThreshold,
      entrants,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to compute progression preview' });
  }
});

module.exports = router;
