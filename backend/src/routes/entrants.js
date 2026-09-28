const express = require('express');
const crypto = require('crypto');
const prisma = require('../lib/prisma');
const { requireRole } = require('../middleware/auth');
const { sendStudentInvitation } = require('../lib/email');
const { filterQualifiedEntrantIds } = require('../lib/qualification');

const router = express.Router();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Grades are South African school grades: whole numbers 1–12.
const GRADE_REGEX = /^(?:[1-9]|1[0-2])$/;
const INVITATION_TTL_MS = 48 * 60 * 60 * 1000; // 48 hours

function buildInvitationUrl(token) {
  const base = process.env.FRONTEND_URL || 'http://localhost:3000';
  return `${base}/set-password?token=${token}`;
}

/**
 * Loads the educator profile for the authenticated user, so entrants are
 * always scoped to the educator's own school. Responds and returns null if
 * the account has no educator profile.
 */
async function loadEducator(req, res) {
  const educator = await prisma.educator.findUnique({
    where: { userId: req.user.id },
  });
  if (!educator) {
    res.status(403).json({ error: 'No school linked to this account' });
    return null;
  }
  return educator;
}

/**
 * Creates the student User record holding a fresh invitation token.
 * Must run inside the same transaction as the entrant create/update so
 * the two records can never get out of sync.
 */
function newInvitation() {
  return {
    token: crypto.randomBytes(32).toString('hex'),
    expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
  };
}

