const prisma = require('./prisma');

/**
 * Checks whether a user is an organiser of a specific olympiad
 * (via the OlympiadOrganiser join table).
 */
async function isOlympiadOrganiser(userId, olympiadId) {
  if (!userId || !olympiadId) return false;
  const row = await prisma.olympiadOrganiser.findUnique({
    where: { olympiadId_organiserId: { olympiadId, organiserId: userId } },
  });
  return Boolean(row);
}

/**
 * Returns the user IDs of all organisers for an olympiad.
 */
async function getOlympiadOrganiserIds(olympiadId) {
  const rows = await prisma.olympiadOrganiser.findMany({
    where: { olympiadId },
    select: { organiserId: true },
  });
  return rows.map((r) => r.organiserId);
}

/**
 * Verifies that a school has approved access to a given olympiad.
 * Returns the SchoolOlympiad row on success, or null if access is not granted.
 * Organisers bypass this check (pass role='organiser' to skip).
 */
async function getSchoolOlympiadAccess(schoolId, olympiadId, role) {
  if (role === 'organiser') return { status: 'approved' };
  if (!schoolId || !olympiadId) return null;

  const access = await prisma.schoolOlympiad.findUnique({
    where: {
      schoolId_olympiadId: { schoolId, olympiadId },
    },
  });
  return access && access.status === 'approved' ? access : null;
}

/**
 * Loads the educator for a user and verifies their school has approved
 * access to the olympiad that owns the given round. Returns the educator
 * on success. Responds with 403 and returns null on failure.
 *
 * Organisers bypass the olympiad-access check (they see all data).
 *
 * @param {object} req  Express request
 * @param {object} res  Express response
 * @param {object} round  Round object (must have olympiadId)
 * @param {object} [user]  Optional user object (if omitted, uses req.user)
 */
async function requireOlympiadAccess(req, res, round, user) {
  const u = user || req.user;
  if (!u) {
    res.status(403).json({ error: 'Not authenticated' });
    return null;
  }
  if (u.role === 'organiser') {
    return { bypassed: true };
  }

  const educator = await prisma.educator.findUnique({
    where: { userId: u.id },
  });
  if (!educator) {
    res.status(403).json({ error: 'No school linked to this account' });
    return null;
  }

  const access = await getSchoolOlympiadAccess(
    educator.schoolId,
    round.olympiadId,
    u.role
  );
  if (!access) {
    res.status(403).json({
      error:
        "Your school doesn't have access to this olympiad — request access from the organiser.",
    });
    return null;
  }

  return { educator, access };
}

module.exports = {
  getSchoolOlympiadAccess,
  requireOlympiadAccess,
  isOlympiadOrganiser,
  getOlympiadOrganiserIds,
};
