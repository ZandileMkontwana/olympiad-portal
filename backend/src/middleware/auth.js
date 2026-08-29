const prisma = require('../lib/prisma');

/**
 * Clerk-based auth guard.
 * Relies on clerkMiddleware() having already populated req.auth().
 */
function requireAuth(req, res, next) {
  const auth = req.auth && req.auth();
  if (!auth || !auth.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  next();
}

/**
 * Role guard — authenticates via Clerk, then checks the user's role
 * in our database.
 */
function requireRole(role) {
  return [
    requireAuth,
    async (req, res, next) => {
      try {
        const { userId: clerkUserId } = req.auth();
        const user = await prisma.user.findUnique({ where: { clerkUserId } });

        if (!user) {
          return res.status(404).json({ error: 'User not found' });
        }

        if (user.role !== role) {
          return res.status(403).json({ error: `${role} access required` });
        }

        req.user = user;
        next();
      } catch (err) {
        console.error('Role check failed:', err);
        res.status(500).json({ error: 'Authorization check failed' });
      }
    },
  ];
}

module.exports = { requireAuth, requireRole };
