const express = require('express');
const prisma = require('../lib/prisma');
const { requireRole } = require('../middleware/auth');
const { hasQualifiedForRound } = require('../lib/qualification');

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
// Lists all open rounds with sitting status and prerequisite gating info.
// For each open round:
//   - If the round has a prerequisite, checks whether the student passed
//     (result score >= qualifyingThreshold in the prerequisite round).
//   - Locked rounds are returned with locked=true and a human-readable
//     lockedReason so the UI can show the unlock criteria.
//   - Only unlocked rounds get lazy-registered and get a sitting lookup.
router.get('/students/me/rounds', ...requireRole('student'), async (req, res) => {
  try {
    const entrant = await loadEntrant(req, res);
    if (!entrant) return;

    // Fetch open rounds with prerequisite chain info
    const openRounds = await prisma.round.findMany({
      where: { state: 'open' },
      select: {
        id: true,
        name: true,
        state: true,
        closeTime: true,
        qualifyingThreshold: true,
        prerequisiteRoundId: true,
        prerequisiteRound: { select: { id: true, name: true } },
      },
      orderBy: { openTime: 'desc' },
    });

    const roundsWithStatus = await Promise.all(
      openRounds.map(async (round) => {
        let locked = false;
        let lockedReason = null;

        // Prerequisite gate: a student who has not met this round's
        // requirements stays locked out of it; the unlock criteria are
        // surfaced in lockedReason.
        if (!(await hasQualifiedForRound(entrant.id, round))) {
          locked = true;
          lockedReason = round.qualifyingThreshold
            ? `Score at least ${round.qualifyingThreshold}% in ${round.prerequisiteRound.name} to unlock`
            : `Complete ${round.prerequisiteRound.name} first`;
        }

        // Only lazy-register and look up sitting for unlocked rounds.
        // Locked rounds stay visible in the UI but are not accessible.
        let sitting = null;
        if (!locked) {
          await prisma.roundEntrant.upsert({
            where: { roundId_entrantId: { roundId: round.id, entrantId: entrant.id } },
            create: { roundId: round.id, entrantId: entrant.id },
            update: {},
          });

          sitting = await prisma.sitting.findFirst({
            where: { roundId: round.id, entrantId: entrant.id },
            select: { id: true, completedAt: true, startedAt: true, expiresAt: true },
          });
        }

        // Strip internal gating fields before returning to the client
        const {
          qualifyingThreshold: _qt,
          prerequisiteRoundId: _pid,
          prerequisiteRound: _pr,
          ...roundInfo
        } = round;

        return { round: roundInfo, sitting, locked, lockedReason };
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
