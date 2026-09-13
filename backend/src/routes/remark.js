const express = require('express');
const prisma = require('../lib/prisma');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

// PATCH /api/remark/:id/review
// An organiser approves or rejects a pending remark request.
// - On approval, `newScore` is required and is written to the submission's
//   Result (creating one if it didn't exist yet, e.g. for a submission that
//   was manually marked via MarkingTask rather than automarked).
// - On rejection, no score changes are made.
router.patch('/remark/:id/review', ...requireRole('organiser'), async (req, res) => {
  const { status, newScore, reviewNotes } = req.body;

  if (status !== 'approved' && status !== 'rejected') {
    return res.status(400).json({ error: "status must be 'approved' or 'rejected'" });
  }

  if (status === 'approved' && typeof newScore !== 'number') {
    return res.status(400).json({ error: 'newScore (number) is required when approving' });
  }

  try {
    const remarkRequest = await prisma.remarkRequest.findUnique({ where: { id: req.params.id } });
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
        create: { submissionId: remarkRequest.submissionId, score: newScore },
      });
    }

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not review remark request' });
  }
});

module.exports = router;
