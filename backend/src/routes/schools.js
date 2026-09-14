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

// GET /schools/:id/dashboard
// Aggregated stats: entrant count, submission count, and average score
// per entrant across all rounds they've sat.
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
      },
    });

    const entrantSummaries = entrants.map((entrant) => {
      const scores = entrant.submissions
        .map((s) => s.result && s.result.score)
        .filter((score) => typeof score === 'number');

      const averageScore =
        scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;

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
