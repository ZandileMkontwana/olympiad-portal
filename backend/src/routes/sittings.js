const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');
const { hasQualifiedForRound, prerequisiteFailureMessage } = require('../lib/qualification');
const { getDbNow } = require('../lib/dbTime');
const { TRANSACTION_OPTIONS } = require('../lib/transactionOptions');
const { isDbBusyError, respondDbBusy } = require('../lib/dbErrors');

const router = express.Router();

// POST /rounds/:id/sittings
// Starts (or resumes) an online sitting for an entrant in an open round.
// Authenticated users only — the entrant must be registered in the round.
// If the round has a prerequisite, the entrant must have passed it first.
router.post('/rounds/:id/sittings', requireAuth, async (req, res) => {
  try {
    const roundId = req.params.id;
    const { entrantId } = req.body;

    if (!entrantId) {
      return res.status(400).json({ error: 'entrantId is required' });
    }

    const round = await prisma.round.findUnique({
      where: { id: roundId },
      include: {
        paper: true,
        prerequisiteRound: { select: { id: true, name: true } },
      },
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

    // Prerequisite gate: an entrant who has not met this round's
    // requirements cannot sit it, even if they were registered earlier.
    if (!(await hasQualifiedForRound(entrantId, round))) {
      return res.status(403).json({
        error: `Prerequisite not met: ${prerequisiteFailureMessage(round)}`,
      });
    }

    // Everything from here down runs in a single transaction: the round's
    // state is re-checked immediately next to the writes (instead of
    // relying on the snapshot read above, taken before the prerequisite
    // check's extra DB round-trip), and the two upserts happen atomically
    // together.
    const sitting = await prisma.$transaction(async (tx) => {
      const freshRound = await tx.round.findUnique({ where: { id: roundId } });

      if (!freshRound || freshRound.state !== 'open') {
        const err = new Error(
          `Test cannot be started - round is currently '${freshRound?.state ?? 'unknown'}'`
        );
        err.httpStatus = 403;
        throw err;
      }

      // Ensure the entrant is registered for this round. If not already
      // registered (e.g. the entrant was created before the round opened),
      // create the RoundEntrant record on the fly so the student can start.
      await tx.roundEntrant.upsert({
        where: { roundId_entrantId: { roundId, entrantId } },
        create: { roundId, entrantId },
        update: {},
      });

      // Upsert instead of findUnique + create to avoid a P2002 race when
      // React Strict Mode or a double-click fires two requests in parallel.
      return tx.sitting.upsert({
        where: { roundId_entrantId: { roundId, entrantId } },
        create: { roundId, entrantId, expiresAt: freshRound.closeTime },
        update: {},
      });
    }, TRANSACTION_OPTIONS);

    if (sitting.completedAt) {
      return res.status(403).json({ error: 'Test already completed for this round' });
    }

    // The sitting expires when the round closes (the round's time limit).
    // An in-progress sitting past expiresAt can no longer be resumed.
    // Using the database's own clock avoids app-server clock drift
    // incorrectly allowing/blocking a resume near the boundary.
    if (new Date(sitting.expiresAt) < (await getDbNow())) {
      return res.status(403).json({ error: 'Test expired - it can no longer be resumed' });
    }

    // Question IDs come from the memo answer key — send ONLY the keys,
    // never the answers, so students can't read the answer key.
    const questions = round.paper.memoAnswers ? Object.keys(round.paper.memoAnswers) : [];

    res.json({
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
    if (err.httpStatus) {
      return res.status(err.httpStatus).json({ error: err.message });
    }
    if (isDbBusyError(err)) {
      return respondDbBusy(req, res, err);
    }
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

    if (new Date(sitting.expiresAt) < (await getDbNow())) {
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
    if (isDbBusyError(err)) {
      return respondDbBusy(req, res, err);
    }
    console.error(err);
    res.status(500).json({ error: 'Could not save answers' });
  }
});

// POST /sittings/:id/submit
// Submits the sitting (Story A5): the stored answers become a Submission,
// automarked immediately against the paper's memo answer key when one
// exists, and the sitting is marked completed. The idempotencyKey is
// derived from the sitting ID, so a retried request after a lost response
// returns the existing submission instead of creating a duplicate — and a
// concurrent duplicate that loses the create race (P2002) also returns the
// winner's submission instead of failing.
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

    if (new Date(sitting.expiresAt) < (await getDbNow())) {
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

    // Wrapped in a transaction so the Submission and the sitting's
    // completedAt flip are atomic together. If a concurrent duplicate
    // submit races past the completedAt check above (e.g. a genuine
    // double-click before either request has committed), both requests'
    // idempotencyKey is identical (`sitting:${sitting.id}`), so the
    // database's unique constraint rejects the second one - caught below
    // and turned into the same 200 response the retried-request path
    // already returns, instead of a confusing 500.
    let submission;
    try {
      submission = await prisma.$transaction(async (tx) => {
        const created = await tx.submission.create({
          data: {
            roundId: sitting.roundId,
            entrantId: sitting.entrantId,
            answers,
            idempotencyKey: `sitting:${sitting.id}`,
            result: resultData,
          },
          include: { result: true },
        });

        await tx.sitting.update({
          where: { id: sitting.id },
          data: { completedAt: new Date() },
        });

        return created;
      }, TRANSACTION_OPTIONS);
    } catch (err) {
      if (
        err.code === 'P2002' &&
        err.meta &&
        err.meta.target &&
        err.meta.target.includes('idempotencyKey')
      ) {
        const existing = await prisma.submission.findUnique({
          where: { idempotencyKey: `sitting:${sitting.id}` },
          include: { result: true },
        });
        return res.status(200).json({ submission: existing, result: existing.result });
      }
      throw err;
    }

    res.status(201).json({ submission, result: submission.result });
  } catch (err) {
    if (isDbBusyError(err)) {
      return respondDbBusy(req, res, err);
    }
    // A concurrent duplicate submit can slip past the completedAt check above
    // and lose the create race on the unique idempotencyKey. Treat the P2002
    // as the idempotent retry it is and return the winner's submission.
    if (
      err.code === 'P2002' &&
      err.meta &&
      err.meta.target &&
      err.meta.target.includes('idempotencyKey')
    ) {
      const existing = await prisma.submission.findUnique({
        where: { idempotencyKey: `sitting:${req.params.id}` },
        include: { result: true },
      });

      if (existing) {
        // Guarded so the winner's stamp is never overwritten; also covers the
        // narrow window where the winner created the row but crashed before
        // stamping the sitting.
        await prisma.sitting.updateMany({
          where: { id: req.params.id, completedAt: null },
          data: { completedAt: new Date() },
        });

        return res.status(200).json({ submission: existing, result: existing.result });
      }
    }

    console.error(err);
    res.status(500).json({ error: 'Could not submit the test' });
  }
});

module.exports = router;
