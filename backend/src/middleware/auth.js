const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');
const { isDbBusyError, respondDbBusy } = require('../lib/dbErrors');

/**
 * Extracts a Bearer token from the Authorization header, if any.
 */
function extractBearerToken(req) {
  const header = req.headers && req.headers.authorization;
  if (typeof header !== 'string' || !header.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length).trim();
  return token || null;
}

/**
 * Verifies a student JWT (issued by POST /api/students/login) and returns
 * the user id it was issued for, or null when the token is invalid.
 */
function verifyStudentJwt(token) {
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    return payload && payload.sub ? payload.sub : null;
  } catch {
    return null;
  }
}

/**
 * Dual-mode auth guard — supports both auth mechanisms in the app:
 *   1. Students log in with email + password and send a JWT we signed
 *      (Authorization: Bearer <jwt>).
 *   2. Educators/organisers authenticate via Clerk; clerkMiddleware()
 *      populates req.auth() — also from a Bearer header (the Clerk session
 *      token), so an unverifiable Bearer token falls through to Clerk.
 *
 * Only establishes identity: it stashes req.authMode ('jwt' | 'clerk') and
 * req.authUserId (our user id, or the Clerk user id). Use loadAuthUser to
 * fetch the database record.
 */
function requireAuth(req, res, next) {
  const token = extractBearerToken(req);
  if (token) {
    const userId = verifyStudentJwt(token);
    if (userId) {
      req.authMode = 'jwt';
      req.authUserId = userId;
      return next();
    }
    // Not one of our JWTs — fall through to the Clerk path, where
    // clerkMiddleware may have validated this same Bearer token.
  }

  const auth = req.auth && req.auth();
  if (!auth || !auth.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  req.authMode = 'clerk';
  req.authUserId = auth.userId;
  next();
}

/**
 * Loads the database User for the identity established by requireAuth:
 * by id for student JWTs, by clerkUserId for Clerk sessions.
 */
async function loadAuthUser(req) {
  if (req.authMode === 'jwt') {
    return prisma.user.findUnique({ where: { id: req.authUserId } });
  }
  if (req.authMode === 'clerk') {
    return prisma.user.findUnique({ where: { clerkUserId: req.authUserId } });
  }
  return null;
}

/**
 * Resolves the caller's database User when credentials are present, without
 * rejecting anonymous requests. Used by public endpoints that behave
 * differently for signed-in users (e.g. GET /olympiads filters for
 * organisers but stays open to educators and anonymous visitors).
 */
async function loadOptionalUser(req) {
  const token = extractBearerToken(req);
  if (token) {
    const userId = verifyStudentJwt(token);
    if (userId) {
      req.authMode = 'jwt';
      req.authUserId = userId;
      return prisma.user.findUnique({ where: { id: userId } });
    }
  }

  const auth = req.auth && req.auth();
  if (auth && auth.userId) {
    req.authMode = 'clerk';
    req.authUserId = auth.userId;
    return prisma.user.findUnique({ where: { clerkUserId: auth.userId } });
  }

  return null;
}

/**
 * Role guard — authenticates via requireAuth, then checks the user's role
 * in our database.
 */
function requireRole(role) {
  return [
    requireAuth,
    async (req, res, next) => {
      try {
        const user = await loadAuthUser(req);

        if (!user) {
          return res.status(404).json({ error: 'User not found' });
        }

        if (user.role !== role) {
          return res.status(403).json({ error: `${role} access required` });
        }

        req.user = user;
        next();
      } catch (err) {
        // Pool exhaustion during the role lookup is a capacity problem,
        // not an authorisation failure — surface it as the #202 busy
        // contract (503 + Retry-After) so retry-capable clients recover
        // instead of treating it as a hard 500.
        if (isDbBusyError(err)) {
          return respondDbBusy(req, res, err);
        }
        console.error('Role check failed:', err);
        res.status(500).json({ error: 'Authorization check failed' });
      }
    },
  ];
}

module.exports = { requireAuth, requireRole, loadAuthUser, loadOptionalUser };
