const express = require('express');
const prisma = require('../lib/prisma');
const { requireRole } = require('../middleware/auth');
const {
  getRecipientsForRound,
  isTriggerEnabled,
  roundIncludeForNotifications,
  roundIncludeForMissingSubmissions,
} = require('../scheduler');
const {
  buildRoundOpeningMessage,
  buildRoundClosingMessage,
  buildResultsReleasedMessage,
  buildMissingSubmissionMessage,
} = require('../lib/email');

const router = express.Router();

const NOTIFICATION_TRIGGER_TYPES = [
  'before_open',
  'before_close',
  'missing_submission',
  'results_released',
];
const NOTIFICATION_RECIPIENT_ROLES = ['educator', 'organiser', 'all'];

router.post('/olympiads', async (req, res) => {
  try {
    const { name, timezone } = req.body;
    if (!name || !timezone) {
      return res.status(400).json({ error: 'name and timezone are required' });
    }
    const olympiad = await prisma.olympiad.create({ data: { name, timezone } });
    res.status(201).json(olympiad);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create olympiad' });
  }
});

router.get('/olympiads', async (req, res) => {
  try {
    const olympiads = await prisma.olympiad.findMany({
      include: {
        rounds: {
          orderBy: { openTime: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });
    res.json(olympiads);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch olympiads' });
  }
});

router.post('/rounds', async (req, res) => {
  try {
    const { olympiadId, name, openTime, closeTime } = req.body;
    if (!olympiadId || !name || !openTime || !closeTime) {
      return res
        .status(400)
        .json({ error: 'olympiadId, name, openTime, and closeTime are required' });
    }
    if (new Date(closeTime) <= new Date(openTime)) {
      return res.status(400).json({ error: 'closeTime must be after openTime' });
    }
    const round = await prisma.round.create({
      data: { olympiadId, name, openTime: new Date(openTime), closeTime: new Date(closeTime) },
    });
    res.status(201).json(round);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create round' });
  }
});

router.get('/rounds', async (req, res) => {
  try {
    const rounds = await prisma.round.findMany({
      include: { olympiad: true },
      orderBy: { openTime: 'asc' },
    });
    res.json(rounds);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch rounds' });
  }
});

router.get('/rounds/:id', async (req, res) => {
  try {
    const round = await prisma.round.findUnique({ where: { id: req.params.id } });
    if (!round) return res.status(404).json({ error: 'Round not found' });
    res.json(round);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch round' });
  }
});

router.get('/olympiads/:id/rounds', async (req, res) => {
  try {
    const rounds = await prisma.round.findMany({
      where: { olympiadId: req.params.id },
      orderBy: { openTime: 'asc' },
    });
    res.json(rounds);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch rounds' });
  }
});

// POST /rounds/:id/entrants
router.post('/rounds/:id/entrants', ...requireRole('educator'), async (req, res) => {
  try {
    const { entrantId } = req.body;
    if (!entrantId) {
      return res.status(400).json({ error: 'entrantId is required' });
    }

    const round = await prisma.round.findUnique({ where: { id: req.params.id } });
    if (!round) {
      return res.status(404).json({ error: 'Round not found' });
    }

    if (round.state !== 'scheduled' && round.state !== 'open') {
      return res.status(403).json({
        error: `Registration not accepted - round is currently '${round.state}'`,
      });
    }

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

    const existing = await prisma.roundEntrant.findUnique({
      where: { roundId_entrantId: { roundId: round.id, entrantId } },
    });
    if (existing) {
      return res.status(409).json({ error: 'Entrant is already registered for this round' });
    }

    const registration = await prisma.roundEntrant.create({
      data: { roundId: round.id, entrantId },
    });
    res.status(201).json(registration);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not register entrant' });
  }
});

router.get('/rounds/:id/entrants', async (req, res) => {
  try {
    const roundEntrants = await prisma.roundEntrant.findMany({
      where: { roundId: req.params.id },
      include: { entrant: true },
    });
    res.json(roundEntrants.map((re) => re.entrant));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch entrants' });
  }
});

router.get('/rounds/:id/submissions', async (req, res) => {
  try {
    const submissions = await prisma.submission.findMany({
      where: { roundId: req.params.id },
      include: { result: true },
    });
    res.json(submissions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch submissions' });
  }
});

// GET /rounds/:id/standings
router.get('/rounds/:id/standings', async (req, res) => {
  try {
    const roundId = req.params.id;

    const round = await prisma.round.findUnique({ where: { id: roundId } });
    if (!round) {
      return res.status(404).json({ error: 'Round not found' });
    }

    const submissions = await prisma.submission.findMany({
      where: { roundId, result: { isNot: null } },
      include: {
        result: true,
        entrant: { include: { school: true } },
      },
    });

    const ranked = submissions
      .map((s) => ({
        entrantId: s.entrant.id,
        entrantName: s.entrant.name,
        schoolName: s.entrant.school.name,
        score: s.result.score,
        submittedAt: s.submittedAt,
      }))
      .sort((a, b) => b.score - a.score);

    let rank = 0;
    let lastScore = null;
    const standings = ranked.map((entry, index) => {
      if (entry.score !== lastScore) {
        rank = index + 1;
        lastScore = entry.score;
      }
      return { rank, ...entry };
    });

    res.json(standings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch standings' });
  }
});

// GET /rounds/:id/standings/schools
router.get('/rounds/:id/standings/schools', async (req, res) => {
  try {
    const roundId = req.params.id;

    const round = await prisma.round.findUnique({ where: { id: roundId } });
    if (!round) {
      return res.status(404).json({ error: 'Round not found' });
    }

    const submissions = await prisma.submission.findMany({
      where: { roundId, result: { isNot: null } },
      include: {
        result: true,
        entrant: { include: { school: true } },
      },
    });

    const bySchool = new Map();

    for (const s of submissions) {
      const schoolId = s.entrant.school.id;
      if (!bySchool.has(schoolId)) {
        bySchool.set(schoolId, {
          schoolId,
          schoolName: s.entrant.school.name,
          totalScore: 0,
          entrantCount: 0,
        });
      }
      const entry = bySchool.get(schoolId);
      entry.totalScore += s.result.score;
      entry.entrantCount += 1;
    }

    const ranked = Array.from(bySchool.values()).sort((a, b) => b.totalScore - a.totalScore);

    let rank = 0;
    let lastScore = null;
    const standings = ranked.map((entry, index) => {
      if (entry.totalScore !== lastScore) {
        rank = index + 1;
        lastScore = entry.totalScore;
      }
      return { rank, ...entry };
    });

    res.json(standings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch school standings' });
  }
});

// POST /rounds/:id/release-results
router.post('/rounds/:id/release-results', ...requireRole('educator'), async (req, res) => {
  try {
    const round = await prisma.round.findUnique({ where: { id: req.params.id } });
    if (!round) {
      return res.status(404).json({ error: 'Round not found' });
    }

    if (round.state !== 'closed') {
      return res.status(403).json({
        error: `Results can only be released for closed rounds (currently '${round.state}')`,
      });
    }

    const now = new Date();
    const updated = await prisma.result.updateMany({
      where: {
        releasedAt: null,
        submission: { roundId: round.id },
      },
      data: { releasedAt: now },
    });

    // Flipping the round to 'released' is the only path past 'closed' in the
    // state machine — without it, certificates and released-round paper
    // downloads stay locked forever even though results carry releasedAt.
    // The state filter keeps the closed -> released transition atomic: if a
    // concurrent request already moved the round on, nothing is written.
    // Legacy closed rounds with pre-existing releasedAt stamps still
    // converge — they remain 'closed', so the filter matches them.
    const flipped = await prisma.round.updateMany({
      where: { id: round.id, state: 'closed' },
      data: { state: 'released' },
    });
    if (flipped.count === 0) {
      return res.status(409).json({
        error: 'Round state changed while releasing results - it is no longer closed',
      });
    }

    res.json({ releasedCount: updated.count, releasedAt: now });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not release results' });
  }
});

// POST /rounds/:id/unrelease-results
router.post('/rounds/:id/unrelease-results', ...requireRole('educator'), async (req, res) => {
  try {
    const round = await prisma.round.findUnique({ where: { id: req.params.id } });
    if (!round) {
      return res.status(404).json({ error: 'Round not found' });
    }

    const updated = await prisma.result.updateMany({
      where: {
        releasedAt: { not: null },
        submission: { roundId: round.id },
      },
      data: { releasedAt: null },
    });

    // A released round drops back to 'closed' once its results are hidden
    // again. Rounds in any other state are left untouched.
    if (round.state === 'released') {
      await prisma.round.update({
        where: { id: round.id },
        data: { state: 'closed' },
      });
    }

    res.json({ unreleasedCount: updated.count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not unrelease results' });
  }
});

// GET /rounds/:id/notifications
router.get('/rounds/:id/notifications', ...requireRole('organiser'), async (req, res) => {
  try {
    const roundId = req.params.id;

    const round = await prisma.round.findUnique({ where: { id: roundId } });
    if (!round) {
      return res.status(404).json({ error: 'Round not found' });
    }

    const existingRules = await prisma.notificationRule.findMany({
      where: { roundId },
    });
    const byTriggerType = new Map(existingRules.map((r) => [r.triggerType, r]));

    const rules = NOTIFICATION_TRIGGER_TYPES.map((triggerType) => {
      const existing = byTriggerType.get(triggerType);
      return (
        existing || {
          id: null,
          roundId,
          triggerType,
          enabled: true,
          recipientRole: 'educator',
        }
      );
    });

    res.json(rules);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch notification rules' });
  }
});

// PUT /rounds/:id/notifications/:triggerType
router.put(
  '/rounds/:id/notifications/:triggerType',
  ...requireRole('organiser'),
  async (req, res) => {
    try {
      const roundId = req.params.id;
      const { triggerType } = req.params;
      const { enabled, recipientRole } = req.body;

      if (!NOTIFICATION_TRIGGER_TYPES.includes(triggerType)) {
        return res.status(400).json({ error: 'Invalid trigger type' });
      }
      if (recipientRole !== undefined && !NOTIFICATION_RECIPIENT_ROLES.includes(recipientRole)) {
        return res.status(400).json({ error: 'Invalid recipient role' });
      }

      const round = await prisma.round.findUnique({ where: { id: roundId } });
      if (!round) {
        return res.status(404).json({ error: 'Round not found' });
      }

      const rule = await prisma.notificationRule.upsert({
        where: { roundId_triggerType: { roundId, triggerType } },
        create: {
          roundId,
          triggerType,
          enabled: enabled ?? true,
          recipientRole: recipientRole ?? 'educator',
        },
        update: {
          ...(enabled !== undefined && { enabled }),
          ...(recipientRole !== undefined && { recipientRole }),
        },
      });

      res.json(rule);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to update notification rule' });
    }
  }
);

// DELETE /rounds/:id/notifications/:triggerType
router.delete(
  '/rounds/:id/notifications/:triggerType',
  ...requireRole('organiser'),
  async (req, res) => {
    try {
      const roundId = req.params.id;
      const { triggerType } = req.params;

      await prisma.notificationRule.deleteMany({
        where: { roundId, triggerType },
      });

      res.status(204).send();
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to delete notification rule' });
    }
  }
);

// POST /rounds/:id/notifications/test
router.post(
  '/rounds/:id/notifications/test',
  ...requireRole('organiser'),
  async (req, res) => {
    try {
      const roundId = req.params.id;
      const { triggerType } = req.body;

      if (!NOTIFICATION_TRIGGER_TYPES.includes(triggerType)) {
        return res.status(400).json({ error: 'A valid triggerType is required' });
      }

      const round = await prisma.round.findUnique({
        where: { id: roundId },
        include:
          triggerType === 'missing_submission'
            ? roundIncludeForMissingSubmissions
            : roundIncludeForNotifications,
      });
      if (!round) {
        return res.status(404).json({ error: 'Round not found' });
      }

      const enabled = await isTriggerEnabled(roundId, triggerType);

      const sentLogs = await prisma.notificationLog.findMany({
        where: { roundId, triggerType },
        select: { recipientEmail: true },
      });
      const alreadyEmailed = new Set(sentLogs.map((log) => log.recipientEmail));

      const recipients = [];
      if (triggerType === 'missing_submission') {
        const coveredEmails = new Set();
        for (const roundEntrant of round.roundEntrants) {
          const entrant = roundEntrant.entrant;
          const hasSubmitted = entrant.submissions.some((s) => s.roundId === round.id);
          if (hasSubmitted) continue;

          for (const educator of entrant.school.educators) {
            const email = educator.user.email;
            recipients.push({
              email,
              entrantId: entrant.id,
              entrantName: entrant.name,
              alreadyNotified: alreadyEmailed.has(email) || coveredEmails.has(email),
            });
            coveredEmails.add(email);
          }
        }
      } else {
        for (const email of await getRecipientsForRound(round)) {
          recipients.push({ email, alreadyNotified: alreadyEmailed.has(email) });
        }
      }

      let emailPreview = null;
      if (triggerType === 'before_open') {
        emailPreview = buildRoundOpeningMessage({
          roundName: round.name,
          opensAt: new Date(round.openTime).toISOString(),
        });
      } else if (triggerType === 'before_close') {
        emailPreview = buildRoundClosingMessage({
          roundName: round.name,
          closesAt: new Date(round.closeTime).toISOString(),
        });
      } else if (triggerType === 'results_released') {
        emailPreview = buildResultsReleasedMessage({ roundName: round.name });
      } else if (recipients.length > 0) {
        emailPreview = buildMissingSubmissionMessage({
          roundName: round.name,
          entrantName: recipients[0].entrantName,
        });
      }

      res.json({
        dryRun: true,
        round: {
          id: round.id,
          name: round.name,
          state: round.state,
          openTime: round.openTime,
          closeTime: round.closeTime,
        },
        triggerType,
        enabled,
        recipients,
        emailPreview,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to run notification dry-run' });
    }
  }
);

module.exports = router;