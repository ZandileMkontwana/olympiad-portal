const express = require('express');
const prisma = require('../lib/prisma');
const { requireRole } = require('../middleware/auth');
const {
  advanceQualifiedEntrantsForRound,
  AUTO_ADVANCE_ROUND_INCLUDE,
} = require('../lib/qualification');

const router = express.Router();

// GET /api/remark/queue
// Lists remark requests an organiser owns or has been assigned to review. It
// defaults to pending requests, except for ?assignedTo=me which defaults to
// the caller's assigned work. Pass ?status=all to include resolved appeals.
router.get('/remark/queue', ...requireRole('organiser'), async (req, res) => {
  try {
    const { status, assignedTo } = req.query;
    const selectedStatus = status || (assignedTo === 'me' ? 'assigned' : 'pending');
    const where = {
      ...(selectedStatus === 'all' ? {} : { status: selectedStatus }),
      OR: [
        {
          submission: {
            round: {
              olympiad: { organiserId: req.user.id },
            },
          },
        },
        { assignedToId: req.user.id },
      ],
    };

    if (assignedTo === 'me') {
      where.assignedToId = req.user.id;
    }

    const remarkRequests = await prisma.remarkRequest.findMany({
      where,
      include: {
        submission: {
          include: {
            entrant: true,
            round: true,
            result: true,
            markingTask: true,
          },
        },
        requestedBy: { select: { id: true, name: true, email: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
        reviewedBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    res.json(remarkRequests);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch remark queue' });
  }
});

// PATCH /api/remark/:id/assign
// Routes a pending appeal to an organiser reviewer. Only the organiser who
// owns the appeal's olympiad may route it. Omitting assignedToId assigns the
// owner as reviewer.
router.patch('/remark/:id/assign', ...requireRole('organiser'), async (req, res) => {
  try {
    const remarkRequest = await prisma.remarkRequest.findUnique({
      where: { id: req.params.id },
      include: {
        submission: {
          select: {
            round: { select: { olympiad: { select: { organiserId: true } } } },
          },
        },
      },
    });

    if (!remarkRequest) {
      return res.status(404).json({ error: 'Remark request not found' });
    }

    if (remarkRequest.submission.round.olympiad.organiserId !== req.user.id) {
      return res.status(404).json({ error: 'Remark request not found' });
    }

    if (remarkRequest.status !== 'pending') {
      return res.status(409).json({
        error: `Remark request cannot be assigned - current status is '${remarkRequest.status}'`,
      });
    }

    const assignedToId = req.body.assignedToId || req.user.id;
    const reviewer =
      assignedToId === req.user.id
        ? req.user
        : await prisma.user.findUnique({ where: { id: assignedToId } });

    if (!reviewer) {
      return res.status(400).json({ error: 'assignedToId does not match a known user' });
    }

    if (reviewer.role !== 'organiser') {
      return res.status(400).json({ error: 'assignedToId must identify an organiser reviewer' });
    }

    const assignment = await prisma.remarkRequest.updateMany({
      where: {
        id: req.params.id,
        status: 'pending',
      },
      data: {
        assignedToId,
        status: 'assigned',
      },
    });

    if (assignment.count === 0) {
      return res.status(409).json({ error: 'Remark request changed before it could be assigned' });
    }

    const updated = await prisma.remarkRequest.findUnique({
      where: { id: req.params.id },
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
      },
    });

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not assign remark request' });
  }
});

// PATCH /api/remark/:id/review
// The assigned organiser approves or rejects an assigned remark request.
router.patch('/remark/:id/review', ...requireRole('organiser'), async (req, res) => {
  const { status, newScore, reviewNotes } = req.body;

  if (status !== 'approved' && status !== 'rejected') {
    return res.status(400).json({ error: "status must be 'approved' or 'rejected'" });
  }

  // Scores are percentages (0-100); anything else would poison the live
  // standings, qualification gates and certificate PDFs it feeds.
  if (status === 'approved' && (!Number.isFinite(newScore) || newScore < 0 || newScore > 100)) {
    return res
      .status(400)
      .json({ error: 'newScore must be a number between 0 and 100 when approving' });
  }

  try {
    const remarkRequest = await prisma.remarkRequest.findUnique({
      where: { id: req.params.id },
      include: {
        submission: { select: { roundId: true } },
      },
    });

    if (!remarkRequest) {
      return res.status(404).json({ error: 'Remark request not found' });
    }

    if (remarkRequest.status !== 'assigned') {
      return res.status(409).json({
        error: `Remark request cannot be reviewed - current status is '${remarkRequest.status}', expected 'assigned'`,
      });
    }

    if (remarkRequest.assignedToId !== req.user.id) {
      return res.status(403).json({ error: 'Remark request is assigned to a different reviewer' });
    }

    const reviewedAt = new Date();
    const updated = await prisma.$transaction(async (tx) => {
      const review = await tx.remarkRequest.updateMany({
        where: {
          id: req.params.id,
          status: 'assigned',
          assignedToId: req.user.id,
        },
        data: {
          status,
          newScore: status === 'approved' ? newScore : undefined,
          reviewNotes,
          reviewedById: req.user.id,
          reviewedAt,
        },
      });

      if (review.count === 0) {
        return null;
      }

      if (status === 'approved') {
        // Result.score is the canonical source for live standings, on-demand
        // certificate PDFs, and every qualification gate. The decision is
        // wired straight into it; the update omits releasedAt so an appeal
        // resolved after publication amends the released score in place
        // instead of unpublishing it (see documents/docs/appeal-workflow.md).
        await tx.result.upsert({
          where: { submissionId: remarkRequest.submissionId },
          update: { score: newScore },
          create: {
            submissionId: remarkRequest.submissionId,
            score: newScore,
          },
        });

        // Re-run qualification for the revised score immediately, inside the
        // same transaction: the shared pass registers anyone who now meets
        // the threshold and stamps autoAdvanceProcessedAt. Doing it here —
        // rather than clearing the marker for the next scheduler tick —
        // closes the race where a concurrent tick could re-stamp the marker
        // after the clear and silently swallow the re-trigger. The pass is
        // idempotent (skipDuplicates), so a concurrent tick processing the
        // same round cannot double-register anyone.
        const round = await tx.round.findUnique({
          where: { id: remarkRequest.submission.roundId },
          include: AUTO_ADVANCE_ROUND_INCLUDE,
        });
        if (round) {
          await advanceQualifiedEntrantsForRound(round, tx);
        }
      }

      return tx.remarkRequest.findUnique({ where: { id: req.params.id } });
    });

    if (!updated) {
      return res.status(409).json({ error: 'Remark request changed before it could be reviewed' });
    }

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not review remark request' });
  }
});

module.exports = router;
