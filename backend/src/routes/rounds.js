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
    const { olympiadId, name, openTime, closeTime } = req.body;
    if (!olympiadId || !name || !openTime || !closeTime) {
      return res
        .status(400)
        .json({ error: 'olympiadId, name, openTime, and closeTime are required' });
    }
    if (new Date(closeTime) <= new Date(openTime)) {
      return res.status(400).json({ error: 'closeTime must be after openTime' });
    }
    const round = await prisma.round.create({
      data: { olympiadId, name, openTime: new Date(openTime), closeTime: new Date(closeTime) },
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
      include: { result: true },
    });
    res.json(submissions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch submissions' });
  }
});

// GET /rounds/:id/standings
// Ranks entrants who have a scored Result for this round, highest score first.
// Entrants with a Submission but no Result yet (not marked / no memo answers
// on the paper) are excluded — there's nothing to rank them on.
router.get('/rounds/:id/standings', async (req, res) => {
  try {
    const roundId = req.params.id;

    const round = await prisma.round.findUnique({ where: { id: roundId } });
    if (!round) {
      return res.status(404).json({ error: 'Round not found' });
    }

    const submissions = await prisma.submission.findMany({
      where: { roundId, result: { isNot: null } },
      include: {
        result: true,
        entrant: { include: { school: true } },
      },
    });

    const ranked = submissions
      .map((s) => ({
        entrantId: s.entrant.id,
        entrantName: s.entrant.name,
        schoolName: s.entrant.school.name,
        score: s.result.score,
        submittedAt: s.submittedAt,
      }))
      .sort((a, b) => b.score - a.score);

    // Standard competition ranking (1224): ties share a rank, next rank
    // skips ahead by the number of tied entries.
    let rank = 0;
    let lastScore = null;
    const standings = ranked.map((entry, index) => {
      if (entry.score !== lastScore) {
        rank = index + 1;
        lastScore = entry.score;
      }
      return { rank, ...entry };
    });

    res.json(standings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch standings' });
  }
});

// GET /rounds/:id/standings/schools
// Ranks schools by the sum of their entrants' scores for this round.
// Reuses the same underlying data as GET /rounds/:id/standings (Submission
// -> Result), so it automatically covers both paper and online results too,
// same as the individual standings route.
router.get('/rounds/:id/standings/schools', async (req, res) => {
  try {
    const roundId = req.params.id;

    const round = await prisma.round.findUnique({ where: { id: roundId } });
    if (!round) {
      return res.status(404).json({ error: 'Round not found' });
    }

    const submissions = await prisma.submission.findMany({
      where: { roundId, result: { isNot: null } },
      include: {
        result: true,
        entrant: { include: { school: true } },
      },
    });

    const bySchool = new Map();

    for (const s of submissions) {
      const schoolId = s.entrant.school.id;
      if (!bySchool.has(schoolId)) {
        bySchool.set(schoolId, {
          schoolId,
          schoolName: s.entrant.school.name,
          totalScore: 0,
          entrantCount: 0,
        });
      }
      const entry = bySchool.get(schoolId);
      entry.totalScore += s.result.score;
      entry.entrantCount += 1;
    }

    const ranked = Array.from(bySchool.values()).sort((a, b) => b.totalScore - a.totalScore);

    // Standard competition ranking (1224), same convention as the
    // individual standings route.
    let rank = 0;
    let lastScore = null;
    const standings = ranked.map((entry, index) => {
      if (entry.totalScore !== lastScore) {
        rank = index + 1;
        lastScore = entry.totalScore;
      }
      return { rank, ...entry };
    });

    res.json(standings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch school standings' });
  }
});


module.exports = router;
