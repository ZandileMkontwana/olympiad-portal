const express = require('express');
const prisma = require('../lib/prisma');
const { requireRole } = require('../middleware/auth');
const { isOlympiadOrganiser } = require('../lib/authorization');
const { runAllSignals } = require('../cheating/signals');

const router = express.Router();

// GET /api/marking/queue
// Lists marking tasks for organisers to work through. Defaults to showing
// only unassigned tasks; pass ?status=all to see everything, or
// ?status=assigned / ?status=marked / ?status=moderated to filter.
// Each task includes a `signals` array of cheating-signal badges
// (type + severity) computed from the round's submission data.
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

    // Compute cheating-signal badges per task. Collect unique round IDs
    // from the queue, run signals for each round, then map flags back to
    // the entrants they reference.
    const roundIds = [...new Set(tasks.map((t) => t.submission.roundId))];
    const entrantSignals = {}; // entrantId → [{ type, severity }]

    for (const roundId of roundIds) {
      const [round, sittings, submissions, paper] = await Promise.all([
        prisma.round.findUnique({
          where: { id: roundId },
          select: { openTime: true, closeTime: true },
        }),
        prisma.sitting.findMany({
          where: { roundId, completedAt: { not: null } },
          select: { entrantId: true, startedAt: true, completedAt: true },
        }),
        prisma.submission.findMany({
          where: { roundId },
          select: { entrantId: true, answers: true, submittedAt: true },
        }),
        prisma.paper.findUnique({
          where: { roundId },
          select: { memoAnswers: true },
        }),
      ]);

      if (!round || sittings.length === 0) continue;

      const flags = runAllSignals({
        sittings: sittings.map((s) => ({
          entrantId: s.entrantId,
          startedAt: s.startedAt.toISOString(),
          submittedAt: s.completedAt.toISOString(),
        })),
        submissions: submissions.map((s) => ({
          entrantId: s.entrantId,
          answers: s.answers,
          submittedAt: s.submittedAt.toISOString(),
        })),
        roundWindow: {
          openTime: round.openTime.toISOString(),
          closeTime: round.closeTime.toISOString(),
        },
        memoAnswers: paper?.memoAnswers || null,
      });

      for (const flag of flags) {
        for (const eid of flag.entrantIds) {
          if (!entrantSignals[eid]) entrantSignals[eid] = [];
          // Avoid duplicate badges (same type + severity)
          const dup = entrantSignals[eid].some(
            (s) => s.type === flag.type && s.severity === flag.severity
          );
          if (!dup) {
            entrantSignals[eid].push({ type: flag.type, severity: flag.severity });
          }
        }
      }
    }

    // Attach signals to each task
    const enriched = tasks.map((t) => ({
      ...t,
      signals: entrantSignals[t.submission.entrantId] || [],
    }));

    res.json(enriched);
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
      include: { submission: { select: { round: { select: { olympiadId: true } } } } },
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
