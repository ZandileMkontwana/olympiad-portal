const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const clerkClient = require('@clerk/express').clerkClient;
const { requireAuth, loadAuthUser } = require('../middleware/auth');

// POST /educators/complete-profile
// Called once, after a user signs up via Clerk, to link them to our
// app-specific data (name, school) which Clerk doesn't know about.
router.post('/educators/complete-profile', requireAuth, async (req, res) => {
  if (req.authMode !== 'clerk') {
    return res.status(403).json({ error: 'An educator sign-in is required to complete a profile' });
  }
  const clerkUserId = req.authUserId;
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const schoolName = typeof req.body?.schoolName === 'string' ? req.body.schoolName.trim() : '';

  if (!name || !schoolName || name.length > 200 || schoolName.length > 200) {
    return res.status(400).json({ error: 'name and schoolName are required' });
  }

  const include = { educator: { include: { school: true } } };
  const respond = (user, status) =>
    res.status(status).json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
        school: user.educator?.school
          ? { id: user.educator.school.id, name: user.educator.school.name }
          : null,
      },
    });

  try {
    const existingByClerkId = await prisma.user.findUnique({ where: { clerkUserId }, include });
    // Retried requests (including a response lost after a successful save)
    // must return the existing profile without changing its role or school.
    if (existingByClerkId) return respond(existingByClerkId, 200);

    const clerkUser = await clerkClient.users.getUser(clerkUserId);
    const emailRecord =
      clerkUser.emailAddresses.find((entry) => entry.id === clerkUser.primaryEmailAddressId) ||
      clerkUser.emailAddresses[0];
    if (!emailRecord?.emailAddress) {
      return res.status(400).json({ error: 'No email found on Clerk account' });
    }
    if (emailRecord.verification?.status !== 'verified') {
      return res
        .status(400)
        .json({ error: 'Please verify your email before completing your profile' });
    }
    const email = emailRecord.emailAddress.trim().toLowerCase();

    const existingByEmail = await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      include,
    });
    if (existingByEmail) {
      if (existingByEmail.clerkUserId === clerkUserId) return respond(existingByEmail, 200);
      return res.status(409).json({
        error:
          'An account with this email already exists. Contact your administrator to link your sign-in account.',
      });
    }

    const user = await prisma.$transaction(async (tx) => {
      let school = await tx.school.findFirst({
        where: { name: { equals: schoolName, mode: 'insensitive' } },
      });
      if (!school) {
        school = await tx.school.create({
          data: { name: schoolName, timezone: 'Africa/Johannesburg' },
        });
      }
      return tx.user.create({
        data: {
          clerkUserId,
          email,
          role: 'educator',
          name,
          educator: { create: { schoolId: school.id } },
        },
        include,
      });
    });

    return respond(user, 201);
  } catch (err) {
    if (err.code === 'P2002') {
      // Two tabs may submit together. The unique Clerk id keeps one profile.
      const existing = await prisma.user.findUnique({ where: { clerkUserId }, include });
      if (existing) return respond(existing, 200);
      return res.status(409).json({
        error:
          'An account with this email already exists. Contact your administrator to link your sign-in account.',
      });
    }
    console.error('Profile completion failed:', err);
    return res.status(500).json({ error: 'Could not save your profile. Please try again.' });
  }
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
// Self-service account deletion. Cascades through all related data in a
// transaction so the user row can be removed without FK violations:
//   - Students: entrant + their submissions, results, sittings, etc.
//   - Educators: educator row + nullify marking-task assignments
//   - Organisers: nullify olympiad ownership, delete co-organiser rows
// After the DB transaction, the Clerk identity is deleted (best-effort).
router.delete('/auth/account', requireAuth, async (req, res) => {
  try {
    const authUser = await loadAuthUser(req);

    if (!authUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Load the full user with relations needed for cascade
    const user = await prisma.user.findUnique({
      where: { id: authUser.id },
      include: {
        entrant: {
          include: {
            submissions: { select: { id: true } },
          },
        },
        educator: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Guard: organisers who own olympiads must transfer ownership before
    // deleting their account. Nullifying organiserId would orphan the
    // olympiads with no responsible organiser.
    if (user.role === 'organiser') {
      const ownedCount = await prisma.olympiad.count({
        where: { organiserId: user.id },
      });
      if (ownedCount > 0) {
        return res.status(409).json({
          error:
            'You still own olympiads. Transfer ownership to another organiser before deleting your account.',
        });
      }
    }

    await prisma.$transaction(async (tx) => {
      // Student path: cascade through entrant data (same pattern as
      // DELETE /entrants/:id in entrants.js)
      if (user.entrant) {
        const submissionIds = user.entrant.submissions.map((s) => s.id);
        if (submissionIds.length > 0) {
          await tx.result.deleteMany({ where: { submissionId: { in: submissionIds } } });
          await tx.markingTask.deleteMany({ where: { submissionId: { in: submissionIds } } });
          await tx.remarkRequest.deleteMany({ where: { submissionId: { in: submissionIds } } });
        }
        await tx.submission.deleteMany({ where: { entrantId: user.entrant.id } });
        await tx.sitting.deleteMany({ where: { entrantId: user.entrant.id } });
        await tx.roundEntrant.deleteMany({ where: { entrantId: user.entrant.id } });
        await tx.notificationLog.deleteMany({ where: { entrantId: user.entrant.id } });
        await tx.entrant.delete({ where: { id: user.entrant.id } });
      }

      // Educator row (1:1 with user)
      if (user.educator) {
        await tx.educator.delete({ where: { id: user.educator.id } });
      }

      // Remark requests this user requested (required FK: requestedById)
      await tx.remarkRequest.deleteMany({ where: { requestedById: user.id } });

      // Nullify optional user references in marking tasks and remarks
      await tx.markingTask.updateMany({
        where: { assignedToId: user.id },
        data: { assignedToId: null },
      });
      await tx.markingTask.updateMany({
        where: { moderatedById: user.id },
        data: { moderatedById: null },
      });
      await tx.remarkRequest.updateMany({
        where: { assignedToId: user.id },
        data: { assignedToId: null },
      });
      await tx.remarkRequest.updateMany({
        where: { reviewedById: user.id },
        data: { reviewedById: null },
      });

      // Olympiad ownership: nullify the organiser reference so the olympiad
      // survives but is no longer tied to this account
      await tx.olympiad.updateMany({
        where: { organiserId: user.id },
        data: { organiserId: null },
      });
      await tx.olympiadOrganiser.deleteMany({ where: { organiserId: user.id } });

      // Finally, delete the user
      await tx.user.delete({ where: { id: user.id } });
    });

    // External Clerk deletion — best-effort, outside the DB transaction so
    // a Clerk API failure doesn't roll back the local deletion.
    if (user.clerkUserId) {
      try {
        await clerkClient.users.deleteUser(user.clerkUserId);
      } catch (clerkErr) {
        console.error('Clerk deletion failed (account already removed locally):', clerkErr);
      }
    }

    res.status(200).json({ message: 'Account deleted successfully' });
  } catch (err) {
    console.error('Account deletion failed:', err);
    res.status(500).json({ error: 'Could not delete the account' });
  }
});

module.exports = router;
