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

// GET /students/me/rounds
// Lists open rounds the student is registered for (via RoundEntrant),
// with an optional sitting record if they've already started the test.
router.get('/students/me/rounds', ...requireRole('student'), async (req, res) => {
  try {
    const entrant = await loadEntrant(req, res);
    if (!entrant) return;

    const registrations = await prisma.roundEntrant.findMany({
      where: {
        entrantId: entrant.id,
        round: { state: 'open' },
      },
      include: {
        round: {
          select: { id: true, name: true, state: true, closeTime: true },
        },
      },
      orderBy: { registeredAt: 'desc' },
    });

    // For each open round, check if the student already has a sitting
    const roundsWithStatus = await Promise.all(
      registrations.map(async (reg) => {
        const sitting = await prisma.sitting.findFirst({
          where: { roundId: reg.round.id, entrantId: entrant.id },
          select: { id: true, completedAt: true, startedAt: true, expiresAt: true },
        });
        return { round: reg.round, sitting };
      })
    );

    res.json(roundsWithStatus);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not fetch rounds' });
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

// GET /students/me/results/:resultId
// Full review of one released result: the student's answer next to the
// correct answer for every question. Only released results are viewable,
// and only by the student who owns them — findFirst scopes on entrantId.
router.get('/students/me/results/:resultId', ...requireRole('student'), async (req, res) => {
  try {
    const entrant = await loadEntrant(req, res);
    if (!entrant) return;

    const submission = await prisma.submission.findFirst({
      where: {
        entrantId: entrant.id,
        result: { id: req.params.resultId, releasedAt: { not: null } },
      },
      include: {
        round: { select: { id: true, name: true } },
        result: true,
      },
    });

    if (!submission) {
      return res.status(404).json({ error: 'Result not found or not released yet' });
    }

    const paper = await prisma.paper.findUnique({
      where: { roundId: submission.roundId },
      select: { fileUrl: true, memoAnswers: true },
    });

    const memo = paper && paper.memoAnswers ? paper.memoAnswers : {};
    const answers = submission.answers || {};
    const questions = Object.keys(memo)
      .sort((a, b) => Number(a) - Number(b))
      .map((questionId) => ({
        questionId,
        correctAnswer: memo[questionId],
        studentAnswer: answers[questionId] ?? null,
        isCorrect: answers[questionId] === memo[questionId],
      }));

    res.json({
      id: submission.result.id,
      score: submission.result.score,
      submittedAt: submission.submittedAt,
      releasedAt: submission.result.releasedAt,
      round: submission.round,
      paperFileUrl: paper ? paper.fileUrl : null,
      questions,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not fetch result' });
  }
});

module.exports = router;
