const express = require('express');
const prisma = require('../lib/prisma');
const { requireRole } = require('../middleware/auth');
const { sendSubmissionReceipt } = require('../lib/email');
const { hasQualifiedForRound, prerequisiteFailureMessage } = require('../lib/qualification');

const router = express.Router();

// POST /rounds/:id/submissions
// Educator-only. Scoped twice: the educator may only submit for an entrant
// at their own school, and the entrant must have met the round's
// requirements (prerequisite round passed at/above the threshold).
router.post('/rounds/:id/submissions', ...requireRole('educator'), async (req, res) => {
  const roundId = req.params.id;
  const { entrantId, answers, idempotencyKey } = req.body;

  if (!entrantId || !answers || !idempotencyKey) {
    return res.status(400).json({ error: 'entrantId, answers, and idempotencyKey are required' });
  }

  const round = await prisma.round.findUnique({
    where: { id: roundId },
    include: { paper: true },
  });

  if (!round) {
    return res.status(404).json({ error: 'Round not found' });
  }

  if (round.state !== 'open') {
    return res.status(403).json({
      error: `Submissions not accepted - round is currently '${round.state}'`,
    });
  }

  // School scoping: a teacher may only submit for learners at their own
  // school — other schools' grades must never pass through them.
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

  // Prerequisite gate: an entrant who has not met this round's requirements
  // cannot have a submission recorded for them, even if the UI is bypassed.
  if (!(await hasQualifiedForRound(entrantId, round))) {
    return res.status(403).json({
      error: `Prerequisite not met: ${prerequisiteFailureMessage(round)}`,
    });
  }

  try {
    const submission = await prisma.submission.create({
      data: { roundId, entrantId, answers, idempotencyKey },
    });

    // Automark immediately if this round's paper has a memo answer key
    let result = null;

    if (round.paper && round.paper.memoAnswers) {
      const memo = round.paper.memoAnswers;
      const totalQuestions = Object.keys(memo).length;
      let correctCount = 0;

      for (const questionId in memo) {
        if (answers[questionId] === memo[questionId]) {
          correctCount++;
        }
      }

      const score = totalQuestions > 0 ? (correctCount / totalQuestions) * 100 : 0;

      result = await prisma.result.create({
        data: {
          submissionId: submission.id,
          score,
        },
      });
    }

    res.status(201).json({ submission, result });

    // requireRole() already loaded the requester's DB record onto req.user;
    // the entrant was resolved and school-checked before the create.
    const requester = req.user;

    if (requester) {
      sendSubmissionReceipt({
        toEmail: requester.email,
        entrantName: entrant.name,
        roundName: round.name,
        submittedAt: submission.submittedAt,
      });
    }
  } catch (err) {
    if (
      err.code === 'P2002' &&
      err.meta &&
      err.meta.target &&
      err.meta.target.includes('idempotencyKey')
    ) {
      const existing = await prisma.submission.findUnique({
        where: { idempotencyKey },
        include: { result: true },
      });
      return res.status(200).json({ submission: existing, result: existing.result });
    }
    console.error(err);
    res.status(500).json({ error: 'Could not save submission' });
  }
});

module.exports = router;
