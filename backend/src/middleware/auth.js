const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

function requireAuth(req, res, next) {
  const token = req.cookies?.token;

  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    console.error('Invalid or expired token', err.message);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireRole(role) {
  return [
    requireAuth,
    (req, res, next) => {
      if (req.user.role !== role) {
        return res.status(403).json({ error: `${role} access required` });
      }
      next();
    },
  ];
}

module.exports = { requireAuth, requireRole };
