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
    // Everything from here down runs in a single transaction:
    // - The round's state is re-checked immediately before writing, right
    //   next to the create calls, instead of relying on the snapshot read
    //   several awaits ago (educator lookup, entrant lookup, prerequisite
    //   check). That earlier snapshot could be stale by the time we get
    //   here - the scheduler ticks every 30s and could have closed this
    //   round in the meantime.
    // - The Submission and its Result/MarkingTask are created together,
    //   so a crash or error between the two can never leave a Submission
    //   with neither - it either fully commits or fully rolls back.
    const { submission, result, markingTask } = await prisma.$transaction(async (tx) => {
      const freshRound = await tx.round.findUnique({
        where: { id: roundId },
        include: { paper: true },
      });

      if (!freshRound || freshRound.state !== 'open') {
        const err = new Error(
          `Submissions not accepted - round is currently '${freshRound?.state ?? 'unknown'}'`
        );
        err.httpStatus = 403;
        throw err;
      }

      const submission = await tx.submission.create({
        data: { roundId, entrantId, answers, idempotencyKey },
      });

      let result = null;
      let markingTask = null;

      if (freshRound.paper && freshRound.paper.memoAnswers) {
        const memo = freshRound.paper.memoAnswers;
        const totalQuestions = Object.keys(memo).length;
        let correctCount = 0;

        for (const questionId in memo) {
          if (answers[questionId] === memo[questionId]) {
            correctCount++;
          }
        }

        const score = totalQuestions > 0 ? (correctCount / totalQuestions) * 100 : 0;

        result = await tx.result.create({
          data: {
            submissionId: submission.id,
            score,
          },
        });
      } else {
        markingTask = await tx.markingTask.create({
          data: {
            submissionId: submission.id,
          },
        });
      }

      return { submission, result, markingTask };
    });

    res.status(201).json({ submission, result, markingTask });

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
    if (err.httpStatus) {
      return res.status(err.httpStatus).json({ error: err.message });
    }
    if (
      err.code === 'P2002' &&
      err.meta &&
      err.meta.target &&
      err.meta.target.includes('idempotencyKey')
    ) {
      const existing = await prisma.submission.findUnique({
        where: { idempotencyKey },
        include: { result: true, markingTask: true },
      });
      return res
        .status(200)
        .json({ submission: existing, result: existing.result, markingTask: existing.markingTask });
    }
    console.error(err);
    res.status(500).json({ error: 'Could not save submission' });
  }
});

// POST /submissions/:id/remark
// An educator requests a remark on a submission that's already been marked
// (automarked or manually marked), explaining why in `reason`.
router.post('/submissions/:id/remark', ...requireRole('educator'), async (req, res) => {
  const submissionId = req.params.id;
  const { reason } = req.body;

  if (!reason) {
    return res.status(400).json({ error: 'reason is required' });
  }

  try {
    const submission = await prisma.submission.findUnique({ where: { id: submissionId } });
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    const remarkRequest = await prisma.remarkRequest.create({
      data: {
        submissionId,
        requestedById: req.user.id,
        reason,
      },
    });

    res.status(201).json(remarkRequest);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not create remark request' });
  }
});

module.exports = router;
