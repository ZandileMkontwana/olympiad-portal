import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
const prisma = require('../lib/prisma');
const roundsRouter = require('./rounds');

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
  app.use('/api', roundsRouter);
  return app;
}

describe('Rounds routes', () => {
  let app;

  beforeEach(() => {
    vi.spyOn(prisma.olympiad, 'create');
    vi.spyOn(prisma.olympiad, 'findMany');
    vi.spyOn(prisma.round, 'create');
    vi.spyOn(prisma.round, 'findMany');
    vi.spyOn(prisma.round, 'findUnique');
    vi.spyOn(prisma.roundEntrant, 'findMany');
    vi.spyOn(prisma.roundEntrant, 'findUnique');
    vi.spyOn(prisma.roundEntrant, 'create');
    vi.spyOn(prisma.submission, 'findMany');
    vi.spyOn(prisma.user, 'findUnique');
    vi.spyOn(prisma.educator, 'findUnique');
    vi.spyOn(prisma.entrant, 'findUnique');
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

  describe('POST /api/olympiads', () => {
    it('returns 400 when fields are missing', async () => {
      const res = await request(app).post('/api/olympiads').send({ name: 'Test' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/required/);
    });

    it('creates olympiad and returns 201', async () => {
      prisma.olympiad.create.mockResolvedValue({ id: '1', name: 'Test', timezone: 'UTC' });
      const res = await request(app).post('/api/olympiads').send({ name: 'Test', timezone: 'UTC' });
      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Test');
    });

    it('returns 500 on prisma error', async () => {
      prisma.olympiad.create.mockRejectedValue(new Error('DB error'));
      const res = await request(app).post('/api/olympiads').send({ name: 'Test', timezone: 'UTC' });
      expect(res.status).toBe(500);
      expect(res.body.error).toMatch(/Failed/);
    });
  });

  describe('GET /api/olympiads', () => {
    it('returns list of olympiads with nested rounds, sorted by name', async () => {
      prisma.olympiad.findMany.mockResolvedValue([
        { id: '1', name: 'A', rounds: [] },
        { id: '2', name: 'B', rounds: [] },
      ]);
      const res = await request(app).get('/api/olympiads');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(prisma.olympiad.findMany).toHaveBeenCalledWith({
        include: { rounds: { orderBy: { openTime: 'asc' } } },
        orderBy: { name: 'asc' },
      });
    });

    it('returns 500 on error', async () => {
      prisma.olympiad.findMany.mockRejectedValue(new Error('DB error'));
      const res = await request(app).get('/api/olympiads');
      expect(res.status).toBe(500);
    });
  });

  describe('POST /api/rounds', () => {
    it('returns 400 when fields are missing', async () => {
      const res = await request(app).post('/api/rounds').send({ name: 'Round 1' });
      expect(res.status).toBe(400);
    });

    it('returns 400 when closeTime is before openTime', async () => {
      const res = await request(app).post('/api/rounds').send({
        olympiadId: '1',
        name: 'Round 1',
        openTime: '2026-01-02T00:00:00Z',
        closeTime: '2026-01-01T00:00:00Z',
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/after openTime/);
    });

    it('creates round and returns 201', async () => {
      prisma.round.create.mockResolvedValue({ id: '1', name: 'Round 1' });
      const res = await request(app).post('/api/rounds').send({
        olympiadId: '1',
        name: 'Round 1',
        openTime: '2026-01-01T00:00:00Z',
        closeTime: '2026-01-02T00:00:00Z',
      });
      expect(res.status).toBe(201);
      expect(prisma.round.create).toHaveBeenCalledWith({
        data: {
          olympiadId: '1',
          name: 'Round 1',
          openTime: new Date('2026-01-01T00:00:00Z'),
          closeTime: new Date('2026-01-02T00:00:00Z'),
        },
      });
    });

    it('returns 500 on prisma error', async () => {
      prisma.round.create.mockRejectedValue(new Error('DB error'));
      const res = await request(app).post('/api/rounds').send({
        olympiadId: '1',
        name: 'Round 1',
        openTime: '2026-01-01T00:00:00Z',
        closeTime: '2026-01-02T00:00:00Z',
      });
      expect(res.status).toBe(500);
    });
  });

  describe('GET /api/rounds', () => {
    it('returns list of rounds sorted by openTime', async () => {
      prisma.round.findMany.mockResolvedValue([{ id: '1' }]);
      const res = await request(app).get('/api/rounds');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(prisma.round.findMany).toHaveBeenCalledWith({
        include: { olympiad: true },
        orderBy: { openTime: 'asc' },
      });
    });

    it('returns 500 on error', async () => {
      prisma.round.findMany.mockRejectedValue(new Error('DB error'));
      const res = await request(app).get('/api/rounds');
      expect(res.status).toBe(500);
    });
  });

  describe('GET /api/rounds/:id', () => {
    it('returns 404 when round not found', async () => {
      prisma.round.findUnique.mockResolvedValue(null);
      const res = await request(app).get('/api/rounds/nonexistent');
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Round not found');
    });

    it('returns round on success', async () => {
      prisma.round.findUnique.mockResolvedValue({ id: '1', name: 'Round 1' });
      const res = await request(app).get('/api/rounds/1');
      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Round 1');
    });

    it('returns 500 on error', async () => {
      prisma.round.findUnique.mockRejectedValue(new Error('DB error'));
      const res = await request(app).get('/api/rounds/1');
      expect(res.status).toBe(500);
    });
  });

  describe('GET /api/olympiads/:id/rounds', () => {
    it('returns rounds for an olympiad', async () => {
      prisma.round.findMany.mockResolvedValue([{ id: '1' }, { id: '2' }]);
      const res = await request(app).get('/api/olympiads/olympiad-1/rounds');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
    });

    it('returns 500 on error', async () => {
      prisma.round.findMany.mockRejectedValue(new Error('DB error'));
      const res = await request(app).get('/api/olympiads/olympiad-1/rounds');
      expect(res.status).toBe(500);
    });
  });

  describe('GET /api/rounds/:id/entrants', () => {
    it('returns entrants for a round', async () => {
      prisma.roundEntrant.findMany.mockResolvedValue([
        { entrant: { id: 'e1', name: 'Alice' } },
        { Entrant: { id: 'e2', name: 'Bob' } },
      ]);
      const res = await request(app).get('/api/rounds/1/entrants');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].name).toBe('Alice');
    });

    it('returns 500 on error', async () => {
      prisma.roundEntrant.findMany.mockRejectedValue(new Error('DB error'));
      const res = await request(app).get('/api/rounds/1/entrants');
      expect(res.status).toBe(500);
    });
  });

  describe('POST /api/rounds/:id/entrants', () => {
    it('returns 401 when not authenticated (no Clerk session)', async () => {
      const unauthApp = createApp(false);
      const res = await request(unauthApp).post('/api/rounds/1/entrants').send({ entrantId: 'e1' });
      expect(res.status).toBe(401);
      expect(prisma.roundEntrant.create).not.toHaveBeenCalled();
    });

    it('returns 400 when entrantId is missing', async () => {
      const res = await request(app).post('/api/rounds/1/entrants').send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/required/);
    });

    it('returns 403 when user is not an educator', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'organiser@olympiad.com',
        role: 'organiser',
        name: 'Organiser One',
      });
      const res = await request(app).post('/api/rounds/1/entrants').send({ entrantId: 'e1' });
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('educator access required');
    });

    it('returns 404 when round not found', async () => {
      prisma.round.findUnique.mockResolvedValue(null);
      const res = await request(app).post('/api/rounds/1/entrants').send({ entrantId: 'e1' });
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Round not found');
    });

    it('returns 403 when round is closed', async () => {
      prisma.round.findUnique.mockResolvedValue({ id: '1', state: 'closed' });
      const res = await request(app).post('/api/rounds/1/entrants').send({ entrantId: 'e1' });
      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/closed/);
    });

    it('returns 404 when entrant not found', async () => {
      prisma.round.findUnique.mockResolvedValue({ id: '1', state: 'open' });
      prisma.entrant.findUnique.mockResolvedValue(null);
      const res = await request(app).post('/api/rounds/1/entrants').send({ entrantId: 'e1' });
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Entrant not found');
    });

    it('returns 403 when entrant belongs to a different school', async () => {
      prisma.round.findUnique.mockResolvedValue({ id: '1', state: 'open' });
      prisma.entrant.findUnique.mockResolvedValue({
        id: 'e1',
        schoolId: 'school-2',
        name: 'Alice',
        grade: '10',
      });
      const res = await request(app).post('/api/rounds/1/entrants').send({ entrantId: 'e1' });
      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/different school/);
      expect(prisma.roundEntrant.create).not.toHaveBeenCalled();
    });

    it('returns 409 when entrant is already registered', async () => {
      prisma.round.findUnique.mockResolvedValue({ id: '1', state: 'open' });
      prisma.entrant.findUnique.mockResolvedValue({
        id: 'e1',
        schoolId: 'school-1',
        name: 'Alice',
        grade: '10',
      });
      prisma.roundEntrant.findUnique.mockResolvedValue({ id: 're-1' });
      const res = await request(app).post('/api/rounds/1/entrants').send({ entrantId: 'e1' });
      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/already registered/);
      expect(prisma.roundEntrant.create).not.toHaveBeenCalled();
    });

    it('registers entrant and returns 201', async () => {
      prisma.round.findUnique.mockResolvedValue({ id: '1', state: 'open' });
      prisma.entrant.findUnique.mockResolvedValue({
        id: 'e1',
        schoolId: 'school-1',
        name: 'Alice',
        grade: '10',
      });
      prisma.roundEntrant.findUnique.mockResolvedValue(null);
      prisma.roundEntrant.create.mockResolvedValue({
        id: 're-1',
        roundId: '1',
        entrantId: 'e1',
        registeredAt: new Date('2026-01-01'),
      });
      const res = await request(app).post('/api/rounds/1/entrants').send({ entrantId: 'e1' });

      expect(res.status).toBe(201);
      expect(res.body.entrantId).toBe('e1');
      expect(prisma.roundEntrant.create).toHaveBeenCalledWith({
        data: { roundId: '1', entrantId: 'e1' },
      });
    });

    it('accepts registration for a scheduled round', async () => {
      prisma.round.findUnique.mockResolvedValue({ id: '1', state: 'scheduled' });
      prisma.entrant.findUnique.mockResolvedValue({
        id: 'e1',
        schoolId: 'school-1',
        name: 'Alice',
        grade: '10',
      });
      prisma.roundEntrant.findUnique.mockResolvedValue(null);
      prisma.roundEntrant.create.mockResolvedValue({
        id: 're-1',
        roundId: '1',
        entrantId: 'e1',
      });
      const res = await request(app).post('/api/rounds/1/entrants').send({ entrantId: 'e1' });
      expect(res.status).toBe(201);
    });

    it('returns 500 on unexpected error', async () => {
      prisma.round.findUnique.mockResolvedValue({ id: '1', state: 'open' });
      prisma.entrant.findUnique.mockResolvedValue({
        id: 'e1',
        schoolId: 'school-1',
        name: 'Alice',
        grade: '10',
      });
      prisma.roundEntrant.findUnique.mockResolvedValue(null);
      prisma.roundEntrant.create.mockRejectedValue(new Error('DB error'));
      const res = await request(app).post('/api/rounds/1/entrants').send({ entrantId: 'e1' });
      expect(res.status).toBe(500);
      expect(res.body.error).toMatch(/Could not register/);
    });
  });

  describe('GET /api/rounds/:id/submissions', () => {
    it('returns submissions for a round', async () => {
      prisma.submission.findMany.mockResolvedValue([{ id: 's1', result: { score: 80 } }]);
      const res = await request(app).get('/api/rounds/1/submissions');
      expect(res.status).toBe(200);
      expect(res.body[0].result.score).toBe(80);
    });

    it('returns 500 on error', async () => {
      prisma.submission.findMany.mockRejectedValue(new Error('DB error'));
      const res = await request(app).get('/api/rounds/1/submissions');
      expect(res.status).toBe(500);
    });
  });
});
