const express = require('express');
const prisma = require('../lib/prisma');
const { requireRole } = require('../middleware/auth');
const { sendSubmissionReceipt } = require('../lib/email');

const router = express.Router();

// POST /rounds/:id/submissions
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

  try {
    const submission = await prisma.submission.create({
      data: { roundId, entrantId, answers, idempotencyKey },
    });

    // Automark immediately if this round's paper has a memo answer key.
    // Otherwise, queue it for manual marking.
    let result = null;
    let markingTask = null;

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
    } else {
      markingTask = await prisma.markingTask.create({
        data: {
          submissionId: submission.id,
        },
      });
    }

    res.status(201).json({ submission, result, markingTask });

    // requireRole() already loaded the requester's DB record onto req.user
    const requester = req.user;
    const entrant = await prisma.entrant.findUnique({ where: { id: entrantId } });

    if (requester) {
      sendSubmissionReceipt({
        toEmail: requester.email,
        entrantName: entrant ? entrant.name : 'Unknown entrant',
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
