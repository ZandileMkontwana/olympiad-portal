const express = require('express');
const prisma = require('../lib/prisma');
const { requireRole } = require('../middleware/auth');
const { runAllSignals } = require('../cheating/signals');

const router = express.Router();

// GET /rounds/:id/signals
// Runs cheating signal detection algorithms for a round. Organiser only.
// Returns an array of flags sorted by severity (high → medium → low).
router.get('/rounds/:id/signals', ...requireRole('organiser'), async (req, res) => {
  try {
    const roundId = req.params.id;

    // Load the round for its time window
    const round = await prisma.round.findUnique({
      where: { id: roundId },
      select: { id: true, openTime: true, closeTime: true },
    });
    if (!round) {
      return res.status(404).json({ error: 'Round not found' });
    }

    // Load sittings with their timing data
    const sittings = await prisma.sitting.findMany({
      where: { roundId, completedAt: { not: null } },
      select: {
        entrantId: true,
        startedAt: true,
        completedAt: true,
      },
    });

    // Load submissions with their answer data
    const submissions = await prisma.submission.findMany({
      where: { roundId },
      select: {
        entrantId: true,
        answers: true,
        submittedAt: true,
      },
    });

    // Load the memo answer key (if the paper has one)
    const paper = await prisma.paper.findUnique({
      where: { roundId },
      select: { memoAnswers: true },
    });

    // Map sittings to the format the signals expect.
    // Use completedAt as the submission time (it's when the sitting was finalised).
    const sittingData = sittings.map((s) => ({
      entrantId: s.entrantId,
      startedAt: s.startedAt.toISOString(),
      submittedAt: s.completedAt.toISOString(),
    }));

    // Map submissions to include submittedAt for clustering
    const submissionData = submissions.map((s) => ({
      entrantId: s.entrantId,
      answers: s.answers,
      submittedAt: s.submittedAt.toISOString(),
    }));

    const flags = runAllSignals({
      sittings: sittingData,
      submissions: submissionData,
      roundWindow: {
        openTime: round.openTime.toISOString(),
        closeTime: round.closeTime.toISOString(),
      },
      memoAnswers: paper?.memoAnswers || null,
    });

    // Enrich flags with entrant names for the UI
    const entrantIds = [...new Set(flags.flatMap((f) => f.entrantIds))];
    const entrants = await prisma.entrant.findMany({
      where: { id: { in: entrantIds } },
      select: { id: true, name: true, grade: true },
    });
    const entrantMap = Object.fromEntries(entrants.map((e) => [e.id, e]));

    const enriched = flags.map((f) => ({
      ...f,
      entrants: f.entrantIds.map((id) => entrantMap[id] || { id, name: 'Unknown' }),
    }));

    res.json({ round: { id: round.id }, flags: enriched });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not compute cheating signals' });
  }
});

module.exports = router;
