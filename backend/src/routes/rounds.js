const express = require('express');
const prisma = require('../lib/prisma');
const { requireRole, requireAuth, loadAuthUser, loadOptionalUser } = require('../middleware/auth');
const { hasQualifiedForRound, prerequisiteFailureMessage } = require('../lib/qualification');
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
const { requireOlympiadAccess, isOlympiadOrganiser } = require('../lib/authorization');
const { toUTCDate } = require('../lib/timezone');

const router = express.Router();

const NOTIFICATION_TRIGGER_TYPES = [
  'before_open',
  'before_close',
  'missing_submission',
  'results_released',
];
const NOTIFICATION_RECIPIENT_ROLES = ['educator', 'organiser', 'all'];

// POST /olympiads — organiser-only; the creator becomes the owner, and
// organisers only ever see their own olympiads afterwards.
router.post('/olympiads', ...requireRole('organiser'), async (req, res) => {
  try {
    const { name, timezone, description, grades, startDate, endDate } = req.body;
    if (!name || !timezone) {
      return res.status(400).json({ error: 'name and timezone are required' });
    }
    if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
      return res.status(400).json({ error: 'endDate must be on or after startDate' });
    }
    const olympiad = await prisma.olympiad.create({
      data: {
        name,
        timezone,
        description: description || null,
        grades: grades || null,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        organiserId: req.user.id,
      },
    });
    // Backfill the creator into the OlympiadOrganiser join table so
    // membership-based access checks work uniformly.
    await prisma.olympiadOrganiser.create({
      data: { olympiadId: olympiad.id, organiserId: req.user.id },
    });
    res.status(201).json(olympiad);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create olympiad' });
  }
});

