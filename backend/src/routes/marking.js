const express = require('express');
const prisma = require('../lib/prisma');
const activityBus = require('../lib/activityBus');
const { requireRole } = require('../middleware/auth');
const { isOlympiadOrganiser } = require('../lib/authorization');

const router = express.Router();

// GET /api/marking/queue
// Lists marking tasks for organisers to work through. Defaults to showing
// only unassigned tasks; pass ?status=all to see everything, or
// ?status=assigned / ?status=marked / ?status=moderated to filter.
router.get('/marking/queue', ...requireRole('organiser'), async (req, res) => {
  try {
    const { status } = req.query;
    const where =
      !status || status === 'unassigned'
        ? { status: 'unassigned' }
        : status === 'all'
          ? {}
          : { status };

    // Scope to marking tasks for olympiads the caller organises.
    const organiserRows = await prisma.olympiadOrganiser.findMany({
      where: { organiserId: req.user.id },
      select: { olympiadId: true },
    });
    const organisedOlympiadIds = organiserRows.map((r) => r.olympiadId);

    const tasks = await prisma.markingTask.findMany({
      where: {
        ...where,
        submission: {
          round: {
            olympiadId: { in: organisedOlympiadIds },
          },
        },
      },
      include: {
        submission: {
          include: {
            entrant: true,
            round: true,
          },
        },
        assignedTo: { select: { id: true, name: true, email: true } },
        moderatedBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    res.json(tasks);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch marking queue' });
  }
});

// PATCH /api/marking/:id/assign
// Assigns a marking task to an organiser. If no assignedToId is given in
// the body, the task is assigned to the requester themselves.
router.patch('/marking/:id/assign', ...requireRole('organiser'), async (req, res) => {
  try {
    const task = await prisma.markingTask.findUnique({
      where: { id: req.params.id },
      include: { submission: { select: { round: { select: { olympiadId: true } } } } },
    });
    if (!task) {
      return res.status(404).json({ error: 'Marking task not found' });
    }

    // Only organisers of this specific olympiad may assign marking tasks.
    const olympiadId = task.submission.round.olympiadId;
    if (!(await isOlympiadOrganiser(req.user.id, olympiadId))) {
      return res.status(403).json({ error: 'You are not an organiser of this olympiad' });
    }

    const assignedToId = req.body.assignedToId || req.user.id;

    const assignee = await prisma.user.findUnique({ where: { id: assignedToId } });
    if (!assignee) {
      return res.status(400).json({ error: 'assignedToId does not match a known user' });
    }

    const updated = await prisma.markingTask.update({
      where: { id: req.params.id },
      data: { assignedToId, status: 'assigned' },
    });

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to assign marking task' });
  }
});

// PATCH /api/marking/:id
// Records the marker's score for a task, with optional per-question
// breakdown for partial credit.
router.patch('/marking/:id', ...requireRole('organiser'), async (req, res) => {
  try {
    const { score, breakdown } = req.body;

    if (typeof score !== 'number') {
      return res.status(400).json({ error: 'score (number) is required' });
    }

    const task = await prisma.markingTask.findUnique({
      where: { id: req.params.id },
      include: {
        submission: {
          select: {
            round: { select: { olympiadId: true } },
            entrant: { select: { name: true } },
          },
        },
      },
    });
    if (!task) {
      return res.status(404).json({ error: 'Marking task not found' });
    }

    // Only organisers of this specific olympiad may record marking.
    const olympiadId = task.submission.round.olympiadId;
    if (!(await isOlympiadOrganiser(req.user.id, olympiadId))) {
      return res.status(403).json({ error: 'You are not an organiser of this olympiad' });
    }

    const updated = await prisma.markingTask.update({
      where: { id: req.params.id },
      data: {
        score,
        breakdown: breakdown || undefined,
        status: 'marked',
        markedAt: new Date(),
      },
    });

    // Live activity feed (US-4.1): manual marking was recorded.
    activityBus.broadcast({
      type: 'marking_completed',
      message: `Marking completed for ${task.submission.entrant.name}`,
      olympiadId,
    });

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to record marking' });
  }
});

// PATCH /api/marking/:id/moderate
// Records a moderator's reviewed score, separate from the original
// marker's score, and marks the task as moderated.
router.patch('/marking/:id/moderate', ...requireRole('organiser'), async (req, res) => {
  try {
    const { moderatedScore } = req.body;

    if (typeof moderatedScore !== 'number') {
      return res.status(400).json({ error: 'moderatedScore (number) is required' });
    }

    const task = await prisma.markingTask.findUnique({
      where: { id: req.params.id },
      include: { submission: { select: { round: { select: { olympiadId: true } } } } },
    });
    if (!task) {
      return res.status(404).json({ error: 'Marking task not found' });
    }

    // Only organisers of this specific olympiad may moderate marking.
    const olympiadId = task.submission.round.olympiadId;
    if (!(await isOlympiadOrganiser(req.user.id, olympiadId))) {
      return res.status(403).json({ error: 'You are not an organiser of this olympiad' });
    }

    if (task.status !== 'marked') {
      return res.status(403).json({
        error: `Task cannot be moderated - current status is '${task.status}', expected 'marked'`,
      });
    }

    const updated = await prisma.markingTask.update({
      where: { id: req.params.id },
      data: {
        moderatedScore,
        moderatedById: req.user.id,
        moderatedAt: new Date(),
        status: 'moderated',
      },
    });

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to moderate marking task' });
  }
});

module.exports = router;
