const express = require('express');
const prisma = require('../lib/prisma');
const { requireRole } = require('../middleware/auth');
const { isOlympiadOrganiser } = require('../lib/authorization');

const router = express.Router();

// GET /organisers
// Lists all users with role 'organiser' — used by the "Add organiser"
// dropdown so the creator can pick a co-organiser.
router.get('/organisers', ...requireRole('organiser'), async (req, res) => {
  try {
    const organisers = await prisma.user.findMany({
      where: { role: 'organiser' },
      select: { id: true, name: true, email: true },
      orderBy: { name: 'asc' },
    });
    res.json(organisers);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch organisers' });
  }
});

// GET /olympiads/:id/organisers
// Lists all organisers (creator + co-organisers) for an olympiad.
// Only existing organisers of the olympiad may view the list.
router.get(
  '/olympiads/:id/organisers',
  ...requireRole('organiser'),
  async (req, res) => {
    try {
      const olympiadId = req.params.id;

      if (!(await isOlympiadOrganiser(req.user.id, olympiadId))) {
        return res
          .status(403)
          .json({ error: 'You are not an organiser of this olympiad' });
      }

      const rows = await prisma.olympiadOrganiser.findMany({
        where: { olympiadId },
        include: {
          organiser: { select: { id: true, name: true, email: true } },
        },
        orderBy: { addedAt: 'asc' },
      });

      const olympiad = await prisma.olympiad.findUnique({
        where: { id: olympiadId },
        select: { organiserId: true },
      });

      res.json(
        rows.map((row) => ({
          id: row.id,
          organiserId: row.organiserId,
          name: row.organiser.name,
          email: row.organiser.email,
          addedAt: row.addedAt,
          isCreator: row.organiserId === olympiad?.organiserId,
        }))
      );
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to fetch organisers' });
    }
  }
);

// POST /olympiads/:id/organisers
// Adds an organiser to an olympiad. Only existing organisers may add.
// The target user must exist and have role 'organiser'.
router.post(
  '/olympiads/:id/organisers',
  ...requireRole('organiser'),
  async (req, res) => {
    try {
      const olympiadId = req.params.id;
      const { organiserId } = req.body;

      if (!organiserId) {
        return res.status(400).json({ error: 'organiserId is required' });
      }

      if (!(await isOlympiadOrganiser(req.user.id, olympiadId))) {
        return res
          .status(403)
          .json({ error: 'You are not an organiser of this olympiad' });
      }

      const olympiad = await prisma.olympiad.findUnique({
        where: { id: olympiadId },
      });
      if (!olympiad) {
        return res.status(404).json({ error: 'Olympiad not found' });
      }

      const targetUser = await prisma.user.findUnique({
        where: { id: organiserId },
      });
      if (!targetUser) {
        return res.status(404).json({ error: 'User not found' });
      }
      if (targetUser.role !== 'organiser') {
        return res
          .status(400)
          .json({ error: 'Target user is not an organiser' });
      }

      const existing = await prisma.olympiadOrganiser.findUnique({
        where: { olympiadId_organiserId: { olympiadId, organiserId } },
      });
      if (existing) {
        return res
          .status(409)
          .json({ error: 'User is already an organiser of this olympiad' });
      }

      const row = await prisma.olympiadOrganiser.create({
        data: { olympiadId, organiserId },
      });

      res.status(201).json({
        id: row.id,
        organiserId: row.organiserId,
        name: targetUser.name,
        email: targetUser.email,
        addedAt: row.addedAt,
        isCreator: false,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to add organiser' });
    }
  }
);

// DELETE /olympiads/:id/organisers/:organiserId
// Removes a co-organiser from an olympiad.
// Rules: any existing organiser can remove another, but the creator
// (Olympiad.organiserId) cannot be removed — not even by themselves.
router.delete(
  '/olympiads/:id/organisers/:organiserId',
  ...requireRole('organiser'),
  async (req, res) => {
    try {
      const olympiadId = req.params.id;
      const targetOrganiserId = req.params.organiserId;

      if (!(await isOlympiadOrganiser(req.user.id, olympiadId))) {
        return res
          .status(403)
          .json({ error: 'You are not an organiser of this olympiad' });
      }

      const olympiad = await prisma.olympiad.findUnique({
        where: { id: olympiadId },
        select: { organiserId: true },
      });

      if (!olympiad) {
        return res.status(404).json({ error: 'Olympiad not found' });
      }

      // The creator is never removable.
      if (targetOrganiserId === olympiad.organiserId) {
        return res.status(403).json({
          error: 'The creator of the olympiad cannot be removed',
        });
      }

      const row = await prisma.olympiadOrganiser.findUnique({
        where: {
          olympiadId_organiserId: { olympiadId, organiserId: targetOrganiserId },
        },
      });
      if (!row) {
        return res
          .status(404)
          .json({ error: 'Organiser not found for this olympiad' });
      }

      await prisma.olympiadOrganiser.delete({
        where: { id: row.id },
      });

      res.status(204).send();
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to remove organiser' });
    }
  }
);

module.exports = router;
