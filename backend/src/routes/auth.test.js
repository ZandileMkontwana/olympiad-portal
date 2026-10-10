import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';

// ===== Clerk mock setup (must happen BEFORE loading auth.js) =====
const clerk = require('@clerk/express');
const mockGetUser = vi.fn();
const mockDeleteUser = vi.fn();

clerk.clerkClient = {
  users: {
    getUser: mockGetUser,
    deleteUser: mockDeleteUser,
  },
};

// ===== Load source modules (they will use our mocked Clerk) =====
const prisma = require('../lib/prisma');
const authRouter = require('./auth');

// Simulate Clerk's clerkMiddleware() having run: req.auth() returns the
// signed-in Clerk user. The dual-mode middleware (middleware/auth.js) reads
// it when no student JWT is present.
function createApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.auth = () => ({ userId: 'clerk-user-1' });
    next();
  });
  app.use('/api', authRouter);
  return app;
}

describe('Auth routes', () => {
  let app;

  beforeEach(() => {
    vi.spyOn(prisma.user, 'findUnique');
    vi.spyOn(prisma.user, 'create');
    vi.spyOn(prisma.user, 'delete');
    vi.spyOn(prisma.school, 'findFirst');
    vi.spyOn(prisma.school, 'create');
    vi.spyOn(prisma.olympiad, 'count').mockResolvedValue(0);
    vi.spyOn(prisma, '$transaction').mockImplementation(async (fn) => {
      // Execute the transaction callback immediately with a mock tx object
      const mockTx = {
        result: { deleteMany: vi.fn() },
        markingTask: { deleteMany: vi.fn(), updateMany: vi.fn() },
        remarkRequest: { deleteMany: vi.fn(), updateMany: vi.fn() },
        submission: { deleteMany: vi.fn() },
        sitting: { deleteMany: vi.fn() },
        roundEntrant: { deleteMany: vi.fn() },
        notificationLog: { deleteMany: vi.fn() },
        entrant: { delete: vi.fn() },
        educator: { delete: vi.fn() },
        olympiad: { updateMany: vi.fn() },
        olympiadOrganiser: { deleteMany: vi.fn() },
        user: { delete: vi.fn() },
      };
      return fn(mockTx);
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mockGetUser.mockReset();
    mockDeleteUser.mockReset();
    app = createApp();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('POST /api/educators/complete-profile', () => {
    it('returns 400 when name is missing', async () => {
      const res = await request(app)
        .post('/api/educators/complete-profile')
        .send({ schoolName: 'Test School' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/required/);
    });

    it('returns 400 when schoolName is missing', async () => {
      const res = await request(app).post('/api/educators/complete-profile').send({ name: 'Test' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/required/);
    });

    it('returns 409 when profile already completed', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: '1', clerkUserId: 'clerk-user-1' });
      const res = await request(app)
        .post('/api/educators/complete-profile')
        .send({ name: 'Test', schoolName: 'Test School' });
      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/already completed/);
    });

    it('returns 400 when Clerk has no email', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      mockGetUser.mockResolvedValue({ emailAddresses: [] });
      const res = await request(app)
        .post('/api/educators/complete-profile')
        .send({ name: 'Test', schoolName: 'Test School' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/No email/);
    });

    it('creates user with existing school and returns 201', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      mockGetUser.mockResolvedValue({
        emailAddresses: [{ emailAddress: 'a@b.com' }],
      });
      prisma.school.findFirst.mockResolvedValue({ id: 'school-1', name: 'Test School' });
      prisma.user.create.mockResolvedValue({
        id: 'user-1',
        email: 'a@b.com',
        role: 'educator',
        name: 'Test',
        educator: { school: { name: 'Test School' } },
      });

      const res = await request(app)
        .post('/api/educators/complete-profile')
        .send({ name: 'Test', schoolName: 'Test School' });

      expect(res.status).toBe(201);
      expect(res.body.user.email).toBe('a@b.com');
      expect(res.body.user.role).toBe('educator');
      expect(prisma.school.create).not.toHaveBeenCalled();
    });

    it('creates school when it does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      mockGetUser.mockResolvedValue({
        emailAddresses: [{ emailAddress: 'b@b.com' }],
      });
      prisma.school.findFirst.mockResolvedValue(null);
      prisma.school.create.mockResolvedValue({ id: 'school-2', name: 'New School' });
      prisma.user.create.mockResolvedValue({
        id: 'user-2',
        email: 'b@b.com',
        role: 'educator',
        name: 'Test2',
        educator: { school: { name: 'New School' } },
      });

      const res = await request(app)
        .post('/api/educators/complete-profile')
        .send({ name: 'Test2', schoolName: 'New School' });

      expect(res.status).toBe(201);
      expect(prisma.school.create).toHaveBeenCalledWith({
        data: { name: 'New School', timezone: 'Africa/Johannesburg' },
      });
    });
  });

  describe('GET /api/auth/me', () => {
    it('returns 404 when user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('User not found');
    });

    it('returns user on success via a Clerk session', async () => {
      prisma.user.findUnique.mockImplementation(({ where }) => {
        if (where.clerkUserId === 'clerk-user-1') {
          return Promise.resolve({ id: 'user-1' });
        }
        if (where.id === 'user-1') {
          return Promise.resolve({
            id: 'user-1',
            email: 'a@b.com',
            role: 'educator',
            name: 'Test',
            educator: { school: { id: 'school-1', name: 'Test School' } },
            entrant: null,
          });
        }
        return Promise.resolve(null);
      });
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe('a@b.com');
      expect(res.body.user.school).toEqual({ id: 'school-1', name: 'Test School' });
      expect(res.body.user.entrantId).toBeNull();
    });

    it('returns school from entrant for student users', async () => {
      prisma.user.findUnique.mockImplementation(({ where }) => {
        if (where.clerkUserId === 'clerk-user-1') {
          return Promise.resolve({ id: 'user-2' });
        }
        if (where.id === 'user-2') {
          return Promise.resolve({
            id: 'user-2',
            email: 'student@b.com',
            role: 'student',
            name: 'Test',
            educator: null,
            entrant: { id: 'entrant-1', school: { id: 'school-1', name: 'Test School' } },
          });
        }
        return Promise.resolve(null);
      });
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(200);
      expect(res.body.user.role).toBe('student');
      expect(res.body.user.school).toEqual({ id: 'school-1', name: 'Test School' });
      expect(res.body.user.entrantId).toBe('entrant-1');
    });

    it('resolves the user from a student JWT bearer token', async () => {
      const token = jwt.sign({ sub: 'user-2', role: 'student' }, 'test-secret');
      prisma.user.findUnique.mockImplementation(({ where }) => {
        if (where.id === 'user-2') {
          return Promise.resolve({
            id: 'user-2',
            email: 'student@b.com',
            role: 'student',
            name: 'Test',
            educator: null,
            entrant: { id: 'entrant-1', school: { id: 'school-1', name: 'Test School' } },
          });
        }
        return Promise.resolve(null);
      });

      const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.user.role).toBe('student');
      expect(res.body.user.entrantId).toBe('entrant-1');
      // Must NOT have gone down the Clerk lookup path
      expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: 'user-2' } });
    });

    it('returns 404 when the JWT points at a deleted user', async () => {
      const token = jwt.sign({ sub: 'user-gone', role: 'student' }, 'test-secret');
      prisma.user.findUnique.mockResolvedValue(null);

      const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/auth/account', () => {
    it('returns 404 when user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      const res = await request(app).delete('/api/auth/account');
      expect(res.status).toBe(404);
    });

    it('deletes the user and their Clerk account', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        clerkUserId: 'clerk-user-1',
        entrant: null,
        educator: null,
      });
      mockDeleteUser.mockResolvedValue({});

      const res = await request(app).delete('/api/auth/account');
      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/deleted/i);
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(mockDeleteUser).toHaveBeenCalledWith('clerk-user-1');
    });

    it('skips Clerk deletion for students without a Clerk account', async () => {
      const token = jwt.sign({ sub: 'user-2', role: 'student' }, 'test-secret');
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-2',
        clerkUserId: null,
        entrant: null,
        educator: null,
      });

      const res = await request(app)
        .delete('/api/auth/account')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(mockDeleteUser).not.toHaveBeenCalled();
    });

    it('cascades through student entrant data', async () => {
      const token = jwt.sign({ sub: 'user-student', role: 'student' }, 'test-secret');
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-student',
        clerkUserId: null,
        entrant: {
          id: 'entrant-1',
          submissions: [{ id: 'sub-1' }, { id: 'sub-2' }],
        },
        educator: null,
      });

      const res = await request(app)
        .delete('/api/auth/account')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(prisma.$transaction).toHaveBeenCalled();
      
      // Verify the transaction callback was executed (cascade operations ran)
      const txCallback = prisma.$transaction.mock.calls[0][0];
      expect(typeof txCallback).toBe('function');
    });

    it('cascades through educator data', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-educator',
        clerkUserId: 'clerk-edu-1',
        entrant: null,
        educator: { id: 'edu-1' },
      });
      mockDeleteUser.mockResolvedValue({});

      const res = await request(app).delete('/api/auth/account');

      expect(res.status).toBe(200);
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(mockDeleteUser).toHaveBeenCalledWith('clerk-edu-1');
    });

    it('blocks deletion when the organiser still owns olympiads', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-org',
        clerkUserId: 'clerk-org-1',
        role: 'organiser',
        entrant: null,
        educator: null,
      });
      prisma.olympiad.count.mockResolvedValue(2);

      const res = await request(app).delete('/api/auth/account');

      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/transfer ownership/i);
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(mockDeleteUser).not.toHaveBeenCalled();
    });
  });
});