// POST /entrants
// Registers a student at the authenticated educator's school: creates the
// Entrant record AND their student account (email + role) with an invitation
// to set a password, then emails the student the activation link.
router.post('/entrants', ...requireRole('educator'), async (req, res) => {
  try {
    const { name, email, grade, olympiadId } = req.body;
    if (!name || !email || !grade) {
      return res.status(400).json({ error: 'name, email and grade are required' });
    }
    if (!olympiadId) {
      return res
        .status(400)
        .json({ error: 'olympiadId is required — select which olympiad to add the student under' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    if (!EMAIL_REGEX.test(normalizedEmail)) {
      return res.status(400).json({ error: 'email must be a valid email address' });
    }

    const normalizedGrade = String(grade).trim();
    if (!GRADE_REGEX.test(normalizedGrade)) {
      return res.status(400).json({ error: 'grade must be a whole number from 1 to 12' });
    }

    const educator = await loadEducator(req, res);
    if (!educator) return;

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existingUser) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const school = await prisma.school.findUnique({
      where: { id: educator.schoolId },
    });

    const invitation = newInvitation();

    const entrant = await prisma.$transaction(async (tx) => {
      const created = await tx.entrant.create({
        data: {
          name: String(name).trim(),
          grade: normalizedGrade,
          schoolId: educator.schoolId,
        },
      });

      await tx.user.create({
        data: {
          email: normalizedEmail,
          role: 'student',
          name: String(name).trim(),
          invitationToken: invitation.token,
          invitationExpiresAt: invitation.expiresAt,
          entrant: { connect: { id: created.id } },
        },
      });

      return created;
    });

    // Auto-register the new entrant for open rounds of the specified
    // olympiad, but only if the school has approved access to it and only
    // for rounds the entrant qualifies for. Gated rounds are skipped until
    // the qualification is met.
    const access = await prisma.schoolOlympiad.findUnique({
      where: {
        schoolId_olympiadId: { schoolId: educator.schoolId, olympiadId },
      },
    });
    if (!access || access.status !== 'approved') {
      return res.status(403).json({
        error:
          "Your school doesn't have access to this olympiad yet — request access from the organiser.",
      });
    }
    const openRounds = await prisma.round.findMany({
      where: {
        state: 'open',
        olympiadId,
      },
      select: {
        id: true,
        name: true,
        prerequisiteRoundId: true,
        qualifyingThreshold: true,
        olympiad: { select: { name: true } },
      },
    });
    const registerableRoundIds = [];
    for (const round of openRounds) {
      const qualifiedIds = await filterQualifiedEntrantIds([entrant.id], round);
      if (qualifiedIds.length > 0) registerableRoundIds.push(round.id);
    }
    if (registerableRoundIds.length > 0) {
      await prisma.roundEntrant.createMany({
        data: registerableRoundIds.map((roundId) => ({ roundId, entrantId: entrant.id })),
        skipDuplicates: true,
      });
    }

    const invitationSent = await sendStudentInvitation({
      toEmail: normalizedEmail,
      studentName: entrant.name,
      schoolName: school ? school.name : 'your school',
      invitationUrl: buildInvitationUrl(invitation.token),
    });

    res.status(201).json({
      ...entrant,
      email: normalizedEmail,
      accountStatus: 'invite_pending',
      invitationSent,
      // Which open rounds the entrant was registered for, so the educator
      // can see which olympiads the student now falls under. Only rounds
      // that passed the qualification gate are listed.
      registeredRounds: openRounds
        .filter((round) => registerableRoundIds.includes(round.id))
        .map((round) => ({
          id: round.id,
          name: round.name,
          olympiadName: round.olympiad.name,
        })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not create entrant' });
  }
});

// POST /entrants/:id/resend-invite
// Re-sends the set-password invitation for a student at the educator's own
// school. Covers three cases: invite-pending students (fresh link), legacy
// entrants with no user account yet (creates the account — email required
// in the body), and active students who forgot their password (the new link
// lets them set a new one).
router.post('/entrants/:id/resend-invite', ...requireRole('educator'), async (req, res) => {
  try {
    const educator = await loadEducator(req, res);
    if (!educator) return;

    const entrant = await prisma.entrant.findUnique({
      where: { id: req.params.id },
      include: { user: true, school: { select: { name: true } } },
    });

    if (!entrant || entrant.schoolId !== educator.schoolId) {
      return res.status(404).json({ error: 'Entrant not found at your school' });
    }

    let email = entrant.user
      ? entrant.user.email
      : req.body && req.body.email
        ? String(req.body.email).trim().toLowerCase()
        : null;

    if (!email) {
      return res.status(400).json({ error: 'email is required for students without an account' });
    }

    const invitation = newInvitation();

    if (entrant.user) {
      await prisma.user.update({
        where: { id: entrant.user.id },
        data: {
          invitationToken: invitation.token,
          invitationExpiresAt: invitation.expiresAt,
        },
      });
    } else {
      if (!EMAIL_REGEX.test(email)) {
        return res.status(400).json({ error: 'email must be a valid email address' });
      }

      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        return res.status(409).json({ error: 'An account with this email already exists' });
      }

      await prisma.user.create({
        data: {
          email,
          role: 'student',
          name: entrant.name,
          invitationToken: invitation.token,
          invitationExpiresAt: invitation.expiresAt,
          entrant: { connect: { id: entrant.id } },
        },
      });
    }

    const invitationSent = await sendStudentInvitation({
      toEmail: email,
      studentName: entrant.name,
      schoolName: entrant.school.name,
      invitationUrl: buildInvitationUrl(invitation.token),
    });

    res.json({ message: 'Invitation sent', invitationSent });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not resend the invitation' });
  }
});

// DELETE /entrants/:id
// Removes an entrant from the educator's own school together with their
// student account and everything they generated: results, submissions,
// sittings, round registrations and notification logs. The frontend
// confirms first — this is permanent.
router.delete('/entrants/:id', ...requireRole('educator'), async (req, res) => {
  try {
    const educator = await loadEducator(req, res);
    if (!educator) return;

    const entrant = await prisma.entrant.findUnique({
      where: { id: req.params.id },
      include: { user: { select: { id: true } } },
    });

    if (!entrant || entrant.schoolId !== educator.schoolId) {
      return res.status(404).json({ error: 'Entrant not found at your school' });
    }

    await prisma.$transaction(async (tx) => {
      // Results reference submissions, so they must go first; everything
      // else references the entrant directly.
      const submissions = await tx.submission.findMany({
        where: { entrantId: entrant.id },
        select: { id: true },
      });
      if (submissions.length > 0) {
        await tx.result.deleteMany({
          where: { submissionId: { in: submissions.map((s) => s.id) } },
        });
      }
      await tx.submission.deleteMany({ where: { entrantId: entrant.id } });
      await tx.sitting.deleteMany({ where: { entrantId: entrant.id } });
      await tx.roundEntrant.deleteMany({ where: { entrantId: entrant.id } });
      await tx.notificationLog.deleteMany({ where: { entrantId: entrant.id } });
      // Entrant.userId links the account, so the entrant row must go
      // before the account itself can be deleted.
      await tx.entrant.delete({ where: { id: entrant.id } });
      if (entrant.user) {
        await tx.user.delete({ where: { id: entrant.user.id } });
      }
    });

    res.json({ message: 'Entrant removed' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not remove the entrant' });
  }
});

// GET /entrants
// Lists the entrants registered at the authenticated educator's school.
router.get('/entrants', ...requireRole('educator'), async (req, res) => {
  try {
    const educator = await loadEducator(req, res);
    if (!educator) return;

    const entrants = await prisma.entrant.findMany({
      where: { schoolId: educator.schoolId },
      orderBy: { name: 'asc' },
      include: { user: { select: { email: true, passwordHash: true } } },
    });

    res.json(
      entrants.map((entrant) => ({
        ...entrant,
        email: entrant.user ? entrant.user.email : null,
        accountStatus: entrant.user
          ? entrant.user.passwordHash
            ? 'active'
            : 'invite_pending'
          : null,
        user: undefined,
      }))
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not fetch entrants' });
  }
});

module.exports = router;
