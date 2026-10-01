const express = require('express');
const crypto = require('crypto');
const prisma = require('../lib/prisma');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

/**
 * Generates a secure random API key.
 * Format: "olymp_<32 bytes hex>" for easy identification.
 */
function generateApiKey() {
  return `olymp_${crypto.randomBytes(32).toString('hex')}`;
}

// POST /api-keys — organiser-only; creates a new API key for external access
router.post('/', ...requireRole('organiser'), async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'name is required' });
    }

    const key = generateApiKey();

    const apiKey = await prisma.apiKey.create({
      data: {
        key,
        name: name.trim(),
        createdBy: req.user.id,
      },
    });

    // Return the full key only on creation — it cannot be retrieved later
    res.status(201).json({
      id: apiKey.id,
      key: apiKey.key, // only time the full key is shown
      name: apiKey.name,
      createdAt: apiKey.createdAt,
    });
  } catch (err) {
    console.error('Failed to create API key:', err);
    res.status(500).json({ error: 'Failed to create API key' });
  }
});

// GET /api-keys — organiser-only; lists all API keys (without the full key value)
router.get('/', ...requireRole('organiser'), async (req, res) => {
  try {
    const keys = await prisma.apiKey.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        createdAt: true,
        revokedAt: true,
        createdBy: true,
        // Show only the first 12 chars of the key for identification
        key: true,
      },
    });

    // Mask the full key, showing only prefix for identification
    const masked = keys.map((k) => ({
      id: k.id,
      name: k.name,
      keyPrefix: k.key.slice(0, 12) + '...',
      createdAt: k.createdAt,
      revokedAt: k.revokedAt,
      createdBy: k.createdBy,
    }));

    res.json(masked);
  } catch (err) {
    console.error('Failed to list API keys:', err);
    res.status(500).json({ error: 'Failed to list API keys' });
  }
});

// DELETE /api-keys/:id — organiser-only; revokes an API key
router.delete('/:id', ...requireRole('organiser'), async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await prisma.apiKey.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'API key not found' });
    }

    if (existing.revokedAt) {
      return res.status(400).json({ error: 'API key is already revoked' });
    }

    const revoked = await prisma.apiKey.update({
      where: { id },
      data: { revokedAt: new Date() },
    });

    res.json({
      id: revoked.id,
      name: revoked.name,
      revokedAt: revoked.revokedAt,
    });
  } catch (err) {
    console.error('Failed to revoke API key:', err);
    res.status(500).json({ error: 'Failed to revoke API key' });
  }
});

module.exports = router;
