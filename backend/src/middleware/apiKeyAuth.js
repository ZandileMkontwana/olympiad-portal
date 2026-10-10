const prisma = require('../lib/prisma');

/**
 * API key authentication middleware for external read-only endpoints.
 * Validates the X-API-Key header against the database and attaches
 * the key record to req.apiKey for downstream use (e.g. rate limiting).
 *
 * Usage: app.use('/external', requireApiKey, externalRoutes);
 */
async function requireApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey) {
    return res.status(401).json({
      error: 'API key required. Pass your key in the X-API-Key header.',
    });
  }

  try {
    const keyRecord = await prisma.apiKey.findUnique({
      where: { key: apiKey },
    });

    if (!keyRecord) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    if (keyRecord.revokedAt) {
      return res.status(403).json({ error: 'This API key has been revoked' });
    }

    // Attach key info to request for rate limiting and auditing
    req.apiKey = keyRecord;
    next();
  } catch (err) {
    console.error('API key validation failed:', err);
    res.status(500).json({ error: 'API key validation failed' });
  }
}

module.exports = { requireApiKey };
