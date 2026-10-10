const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth, loadAuthUser } = require('../middleware/auth');

const router = express.Router();

/**
 * Auth + user-load middleware for school routes.
 * Returns an array (same pattern as requireRole) so it can be spread into
 * route handlers.  After this chain runs, req.user holds the DB user record.
 */
function requireSchoolAccess() {
  return [
    requireAuth,
    async (req, res, next) => {
      try {
        const user = await loadAuthUser(req);

        if (!user) {
          return res.status(404).json({ error: 'User not found' });
        }

        req.user = user;
        next();
      } catch (err) {
        console.error('School access check failed:', err);
        res.status(500).json({ error: 'Authorization check failed' });
      }
    },
  ];
}

/**
 * Checks the authenticated user is allowed to view this school's data:
 * organisers can view any school, educators only their own.
 */
async function canAccessSchool(req, schoolId) {
  if (req.user.role === 'organiser') return true;

  if (req.user.role === 'educator') {
    const educator = await prisma.educator.findUnique({
      where: { userId: req.user.id },
    });
    return Boolean(educator && educator.schoolId === schoolId);
  }

  return false;
}

// GET /schools
// Public list of all schools (used by the student registration dropdown).
router.get('/schools', async (_req, res) => {
  try {
    const schools = await prisma.school.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    });
    res.json(schools);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not fetch schools' });
  }
});

// GET /schools/:id/entrants
router.get('/schools/:id/entrants', ...requireSchoolAccess(), async (req, res) => {
  try {
    const { id: schoolId } = req.params;

    const allowed = await canAccessSchool(req, schoolId);
    if (!allowed) {
      return res.status(403).json({ error: 'Not authorized to view this school' });
    }

    const entrants = await prisma.entrant.findMany({
      where: { schoolId },
      orderBy: { name: 'asc' },
      include: {
        user: { select: { email: true, passwordHash: true } },
      },
    });

    res.json(
      entrants.map((entrant) => ({
        ...entrant,
        email: entrant.user ? entrant.user.email : null,
        accountStatus: entrant.user
          ? entrant.user.passwordHash
            ? 'active'
            : 'invite_pending'
          : null,
        user: undefined,
      }))
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not fetch entrants' });
  }
});

// GET /schools/:id/analytics
// Per-round performance analytics: participation, average/highest scores,
// and completion rates. Educators see their own school; organisers see any.
router.get('/schools/:id/analytics', ...requireSchoolAccess(), async (req, res) => {
  try {
    const { id: schoolId } = req.params;

    const allowed = await canAccessSchool(req, schoolId);
    if (!allowed) {
      return res.status(403).json({ error: 'Not authorized to view this school' });
    }

    const school = await prisma.school.findUnique({ where: { id: schoolId } });
    if (!school) {
      return res.status(404).json({ error: 'School not found' });
    }

    // Load all entrants for this school
    const entrants = await prisma.entrant.findMany({
      where: { schoolId },
      select: { id: true },
    });
    const entrantIds = entrants.map((e) => e.id);

    if (entrantIds.length === 0) {
      return res.json({
        school: { id: school.id, name: school.name },
        totalEntrants: 0,
        rounds: [],
      });
    }

    // Load all round registrations for these entrants
    const roundEntrants = await prisma.roundEntrant.findMany({
      where: { entrantId: { in: entrantIds } },
      include: {
        round: {
          select: {
            id: true,
            name: true,
            olympiad: { select: { id: true, name: true } },
          },
        },
      },
    });

    // Load all submissions for these entrants
    const submissions = await prisma.submission.findMany({
      where: { entrantId: { in: entrantIds } },
      include: {
        result: { select: { score: true } },
        round: { select: { id: true, name: true } },
      },
    });

    // Group by round
    const roundMap = new Map();
    for (const re of roundEntrants) {
      const roundId = re.round.id;
      if (!roundMap.has(roundId)) {
        roundMap.set(roundId, {
          round: re.round,
          registeredEntrants: new Set(),
          submissions: [],
        });
      }
      roundMap.get(roundId).registeredEntrants.add(re.entrantId);
    }

    for (const sub of submissions) {
      const roundId = sub.roundId;
      if (roundMap.has(roundId)) {
        roundMap.get(roundId).submissions.push(sub);
      }
    }

    // Compute per-round analytics
    const rounds = [...roundMap.values()].map((data) => {
      const scores = data.submissions
        .map((s) => s.result?.score)
        .filter((s) => typeof s === 'number');

      const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
      const maxScore = scores.length > 0 ? Math.max(...scores) : null;
      const participationRate =
        data.registeredEntrants.size > 0
          ? (data.submissions.length / data.registeredEntrants.size) * 100
          : 0;

      return {
        round: data.round,
        registeredCount: data.registeredEntrants.size,
        submissionCount: data.submissions.length,
        participationRate: Math.round(participationRate),
        averageScore: avgScore !== null ? Math.round(avgScore * 100) / 100 : null,
        highestScore: maxScore,
      };
    });

    // Sort by round name for consistent ordering
    rounds.sort((a, b) => a.round.name.localeCompare(b.round.name));

    res.json({
      school: { id: school.id, name: school.name },
      totalEntrants: entrants.length,
      rounds,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not fetch school analytics' });
  }
});

// GET /schools/:id/dashboard
// Aggregated stats: entrant count, submission count, average score per
// entrant across all rounds they've sat, and the olympiads each entrant is
// registered under (for the student cards).
router.get('/schools/:id/dashboard', ...requireSchoolAccess(), async (req, res) => {
  try {
    const { id: schoolId } = req.params;

    const allowed = await canAccessSchool(req, schoolId);
    if (!allowed) {
      return res.status(403).json({ error: 'Not authorized to view this school' });
    }

    const school = await prisma.school.findUnique({ where: { id: schoolId } });
    if (!school) {
      return res.status(404).json({ error: 'School not found' });
    }

    const entrants = await prisma.entrant.findMany({
      where: { schoolId },
      include: {
        submissions: { include: { result: true } },
        user: { select: { email: true, passwordHash: true } },
        roundEntrants: {
          include: { round: { select: { olympiad: { select: { id: true, name: true } } } } },
        },
      },
    });

    const entrantSummaries = entrants.map((entrant) => {
      const scores = entrant.submissions
        .map((s) => s.result && s.result.score)
        .filter((score) => typeof score === 'number');

      const averageScore =
        scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;

      // Distinct olympiads this entrant has round registrations in — a
      // student is "under" an olympiad exactly when they have a RoundEntrant
      // row for one of its rounds.
      const olympiadById = new Map();
      for (const registration of entrant.roundEntrants) {
        const olympiad = registration.round.olympiad;
        if (olympiad) olympiadById.set(olympiad.id, olympiad);
      }

      return {
        id: entrant.id,
        name: entrant.name,
        grade: entrant.grade,
        email: entrant.user ? entrant.user.email : null,
        accountStatus: entrant.user
          ? entrant.user.passwordHash
            ? 'active'
            : 'invite_pending'
          : null,
        submissionCount: entrant.submissions.length,
        averageScore,
        olympiads: [...olympiadById.values()].sort((a, b) => a.name.localeCompare(b.name)),
      };
    });

    res.json({
      school: { id: school.id, name: school.name },
      entrantCount: entrants.length,
      totalSubmissions: entrantSummaries.reduce((sum, e) => sum + e.submissionCount, 0),
      entrants: entrantSummaries,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not fetch school dashboard' });
  }
});

module.exports = router;
