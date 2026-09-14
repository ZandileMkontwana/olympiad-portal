import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
const sgMail = require('@sendgrid/mail');
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
    vi.spyOn(prisma.notificationRule, 'findMany');
    vi.spyOn(prisma.notificationRule, 'upsert');
    vi.spyOn(prisma.notificationRule, 'deleteMany');
    vi.spyOn(prisma.result, 'updateMany');
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

  describe('GET /api/rounds/:id/standings', () => {
    it('returns 404 when the round does not exist', async () => {
      prisma.round.findUnique.mockResolvedValue(null);

      const res = await request(app).get('/api/rounds/missing-round/standings');

      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/not found/i);
    });

    it('returns an empty array when no submissions have a result yet', async () => {
      prisma.round.findUnique.mockResolvedValue({ id: 'round-1', name: 'Round 1' });
      prisma.submission.findMany.mockResolvedValue([]);

      const res = await request(app).get('/api/rounds/round-1/standings');

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('excludes submissions with no result', async () => {
      prisma.round.findUnique.mockResolvedValue({ id: 'round-1', name: 'Round 1' });
      prisma.submission.findMany.mockResolvedValue([
        {
          entrant: { id: 'entrant-1', name: 'Thabo', school: { name: 'Wits High School' } },
          result: { score: 80 },
          submittedAt: '2026-09-12T20:56:55.855Z',
        },
      ]);

      const res = await request(app).get('/api/rounds/round-1/standings');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(prisma.submission.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { roundId: 'round-1', result: { isNot: null } },
        })
      );
    });

    it('ranks entrants by score, highest first', async () => {
      prisma.round.findUnique.mockResolvedValue({ id: 'round-1', name: 'Round 1' });
      prisma.submission.findMany.mockResolvedValue([
        {
          entrant: { id: 'entrant-1', name: 'Thabo', school: { name: 'Wits High School' } },
          result: { score: 50 },
          submittedAt: '2026-09-12T20:00:00.000Z',
        },
        {
          entrant: { id: 'entrant-2', name: 'Naledi', school: { name: "St Mary's" } },
          result: { score: 90 },
          submittedAt: '2026-09-12T20:10:00.000Z',
        },
      ]);

      const res = await request(app).get('/api/rounds/round-1/standings');

      expect(res.status).toBe(200);
      expect(res.body[0]).toMatchObject({ rank: 1, entrantName: 'Naledi', score: 90 });
      expect(res.body[1]).toMatchObject({ rank: 2, entrantName: 'Thabo', score: 50 });
    });

    it('gives tied scores the same rank, and skips the next rank accordingly', async () => {
      prisma.round.findUnique.mockResolvedValue({ id: 'round-1', name: 'Round 1' });
      prisma.submission.findMany.mockResolvedValue([
        {
          entrant: { id: 'entrant-1', name: 'A', school: { name: 'School A' } },
          result: { score: 70 },
          submittedAt: '2026-09-12T20:00:00.000Z',
        },
        {
          entrant: { id: 'entrant-2', name: 'B', school: { name: 'School B' } },
          result: { score: 70 },
          submittedAt: '2026-09-12T20:10:00.000Z',
        },
        {
          entrant: { id: 'entrant-3', name: 'C', school: { name: 'School C' } },
          result: { score: 60 },
          submittedAt: '2026-09-12T20:20:00.000Z',
        },
      ]);

      const res = await request(app).get('/api/rounds/round-1/standings');

      expect(res.body[0].rank).toBe(1);
      expect(res.body[1].rank).toBe(1);
      expect(res.body[2].rank).toBe(3);
    });

    it('includes both paper-based and online-sitting-based submissions without distinction', async () => {
      prisma.round.findUnique.mockResolvedValue({ id: 'round-1', name: 'Round 1' });
      prisma.submission.findMany.mockResolvedValue([
        {
          entrant: { id: 'entrant-1', name: 'Paper Entrant', school: { name: 'School A' } },
          result: { score: 40 },
          submittedAt: '2026-09-12T20:00:00.000Z',
        },
        {
          entrant: { id: 'entrant-2', name: 'Online Entrant', school: { name: 'School B' } },
          result: { score: 20 },
          submittedAt: '2026-09-12T20:56:55.855Z',
        },
      ]);

      const res = await request(app).get('/api/rounds/round-1/standings');

      expect(res.body).toHaveLength(2);
      expect(res.body.map((r) => r.entrantName)).toEqual(
        expect.arrayContaining(['Paper Entrant', 'Online Entrant'])
      );
    });

    it('returns 500 on prisma error', async () => {
      prisma.round.findUnique.mockResolvedValue({ id: 'round-1', name: 'Round 1' });
      prisma.submission.findMany.mockRejectedValue(new Error('DB error'));

      const res = await request(app).get('/api/rounds/round-1/standings');

      expect(res.status).toBe(500);
      expect(res.body.error).toMatch(/Failed/);
    });

    describe('GET /api/rounds/:id/standings/schools', () => {
      it('returns 404 when the round does not exist', async () => {
        prisma.round.findUnique.mockResolvedValue(null);

        const res = await request(app).get('/api/rounds/missing-round/standings/schools');

        expect(res.status).toBe(404);
        expect(res.body.error).toMatch(/not found/i);
      });

      it('returns an empty array when no submissions have a result yet', async () => {
        prisma.round.findUnique.mockResolvedValue({ id: 'round-1', name: 'Round 1' });
        prisma.submission.findMany.mockResolvedValue([]);

        const res = await request(app).get('/api/rounds/round-1/standings/schools');

        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
      });

      it('sums scores per school and returns entrant counts', async () => {
        prisma.round.findUnique.mockResolvedValue({ id: 'round-1', name: 'Round 1' });
        prisma.submission.findMany.mockResolvedValue([
          {
            entrant: { id: 'e1', school: { id: 'school-1', name: 'Wits High School' } },
            result: { score: 20 },
          },
          {
            entrant: { id: 'e2', school: { id: 'school-1', name: 'Wits High School' } },
            result: { score: 30 },
          },
          {
            entrant: { id: 'e3', school: { id: 'school-2', name: "St Mary's" } },
            result: { score: 10 },
          },
        ]);

        const res = await request(app).get('/api/rounds/round-1/standings/schools');

        expect(res.status).toBe(200);
        const wits = res.body.find((s) => s.schoolName === 'Wits High School');
        expect(wits.totalScore).toBe(50);
        expect(wits.entrantCount).toBe(2);
      });

      it('ranks schools by total score, highest first', async () => {
        prisma.round.findUnique.mockResolvedValue({ id: 'round-1', name: 'Round 1' });
        prisma.submission.findMany.mockResolvedValue([
          {
            entrant: { id: 'e1', school: { id: 'school-1', name: 'School A' } },
            result: { score: 30 },
          },
          {
            entrant: { id: 'e2', school: { id: 'school-2', name: 'School B' } },
            result: { score: 90 },
          },
        ]);

        const res = await request(app).get('/api/rounds/round-1/standings/schools');

        expect(res.body[0]).toMatchObject({ rank: 1, schoolName: 'School B', totalScore: 90 });
        expect(res.body[1]).toMatchObject({ rank: 2, schoolName: 'School A', totalScore: 30 });
      });

      it('gives tied school totals the same rank, skipping the next rank accordingly', async () => {
        prisma.round.findUnique.mockResolvedValue({ id: 'round-1', name: 'Round 1' });
        prisma.submission.findMany.mockResolvedValue([
          { entrant: { id: 'e1', school: { id: 'school-1', name: 'School A' } }, result: { score: 50 } },
          { entrant: { id: 'e2', school: { id: 'school-2', name: 'School B' } }, result: { score: 50 } },
          { entrant: { id: 'e3', school: { id: 'school-3', name: 'School C' } }, result: { score: 40 } },
        ]);

        const res = await request(app).get('/api/rounds/round-1/standings/schools');

        expect(res.body[0].rank).toBe(1);
        expect(res.body[1].rank).toBe(1);
        expect(res.body[2].rank).toBe(3);
      });

      it('returns 500 on prisma error', async () => {
        prisma.round.findUnique.mockResolvedValue({ id: 'round-1', name: 'Round 1' });
        prisma.submission.findMany.mockRejectedValue(new Error('DB error'));

        const res = await request(app).get('/api/rounds/round-1/standings/schools');

        expect(res.status).toBe(500);
        expect(res.body.error).toMatch(/Failed/);
      });
    });
  });

  describe('GET /api/rounds/:id/notifications', () => {
    beforeEach(() => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'organiser@olympiad.com',
        role: 'organiser',
        name: 'Organiser One',
      });
    });

    it('returns 401 when not authenticated', async () => {
      const unauthApp = createApp(false);
      const res = await request(unauthApp).get('/api/rounds/round-1/notifications');
      expect(res.status).toBe(401);
    });

    it('returns 403 when user is not an organiser', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'teacher@school.com',
        role: 'educator',
        name: 'Teacher One',
      });
      const res = await request(app).get('/api/rounds/round-1/notifications');
      expect(res.status).toBe(403);
    });

    it('returns 404 when round not found', async () => {
      prisma.round.findUnique.mockResolvedValue(null);
      const res = await request(app).get('/api/rounds/round-1/notifications');
      expect(res.status).toBe(404);
    });

    it('returns all 4 trigger types with defaults when none are configured', async () => {
      prisma.round.findUnique.mockResolvedValue({ id: 'round-1' });
      prisma.notificationRule.findMany.mockResolvedValue([]);

      const res = await request(app).get('/api/rounds/round-1/notifications');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(4);
      expect(res.body.every((r) => r.enabled === true)).toBe(true);
      expect(res.body.map((r) => r.triggerType).sort()).toEqual(
        ['before_close', 'before_open', 'missing_submission', 'results_released'].sort()
      );
    });

    it('merges configured rules with defaults for unconfigured trigger types', async () => {
      prisma.round.findUnique.mockResolvedValue({ id: 'round-1' });
      prisma.notificationRule.findMany.mockResolvedValue([
        {
          id: 'rule-1',
          roundId: 'round-1',
          triggerType: 'before_open',
          enabled: false,
          recipientRole: 'organiser',
        },
      ]);

      const res = await request(app).get('/api/rounds/round-1/notifications');

      const beforeOpen = res.body.find((r) => r.triggerType === 'before_open');
      const beforeClose = res.body.find((r) => r.triggerType === 'before_close');
      expect(beforeOpen).toMatchObject({ enabled: false, recipientRole: 'organiser' });
      expect(beforeClose).toMatchObject({ enabled: true, recipientRole: 'educator', id: null });
    });

    it('returns 500 on prisma error', async () => {
      prisma.round.findUnique.mockResolvedValue({ id: 'round-1' });
      prisma.notificationRule.findMany.mockRejectedValue(new Error('DB error'));
      const res = await request(app).get('/api/rounds/round-1/notifications');
      expect(res.status).toBe(500);
    });
  });

  describe('PUT /api/rounds/:id/notifications/:triggerType', () => {
    beforeEach(() => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'organiser@olympiad.com',
        role: 'organiser',
        name: 'Organiser One',
      });
    });

    it('returns 401 when not authenticated', async () => {
      const unauthApp = createApp(false);
      const res = await request(unauthApp)
        .put('/api/rounds/round-1/notifications/before_open')
        .send({ enabled: false });
      expect(res.status).toBe(401);
      expect(prisma.notificationRule.upsert).not.toHaveBeenCalled();
    });

    it('returns 403 when user is not an organiser', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'teacher@school.com',
        role: 'educator',
        name: 'Teacher One',
      });
      const res = await request(app)
        .put('/api/rounds/round-1/notifications/before_open')
        .send({ enabled: false });
      expect(res.status).toBe(403);
      expect(prisma.notificationRule.upsert).not.toHaveBeenCalled();
    });

    it('returns 400 for an invalid trigger type', async () => {
      const res = await request(app)
        .put('/api/rounds/round-1/notifications/not_a_real_trigger')
        .send({ enabled: false });
      expect(res.status).toBe(400);
    });

    it('returns 400 for an invalid recipient role', async () => {
      const res = await request(app)
        .put('/api/rounds/round-1/notifications/before_open')
        .send({ recipientRole: 'not_a_real_role' });
      expect(res.status).toBe(400);
    });

    it('returns 404 when round not found', async () => {
      prisma.round.findUnique.mockResolvedValue(null);
      const res = await request(app)
        .put('/api/rounds/round-1/notifications/before_open')
        .send({ enabled: false });
      expect(res.status).toBe(404);
    });

    it('upserts the rule with enabled=false and returns it', async () => {
      prisma.round.findUnique.mockResolvedValue({ id: 'round-1' });
      prisma.notificationRule.upsert.mockResolvedValue({
        id: 'rule-1',
        roundId: 'round-1',
        triggerType: 'before_open',
        enabled: false,
        recipientRole: 'educator',
      });

      const res = await request(app)
        .put('/api/rounds/round-1/notifications/before_open')
        .send({ enabled: false });

      expect(res.status).toBe(200);
      expect(res.body.enabled).toBe(false);
      expect(prisma.notificationRule.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { roundId_triggerType: { roundId: 'round-1', triggerType: 'before_open' } },
        })
      );
    });

    it('creates with defaults when no fields are supplied', async () => {
      prisma.round.findUnique.mockResolvedValue({ id: 'round-1' });
      prisma.notificationRule.upsert.mockResolvedValue({
        id: 'rule-1',
        roundId: 'round-1',
        triggerType: 'before_close',
        enabled: true,
        recipientRole: 'educator',
      });

      const res = await request(app)
        .put('/api/rounds/round-1/notifications/before_close')
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.enabled).toBe(true);
      expect(res.body.recipientRole).toBe('educator');
      expect(prisma.notificationRule.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            roundId: 'round-1',
            triggerType: 'before_close',
            enabled: true,
            recipientRole: 'educator',
          }),
        })
      );
    });

    it('updates only recipientRole when that is the only field sent', async () => {
      prisma.round.findUnique.mockResolvedValue({ id: 'round-1' });
      prisma.notificationRule.upsert.mockResolvedValue({
        id: 'rule-1',
        roundId: 'round-1',
        triggerType: 'before_open',
        enabled: true,
        recipientRole: 'all',
      });

      const res = await request(app)
        .put('/api/rounds/round-1/notifications/before_open')
        .send({ recipientRole: 'all' });

      expect(res.status).toBe(200);
      expect(res.body.recipientRole).toBe('all');
      expect(prisma.notificationRule.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({ recipientRole: 'all' }),
        })
      );
    });

    it('accepts all valid trigger types', async () => {
      prisma.round.findUnique.mockResolvedValue({ id: 'round-1' });
      const triggers = ['before_open', 'before_close', 'missing_submission', 'results_released'];

      for (const trigger of triggers) {
        prisma.notificationRule.upsert.mockResolvedValue({
          id: `rule-${trigger}`,
          roundId: 'round-1',
          triggerType: trigger,
          enabled: true,
          recipientRole: 'educator',
        });

        const res = await request(app)
          .put(`/api/rounds/round-1/notifications/${trigger}`)
          .send({ enabled: true });

        expect(res.status).toBe(200);
        expect(res.body.triggerType).toBe(trigger);
      }
    });

    it('returns 500 on prisma error', async () => {
      prisma.round.findUnique.mockResolvedValue({ id: 'round-1' });
      prisma.notificationRule.upsert.mockRejectedValue(new Error('DB error'));
      const res = await request(app)
        .put('/api/rounds/round-1/notifications/before_open')
        .send({ enabled: false });
      expect(res.status).toBe(500);
    });
  });

  describe('DELETE /api/rounds/:id/notifications/:triggerType', () => {
    beforeEach(() => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'organiser@olympiad.com',
        role: 'organiser',
        name: 'Organiser One',
      });
    });

    it('returns 401 when not authenticated', async () => {
      const unauthApp = createApp(false);
      const res = await request(unauthApp).delete('/api/rounds/round-1/notifications/before_open');
      expect(res.status).toBe(401);
      expect(prisma.notificationRule.deleteMany).not.toHaveBeenCalled();
    });

    it('returns 403 when user is not an organiser', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'teacher@school.com',
        role: 'educator',
        name: 'Teacher One',
      });
      const res = await request(app).delete('/api/rounds/round-1/notifications/before_open');
      expect(res.status).toBe(403);
      expect(prisma.notificationRule.deleteMany).not.toHaveBeenCalled();
    });

    it('deletes the rule and returns 204', async () => {
      prisma.notificationRule.deleteMany.mockResolvedValue({ count: 1 });

      const res = await request(app).delete('/api/rounds/round-1/notifications/before_open');

      expect(res.status).toBe(204);
      expect(prisma.notificationRule.deleteMany).toHaveBeenCalledWith({
        where: { roundId: 'round-1', triggerType: 'before_open' },
      });
    });

    it('returns 204 even when no matching rule exists (deleteMany deletes 0)', async () => {
      prisma.notificationRule.deleteMany.mockResolvedValue({ count: 0 });

      const res = await request(app).delete('/api/rounds/round-1/notifications/missing_submission');

      expect(res.status).toBe(204);
      expect(prisma.notificationRule.deleteMany).toHaveBeenCalledWith({
        where: { roundId: 'round-1', triggerType: 'missing_submission' },
      });
    });

    it('passes the correct triggerType for each trigger', async () => {
      prisma.notificationRule.deleteMany.mockResolvedValue({ count: 1 });
      const triggers = ['before_open', 'before_close', 'missing_submission', 'results_released'];

      for (const trigger of triggers) {
        const res = await request(app).delete(`/api/rounds/round-1/notifications/${trigger}`);
        expect(res.status).toBe(204);
        expect(prisma.notificationRule.deleteMany).toHaveBeenCalledWith({
          where: { roundId: 'round-1', triggerType: trigger },
        });
      }
    });

    it('returns 500 on prisma error', async () => {
      prisma.notificationRule.deleteMany.mockRejectedValue(new Error('DB error'));
      const res = await request(app).delete('/api/rounds/round-1/notifications/before_open');
      expect(res.status).toBe(500);
    });
  });

  describe('POST /api/rounds/:id/notifications/test', () => {
    beforeEach(() => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'organiser@olympiad.com',
        role: 'organiser',
        name: 'Organiser One',
      });
      vi.spyOn(sgMail, 'send');
      vi.spyOn(prisma.notificationRule, 'findUnique').mockResolvedValue(null);
      vi.spyOn(prisma.notificationLog, 'findMany').mockResolvedValue([]);
      vi.spyOn(prisma.notificationLog, 'create');
    });

    it('returns 401 when not authenticated', async () => {
      const unauthApp = createApp(false);
      const res = await request(unauthApp)
        .post('/api/rounds/round-1/notifications/test')
        .send({ triggerType: 'before_open' });
      expect(res.status).toBe(401);
    });

    it('returns 403 when user is not an organiser', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'teacher@school.com',
        role: 'educator',
        name: 'Teacher One',
      });
      const res = await request(app)
        .post('/api/rounds/round-1/notifications/test')
        .send({ triggerType: 'before_open' });
      expect(res.status).toBe(403);
    });

    it('returns 400 when triggerType is missing or invalid', async () => {
      const missing = await request(app).post('/api/rounds/round-1/notifications/test').send({});
      expect(missing.status).toBe(400);

      const invalid = await request(app)
        .post('/api/rounds/round-1/notifications/test')
        .send({ triggerType: 'not_a_real_trigger' });
      expect(invalid.status).toBe(400);
    });

    it('returns 404 when round not found', async () => {
      prisma.round.findUnique.mockResolvedValue(null);
      const res = await request(app)
        .post('/api/rounds/round-1/notifications/test')
        .send({ triggerType: 'before_open' });
      expect(res.status).toBe(404);
    });

    it('previews recipients and the email without sending or logging anything', async () => {
      prisma.round.findUnique.mockResolvedValue({
        id: 'round-1',
        name: 'Round One',
        state: 'scheduled',
        openTime: new Date('2026-01-01T10:00:00Z'),
        closeTime: new Date('2026-01-02T10:00:00Z'),
        roundEntrants: [
          {
            entrant: {
              id: 'entrant-1',
              name: 'Alice',
              school: {
                educators: [
                  { user: { email: 'teacher-a@school.com' } },
                  { user: { email: 'teacher-b@school.com' } },
                ],
              },
            },
          },
          {
            entrant: {
              id: 'entrant-2',
              name: 'Bob',
              school: { educators: [{ user: { email: 'teacher-c@school.com' } }] },
            },
          },
        ],
      });
      prisma.notificationLog.findMany.mockResolvedValue([{ recipientEmail: 'teacher-a@school.com' }]);

      const res = await request(app)
        .post('/api/rounds/round-1/notifications/test')
        .send({ triggerType: 'before_open' });

      expect(res.status).toBe(200);
      expect(res.body.dryRun).toBe(true);
      expect(res.body.triggerType).toBe('before_open');
      expect(res.body.enabled).toBe(true);
      expect(res.body.recipients).toEqual([
        { email: 'teacher-a@school.com', alreadyNotified: true },
        { email: 'teacher-b@school.com', alreadyNotified: false },
        { email: 'teacher-c@school.com', alreadyNotified: false },
      ]);
      expect(res.body.emailPreview.subject).toBe('Round One opens soon');
      expect(res.body.emailPreview.text).toContain('Round One opens at 2026-01-01T10:00:00.000Z');
      expect(sgMail.send).not.toHaveBeenCalled();
      expect(prisma.notificationLog.create).not.toHaveBeenCalled();
    });

    it('reports the trigger as disabled when the rule is configured off', async () => {
      prisma.round.findUnique.mockResolvedValue({
        id: 'round-1',
        name: 'Round One',
        state: 'open',
        openTime: new Date('2026-01-01T10:00:00Z'),
        closeTime: new Date('2026-01-02T10:00:00Z'),
        roundEntrants: [],
      });
      prisma.notificationRule.findUnique.mockResolvedValue({
        id: 'rule-1',
        roundId: 'round-1',
        triggerType: 'before_open',
        enabled: false,
        recipientRole: 'educator',
      });

      const res = await request(app)
        .post('/api/rounds/round-1/notifications/test')
        .send({ triggerType: 'before_open' });

      expect(res.status).toBe(200);
      expect(res.body.enabled).toBe(false);
      expect(res.body.recipients).toEqual([]);
    });

    it('previews the closing and results-released emails too', async () => {
      prisma.round.findUnique.mockResolvedValue({
        id: 'round-1',
        name: 'Round One',
        state: 'open',
        openTime: new Date('2026-01-01T10:00:00Z'),
        closeTime: new Date('2026-01-02T10:00:00Z'),
        roundEntrants: [],
      });

      const closing = await request(app)
        .post('/api/rounds/round-1/notifications/test')
        .send({ triggerType: 'before_close' });
      expect(closing.status).toBe(200);
      expect(closing.body.emailPreview.subject).toBe('Round One closes soon');
      expect(closing.body.emailPreview.text).toContain('Round One closes at 2026-01-02T10:00:00.000Z');

      const released = await request(app)
        .post('/api/rounds/round-1/notifications/test')
        .send({ triggerType: 'results_released' });
      expect(released.status).toBe(200);
      expect(released.body.emailPreview.subject).toBe('Results are out for Round One');
    });

    it('lists one entry per missing entrant, deduped per educator like the scheduler', async () => {
      prisma.round.findUnique.mockResolvedValue({
        id: 'round-1',
        name: 'Round One',
        state: 'closed',
        openTime: new Date('2026-01-01T10:00:00Z'),
        closeTime: new Date('2026-01-02T10:00:00Z'),
        roundEntrants: [
          {
            entrant: {
              id: 'entrant-1',
              name: 'Alice',
              school: { educators: [{ user: { email: 'teacher@school.com' } }] },
              submissions: [{ roundId: 'round-1' }],
            },
          },
          {
            entrant: {
              id: 'entrant-2',
              name: 'Bob',
              school: { educators: [{ user: { email: 'teacher@school.com' } }] },
              submissions: [],
            },
          },
          {
            entrant: {
              id: 'entrant-3',
              name: 'Carol',
              school: { educators: [{ user: { email: 'teacher@school.com' } }] },
              submissions: [],
            },
          },
        ],
      });

      const res = await request(app)
        .post('/api/rounds/round-1/notifications/test')
        .send({ triggerType: 'missing_submission' });

      expect(res.status).toBe(200);
      expect(res.body.recipients).toEqual([
        { email: 'teacher@school.com', entrantId: 'entrant-2', entrantName: 'Bob', alreadyNotified: false },
        { email: 'teacher@school.com', entrantId: 'entrant-3', entrantName: 'Carol', alreadyNotified: true },
      ]);
      expect(res.body.emailPreview.subject).toBe('Missing submission for Bob - Round One');
    });

    it('omits the email preview for missing_submission when nothing is missing', async () => {
      prisma.round.findUnique.mockResolvedValue({
        id: 'round-1',
        name: 'Round One',
        state: 'closed',
        openTime: new Date('2026-01-01T10:00:00Z'),
        closeTime: new Date('2026-01-02T10:00:00Z'),
        roundEntrants: [
          {
            entrant: {
              id: 'entrant-1',
              name: 'Alice',
              school: { educators: [{ user: { email: 'teacher@school.com' } }] },
              submissions: [{ roundId: 'round-1' }],
            },
          },
        ],
      });

      const res = await request(app)
        .post('/api/rounds/round-1/notifications/test')
        .send({ triggerType: 'missing_submission' });

      expect(res.status).toBe(200);
      expect(res.body.recipients).toEqual([]);
      expect(res.body.emailPreview).toBeNull();
    });

    it('returns 500 on prisma error', async () => {
      prisma.round.findUnique.mockRejectedValue(new Error('DB error'));
      const res = await request(app)
        .post('/api/rounds/round-1/notifications/test')
        .send({ triggerType: 'before_open' });
      expect(res.status).toBe(500);
    });
  });

  describe('POST /api/rounds/:id/release-results', () => {
    it('releases all unreleased results for a closed round', async () => {
      prisma.round.findUnique.mockResolvedValue({ id: 'r1', state: 'closed' });
      prisma.result.updateMany.mockResolvedValue({ count: 5 });

      const res = await request(app).post('/api/rounds/r1/release-results');
      expect(res.status).toBe(200);
      expect(res.body.releasedCount).toBe(5);
      expect(res.body.releasedAt).toBeTruthy();
      expect(prisma.result.updateMany).toHaveBeenCalledWith({
        where: { releasedAt: null, submission: { roundId: 'r1' } },
        data: expect.objectContaining({ releasedAt: expect.any(Date) }),
      });
    });

    it('returns 404 when round does not exist', async () => {
      prisma.round.findUnique.mockResolvedValue(null);
      const res = await request(app).post('/api/rounds/nope/release-results');
      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/Round not found/);
    });

    it('returns 403 when round is not closed', async () => {
      prisma.round.findUnique.mockResolvedValue({ id: 'r1', state: 'open' });
      const res = await request(app).post('/api/rounds/r1/release-results');
      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/closed/);
      expect(prisma.result.updateMany).not.toHaveBeenCalled();
    });

    it('returns 500 on database error', async () => {
      prisma.round.findUnique.mockResolvedValue({ id: 'r1', state: 'closed' });
      prisma.result.updateMany.mockRejectedValue(new Error('DB error'));
      const res = await request(app).post('/api/rounds/r1/release-results');
      expect(res.status).toBe(500);
      expect(res.body.error).toMatch(/Could not release/);
    });
  });

  describe('POST /api/rounds/:id/unrelease-results', () => {
    it('unreleases all released results for a round', async () => {
      prisma.round.findUnique.mockResolvedValue({ id: 'r1', state: 'closed' });
      prisma.result.updateMany.mockResolvedValue({ count: 3 });

      const res = await request(app).post('/api/rounds/r1/unrelease-results');
      expect(res.status).toBe(200);
      expect(res.body.unreleasedCount).toBe(3);
      expect(prisma.result.updateMany).toHaveBeenCalledWith({
        where: { releasedAt: { not: null }, submission: { roundId: 'r1' } },
        data: { releasedAt: null },
      });
    });

    it('returns 404 when round does not exist', async () => {
      prisma.round.findUnique.mockResolvedValue(null);
      const res = await request(app).post('/api/rounds/nope/unrelease-results');
      expect(res.status).toBe(404);
    });

    it('returns 500 on database error', async () => {
      prisma.round.findUnique.mockResolvedValue({ id: 'r1', state: 'closed' });
      prisma.result.updateMany.mockRejectedValue(new Error('DB error'));
      const res = await request(app).post('/api/rounds/r1/unrelease-results');
      expect(res.status).toBe(500);
      expect(res.body.error).toMatch(/Could not unrelease/);
    });
  });
});