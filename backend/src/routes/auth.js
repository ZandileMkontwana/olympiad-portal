const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const clerkClient = require('@clerk/express').clerkClient;
const { requireAuth, loadAuthUser } = require('../middleware/auth');

// POST /educators/complete-profile
// Called once, after a user signs up via Clerk, to link them to our
// app-specific data (name, school) which Clerk doesn't know about.
router.post('/educators/complete-profile', requireAuth, async (req, res) => {
  const { userId: clerkUserId } = req.auth();
  const { name, schoolName } = req.body;

  if (!name || !schoolName) {
    return res.status(400).json({ error: 'name and schoolName are required' });
  }

  const existing = await prisma.user.findUnique({ where: { clerkUserId } });
  if (existing) {
    return res.status(409).json({ error: 'Profile already completed for this account' });
  }

  // Get the user's email from Clerk itself, since we don't collect it ourselves anymore
  const clerkUser = await clerkClient.users.getUser(clerkUserId);
  const email = clerkUser.emailAddresses[0] && clerkUser.emailAddresses[0].emailAddress;

  if (!email) {
    return res.status(400).json({ error: 'No email found on Clerk account' });
  }

  let school = await prisma.school.findFirst({
    where: { name: { equals: schoolName, mode: 'insensitive' } },
  });
  if (!school) {
    school = await prisma.school.create({
      data: { name: schoolName, timezone: 'Africa/Johannesburg' },
    });
  }

  const user = await prisma.user.create({
    data: {
      clerkUserId,
      email,
      role: 'educator',
      name,
      educator: {
        create: { schoolId: school.id },
      },
    },
    include: { educator: { include: { school: true } } },
  });

  res.status(201).json({
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      school: { id: user.educator.school.id, name: user.educator.school.name },
    },
  });
});

// GET /auth/me
// Dual-mode: resolves the caller from either a student JWT (Bearer token
// issued by /api/students/login) or a Clerk session, so both student and
// educator/organiser clients can fetch their profile.
router.get('/auth/me', requireAuth, async (req, res) => {
  try {
    const user = await loadAuthUser(req);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userWithRelations = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        educator: { include: { school: true } },
        entrant: { include: { school: true } },
      },
    });

    const schoolRecord =
      userWithRelations.educator?.school ?? userWithRelations.entrant?.school ?? null;

    res.json({
      user: {
        id: userWithRelations.id,
        email: userWithRelations.email,
        role: userWithRelations.role,
        name: userWithRelations.name,
        school: schoolRecord ? { id: schoolRecord.id, name: schoolRecord.name } : null,
        entrantId: userWithRelations.entrant?.id ?? null,
      },
    });
  } catch (err) {
    console.error('Auth/me failed:', err);
    res.status(500).json({ error: 'Could not load your account' });
  }
});

// DELETE /auth/account
router.delete('/auth/account', requireAuth, async (req, res) => {
  try {
    const user = await loadAuthUser(req);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    await prisma.user.delete({ where: { id: user.id } });
    // Also delete from Clerk itself, so the account is fully gone, not just
    // our copy. Educator-registered students have no Clerk account (null).
    if (user.clerkUserId) {
      await clerkClient.users.deleteUser(user.clerkUserId);
    }

    res.status(200).json({ message: 'Account deleted successfully' });
  } catch (err) {
    console.error('Account deletion failed:', err);
    res.status(500).json({ error: 'Could not delete the account' });
  }
});

module.exports = router;