// GET /olympiads — public so educators/students can browse rounds, but
// organisers are scoped to the olympiads they created or co-organise
// (via the OlympiadOrganiser join table).
router.get('/olympiads', async (req, res) => {
  try {
    const user = await loadOptionalUser(req);
    let where = {};
    if (user && user.role === 'organiser') {
      // Organisers see olympiads they created OR co-organise.
      const organiserIds = await prisma.olympiadOrganiser.findMany({
        where: { organiserId: user.id },
        select: { olympiadId: true },
      });
      const organisedIds = organiserIds.map((o) => o.olympiadId);
      where = { OR: [{ organiserId: user.id }, { id: { in: organisedIds } }] };
    }

    const olympiads = await prisma.olympiad.findMany({
      where,
      include: {
        rounds: {
          orderBy: { openTime: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });

    // Public listing: anonymous callers (and organisers) get the plain
    // list. When the token identifies an educator, enrich each olympiad
    // with the educator's school's access state and the number of distinct
    // entrants per school, so the dashboard can show an info card for
    // olympiads the school isn't part of yet.
    if (!user || user.role !== 'educator') {
      return res.json(olympiads);
    }

    // Hide olympiads whose end date has already passed — educators can't
    // act on them and the team wants to keep the list tidy. Past papers
    // remain available in the archive.
    const now = new Date();
    const activeOlympiads = olympiads.filter((o) => !o.endDate || new Date(o.endDate) >= now);

    const educator = await prisma.educator.findUnique({ where: { userId: user.id } });
    if (!educator) {
      return res.json(activeOlympiads);
    }

    const [accessRows, registrations] = await Promise.all([
      prisma.schoolOlympiad.findMany({ where: { schoolId: educator.schoolId } }),
      prisma.roundEntrant.findMany({
        select: {
          entrantId: true,
          entrant: { select: { schoolId: true, school: { select: { name: true } } } },
          round: { select: { olympiadId: true } },
        },
      }),
    ]);

    const accessByOlympiad = new Map(accessRows.map((row) => [row.olympiadId, row.status]));

    // Count each entrant once per olympiad (they may sit several rounds),
    // grouped by school.
    const seen = new Set();
    const countsByOlympiad = new Map();
    for (const registration of registrations) {
      const key = `${registration.round.olympiadId}:${registration.entrantId}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const bySchool = countsByOlympiad.get(registration.round.olympiadId) || new Map();
      countsByOlympiad.set(registration.round.olympiadId, bySchool);

      const schoolId = registration.entrant.schoolId;
      const entry = bySchool.get(schoolId) || {
        schoolName: registration.entrant.school
          ? registration.entrant.school.name
          : 'Unknown school',
        entrantCount: 0,
      };
      entry.entrantCount += 1;
      bySchool.set(schoolId, entry);
    }

    res.json(
      activeOlympiads.map((olympiad) => ({
        ...olympiad,
        schoolAccess: accessByOlympiad.get(olympiad.id) || 'none',
        schoolEntrantCounts: Array.from(countsByOlympiad.get(olympiad.id) || new Map())
          .map(([, entry]) => entry)
          .sort(
            (a, b) => b.entrantCount - a.entrantCount || a.schoolName.localeCompare(b.schoolName)
          ),
      }))
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch olympiads' });
  }
});

// PUT /olympiads/:id
// Edits an olympiad's details and organiser-set info fields (description,
// grades, run dates) that are shown to educators on the info card.
router.put('/olympiads/:id', ...requireRole('organiser'), async (req, res) => {
  try {
    const { name, timezone, description, grades, startDate, endDate } = req.body;

    const existing = await prisma.olympiad.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ error: 'Olympiad not found' });
    }

    // Only organisers of this specific olympiad may edit it.
    if (!(await isOlympiadOrganiser(req.user.id, req.params.id))) {
      return res.status(403).json({ error: 'You are not an organiser of this olympiad' });
    }

    if (name !== undefined && !name) {
      return res.status(400).json({ error: 'name cannot be empty' });
    }
    if (timezone !== undefined && !timezone) {
      return res.status(400).json({ error: 'timezone cannot be empty' });
    }

    const nextStartDate =
      startDate !== undefined ? (startDate ? new Date(startDate) : null) : existing.startDate;
    const nextEndDate =
      endDate !== undefined ? (endDate ? new Date(endDate) : null) : existing.endDate;
    if (nextStartDate && nextEndDate && nextEndDate < nextStartDate) {
      return res.status(400).json({ error: 'endDate must be on or after startDate' });
    }

    const updated = await prisma.olympiad.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(timezone !== undefined && { timezone }),
        ...(description !== undefined && { description: description || null }),
        ...(grades !== undefined && { grades: grades || null }),
        ...(startDate !== undefined && { startDate: nextStartDate }),
        ...(endDate !== undefined && { endDate: nextEndDate }),
      },
    });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update olympiad' });
  }
});

// POST /olympiads/:id/request-access
// An educator asks for their school to join the olympiad. Re-requesting
// after a decline is allowed; pending and approved states are rejected.
router.post('/olympiads/:id/request-access', ...requireRole('educator'), async (req, res) => {
  try {
    const olympiad = await prisma.olympiad.findUnique({ where: { id: req.params.id } });
    if (!olympiad) {
      return res.status(404).json({ error: 'Olympiad not found' });
    }

    // Block access requests for olympiads that have already closed.
    if (olympiad.endDate && new Date(olympiad.endDate) < new Date()) {
      return res.status(403).json({ error: 'This olympiad has closed' });
    }

    const educator = await prisma.educator.findUnique({ where: { userId: req.user.id } });
    if (!educator) {
      return res.status(403).json({ error: 'No school linked to this account' });
    }

    const existing = await prisma.schoolOlympiad.findUnique({
      where: {
        schoolId_olympiadId: { schoolId: educator.schoolId, olympiadId: olympiad.id },
      },
    });
    if (existing && existing.status !== 'declined') {
      return res.status(409).json({
        error:
          existing.status === 'approved'
            ? 'Your school already has access to this olympiad'
            : 'An access request for this olympiad is already pending',
      });
    }

    const access = await prisma.schoolOlympiad.upsert({
      where: {
        schoolId_olympiadId: { schoolId: educator.schoolId, olympiadId: olympiad.id },
      },
      create: {
        schoolId: educator.schoolId,
        olympiadId: olympiad.id,
        requestedById: req.user.id,
      },
      update: {
        status: 'pending',
        requestedById: req.user.id,
        requestedAt: new Date(),
        decidedAt: null,
      },
    });
    res.status(201).json({ status: access.status });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not request access' });
  }
});

// GET /olympiads/access-requests
// Pending school access requests for the organiser console, with the
// school, olympiad and requesting educator's details.
router.get('/olympiads/access-requests', ...requireRole('organiser'), async (req, res) => {
  try {
    // Scope to pending requests for olympiads the caller organises.
    const organiserRows = await prisma.olympiadOrganiser.findMany({
      where: { organiserId: req.user.id },
      select: { olympiadId: true },
    });
    const organisedOlympiadIds = organiserRows.map((r) => r.olympiadId);

    const requests = await prisma.schoolOlympiad.findMany({
      where: {
        status: 'pending',
        olympiadId: { in: organisedOlympiadIds },
      },
      include: {
        school: { select: { id: true, name: true } },
        olympiad: { select: { id: true, name: true } },
      },
      orderBy: { requestedAt: 'asc' },
    });

    const requesterIds = [...new Set(requests.map((r) => r.requestedById).filter(Boolean))];
    const requesters = requesterIds.length
      ? await prisma.user.findMany({
          where: { id: { in: requesterIds } },
          select: { id: true, name: true, email: true },
        })
      : [];
    const requesterById = new Map(requesters.map((user) => [user.id, user]));

    res.json(
      requests.map((request) => ({
        id: request.id,
        school: request.school,
        olympiad: request.olympiad,
        requestedBy: request.requestedById
          ? requesterById.get(request.requestedById) || null
          : null,
        requestedAt: request.requestedAt,
      }))
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch access requests' });
  }
});

// POST /olympiads/access-requests/:id/approve and /decline
// The organiser's decision on a school's access request.
async function decideAccessRequest(req, res, status) {
  const existing = await prisma.schoolOlympiad.findUnique({ where: { id: req.params.id } });
  if (!existing) {
    return res.status(404).json({ error: 'Access request not found' });
  }

  // Only organisers of this specific olympiad may approve/decline requests.
  if (!(await isOlympiadOrganiser(req.user.id, existing.olympiadId))) {
    return res.status(403).json({ error: 'You are not an organiser of this olympiad' });
  }

  const updated = await prisma.schoolOlympiad.update({
    where: { id: req.params.id },
    data: { status, decidedAt: new Date() },
  });
  res.json({ id: updated.id, status: updated.status });
}

router.post(
  '/olympiads/access-requests/:id/approve',
  ...requireRole('organiser'),
  async (req, res) => {
    try {
      await decideAccessRequest(req, res, 'approved');
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Could not approve access request' });
    }
  }
);

router.post(
  '/olympiads/access-requests/:id/decline',
  ...requireRole('organiser'),
  async (req, res) => {
    try {
      await decideAccessRequest(req, res, 'declined');
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Could not decline access request' });
    }
  }
);

router.post('/rounds', async (req, res) => {
  try {
    const { olympiadId, name, openTime, closeTime, qualifyingThreshold } = req.body;
    if (!olympiadId || !name || !openTime || !closeTime) {
      return res
        .status(400)
        .json({ error: 'olympiadId, name, openTime, and closeTime are required' });
    }
    if (new Date(closeTime) <= new Date(openTime)) {
      return res.status(400).json({ error: 'closeTime must be after openTime' });
    }
    if (
      qualifyingThreshold !== undefined &&
      qualifyingThreshold !== null &&
      (typeof qualifyingThreshold !== 'number' ||
        qualifyingThreshold < 0 ||
        qualifyingThreshold > 100)
    ) {
      return res
        .status(400)
        .json({ error: 'qualifyingThreshold must be a number between 0 and 100' });
    }

    // Look up the olympiad's timezone so we can convert the organiser's
    // local times to UTC for storage.
    const olympiad = await prisma.olympiad.findUnique({ where: { id: olympiadId } });
    if (!olympiad) {
      return res.status(404).json({ error: 'Olympiad not found' });
    }

    // Only organisers of this specific olympiad may create rounds for it.
    // Check req.user exists (set by auth middleware) and is an organiser of this olympiad.
    if (!req.user || !(await isOlympiadOrganiser(req.user.id, olympiadId))) {
      return res.status(403).json({ error: 'You are not an organiser of this olympiad' });
    }

    const round = await prisma.round.create({
      data: {
        olympiadId,
        name,
        openTime: toUTCDate(openTime, olympiad.timezone),
        closeTime: toUTCDate(closeTime, olympiad.timezone),
        qualifyingThreshold: qualifyingThreshold ?? null,
      },
    });
    res.status(201).json(round);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create round' });
  }
});

router.get('/rounds', async (req, res) => {
  try {
    const { olympiadId } = req.query;
    const where = olympiadId ? { olympiadId } : {};
    const rounds = await prisma.round.findMany({
      where,
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
    const round = await prisma.round.findUnique({
      where: { id: req.params.id },
      include: { olympiad: true },
    });
    if (!round) return res.status(404).json({ error: 'Round not found' });

    // Educators must have approved school access to the round's olympiad
    if (req.headers.authorization) {
      const user = await loadOptionalUser(req);
      if (user) {
        const check = await requireOlympiadAccess(req, res, round, user);
        if (!check) return;
      }
    }

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

    const round = await prisma.round.findUnique({
      where: { id: req.params.id },
      include: { prerequisiteRound: { select: { id: true, name: true } } },
    });
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

    // The school must have approved access to the olympiad before its
    // educators can register entrants into the olympiad's rounds.
    const access = await prisma.schoolOlympiad.findUnique({
      where: {
        schoolId_olympiadId: {
          schoolId: educator.schoolId,
          olympiadId: round.olympiadId,
        },
      },
    });
    if (!access || access.status !== 'approved') {
      return res.status(403).json({
        error:
          "Your school doesn't have access to this olympiad yet — request access from the organiser.",
      });
    }

    const entrant = await prisma.entrant.findUnique({ where: { id: entrantId } });
    if (!entrant) {
      return res.status(404).json({ error: 'Entrant not found' });
    }

    if (entrant.schoolId !== educator.schoolId) {
      return res.status(403).json({ error: 'Entrant belongs to a different school' });
    }

    // Prerequisite gate: verify the entrant met this round's requirements
    // (passed the prerequisite round at or above the qualifying threshold)
    // before allowing registration into it.
    if (!(await hasQualifiedForRound(entrantId, round))) {
      return res.status(403).json({
        error: `Prerequisite not met: ${prerequisiteFailureMessage(round)}`,
      });
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

// GET /rounds/:id/entrants
// Returns entrants registered for a round. Educators see only their own
// school's entrants; organisers see all.
router.get('/rounds/:id/entrants', requireAuth, async (req, res) => {
  try {
    const user = await loadAuthUser(req);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Fetch the round to check olympiad access
    const round = await prisma.round.findUnique({ where: { id: req.params.id } });
    if (!round) return res.status(404).json({ error: 'Round not found' });

    // All users (organisers and educators) must have access to this olympiad.
    // requireOlympiadAccess checks OlympiadOrganiser membership for organisers
    // and SchoolOlympiad access for educators.
    const check = await requireOlympiadAccess(req, res, round, user);
    if (!check) return;

    let schoolId = null;
    if (user.role !== 'organiser') {
      const educator = await prisma.educator.findUnique({
        where: { userId: user.id },
      });
      schoolId = educator?.schoolId ?? null;
      // Non-organisers must have a linked school; otherwise return no data.
      if (!schoolId) return res.json([]);
    }

    // Organisers see every school; educators only their own school. The
    // filter is omitted entirely for organisers — a null schoolId would
    // otherwise match only entrants with no school at all.
    const where = {
      roundId: req.params.id,
      ...(schoolId ? { entrant: { schoolId } } : {}),
    };

    const roundEntrants = await prisma.roundEntrant.findMany({
      where,
      include: { entrant: true },
    });
    res.json(roundEntrants.map((re) => re.entrant));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch entrants' });
  }
});

// GET /rounds/:id/submissions
// Returns submissions for a round. Educators see only their own school's
// submissions; organisers see all.
router.get('/rounds/:id/submissions', requireAuth, async (req, res) => {
  try {
    const user = await loadAuthUser(req);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Fetch the round to check olympiad access
    const round = await prisma.round.findUnique({ where: { id: req.params.id } });
    if (!round) return res.status(404).json({ error: 'Round not found' });

    // All users (organisers and educators) must have access to this olympiad.
    // requireOlympiadAccess checks OlympiadOrganiser membership for organisers
    // and SchoolOlympiad access for educators.
    const check = await requireOlympiadAccess(req, res, round, user);
    if (!check) return;

    let schoolId = null;
    if (user.role !== 'organiser') {
      const educator = await prisma.educator.findUnique({
        where: { userId: user.id },
      });
      schoolId = educator?.schoolId ?? null;
      // Non-organisers must have a linked school; otherwise return no data.
      if (!schoolId) return res.json([]);
    }

    // Organisers see every school; educators only their own school. The
    // filter is omitted entirely for organisers — a null schoolId would
    // otherwise match only entrants with no school at all.
    const where = {
      roundId: req.params.id,
      ...(schoolId ? { entrant: { schoolId } } : {}),
    };

    const submissions = await prisma.submission.findMany({
      where,
      include: { result: true, entrant: true, remarkRequests: true },
    });
    res.json(submissions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch submissions' });
  }
});

// GET /rounds/:id/progression
// A read-only preview of who would qualify for the next round based on
// this round's qualifyingThreshold, without actually registering anyone.
// Useful for organisers to check before/after a round closes.
router.get('/rounds/:id/progression', async (req, res) => {
  try {
    const round = await prisma.round.findUnique({
      where: { id: req.params.id },
      include: {
        roundEntrants: {
          include: {
            entrant: {
              include: {
                submissions: {
                  where: { roundId: req.params.id },
                  include: { result: true },
                },
              },
            },
          },
        },
      },
    });

    if (!round) {
      return res.status(404).json({ error: 'Round not found' });
    }

    if (round.qualifyingThreshold === null || round.qualifyingThreshold === undefined) {
      return res.json({
        roundId: round.id,
        qualifyingThreshold: null,
        entrants: [],
        message: 'This round has no qualifyingThreshold set, so no entrants will be auto-advanced.',
      });
    }

    const entrants = round.roundEntrants.map((roundEntrant) => {
      const entrant = roundEntrant.entrant;
      const submission = entrant.submissions[0];
      const score = submission?.result?.score ?? null;
      return {
        entrantId: entrant.id,
        name: entrant.name,
        score,
        qualifies: score !== null && score >= round.qualifyingThreshold,
      };
    });

    res.json({
      roundId: round.id,
      qualifyingThreshold: round.qualifyingThreshold,
      entrants,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to compute progression preview' });
  }
});
// GET /rounds/:id/standings
// Per-entrant standings for a round. Educators see only their school's
// entrants; organisers see all.
router.get('/rounds/:id/standings', requireAuth, async (req, res) => {
  try {
    const roundId = req.params.id;
    const user = await loadAuthUser(req);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    let schoolId = null;
    if (user.role !== 'organiser') {
      const educator = await prisma.educator.findUnique({
        where: { userId: user.id },
      });
      schoolId = educator?.schoolId ?? null;
    }

    const round = await prisma.round.findUnique({ where: { id: roundId } });
    if (!round) {
      return res.status(404).json({ error: 'Round not found' });
    }

    // All users (organisers and educators) must have access to this olympiad.
    // requireOlympiadAccess checks OlympiadOrganiser membership for organisers
    // and SchoolOlympiad access for educators.
    const check = await requireOlympiadAccess(req, res, round, user);
    if (!check) return;

    // Non-organisers must have a linked school; otherwise return no data.
    if (user.role !== 'organiser' && !schoolId) return res.json([]);

    // Organisers see every school; educators only their own school. The
    // filter is omitted entirely for organisers — a null schoolId would
    // otherwise match only entrants with no school at all.
    const where = {
      roundId,
      result: { isNot: null },
      ...(schoolId ? { entrant: { schoolId } } : {}),
    };

    const submissions = await prisma.submission.findMany({
      where,
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
// Per-school standings for a round. Educators see only their own school's
// row; organisers see all schools.
router.get('/rounds/:id/standings/schools', requireAuth, async (req, res) => {
  try {
    const roundId = req.params.id;
    const user = await loadAuthUser(req);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    let schoolId = null;
    if (user.role !== 'organiser') {
      const educator = await prisma.educator.findUnique({
        where: { userId: user.id },
      });
      schoolId = educator?.schoolId ?? null;
    }

    const round = await prisma.round.findUnique({ where: { id: roundId } });
    if (!round) {
      return res.status(404).json({ error: 'Round not found' });
    }

    // All users (organisers and educators) must have access to this olympiad.
    // requireOlympiadAccess checks OlympiadOrganiser membership for organisers
    // and SchoolOlympiad access for educators.
    const check = await requireOlympiadAccess(req, res, round, user);
    if (!check) return;

    // Non-organisers must have a linked school; otherwise return no data.
    if (user.role !== 'organiser' && !schoolId) return res.json([]);

    // Organisers see every school; educators only their own school. The
    // filter is omitted entirely for organisers — a null schoolId would
    // otherwise match only entrants with no school at all.
    const where = {
      roundId,
      result: { isNot: null },
      ...(schoolId ? { entrant: { schoolId } } : {}),
    };

    const submissions = await prisma.submission.findMany({
      where,
      include: {
        result: true,
        entrant: { include: { school: true } },
      },
    });

    const bySchool = new Map();

    for (const s of submissions) {
      const sid = s.entrant.school.id;
      if (!bySchool.has(sid)) {
        bySchool.set(sid, {
          schoolId: sid,
          schoolName: s.entrant.school.name,
          totalScore: 0,
          entrantCount: 0,
        });
      }
      const entry = bySchool.get(sid);
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

    // Only organisers of this specific olympiad may view notification rules.
    if (!(await isOlympiadOrganiser(req.user.id, round.olympiadId))) {
      return res.status(403).json({ error: 'You are not an organiser of this olympiad' });
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

      // Only organisers of this specific olympiad may update notification rules.
      if (!(await isOlympiadOrganiser(req.user.id, round.olympiadId))) {
        return res.status(403).json({ error: 'You are not an organiser of this olympiad' });
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

      const round = await prisma.round.findUnique({ where: { id: roundId } });
      if (!round) {
        return res.status(404).json({ error: 'Round not found' });
      }

      // Only organisers of this specific olympiad may delete notification rules.
      if (!(await isOlympiadOrganiser(req.user.id, round.olympiadId))) {
        return res.status(403).json({ error: 'You are not an organiser of this olympiad' });
      }

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
router.post('/rounds/:id/notifications/test', ...requireRole('organiser'), async (req, res) => {
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

    // Only organisers of this specific olympiad may run notification dry-runs.
    if (!(await isOlympiadOrganiser(req.user.id, round.olympiadId))) {
      return res.status(403).json({ error: 'You are not an organiser of this olympiad' });
    }

    const enabled = await isTriggerEnabled(roundId, triggerType);

    const sentLogs = await prisma.notificationLog.findMany({
      where: { roundId, triggerType },
      select: { recipientEmail: true, entrantId: true },
    });
    const alreadyEmailed = new Set(
      sentLogs.map((log) =>
        log.entrantId ? `${log.recipientEmail}:${log.entrantId}` : log.recipientEmail
      )
    );
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
            alreadyNotified:
              alreadyEmailed.has(`${email}:${entrant.id}`) || coveredEmails.has(email),
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
});

// PATCH /rounds/:id
// Organiser-only: update qualifyingThreshold and/or prerequisiteRoundId
// on a round. Both fields are optional; passing null clears the gate.
router.patch('/rounds/:id', ...requireRole('organiser'), async (req, res) => {
  try {
    const { qualifyingThreshold, prerequisiteRoundId } = req.body;

    // Validate that at least one field was provided
    if (qualifyingThreshold === undefined && prerequisiteRoundId === undefined) {
      return res.status(400).json({
        error: 'At least one of qualifyingThreshold or prerequisiteRoundId is required',
      });
    }

    // Validate qualifyingThreshold if provided
    if (qualifyingThreshold !== undefined && qualifyingThreshold !== null) {
      const num = Number(qualifyingThreshold);
      if (Number.isNaN(num) || num < 0 || num > 100) {
        return res.status(400).json({
          error: 'qualifyingThreshold must be a number between 0 and 100, or null to clear',
        });
      }
    }

    const round = await prisma.round.findUnique({ where: { id: req.params.id } });
    if (!round) {
      return res.status(404).json({ error: 'Round not found' });
    }

    // Only organisers of this specific olympiad may update round settings.
    if (!(await isOlympiadOrganiser(req.user.id, round.olympiadId))) {
      return res.status(403).json({ error: 'You are not an organiser of this olympiad' });
    }

    // If setting a prerequisite, verify the referenced round exists
    if (prerequisiteRoundId !== undefined && prerequisiteRoundId !== null) {
      const prereq = await prisma.round.findUnique({
        where: { id: prerequisiteRoundId },
      });
      if (!prereq) {
        return res.status(404).json({ error: 'Prerequisite round not found' });
      }
      if (prereq.id === round.id) {
        return res.status(400).json({ error: 'A round cannot be its own prerequisite' });
      }
    }

    const data = {};
    if (qualifyingThreshold !== undefined) {
      data.qualifyingThreshold = qualifyingThreshold === null ? null : Number(qualifyingThreshold);
    }
    if (prerequisiteRoundId !== undefined) {
      data.prerequisiteRoundId = prerequisiteRoundId;
    }

    const updated = await prisma.round.update({
      where: { id: round.id },
      data,
    });

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not update round settings' });
  }
});

// GET /rounds/:id/audit-log
// Returns the audit trail of automatic actions the scheduler performed
// on a round (open, close, auto-advance, notification sends).
router.get('/rounds/:id/audit-log', requireAuth, async (req, res) => {
  try {
    const user = await loadAuthUser(req);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const round = await prisma.round.findUnique({
      where: { id: req.params.id },
      include: { olympiad: true },
    });
    if (!round) {
      return res.status(404).json({ error: 'Round not found' });
    }

    // All users (organisers and educators) must have access to this olympiad.
    // requireOlympiadAccess checks OlympiadOrganiser membership for organisers
    // and SchoolOlympiad access for educators.
    const check = await requireOlympiadAccess(req, res, round, user);
    if (!check) return;

    const logs = await prisma.auditLog.findMany({
      where: { roundId: req.params.id },
      orderBy: { timestamp: 'desc' },
    });

    res.json(logs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch audit log' });
  }
});

// GET /rounds/:id/replay
// Aggregates the round's audit log into a chronological timeline of
// state transitions, auto-advances, and notification sends — useful
// for organisers to review what happened during a round's lifecycle.
router.get('/rounds/:id/replay', requireAuth, async (req, res) => {
  try {
    const user = await loadAuthUser(req);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const round = await prisma.round.findUnique({
      where: { id: req.params.id },
      include: { olympiad: true },
    });
    if (!round) {
      return res.status(404).json({ error: 'Round not found' });
    }

    // All users (organisers and educators) must have access to this olympiad.
    // requireOlympiadAccess checks OlympiadOrganiser membership for organisers
    // and SchoolOlympiad access for educators.
    const check = await requireOlympiadAccess(req, res, round, user);
    if (!check) return;

    const logs = await prisma.auditLog.findMany({
      where: { roundId: req.params.id },
      orderBy: { timestamp: 'asc' },
    });

    // Build a timeline with enriched context
    const timeline = logs.map((log) => ({
      id: log.id,
      action: log.action,
      timestamp: log.timestamp,
      roundId: log.roundId,
      payload: log.payload,
      summary: buildActionSummary(log),
    }));

    res.json({
      round: {
        id: round.id,
        name: round.name,
        olympiadName: round.olympiad.name,
        state: round.state,
        openTime: round.openTime,
        closeTime: round.closeTime,
      },
      timeline,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to build round replay' });
  }
});

// Human-readable summary for each audit action type
function buildActionSummary(log) {
  const p = log.payload || {};
  switch (log.action) {
    case 'round_opened':
      return `Round opened at ${log.timestamp.toISOString()}`;
    case 'round_closed':
      return `Round closed at ${log.timestamp.toISOString()}`;
    case 'auto_advanced':
      return `Entrant ${p.entrantName || p.entrantId} advanced to round ${p.nextRoundId || '?'}`;
    case 'notification_sent':
      return `${p.triggerType} notification sent to ${p.recipientEmail || '?'}`;
    default:
      return `${log.action} at ${log.timestamp.toISOString()}`;
  }
}

module.exports = router;
