const express = require('express');
const prisma = require('../lib/prisma');
const { requireApiKey } = require('../middleware/apiKeyAuth');

const router = express.Router();

// All external routes require a valid API key
router.use(requireApiKey);

// GET /external/olympiads — list all olympiads with their rounds
router.get('/olympiads', async (req, res) => {
  try {
    const olympiads = await prisma.olympiad.findMany({
      include: {
        rounds: {
          select: {
            id: true,
            name: true,
            openTime: true,
            closeTime: true,
            state: true,
          },
          orderBy: { openTime: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });

    res.json(olympiads);
  } catch (err) {
    console.error('External API: Failed to list olympiads:', err);
    res.status(500).json({ error: 'Failed to fetch olympiads' });
  }
});

// GET /external/olympiads/:id — single olympiad details
router.get('/olympiads/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const olympiad = await prisma.olympiad.findUnique({
      where: { id },
      include: {
        rounds: {
          select: {
            id: true,
            name: true,
            openTime: true,
            closeTime: true,
            state: true,
            qualifyingThreshold: true,
          },
          orderBy: { openTime: 'asc' },
        },
      },
    });

    if (!olympiad) {
      return res.status(404).json({ error: 'Olympiad not found' });
    }

    res.json(olympiad);
  } catch (err) {
    console.error('External API: Failed to fetch olympiad:', err);
    res.status(500).json({ error: 'Failed to fetch olympiad' });
  }
});

// GET /external/olympiads/:id/rounds — rounds for an olympiad
router.get('/olympiads/:id/rounds', async (req, res) => {
  try {
    const { id } = req.params;

    const olympiad = await prisma.olympiad.findUnique({
      where: { id },
      select: {
        rounds: {
          select: {
            id: true,
            name: true,
            openTime: true,
            closeTime: true,
            state: true,
            qualifyingThreshold: true,
          },
          orderBy: { openTime: 'asc' },
        },
      },
    });

    if (!olympiad) {
      return res.status(404).json({ error: 'Olympiad not found' });
    }

    res.json(olympiad.rounds);
  } catch (err) {
    console.error('External API: Failed to fetch rounds:', err);
    res.status(500).json({ error: 'Failed to fetch rounds' });
  }
});

// GET /external/rounds/:id/results — published results for a round
// Only returns results if the round state is 'results_released'
router.get('/rounds/:id/results', async (req, res) => {
  try {
    const { id } = req.params;

    const round = await prisma.round.findUnique({
      where: { id },
      include: {
        olympiad: {
          select: { id: true, name: true },
        },
        submissions: {
          where: {
            result: {
              releasedAt: { not: null },
            },
          },
          select: {
            id: true,
            entrant: {
              select: {
                id: true,
                name: true,
                grade: true,
                school: {
                  select: { id: true, name: true },
                },
              },
            },
            result: {
              select: {
                score: true,
                releasedAt: true,
              },
            },
            submittedAt: true,
          },
          orderBy: {
            result: {
              score: 'desc',
            },
          },
        },
      },
    });

    if (!round) {
      return res.status(404).json({ error: 'Round not found' });
    }

    if (round.state !== 'results_released') {
      return res.status(403).json({
        error: 'Results not yet released for this round',
      });
    }

    // Format results for external consumption
    const results = round.submissions.map((sub) => ({
      entrantName: sub.entrant.name,
      entrantGrade: sub.entrant.grade,
      schoolName: sub.entrant.school.name,
      score: sub.result.score,
      submittedAt: sub.submittedAt,
      releasedAt: sub.result.releasedAt,
    }));

    res.json({
      roundId: round.id,
      roundName: round.name,
      olympiadName: round.olympiad.name,
      results,
    });
  } catch (err) {
    console.error('External API: Failed to fetch results:', err);
    res.status(500).json({ error: 'Failed to fetch results' });
  }
});

// GET /external/schools — list all schools
router.get('/schools', async (req, res) => {
  try {
    const schools = await prisma.school.findMany({
      select: {
        id: true,
        name: true,
        timezone: true,
      },
      orderBy: { name: 'asc' },
    });

    res.json(schools);
  } catch (err) {
    console.error('External API: Failed to list schools:', err);
    res.status(500).json({ error: 'Failed to fetch schools' });
  }
});

module.exports = router;
