import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
const prisma = require('../lib/prisma');
const schoolsRouter = require('./schools');

// Simulate Clerk's clerkMiddleware() having run: req.auth() returns the
// signed-in Clerk user. The requireSchoolAccess middleware then loads the
// matching database record and sets req.user.
function createApp(authenticated = true) {
  const app = express();
  app.use(express.json());
  if (authenticated) {
    app.use((req, _res, next) => {
      req.auth = () => ({ userId: 'clerk-user-1' });
      next();
    });
  }
  app.use('/api', schoolsRouter);
  return app;
}

describe('Schools routes', () => {
  let app;

  beforeEach(() => {
    vi.spyOn(prisma.user, 'findUnique');
    vi.spyOn(prisma.educator, 'findUnique');
    vi.spyOn(prisma.school, 'findUnique');
    vi.spyOn(prisma.school, 'findMany');
    vi.spyOn(prisma.entrant, 'findMany');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    // Default: organiser role (can access any school)
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'organiser@olympiad.com',
      role: 'organiser',
      name: 'Organiser One',
    });
    app = createApp();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ΓöÇΓöÇ GET /api/schools (public) ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

  describe('GET /api/schools', () => {
    it('returns an alphabetically sorted list of schools without auth', async () => {
      const unauthApp = createApp(false);
      prisma.school.findMany.mockResolvedValue([
        { id: 'school-1', name: 'Alpha High' },
        { id: 'school-2', name: 'Beta College' },
      ]);
      const res = await request(unauthApp).get('/api/schools');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].name).toBe('Alpha High');
      expect(prisma.school.findMany).toHaveBeenCalledWith({
        orderBy: { name: 'asc' },
        select: { id: true, name: true },
      });
    });

    it('returns 500 when the database is unreachable', async () => {
      prisma.school.findMany.mockRejectedValue(new Error('DB error'));
      const res = await request(app).get('/api/schools');
      expect(res.status).toBe(500);
      expect(res.body.error).toMatch(/Could not fetch schools/);
    });
  });

  // ΓöÇΓöÇ GET /api/schools/:id/entrants ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

  describe('GET /api/schools/:id/entrants', () => {
    it('returns 401 when not authenticated', async () => {
      const unauthApp = createApp(false);
      const res = await request(unauthApp).get('/api/schools/school-1/entrants');
      expect(res.status).toBe(401);
    });

    it('returns 404 when the Clerk user has no database record', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      const res = await request(app).get('/api/schools/school-1/entrants');
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('User not found');
    });

    it('allows an organiser to view any school', async () => {
      prisma.entrant.findMany.mockResolvedValue([
        { id: 'entrant-1', schoolId: 'school-1', name: 'Alice', grade: '10' },
        { id: 'entrant-2', schoolId: 'school-1', name: 'Bob', grade: '11' },
      ]);
      const res = await request(app).get('/api/schools/school-1/entrants');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(prisma.entrant.findMany).toHaveBeenCalledWith({
        where: { schoolId: 'school-1' },
        orderBy: { name: 'asc' },
        include: { user: { select: { email: true, passwordHash: true } } },
      });
      // Organiser path should NOT query educator
      expect(prisma.educator.findUnique).not.toHaveBeenCalled();
    });

    it('exposes each entrant email and account status', async () => {
      prisma.entrant.findMany.mockResolvedValue([
        {
          id: 'entrant-1',
          schoolId: 'school-1',
          name: 'Alice',
          grade: '10',
          user: { email: 'alice@school.com', passwordHash: 'hashed' },
        },
        {
          id: 'entrant-2',
          schoolId: 'school-1',
          name: 'Bob',
          grade: '11',
          user: { email: 'bob@school.com', passwordHash: null },
        },
        { id: 'entrant-3', schoolId: 'school-1', name: 'No User', grade: '10' },
      ]);
      const res = await request(app).get('/api/schools/school-1/entrants');
      expect(res.status).toBe(200);
      expect(res.body[0]).toMatchObject({
        email: 'alice@school.com',
        accountStatus: 'active',
      });
      expect(res.body[1]).toMatchObject({
        email: 'bob@school.com',
        accountStatus: 'invite_pending',
      });
      expect(res.body[2]).toMatchObject({ email: null, accountStatus: null });
      // The embedded user record must never be serialized
      expect(res.body[0].user).toBeUndefined();
    });

    it('allows an educator to view their own school', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-2',
        email: 'teacher@school.com',
        role: 'educator',
        name: 'Teacher One',
      });
      prisma.educator.findUnique.mockResolvedValue({
        id: 'educator-1',
        userId: 'user-2',
        schoolId: 'school-1',
      });
      prisma.entrant.findMany.mockResolvedValue([
        { id: 'entrant-1', schoolId: 'school-1', name: 'Carol', grade: '9' },
      ]);
      const res = await request(app).get('/api/schools/school-1/entrants');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
    });

    it('blocks an educator from viewing a different school', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-2',
        email: 'teacher@school.com',
        role: 'educator',
        name: 'Teacher One',
      });
      prisma.educator.findUnique.mockResolvedValue({
        id: 'educator-1',
        userId: 'user-2',
        schoolId: 'school-1',
      });
      const res = await request(app).get('/api/schools/school-99/entrants');
      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/Not authorized/);
      expect(prisma.entrant.findMany).not.toHaveBeenCalled();
    });

    it('blocks a student from viewing any school', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-3',
        email: 'student@mail.com',
        role: 'student',
        name: 'Student One',
      });
      const res = await request(app).get('/api/schools/school-1/entrants');
      expect(res.status).toBe(403);
      expect(prisma.entrant.findMany).not.toHaveBeenCalled();
    });

    it('returns 500 on unexpected error', async () => {
      prisma.entrant.findMany.mockRejectedValue(new Error('DB error'));
      const res = await request(app).get('/api/schools/school-1/entrants');
      expect(res.status).toBe(500);
      expect(res.body.error).toMatch(/Could not fetch entrants/);
    });
  });

  // ΓöÇΓöÇ GET /api/schools/:id/dashboard ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

  describe('GET /api/schools/:id/dashboard', () => {
    it('returns 401 when not authenticated', async () => {
      const unauthApp = createApp(false);
      const res = await request(unauthApp).get('/api/schools/school-1/dashboard');
      expect(res.status).toBe(401);
    });

    it('returns 404 when the school does not exist', async () => {
      prisma.school.findUnique.mockResolvedValue(null);
      const res = await request(app).get('/api/schools/nonexistent/dashboard');
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('School not found');
    });

    it('returns 403 when educator tries to access another school', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-2',
        email: 'teacher@school.com',
        role: 'educator',
        name: 'Teacher One',
      });
      prisma.educator.findUnique.mockResolvedValue({
        id: 'educator-1',
        userId: 'user-2',
        schoolId: 'school-1',
      });
      const res = await request(app).get('/api/schools/school-99/dashboard');
      expect(res.status).toBe(403);
      expect(prisma.school.findUnique).not.toHaveBeenCalled();
    });

    it('returns aggregated dashboard data for an organiser', async () => {
      prisma.school.findUnique.mockResolvedValue({
        id: 'school-1',
        name: 'Alpha High',
      });
      prisma.entrant.findMany.mockResolvedValue([
        {
          id: 'entrant-1',
          name: 'Alice',
          grade: '10',
          user: { email: 'alice@school.com', passwordHash: 'hashed' },
          submissions: [
            { id: 'sub-1', result: { score: 80 } },
            { id: 'sub-2', result: { score: 90 } },
          ],
        },
        {
          id: 'entrant-2',
          name: 'Bob',
          grade: '11',
          submissions: [
            { id: 'sub-3', result: { score: 70 } },
          ],
        },
        {
          id: 'entrant-3',
          name: 'Carol',
          grade: '9',
          submissions: [],
        },
      ]);

      const res = await request(app).get('/api/schools/school-1/dashboard');
      expect(res.status).toBe(200);
      expect(res.body.school).toEqual({ id: 'school-1', name: 'Alpha High' });
      expect(res.body.entrantCount).toBe(3);
      expect(res.body.totalSubmissions).toBe(3);
      expect(res.body.entrants).toHaveLength(3);

      // Alice: avg (80+90)/2 = 85
      const alice = res.body.entrants.find((e) => e.id === 'entrant-1');
      expect(alice.submissionCount).toBe(2);
      expect(alice.averageScore).toBe(85);
      expect(alice.email).toBe('alice@school.com');
      expect(alice.accountStatus).toBe('active');

      // Bob: avg 70
      const bob = res.body.entrants.find((e) => e.id === 'entrant-2');
      expect(bob.submissionCount).toBe(1);
      expect(bob.averageScore).toBe(70);

      // Carol: no submissions ΓåÆ null average
      const carol = res.body.entrants.find((e) => e.id === 'entrant-3');
      expect(carol.submissionCount).toBe(0);
      expect(carol.averageScore).toBeNull();
    });

    it('treats submissions with no result as having no score', async () => {
      prisma.school.findUnique.mockResolvedValue({
        id: 'school-1',
        name: 'Alpha High',
      });
      prisma.entrant.findMany.mockResolvedValue([
        {
          id: 'entrant-1',
          name: 'Alice',
          grade: '10',
          submissions: [
            { id: 'sub-1', result: null },
            { id: 'sub-2', result: { score: 60 } },
          ],
        },
      ]);

      const res = await request(app).get('/api/schools/school-1/dashboard');
      expect(res.status).toBe(200);
      const alice = res.body.entrants[0];
      expect(alice.submissionCount).toBe(2);
      expect(alice.averageScore).toBe(60); // only one scored submission
    });

    it('returns 500 on unexpected error', async () => {
      prisma.school.findUnique.mockRejectedValue(new Error('DB error'));
      const res = await request(app).get('/api/schools/school-1/dashboard');
      expect(res.status).toBe(500);
      expect(res.body.error).toMatch(/Could not fetch school dashboard/);
    });

    it('allows an educator to view their own school dashboard', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-2',
        email: 'teacher@school.com',
        role: 'educator',
        name: 'Teacher One',
      });
      prisma.educator.findUnique.mockResolvedValue({
        id: 'educator-1',
        userId: 'user-2',
        schoolId: 'school-1',
      });
      prisma.school.findUnique.mockResolvedValue({
        id: 'school-1',
        name: 'Testville High',
      });
      prisma.entrant.findMany.mockResolvedValue([]);

      const res = await request(app).get('/api/schools/school-1/dashboard');
      expect(res.status).toBe(200);
      expect(res.body.school).toEqual({ id: 'school-1', name: 'Testville High' });
      expect(res.body.entrantCount).toBe(0);
      expect(res.body.totalSubmissions).toBe(0);
      expect(res.body.entrants).toHaveLength(0);
    });

    it('returns empty entrants array when school has no students', async () => {
      prisma.school.findUnique.mockResolvedValue({
        id: 'school-1',
        name: 'Empty School',
      });
      prisma.entrant.findMany.mockResolvedValue([]);

      const res = await request(app).get('/api/schools/school-1/dashboard');
      expect(res.status).toBe(200);
      expect(res.body.entrantCount).toBe(0);
      expect(res.body.totalSubmissions).toBe(0);
      expect(res.body.entrants).toEqual([]);
    });
  });
});
