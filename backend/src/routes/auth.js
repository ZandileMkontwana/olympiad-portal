const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { requireAuth, clerkClient } = require('@clerk/express');

// POST /educators/complete-profile
// Called once, after a user signs up via Clerk, to link them to our
// app-specific data (name, school) which Clerk doesn't know about.
router.post('/educators/complete-profile', requireAuth(), async (req, res) => {
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

  let school = await prisma.school.findFirst({ where: { name: schoolName } });
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
      school: user.educator.school.name,
    },
  });
});

// GET /auth/me
router.get('/auth/me', requireAuth(), async (req, res) => {
  const { userId: clerkUserId } = req.auth();

  const user = await prisma.user.findUnique({
    where: { clerkUserId },
    include: { educator: { include: { school: true } } },
  });

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json({
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      school: user.educator ? user.educator.school.name : null,
    },
  });
});

// DELETE /auth/account
router.delete('/auth/account', requireAuth(), async (req, res) => {
  const { userId: clerkUserId } = req.auth();

  const user = await prisma.user.findUnique({ where: { clerkUserId } });
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  await prisma.user.delete({ where: { id: user.id } });
  // Also delete from Clerk itself, so the account is fully gone, not just our copy
  await clerkClient.users.deleteUser(clerkUserId);

  res.status(200).json({ message: 'Account deleted successfully' });
});

module.exports = router;
