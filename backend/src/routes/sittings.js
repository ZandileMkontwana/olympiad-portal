const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// POST /rounds/:id/sittings
// Starts (or resumes) an online sitting for an entrant in an open round.
// Authenticated users only — the entrant must be registered in the round.
router.post('/rounds/:id/sittings', requireAuth, async (req, res) => {
  try {
    const roundId = req.params.id;
    const { entrantId } = req.body;

    if (!entrantId) {
      return res.status(400).json({ error: 'entrantId is required' });
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
        error: `Test cannot be started - round is currently '${round.state}'`,
      });
    }

    if (!round.paper) {
      return res.status(404).json({ error: 'No paper uploaded for this round yet' });
    }

    // Ensure the entrant is registered for this round. If not already
    // registered (e.g. the entrant was created before the round opened),
    // create the RoundEntrant record on the fly so the student can start.
    await prisma.roundEntrant.upsert({
      where: { roundId_entrantId: { roundId, entrantId } },
      create: { roundId, entrantId },
      update: {},
    });

    const existing = await prisma.sitting.findUnique({
      where: { roundId_entrantId: { roundId, entrantId } },
    });

    if (existing && existing.completedAt) {
      return res.status(403).json({ error: 'Test already completed for this round' });
    }

    // The sitting expires when the round closes (the round's time limit).
    // An in-progress sitting past expiresAt can no longer be resumed.
    if (existing && new Date(existing.expiresAt) < new Date()) {
      return res.status(403).json({ error: 'Test expired - it can no longer be resumed' });
    }

    const sitting =
      existing ||
      (await prisma.sitting.create({
        data: { roundId, entrantId, expiresAt: round.closeTime },
      }));

    // Question IDs come from the memo answer key — send ONLY the keys,
    // never the answers, so students can't read the answer key.
    const questions = round.paper.memoAnswers ? Object.keys(round.paper.memoAnswers) : [];

    res.status(existing ? 200 : 201).json({
      sitting: {
        id: sitting.id,
        entrantId: sitting.entrantId,
        roundId: sitting.roundId,
        answers: sitting.answers,
        startedAt: sitting.startedAt,
        expiresAt: sitting.expiresAt,
        completedAt: sitting.completedAt,
      },
      round: {
        id: round.id,
        name: round.name,
        closeTime: round.closeTime,
      },
      paper: {
        fileUrl: round.paper.fileUrl,
        questions,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not start the test' });
  }
});

// PATCH /sittings/:id/answers
// Auto-save (Story A3): merges partial answers into the sitting's stored
// answers, so a refresh or disconnect never loses progress.
// Completed or expired sittings can no longer be updated.
router.patch('/sittings/:id/answers', requireAuth, async (req, res) => {
  try {
    const { answers } = req.body;

    if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
      return res.status(400).json({ error: 'answers must be an object' });
    }

    const sitting = await prisma.sitting.findUnique({
      where: { id: req.params.id },
    });

    if (!sitting) {
      return res.status(404).json({ error: 'Test not found' });
    }

    if (sitting.completedAt) {
      return res.status(403).json({ error: 'Test already completed' });
    }

    if (new Date(sitting.expiresAt) < new Date()) {
      return res.status(403).json({ error: 'Test expired - answers can no longer be saved' });
    }

    const updated = await prisma.sitting.update({
      where: { id: sitting.id },
      data: {
        answers: { ...(sitting.answers || {}), ...answers },
      },
    });

    res.json({
      sitting: {
        id: updated.id,
        entrantId: updated.entrantId,
        roundId: updated.roundId,
        answers: updated.answers,
        startedAt: updated.startedAt,
        expiresAt: updated.expiresAt,
        completedAt: updated.completedAt,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not save answers' });
  }
});

// POST /sittings/:id/submit
// Submits the sitting (Story A5): the stored answers become a Submission,
// automarked immediately against the paper's memo answer key when one
// exists, and the sitting is marked completed. The idempotencyKey is
// derived from the sitting ID, so a retried request after a lost response
// returns the existing submission instead of creating a duplicate.
router.post('/sittings/:id/submit', requireAuth, async (req, res) => {
  try {
    const sitting = await prisma.sitting.findUnique({
      where: { id: req.params.id },
      include: { round: { include: { paper: true } } },
    });

    if (!sitting) {
      return res.status(404).json({ error: 'Test not found' });
    }

    if (sitting.completedAt) {
      const existing = await prisma.submission.findUnique({
        where: { idempotencyKey: `sitting:${sitting.id}` },
        include: { result: true },
      });
      if (existing) {
        return res.status(200).json({ submission: existing, result: existing.result });
      }
      return res.status(403).json({ error: 'Test already completed' });
    }

    if (new Date(sitting.expiresAt) < new Date()) {
      return res.status(403).json({ error: 'Test expired - it can no longer be submitted' });
    }

    const answers = sitting.answers || {};

    // Automark immediately if the round's paper has a memo answer key
    let resultData = null;

    if (sitting.round.paper && sitting.round.paper.memoAnswers) {
      const memo = sitting.round.paper.memoAnswers;
      const totalQuestions = Object.keys(memo).length;
      let correctCount = 0;

      for (const questionId in memo) {
        if (answers[questionId] === memo[questionId]) {
          correctCount++;
        }
      }

      const score = totalQuestions > 0 ? (correctCount / totalQuestions) * 100 : 0;
      resultData = { create: { score } };
    }

    const submission = await prisma.submission.create({
      data: {
        roundId: sitting.roundId,
        entrantId: sitting.entrantId,
        answers,
        idempotencyKey: `sitting:${sitting.id}`,
        result: resultData,
      },
      include: { result: true },
    });

    await prisma.sitting.update({
      where: { id: sitting.id },
      data: { completedAt: new Date() },
    });

    res.status(201).json({ submission, result: submission.result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not submit the test' });
  }
});

module.exports = router;
