import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
const prisma = require('../lib/prisma');
const entrantsRouter = require('./entrants');

// Simulate Clerk's clerkMiddleware() having run: req.auth() returns the
// signed-in Clerk user. requireRole() (middleware/auth.js) then loads the
// matching database record to check the role and set req.user.
function createApp(authenticated = true) {
  const app = express();
  app.use(express.json());
  if (authenticated) {
    app.use((req, _res, next) => {
      req.auth = () => ({ userId: 'clerk-user-1' });
      next();
    });
  }
  app.use('/api', entrantsRouter);
  return app;
}

describe('Entrants routes', () => {
  let app;

  beforeEach(() => {
    vi.spyOn(prisma.user, 'findUnique');
    vi.spyOn(prisma.educator, 'findUnique');
    vi.spyOn(prisma.entrant, 'create');
    vi.spyOn(prisma.entrant, 'findMany');
    vi.spyOn(prisma.round, 'findMany');
    vi.spyOn(prisma.roundEntrant, 'createMany');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    // Default: the Clerk user maps to an educator linked to school-1
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'teacher@school.com',
      role: 'educator',
      name: 'Teacher One',
    });
    prisma.educator.findUnique.mockResolvedValue({
      id: 'educator-1',
      userId: 'user-1',
      schoolId: 'school-1',
    });
    app = createApp();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('POST /api/entrants', () => {
    it('returns 401 when not authenticated (no Clerk session)', async () => {
      const unauthApp = createApp(false);
      const res = await request(unauthApp)
        .post('/api/entrants')
        .send({ name: 'Alice', grade: '10' });
      expect(res.status).toBe(401);
      expect(prisma.entrant.create).not.toHaveBeenCalled();
    });

    it('returns 404 when the Clerk user has no database record', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      const res = await request(app).post('/api/entrants').send({ name: 'Alice', grade: '10' });
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('User not found');
    });

    it('returns 403 when user is not an educator', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'organiser@olympiad.com',
        role: 'organiser',
        name: 'Organiser One',
      });
      const res = await request(app).post('/api/entrants').send({ name: 'Alice', grade: '10' });
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('educator access required');
      expect(prisma.entrant.create).not.toHaveBeenCalled();
    });

    it('returns 400 when fields are missing', async () => {
      const res = await request(app).post('/api/entrants').send({ name: 'Alice' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/required/);
    });

    it('returns 403 when the account has no educator profile', async () => {
      prisma.educator.findUnique.mockResolvedValue(null);
      const res = await request(app).post('/api/entrants').send({ name: 'Alice', grade: '10' });
      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/No school linked/);
      expect(prisma.entrant.create).not.toHaveBeenCalled();
    });

    it('creates the entrant under the educator school and returns 201', async () => {
      prisma.entrant.create.mockResolvedValue({
        id: 'entrant-1',
        schoolId: 'school-1',
        name: 'Alice',
        grade: '10',
      });
      prisma.round.findMany.mockResolvedValue([]);
      const res = await request(app).post('/api/entrants').send({ name: ' Alice ', grade: '10' });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Alice');
      expect(prisma.entrant.create).toHaveBeenCalledWith({
        data: { name: 'Alice', grade: '10', schoolId: 'school-1' },
      });
    });

    it('auto-registers the new entrant for all open rounds', async () => {
      prisma.entrant.create.mockResolvedValue({
        id: 'entrant-1',
        schoolId: 'school-1',
        name: 'Alice',
        grade: '10',
      });
      prisma.round.findMany.mockResolvedValue([
        { id: 'round-1' },
        { id: 'round-2' },
      ]);
      prisma.roundEntrant.createMany.mockResolvedValue({ count: 2 });

      const res = await request(app).post('/api/entrants').send({ name: 'Alice', grade: '10' });

      expect(res.status).toBe(201);
      expect(prisma.round.findMany).toHaveBeenCalledWith({
        where: { state: 'open' },
        select: { id: true },
      });
      expect(prisma.roundEntrant.createMany).toHaveBeenCalledWith({
        data: [
          { roundId: 'round-1', entrantId: 'entrant-1' },
          { roundId: 'round-2', entrantId: 'entrant-1' },
        ],
        skipDuplicates: true,
      });
    });

    it('returns 500 on unexpected error', async () => {
      prisma.entrant.create.mockRejectedValue(new Error('DB error'));
      const res = await request(app).post('/api/entrants').send({ name: 'Alice', grade: '10' });
      expect(res.status).toBe(500);
      expect(res.body.error).toMatch(/Could not create entrant/);
    });
  });

  describe('GET /api/entrants', () => {
    it('returns 401 when not authenticated (no Clerk session)', async () => {
      const unauthApp = createApp(false);
      const res = await request(unauthApp).get('/api/entrants');
      expect(res.status).toBe(401);
    });

    it('returns 403 when user is not an educator', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'organiser@olympiad.com',
        role: 'organiser',
        name: 'Organiser One',
      });
      const res = await request(app).get('/api/entrants');
      expect(res.status).toBe(403);
      expect(prisma.entrant.findMany).not.toHaveBeenCalled();
    });

    it('lists only the educator school entrants, sorted by name', async () => {
      prisma.entrant.findMany.mockResolvedValue([
        { id: 'entrant-1', schoolId: 'school-1', name: 'Alice', grade: '10' },
        { id: 'entrant-2', schoolId: 'school-1', name: 'Bob', grade: '11' },
      ]);
      const res = await request(app).get('/api/entrants');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(prisma.entrant.findMany).toHaveBeenCalledWith({
        where: { schoolId: 'school-1' },
        orderBy: { name: 'asc' },
      });
    });

    it('returns 403 when the account has no educator profile', async () => {
      prisma.educator.findUnique.mockResolvedValue(null);
      const res = await request(app).get('/api/entrants');
      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/No school linked/);
    });

    it('returns 500 on unexpected error', async () => {
      prisma.entrant.findMany.mockRejectedValue(new Error('DB error'));
      const res = await request(app).get('/api/entrants');
      expect(res.status).toBe(500);
    });
  });
});
