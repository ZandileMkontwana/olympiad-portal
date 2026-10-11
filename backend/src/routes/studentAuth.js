const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');
const { sendPasswordResetEmail } = require('../lib/email');

const router = express.Router();

const TOKEN_TTL = '7d';
const MIN_PASSWORD_LENGTH = 8;
const RESET_TTL_MS = 48 * 60 * 60 * 1000; // 48 hours

function buildResetUrl(token) {
  const base = process.env.FRONTEND_URL || 'http://localhost:3000';
  return `${base}/reset-password?token=${token}`;
}

/**
 * Signs the JWT students use for authenticated requests. The middleware
 * (middleware/auth.js) verifies it against JWT_SECRET and loads the user
 * by the `sub` claim.
 */
function signSessionToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: TOKEN_TTL,
  });
}

/**
 * Same user shape as GET /auth/me, so student pages can treat the login /
 * set-password response as the current-user object.
 */
function toSessionUser(user) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
    school: user.entrant?.school
      ? { id: user.entrant.school.id, name: user.entrant.school.name }
      : null,
    entrantId: user.entrant?.id ?? null,
  };
}

// POST /students/login
// Email + password sign-in for educator-registered students. Accounts that
// were invited but have not set a password yet get a distinct 403 so the
// student knows to look for their invitation email.
router.post('/students/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }

    const user = await prisma.user.findUnique({
      where: { email: String(email).trim().toLowerCase() },
      include: { entrant: { include: { school: true } } },
    });

    if (!user || user.role !== 'student') {
      // Deliberately vague: never reveal whether the email exists.
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (!user.passwordHash) {
      return res.status(403).json({
        error:
          'Your account is not activated yet. Check your email for the invitation to set a password, or ask your educator to resend it.',
      });
    }

    const passwordOk = await bcrypt.compare(String(password), user.passwordHash);
    if (!passwordOk) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    res.json({ token: signSessionToken(user), user: toSessionUser(user) });
  } catch (err) {
    console.error('Student login failed:', err);
    res.status(500).json({ error: 'Could not sign in. Please try again.' });
  }
});

// POST /students/set-password
// Public: consumes an invitation token, stores the chosen password and
// returns a session token so the student is signed in immediately.
// Also migrates legacy Clerk-linked student accounts to email login by
// clearing their clerkUserId.
router.post('/students/set-password', async (req, res) => {
  try {
    const { token, password } = req.body || {};
    if (!token || !password) {
      return res.status(400).json({ error: 'token and password are required' });
    }

    if (String(password).length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({
        error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters long`,
      });
    }

    const user = await prisma.user.findUnique({
      where: { invitationToken: String(token) },
      include: { entrant: { include: { school: true } } },
    });

    if (!user || user.role !== 'student') {
      return res.status(400).json({
        error: 'This invitation link is not valid. Ask your educator to send a new one.',
      });
    }

    if (!user.invitationExpiresAt || new Date(user.invitationExpiresAt) < new Date()) {
      return res.status(400).json({
        error: 'This invitation link has expired. Ask your educator to resend the invitation.',
      });
    }

    const passwordHash = await bcrypt.hash(String(password), 10);

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        invitationToken: null,
        invitationExpiresAt: null,
        clerkUserId: null, // legacy Clerk link can no longer sign in
      },
      include: { entrant: { include: { school: true } } },
    });

    res.json({ token: signSessionToken(updated), user: toSessionUser(updated) });
  } catch (err) {
    console.error('Student set-password failed:', err);
    res.status(500).json({ error: 'Could not set your password. Please try again.' });
  }
});

// POST /students/refresh
// Proactive token refresh: accepts a valid (non-expired) JWT and returns a
// new one with a fresh 7-day TTL. This lets the frontend refresh the token
// before it expires, so students don't get logged out mid-sitting.
// Requires authentication (the auth middleware verifies the JWT).
router.post('/students/refresh', async (req, res) => {
  try {
    // req.auth is set by the auth middleware after verifying the JWT
    if (!req.auth || !req.auth.sub) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.auth.sub },
      include: { entrant: { include: { school: true } } },
    });

    if (!user || user.role !== 'student') {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    res.json({ token: signSessionToken(user), user: toSessionUser(user) });
  } catch (err) {
    console.error('Student token refresh failed:', err);
    res.status(500).json({ error: 'Could not refresh session. Please try again.' });
  }
});

// POST /students/forgot-password
// Self-service password reset for students. Accepts an email, generates a
// time-limited token, and sends a reset link. Deliberately vague: always
// returns 200 so the response never reveals whether the email exists.
router.post('/students/forgot-password', async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) {
      return res.status(400).json({ error: 'email is required' });
    }

    const user = await prisma.user.findUnique({
      where: { email: String(email).trim().toLowerCase() },
    });

    // Only send a reset email if the account exists, has a password set
    // (i.e. is activated), and is a student. Otherwise silently succeed.
    if (user && user.role === 'student' && user.passwordHash) {
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + RESET_TTL_MS);

      await prisma.user.update({
        where: { id: user.id },
        data: { invitationToken: token, invitationExpiresAt: expiresAt },
      });

      await sendPasswordResetEmail({
        toEmail: user.email,
        studentName: user.name,
        resetUrl: buildResetUrl(token),
      });
    }

    // Always 200 — never reveal whether the email exists or is activated.
    res.json({ message: 'If that email is registered, a reset link has been sent.' });
  } catch (err) {
    console.error('Student forgot-password failed:', err);
    res.status(500).json({ error: 'Could not process your request. Please try again.' });
  }
});

// POST /students/reset-password
// Public: consumes a reset token (from the forgot-password email), stores
// the new password, clears the token, and returns a session token.
router.post('/students/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body || {};
    if (!token || !password) {
      return res.status(400).json({ error: 'token and password are required' });
    }

    if (String(password).length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({
        error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters long`,
      });
    }

    const user = await prisma.user.findUnique({
      where: { invitationToken: String(token) },
      include: { entrant: { include: { school: true } } },
    });

    if (!user || user.role !== 'student') {
      return res.status(400).json({ error: 'This reset link is not valid.' });
    }

    if (!user.invitationExpiresAt || new Date(user.invitationExpiresAt) < new Date()) {
      return res.status(400).json({
        error: 'This reset link has expired. Request a new one from the login page.',
      });
    }

    const passwordHash = await bcrypt.hash(String(password), 10);

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        invitationToken: null,
        invitationExpiresAt: null,
      },
      include: { entrant: { include: { school: true } } },
    });

    res.json({ token: signSessionToken(updated), user: toSessionUser(updated) });
  } catch (err) {
    console.error('Student reset-password failed:', err);
    res.status(500).json({ error: 'Could not reset your password. Please try again.' });
  }
});

module.exports = router;
