import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// ===== Clerk mock setup (must happen BEFORE loading auth.js) =====
const clerk = require('@clerk/express');
const mockGetUser = vi.fn();
const mockDeleteUser = vi.fn();

vi.spyOn(clerk, 'requireAuth').mockReturnValue((req, res, next) => {
  req.auth = () => ({ userId: 'clerk-user-1' });
  next();
});

clerk.clerkClient = {
  users: {
    getUser: mockGetUser,
    deleteUser: mockDeleteUser,
  },
};

// ===== Load source modules (they will use our mocked Clerk) =====
const prisma = require('../lib/prisma');
const authRouter = require('./auth');

function createApp() {
  const app = express();
  app.use(express.json());
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
    vi.spyOn(prisma.entrant, 'findFirst');
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

  describe('POST /api/students/complete-profile', () => {
    it('returns 400 when name is missing', async () => {
      const res = await request(app)
        .post('/api/students/complete-profile')
        .send({ schoolName: 'Test School' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/required/);
    });

    it('returns 400 when schoolName is missing', async () => {
      const res = await request(app).post('/api/students/complete-profile').send({ name: 'Test' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/required/);
    });

    it('returns 409 when profile already completed', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: '1', clerkUserId: 'clerk-user-1' });
      const res = await request(app)
        .post('/api/students/complete-profile')
        .send({ name: 'Test', schoolName: 'Test School' });
      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/already completed/);
    });

    it('returns 404 when no school found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.school.findFirst.mockResolvedValue(null);
      const res = await request(app)
        .post('/api/students/complete-profile')
        .send({ name: 'Test', schoolName: 'Unknown School' });
      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/No school/);
    });

    it('returns 404 when no unclaimed entrant matches name and school', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.school.findFirst.mockResolvedValue({ id: 'school-1', name: 'Test School' });
      prisma.entrant.findFirst.mockResolvedValue(null);
      const res = await request(app)
        .post('/api/students/complete-profile')
        .send({ name: 'Nobody', schoolName: 'Test School' });
      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/No unclaimed entrant/);
      expect(prisma.entrant.findFirst).toHaveBeenCalledWith({
        where: {
          name: { equals: 'Nobody', mode: 'insensitive' },
          schoolId: 'school-1',
          userId: null,
        },
      });
    });

    it('matches school and entrant names case-insensitively', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.school.findFirst.mockResolvedValue({ id: 'school-1', name: 'Test School' });
      prisma.entrant.findFirst.mockResolvedValue({ id: 'entrant-1', name: 'Test', userId: null });
      mockGetUser.mockResolvedValue({
        emailAddresses: [{ emailAddress: 'student@b.com' }],
      });
      prisma.user.create.mockResolvedValue({
        id: 'user-1',
        email: 'student@b.com',
        role: 'student',
        name: 'Test',
        entrant: { school: { name: 'Test School' } },
      });

      const res = await request(app)
        .post('/api/students/complete-profile')
        .send({ name: 'test', schoolName: 'test school' });

      expect(res.status).toBe(201);
      expect(prisma.school.findFirst).toHaveBeenCalledWith({
        where: { name: { equals: 'test school', mode: 'insensitive' } },
      });
    });

    it('returns 400 when Clerk has no email', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.school.findFirst.mockResolvedValue({ id: 'school-1', name: 'Test School' });
      prisma.entrant.findFirst.mockResolvedValue({ id: 'entrant-1', name: 'Test' });
      mockGetUser.mockResolvedValue({ emailAddresses: [] });
      const res = await request(app)
        .post('/api/students/complete-profile')
        .send({ name: 'Test', schoolName: 'Test School' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/No email/);
    });

    it('links user to the claimed entrant and returns 201', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.school.findFirst.mockResolvedValue({ id: 'school-1', name: 'Test School' });
      prisma.entrant.findFirst.mockResolvedValue({ id: 'entrant-1', name: 'Test', userId: null });
      mockGetUser.mockResolvedValue({
        emailAddresses: [{ emailAddress: 'student@b.com' }],
      });
      prisma.user.create.mockResolvedValue({
        id: 'user-1',
        email: 'student@b.com',
        role: 'student',
        name: 'Test',
        entrant: { school: { id: 'school-1', name: 'Test School' } },
      });

      const res = await request(app)
        .post('/api/students/complete-profile')
        .send({ name: 'Test', schoolName: 'Test School' });

      expect(res.status).toBe(201);
      expect(res.body.user.role).toBe('student');
      expect(res.body.user.school).toEqual({ id: 'school-1', name: 'Test School' });
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          clerkUserId: 'clerk-user-1',
          email: 'student@b.com',
          role: 'student',
          name: 'Test',
          entrant: { connect: { id: 'entrant-1' } },
        },
        include: { entrant: { include: { school: true } } },
      });
      expect(prisma.school.create).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/auth/me', () => {
    it('returns 404 when user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('User not found');
    });

    it('returns user on success', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: '1',
        email: 'a@b.com',
        role: 'educator',
        name: 'Test',
        educator: { school: { id: 'school-1', name: 'Test School' } },
      });
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe('a@b.com');
      expect(res.body.user.school).toEqual({ id: 'school-1', name: 'Test School' });
    });

    it('returns school from entrant for student users', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: '2',
        email: 'student@b.com',
        role: 'student',
        name: 'Test',
        educator: null,
        entrant: { school: { id: 'school-1', name: 'Test School' } },
      });
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(200);
      expect(res.body.user.role).toBe('student');
      expect(res.body.user.school).toEqual({ id: 'school-1', name: 'Test School' });
    });
  });

  describe('DELETE /api/auth/account', () => {
    it('returns 404 when user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      const res = await request(app).delete('/api/auth/account');
      expect(res.status).toBe(404);
    });

    it('deletes user and returns 200', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: '1' });
      prisma.user.delete.mockResolvedValue({});
      mockDeleteUser.mockResolvedValue({});

      const res = await request(app).delete('/api/auth/account');
      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/deleted/i);
      expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: '1' } });
      expect(mockDeleteUser).toHaveBeenCalledWith('clerk-user-1');
    });
  });
});
