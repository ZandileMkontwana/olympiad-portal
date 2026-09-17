const express = require('express');
const prisma = require('../lib/prisma');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

// POST /api/submissions/:id/remark
// Create a new remark request for a submission.
router.post('/submissions/:id/remark', ...requireRole('educator'), async (req, res) => {
  const { reason } = req.body;

  if (!reason || !reason.trim()) {
    return res.status(400).json({ error: 'reason is required' });
  }

  try {
    const submission = await prisma.submission.findUnique({
      where: { id: req.params.id },
      include: {
        result: true,
      },
    });

    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    if (!submission.result) {
      return res.status(400).json({
        error: 'Cannot request a remark for a submission that has not been marked',
      });
    }

    const existingPending = await prisma.remarkRequest.findFirst({
      where: {
        submissionId: req.params.id,
        status: 'pending',
      },
    });

    if (existingPending) {
      return res.status(409).json({
        error: 'A remark request is already pending for this submission',
      });
    }

    const remarkRequest = await prisma.remarkRequest.create({
      data: {
        submissionId: req.params.id,
        requestedById: req.user.id,
        reason: reason.trim(),
      },
    });

    res.status(201).json(remarkRequest);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not create remark request' });
  }
});

// GET /api/remark/queue
// Lists remark requests for organisers to review. Defaults to showing only
// pending requests; pass ?status=all to see everything, or
// ?status=approved / ?status=rejected to filter.
router.get('/remark/queue', ...requireRole('organiser'), async (req, res) => {
  try {
    const { status } = req.query;
    const where =
      !status || status === 'pending' ? { status: 'pending' } : status === 'all' ? {} : { status };

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

// PATCH /api/remark/:id/review
// An organiser approves or rejects a pending remark request.
router.patch('/remark/:id/review', ...requireRole('organiser'), async (req, res) => {
  const { status, newScore, reviewNotes } = req.body;

  if (status !== 'approved' && status !== 'rejected') {
    return res.status(400).json({ error: "status must be 'approved' or 'rejected'" });
  }

  if (status === 'approved' && typeof newScore !== 'number') {
    return res.status(400).json({ error: 'newScore (number) is required when approving' });
  }

  try {
    const remarkRequest = await prisma.remarkRequest.findUnique({
      where: { id: req.params.id },
    });

    if (!remarkRequest) {
      return res.status(404).json({ error: 'Remark request not found' });
    }

    if (remarkRequest.status !== 'pending') {
      return res.status(403).json({
        error: `Remark request cannot be reviewed - current status is '${remarkRequest.status}', expected 'pending'`,
      });
    }

    const updated = await prisma.remarkRequest.update({
      where: { id: req.params.id },
      data: {
        status,
        newScore: status === 'approved' ? newScore : undefined,
        reviewNotes,
        reviewedById: req.user.id,
        reviewedAt: new Date(),
      },
    });

    if (status === 'approved') {
      await prisma.result.upsert({
        where: { submissionId: remarkRequest.submissionId },
        update: { score: newScore },
        create: {
          submissionId: remarkRequest.submissionId,
          score: newScore,
        },
      });
    }

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not review remark request' });
  }
});

module.exports = router;
