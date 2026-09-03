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
        error: `Sitting cannot be started - round is currently '${round.state}'`,
      });
    }

    if (!round.paper) {
      return res.status(404).json({ error: 'No paper uploaded for this round yet' });
    }

    const registration = await prisma.roundEntrant.findUnique({
      where: { roundId_entrantId: { roundId, entrantId } },
    });

    if (!registration) {
      return res.status(403).json({ error: 'Entrant is not registered for this round' });
    }

    const existing = await prisma.sitting.findUnique({
      where: { roundId_entrantId: { roundId, entrantId } },
    });

    if (existing && existing.completedAt) {
      return res.status(403).json({ error: 'Sitting already completed for this round' });
    }

    // The sitting expires when the round closes (the round's time limit).
    // An in-progress sitting past expiresAt can no longer be resumed.
    if (existing && new Date(existing.expiresAt) < new Date()) {
      return res.status(403).json({ error: 'Sitting expired - it can no longer be resumed' });
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
    res.status(500).json({ error: 'Could not start sitting' });
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
      return res.status(404).json({ error: 'Sitting not found' });
    }

    if (sitting.completedAt) {
      return res.status(403).json({ error: 'Sitting already completed' });
    }

    if (new Date(sitting.expiresAt) < new Date()) {
      return res.status(403).json({ error: 'Sitting expired - answers can no longer be saved' });
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

module.exports = router;
