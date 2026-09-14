import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const prisma = require('../lib/prisma');
const studentAuthRouter = require('./studentAuth');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api', studentAuthRouter);
  return app;
}

function studentUser(overrides = {}) {
  return {
    id: 'user-1',
    email: 'student@school.com',
    role: 'student',
    name: 'Test Student',
    passwordHash: null,
    clerkUserId: null,
    invitationToken: null,
    invitationExpiresAt: null,
    entrant: {
      id: 'entrant-1',
      school: { id: 'school-1', name: 'Test School' },
    },
    ...overrides,
  };
}

describe('Student auth routes', () => {
  let app;
  // Precomputed so login tests don't each pay the bcrypt hashing cost.
  let validHash;

  beforeAll(async () => {
    validHash = await bcrypt.hash('password123', 10);
  });

  beforeEach(() => {
    vi.spyOn(prisma.user, 'findUnique');
    vi.spyOn(prisma.user, 'update');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    app = createApp();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('POST /api/students/login', () => {
    it('returns 400 when email or password is missing', async () => {
      const res = await request(app).post('/api/students/login').send({ email: 'a@b.com' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/required/);
    });

    it('returns 401 when no user exists for the email', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      const res = await request(app)
        .post('/api/students/login')
        .send({ email: 'nobody@school.com', password: 'password123' });
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid email or password');
    });

    it('returns 401 when the account is not a student (educator email)', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user-9', role: 'educator' });
      const res = await request(app)
        .post('/api/students/login')
        .send({ email: 'teacher@school.com', password: 'password123' });
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid email or password');
    });

    it('returns 403 with activation hint when password was never set', async () => {
      prisma.user.findUnique.mockResolvedValue(studentUser({ passwordHash: null }));
      const res = await request(app)
        .post('/api/students/login')
        .send({ email: 'student@school.com', password: 'password123' });
      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/not activated/);
    });

    it('returns 401 for a wrong password', async () => {
      prisma.user.findUnique.mockResolvedValue(studentUser({ passwordHash: validHash }));
      const res = await request(app)
        .post('/api/students/login')
        .send({ email: 'student@school.com', password: 'wrong-password' });
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid email or password');
    });

    it('returns a session token and user on success', async () => {
      prisma.user.findUnique.mockResolvedValue(studentUser({ passwordHash: validHash }));
      const res = await request(app)
        .post('/api/students/login')
        .send({ email: 'student@school.com', password: 'password123' });

      expect(res.status).toBe(200);
      expect(res.body.token).toEqual(expect.any(String));
      expect(res.body.user).toEqual({
        id: 'user-1',
        email: 'student@school.com',
        role: 'student',
        name: 'Test Student',
        school: { id: 'school-1', name: 'Test School' },
        entrantId: 'entrant-1',
      });

      // The returned token must authenticate against JWT_SECRET
      const payload = jwt.verify(res.body.token, 'test-secret');
      expect(payload.sub).toBe('user-1');
      expect(payload.role).toBe('student');
    });

    it('normalizes the email before lookup', async () => {
      prisma.user.findUnique.mockResolvedValue(studentUser({ passwordHash: validHash }));
      const res = await request(app)
        .post('/api/students/login')
        .send({ email: '  Student@School.com ', password: 'password123' });

      expect(res.status).toBe(200);
      expect(prisma.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { email: 'student@school.com' } })
      );
    });

    it('returns 500 on unexpected error', async () => {
      prisma.user.findUnique.mockRejectedValue(new Error('DB error'));
      const res = await request(app)
        .post('/api/students/login')
        .send({ email: 'student@school.com', password: 'password123' });
      expect(res.status).toBe(500);
    });
  });

  describe('POST /api/students/set-password', () => {
    it('returns 400 when token or password is missing', async () => {
      const res = await request(app)
        .post('/api/students/set-password')
        .send({ token: 'tok' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/required/);
    });

    it('returns 400 when the password is too short', async () => {
      const res = await request(app)
        .post('/api/students/set-password')
        .send({ token: 'tok', password: 'short' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/at least 8 characters/);
    });

    it('returns 400 for an unknown invitation token', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      const res = await request(app)
        .post('/api/students/set-password')
        .send({ token: 'unknown-token', password: 'password123' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/not valid/);
    });

    it('returns 400 when the invitation has expired', async () => {
      prisma.user.findUnique.mockResolvedValue(
        studentUser({ invitationToken: 'tok', invitationExpiresAt: new Date('2020-01-01') })
      );
      const res = await request(app)
        .post('/api/students/set-password')
        .send({ token: 'tok', password: 'password123' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/expired/);
    });

    it('stores the hash, clears the invitation and returns a session', async () => {
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
      prisma.user.findUnique.mockResolvedValue(
        studentUser({ invitationToken: 'tok', invitationExpiresAt: expiresAt })
      );
      prisma.user.update.mockResolvedValue(
        studentUser({ passwordHash: 'hashed', invitationToken: null, invitationExpiresAt: null })
      );

      const res = await request(app)
        .post('/api/students/set-password')
        .send({ token: 'tok', password: 'password123' });

      expect(res.status).toBe(200);
      expect(res.body.token).toEqual(expect.any(String));
      expect(res.body.user.email).toBe('student@school.com');

      const updateArg = prisma.user.update.mock.calls[0][0];
      expect(updateArg.where).toEqual({ id: 'user-1' });
      expect(updateArg.data.invitationToken).toBeNull();
      expect(updateArg.data.invitationExpiresAt).toBeNull();
      expect(updateArg.data.clerkUserId).toBeNull();
      // Stored hash must verify against the chosen password
      await expect(bcrypt.compare('password123', updateArg.data.passwordHash)).resolves.toBe(true);

      const payload = jwt.verify(res.body.token, 'test-secret');
      expect(payload.sub).toBe('user-1');
    });

    it('drops the legacy Clerk link when setting a password', async () => {
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
      prisma.user.findUnique.mockResolvedValue(
        studentUser({
          clerkUserId: 'clerk-user-1',
          invitationToken: 'tok',
          invitationExpiresAt: expiresAt,
        })
      );
      prisma.user.update.mockResolvedValue(studentUser({ passwordHash: 'hashed' }));

      const res = await request(app)
        .post('/api/students/set-password')
        .send({ token: 'tok', password: 'password123' });

      expect(res.status).toBe(200);
      expect(prisma.user.update.mock.calls[0][0].data.clerkUserId).toBeNull();
    });

    it('returns 500 on unexpected error', async () => {
      prisma.user.findUnique.mockRejectedValue(new Error('DB error'));
      const res = await request(app)
        .post('/api/students/set-password')
        .send({ token: 'tok', password: 'password123' });
      expect(res.status).toBe(500);
    });
  });
});
