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
    vi.spyOn(prisma.olympiad, 'findUnique');
    vi.spyOn(prisma.olympiad, 'update');
    vi.spyOn(prisma.round, 'create');
    vi.spyOn(prisma.round, 'findMany');
    vi.spyOn(prisma.round, 'findUnique');
    vi.spyOn(prisma.round, 'update').mockResolvedValue({ id: 'r1', state: 'released' });
    vi.spyOn(prisma.round, 'updateMany').mockResolvedValue({ count: 1 });
    vi.spyOn(prisma.roundEntrant, 'findMany');
    vi.spyOn(prisma.roundEntrant, 'findUnique');
    vi.spyOn(prisma.roundEntrant, 'create');
    vi.spyOn(prisma.schoolOlympiad, 'findMany').mockResolvedValue([]);
    vi.spyOn(prisma.schoolOlympiad, 'findUnique').mockResolvedValue({ status: 'approved' });
    vi.spyOn(prisma.schoolOlympiad, 'upsert');
    vi.spyOn(prisma.schoolOlympiad, 'update');
    vi.spyOn(prisma.user, 'findMany');
    vi.spyOn(prisma.submission, 'findMany');
    vi.spyOn(prisma.submission, 'findFirst');
    vi.spyOn(prisma.user, 'findUnique');
    vi.spyOn(prisma.educator, 'findUnique');
    vi.spyOn(prisma.entrant, 'findUnique');
    vi.spyOn(prisma.notificationRule, 'findMany');
    vi.spyOn(prisma.notificationRule, 'upsert');
    vi.spyOn(prisma.notificationRule, 'deleteMany');
    vi.spyOn(prisma.result, 'updateMany');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    // Default: no registrations anywhere (GET /olympiads enrichment counts
    // them) — schools have approved access (POST /rounds/:id/entrants gate).
    prisma.roundEntrant.findMany.mockResolvedValue([]);
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
    // Overrides the default educator mock: creating olympiads is
    // organiser-only and the creator becomes the owner.
    function signInAsOrganiser() {
      prisma.user.findUnique.mockResolvedValue({
        id: 'organiser-1',
        email: 'organiser@olympiad.com',
        role: 'organiser',
        name: 'Organiser One',
      });
    }

    it('returns 401 when not authenticated (no Clerk session)', async () => {
      const unauthApp = createApp(false);
      const res = await request(unauthApp)
        .post('/api/olympiads')
        .send({ name: 'Test', timezone: 'UTC' });
      expect(res.status).toBe(401);
      expect(prisma.olympiad.create).not.toHaveBeenCalled();
    });

    it('returns 403 when the user is not an organiser', async () => {
      const res = await request(app).post('/api/olympiads').send({ name: 'Test', timezone: 'UTC' });
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('organiser access required');
      expect(prisma.olympiad.create).not.toHaveBeenCalled();
    });

    it('returns 400 when fields are missing', async () => {
      signInAsOrganiser();
      const res = await request(app).post('/api/olympiads').send({ name: 'Test' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/required/);
    });

    it('creates olympiad owned by the requester and returns 201', async () => {
      signInAsOrganiser();
      prisma.olympiad.create.mockResolvedValue({ id: '1', name: 'Test', timezone: 'UTC' });
      const res = await request(app).post('/api/olympiads').send({ name: 'Test', timezone: 'UTC' });
      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Test');
      expect(prisma.olympiad.create).toHaveBeenCalledWith({
        data: {
          name: 'Test',
          timezone: 'UTC',
          description: null,
          grades: null,
          startDate: null,
          endDate: null,
          organiserId: 'organiser-1',
        },
      });
    });

    it('returns 500 on prisma error', async () => {
      signInAsOrganiser();
      prisma.olympiad.create.mockRejectedValue(new Error('DB error'));
      const res = await request(app).post('/api/olympiads').send({ name: 'Test', timezone: 'UTC' });
      expect(res.status).toBe(500);
      expect(res.body.error).toMatch(/Failed/);
    });

    it('stores the optional info fields when provided', async () => {
      signInAsOrganiser();
      prisma.olympiad.create.mockResolvedValue({ id: '1', name: 'Test', timezone: 'UTC' });
      const res = await request(app).post('/api/olympiads').send({
        name: 'Test',
        timezone: 'UTC',
        description: 'A maths olympiad',
        grades: 'Grade 8–12',
        startDate: '2026-02-01T00:00:00Z',
        endDate: '2026-03-01T00:00:00Z',
      });
      expect(res.status).toBe(201);
      expect(prisma.olympiad.create).toHaveBeenCalledWith({
        data: {
          name: 'Test',
          timezone: 'UTC',
          description: 'A maths olympiad',
          grades: 'Grade 8–12',
          startDate: new Date('2026-02-01T00:00:00Z'),
          endDate: new Date('2026-03-01T00:00:00Z'),
          organiserId: 'organiser-1',
        },
      });
    });

    it('stores nulls when the optional info fields are missing', async () => {
      signInAsOrganiser();
      prisma.olympiad.create.mockResolvedValue({ id: '1', name: 'Test', timezone: 'UTC' });
      const res = await request(app).post('/api/olympiads').send({ name: 'Test', timezone: 'UTC' });
      expect(res.status).toBe(201);
      expect(prisma.olympiad.create).toHaveBeenCalledWith({
        data: {
          name: 'Test',
          timezone: 'UTC',
          description: null,
          grades: null,
          startDate: null,
          endDate: null,
          organiserId: 'organiser-1',
        },
      });
    });

    it('returns 400 when endDate is before startDate', async () => {
      signInAsOrganiser();
      const res = await request(app).post('/api/olympiads').send({
        name: 'Test',
        timezone: 'UTC',
        startDate: '2026-03-01T00:00:00Z',
        endDate: '2026-02-01T00:00:00Z',
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/endDate must be on or after startDate/);
      expect(prisma.olympiad.create).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/olympiads', () => {
    it('enriches the list with access state and entrant counts for educators', async () => {
      prisma.olympiad.findMany.mockResolvedValue([
        { id: '1', name: 'A', rounds: [] },
        { id: '2', name: 'B', rounds: [] },
      ]);
      prisma.schoolOlympiad.findMany.mockResolvedValue([
        { olympiadId: '1', status: 'approved' },
        { olympiadId: '2', status: 'pending' },
      ]);
      prisma.roundEntrant.findMany.mockResolvedValue([
        {
          entrantId: 'e1',
          entrant: { schoolId: 'school-1', school: { name: 'School One' } },
          round: { olympiadId: '1' },
        },
        // Same entrant in another round of the same olympiad counts once.
        {
          entrantId: 'e1',
          entrant: { schoolId: 'school-1', school: { name: 'School One' } },
          round: { olympiadId: '1' },
        },
        {
          entrantId: 'e2',
          entrant: { schoolId: 'school-1', school: { name: 'School One' } },
          round: { olympiadId: '1' },
        },
        {
          entrantId: 'e3',
          entrant: { schoolId: 'school-2', school: { name: 'School Two' } },
          round: { olympiadId: '1' },
        },
      ]);

      const res = await request(app).get('/api/olympiads');

      expect(res.status).toBe(200);
      expect(prisma.olympiad.findMany).toHaveBeenCalledWith({
        where: {},
        include: { rounds: { orderBy: { openTime: 'asc' } } },
        orderBy: { name: 'asc' },
      });
      expect(res.body[0]).toMatchObject({ id: '1', schoolAccess: 'approved' });
      expect(res.body[0].schoolEntrantCounts).toEqual([
        { schoolName: 'School One', entrantCount: 2 },
        { schoolName: 'School Two', entrantCount: 1 },
      ]);
      expect(res.body[1]).toMatchObject({ id: '2', schoolAccess: 'pending' });
      expect(res.body[1].schoolEntrantCounts).toEqual([]);
    });

    it('returns the plain list for anonymous callers', async () => {
      prisma.olympiad.findMany.mockResolvedValue([{ id: '1', name: 'A', rounds: [] }]);
      const unauthApp = createApp(false);

      const res = await request(unauthApp).get('/api/olympiads');

      expect(res.status).toBe(200);
      expect(res.body[0]).not.toHaveProperty('schoolAccess');
      expect(res.body[0]).not.toHaveProperty('schoolEntrantCounts');
      expect(prisma.schoolOlympiad.findMany).not.toHaveBeenCalled();
    });

    it('returns the plain list for organisers', async () => {
      prisma.olympiad.findMany.mockResolvedValue([{ id: '1', name: 'A', rounds: [] }]);
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'organiser@olympiad.com',
        role: 'organiser',
        name: 'Organiser One',
      });

      const res = await request(app).get('/api/olympiads');

      expect(res.status).toBe(200);
      expect(res.body[0]).not.toHaveProperty('schoolAccess');
      expect(res.body[0]).not.toHaveProperty('schoolEntrantCounts');
      expect(prisma.schoolOlympiad.findMany).not.toHaveBeenCalled();
    });

    it('scopes organisers to the olympiads they created themselves', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'organiser@olympiad.com',
        role: 'organiser',
        name: 'Organiser One',
      });
      prisma.olympiad.findMany.mockResolvedValue([{ id: '3', name: 'Mine', rounds: [] }]);

      const res = await request(app).get('/api/olympiads');

      expect(res.status).toBe(200);
      expect(res.body).toEqual([{ id: '3', name: 'Mine', rounds: [] }]);
      expect(prisma.olympiad.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { organiserId: 'user-1' } })
      );
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
          qualifyingThreshold: null,
        },
      });
    });

    it('creates round with a qualifyingThreshold when provided', async () => {
      prisma.round.create.mockResolvedValue({ id: '1', name: 'Round 1', qualifyingThreshold: 60 });
      const res = await request(app).post('/api/rounds').send({
        olympiadId: '1',
        name: 'Round 1',
        openTime: '2026-01-01T00:00:00Z',
        closeTime: '2026-01-02T00:00:00Z',
        qualifyingThreshold: 60,
      });
      expect(res.status).toBe(201);
      expect(prisma.round.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ qualifyingThreshold: 60 }),
      });
    });

    it('returns 400 when qualifyingThreshold is out of range', async () => {
      const res = await request(app).post('/api/rounds').send({
        olympiadId: '1',
        name: 'Round 1',
        openTime: '2026-01-01T00:00:00Z',
        closeTime: '2026-01-02T00:00:00Z',
        qualifyingThreshold: 150,
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/qualifyingThreshold/);
    });

    it('returns 400 when qualifyingThreshold is not a number', async () => {
      const res = await request(app).post('/api/rounds').send({
        olympiadId: '1',
        name: 'Round 1',
        openTime: '2026-01-01T00:00:00Z',
        closeTime: '2026-01-02T00:00:00Z',
        qualifyingThreshold: 'sixty',
      });
      expect(res.status).toBe(400);
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

  describe('PUT /api/olympiads/:id', () => {
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
      const res = await request(unauthApp).put('/api/olympiads/olympiad-1').send({});
      expect(res.status).toBe(401);
      expect(prisma.olympiad.update).not.toHaveBeenCalled();
    });

    it('returns 403 when user is not an organiser', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'teacher@school.com',
        role: 'educator',
        name: 'Teacher One',
      });
      const res = await request(app).put('/api/olympiads/olympiad-1').send({ name: 'New' });
      expect(res.status).toBe(403);
      expect(prisma.olympiad.update).not.toHaveBeenCalled();
    });

    it('returns 404 when the olympiad does not exist', async () => {
      prisma.olympiad.findUnique.mockResolvedValue(null);
      const res = await request(app).put('/api/olympiads/olympiad-1').send({ name: 'New' });
      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/Olympiad not found/);
    });

    it('updates the info fields and returns the olympiad', async () => {
      prisma.olympiad.findUnique.mockResolvedValue({
        id: 'olympiad-1',
        name: 'Old',
        timezone: 'UTC',
        startDate: null,
        endDate: null,
      });
      prisma.olympiad.update.mockResolvedValue({ id: 'olympiad-1', name: 'New' });

      const res = await request(app).put('/api/olympiads/olympiad-1').send({
        name: 'New',
        timezone: 'Africa/Johannesburg',
        description: 'A maths olympiad',
        grades: 'Grade 8–12',
        startDate: '2026-02-01',
        endDate: '2026-03-01',
      });

      expect(res.status).toBe(200);
      expect(prisma.olympiad.update).toHaveBeenCalledWith({
        where: { id: 'olympiad-1' },
        data: {
          name: 'New',
          timezone: 'Africa/Johannesburg',
          description: 'A maths olympiad',
          grades: 'Grade 8–12',
          startDate: new Date('2026-02-01'),
          endDate: new Date('2026-03-01'),
        },
      });
    });

    it('clears optional fields sent as empty strings', async () => {
      prisma.olympiad.findUnique.mockResolvedValue({
        id: 'olympiad-1',
        name: 'Old',
        timezone: 'UTC',
        startDate: '2026-01-01T00:00:00.000Z',
        endDate: '2026-02-01T00:00:00.000Z',
      });
      prisma.olympiad.update.mockResolvedValue({ id: 'olympiad-1' });

      const res = await request(app)
        .put('/api/olympiads/olympiad-1')
        .send({ description: '', grades: '', startDate: '', endDate: '' });

      expect(res.status).toBe(200);
      expect(prisma.olympiad.update).toHaveBeenCalledWith({
        where: { id: 'olympiad-1' },
        data: { description: null, grades: null, startDate: null, endDate: null },
      });
    });

    it('returns 400 when name or timezone is cleared', async () => {
      prisma.olympiad.findUnique.mockResolvedValue({
        id: 'olympiad-1',
        name: 'Old',
        timezone: 'UTC',
      });
      const res = await request(app).put('/api/olympiads/olympiad-1').send({ name: '' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/name cannot be empty/);
      expect(prisma.olympiad.update).not.toHaveBeenCalled();
    });

    it('returns 400 when endDate would end up before startDate', async () => {
      prisma.olympiad.findUnique.mockResolvedValue({
        id: 'olympiad-1',
        name: 'Old',
        timezone: 'UTC',
        startDate: null,
        endDate: null,
      });
      const res = await request(app)
        .put('/api/olympiads/olympiad-1')
        .send({ startDate: '2026-03-01', endDate: '2026-02-01' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/endDate must be on or after startDate/);
      expect(prisma.olympiad.update).not.toHaveBeenCalled();
    });

    it('returns 500 on prisma error', async () => {
      prisma.olympiad.findUnique.mockResolvedValue({
        id: 'olympiad-1',
        name: 'Old',
        timezone: 'UTC',
      });
      prisma.olympiad.update.mockRejectedValue(new Error('DB error'));
      const res = await request(app).put('/api/olympiads/olympiad-1').send({ name: 'New' });
      expect(res.status).toBe(500);
      expect(res.body.error).toMatch(/Failed to update olympiad/);
    });
  });

  describe('POST /api/olympiads/:id/request-access', () => {
    beforeEach(() => {
      prisma.olympiad.findUnique.mockResolvedValue({ id: 'olympiad-1', name: 'Maths Olympiad' });
      prisma.schoolOlympiad.findUnique.mockResolvedValue(null);
    });

    it('returns 401 when not authenticated', async () => {
      const unauthApp = createApp(false);
      const res = await request(unauthApp).post('/api/olympiads/olympiad-1/request-access');
      expect(res.status).toBe(401);
      expect(prisma.schoolOlympiad.upsert).not.toHaveBeenCalled();
    });

    it('returns 403 when user is not an educator', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'organiser@olympiad.com',
        role: 'organiser',
        name: 'Organiser One',
      });
      const res = await request(app).post('/api/olympiads/olympiad-1/request-access');
      expect(res.status).toBe(403);
      expect(prisma.schoolOlympiad.upsert).not.toHaveBeenCalled();
    });

    it('returns 404 when the olympiad does not exist', async () => {
      prisma.olympiad.findUnique.mockResolvedValue(null);
      const res = await request(app).post('/api/olympiads/olympiad-1/request-access');
      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/Olympiad not found/);
      expect(prisma.schoolOlympiad.upsert).not.toHaveBeenCalled();
    });

    it('returns 403 when the educator has no school linked', async () => {
      prisma.educator.findUnique.mockResolvedValue(null);
      const res = await request(app).post('/api/olympiads/olympiad-1/request-access');
      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/No school linked/);
      expect(prisma.schoolOlympiad.upsert).not.toHaveBeenCalled();
    });

    it('creates a pending request and returns 201', async () => {
      prisma.schoolOlympiad.upsert.mockResolvedValue({
        id: 'so-1',
        status: 'pending',
        schoolId: 'school-1',
        olympiadId: 'olympiad-1',
      });

      const res = await request(app).post('/api/olympiads/olympiad-1/request-access');

      expect(res.status).toBe(201);
      expect(res.body).toEqual({ status: 'pending' });
      expect(prisma.schoolOlympiad.upsert).toHaveBeenCalledWith({
        where: { schoolId_olympiadId: { schoolId: 'school-1', olympiadId: 'olympiad-1' } },
        create: {
          schoolId: 'school-1',
          olympiadId: 'olympiad-1',
          requestedById: 'user-1',
        },
        update: {
          status: 'pending',
          requestedById: 'user-1',
          requestedAt: expect.any(Date),
          decidedAt: null,
        },
      });
    });

    it('returns 409 when the school already has access', async () => {
      prisma.schoolOlympiad.findUnique.mockResolvedValue({ status: 'approved' });
      const res = await request(app).post('/api/olympiads/olympiad-1/request-access');
      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/already has access/);
      expect(prisma.schoolOlympiad.upsert).not.toHaveBeenCalled();
    });

    it('returns 409 when a request is already pending', async () => {
      prisma.schoolOlympiad.findUnique.mockResolvedValue({ status: 'pending' });
      const res = await request(app).post('/api/olympiads/olympiad-1/request-access');
      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/already pending/);
      expect(prisma.schoolOlympiad.upsert).not.toHaveBeenCalled();
    });

    it('re-requests after a decline', async () => {
      prisma.schoolOlympiad.findUnique.mockResolvedValue({ status: 'declined' });
      prisma.schoolOlympiad.upsert.mockResolvedValue({ id: 'so-1', status: 'pending' });

      const res = await request(app).post('/api/olympiads/olympiad-1/request-access');

      expect(res.status).toBe(201);
      expect(prisma.schoolOlympiad.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({ status: 'pending', decidedAt: null }),
        })
      );
    });

    it('returns 500 on prisma error', async () => {
      prisma.schoolOlympiad.upsert.mockRejectedValue(new Error('DB error'));
      const res = await request(app).post('/api/olympiads/olympiad-1/request-access');
      expect(res.status).toBe(500);
      expect(res.body.error).toMatch(/Could not request access/);
    });
  });

  describe('GET /api/olympiads/access-requests', () => {
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
      const res = await request(unauthApp).get('/api/olympiads/access-requests');
      expect(res.status).toBe(401);
    });

    it('returns 403 when user is not an organiser', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'teacher@school.com',
        role: 'educator',
        name: 'Teacher One',
      });
      const res = await request(app).get('/api/olympiads/access-requests');
      expect(res.status).toBe(403);
      expect(prisma.schoolOlympiad.findMany).not.toHaveBeenCalled();
    });

    it('lists pending requests with school, olympiad and requester details', async () => {
      prisma.schoolOlympiad.findMany.mockResolvedValue([
        {
          id: 'so-1',
          status: 'pending',
          requestedById: 'user-1',
          requestedAt: new Date('2026-02-01T10:00:00Z'),
          school: { id: 'school-1', name: 'Test School' },
          olympiad: { id: 'olympiad-1', name: 'Maths Olympiad' },
        },
      ]);
      prisma.user.findMany.mockResolvedValue([
        { id: 'user-1', name: 'Teacher One', email: 'teacher@school.com' },
      ]);

      const res = await request(app).get('/api/olympiads/access-requests');

      expect(res.status).toBe(200);
      expect(prisma.schoolOlympiad.findMany).toHaveBeenCalledWith({
        where: { status: 'pending' },
        include: {
          school: { select: { id: true, name: true } },
          olympiad: { select: { id: true, name: true } },
        },
        orderBy: { requestedAt: 'asc' },
      });
      expect(res.body).toEqual([
        {
          id: 'so-1',
          school: { id: 'school-1', name: 'Test School' },
          olympiad: { id: 'olympiad-1', name: 'Maths Olympiad' },
          requestedBy: { id: 'user-1', name: 'Teacher One', email: 'teacher@school.com' },
          requestedAt: '2026-02-01T10:00:00.000Z',
        },
      ]);
    });

    it('returns an empty array when nothing is pending', async () => {
      prisma.schoolOlympiad.findMany.mockResolvedValue([]);
      const res = await request(app).get('/api/olympiads/access-requests');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
      expect(prisma.user.findMany).not.toHaveBeenCalled();
    });

    it('falls back to a null requester when the requesting user is gone', async () => {
      prisma.schoolOlympiad.findMany.mockResolvedValue([
        {
          id: 'so-1',
          status: 'pending',
          requestedById: 'user-gone',
          requestedAt: new Date('2026-02-01T10:00:00Z'),
          school: { id: 'school-1', name: 'Test School' },
          olympiad: { id: 'olympiad-1', name: 'Maths Olympiad' },
        },
      ]);
      prisma.user.findMany.mockResolvedValue([]);

      const res = await request(app).get('/api/olympiads/access-requests');

      expect(res.status).toBe(200);
      expect(res.body[0].requestedBy).toBeNull();
    });

    it('returns 500 on prisma error', async () => {
      prisma.schoolOlympiad.findMany.mockRejectedValue(new Error('DB error'));
      const res = await request(app).get('/api/olympiads/access-requests');
      expect(res.status).toBe(500);
      expect(res.body.error).toMatch(/Failed to fetch access requests/);
    });
  });

  describe('POST /api/olympiads/access-requests/:id/approve and /decline', () => {
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
      const approve = await request(unauthApp).post('/api/olympiads/access-requests/so-1/approve');
      expect(approve.status).toBe(401);
      expect(prisma.schoolOlympiad.update).not.toHaveBeenCalled();
    });

    it('returns 403 when user is not an organiser', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'teacher@school.com',
        role: 'educator',
        name: 'Teacher One',
      });
      const res = await request(app).post('/api/olympiads/access-requests/so-1/approve');
      expect(res.status).toBe(403);
      expect(prisma.schoolOlympiad.update).not.toHaveBeenCalled();
    });

    it('returns 404 when the request does not exist', async () => {
      prisma.schoolOlympiad.findUnique.mockResolvedValue(null);
      const res = await request(app).post('/api/olympiads/access-requests/so-1/approve');
      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/Access request not found/);
      expect(prisma.schoolOlympiad.update).not.toHaveBeenCalled();
    });

    it('approves the request and stamps decidedAt', async () => {
      prisma.schoolOlympiad.findUnique.mockResolvedValue({ id: 'so-1', status: 'pending' });
      prisma.schoolOlympiad.update.mockResolvedValue({ id: 'so-1', status: 'approved' });

      const res = await request(app).post('/api/olympiads/access-requests/so-1/approve');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ id: 'so-1', status: 'approved' });
      expect(prisma.schoolOlympiad.update).toHaveBeenCalledWith({
        where: { id: 'so-1' },
        data: { status: 'approved', decidedAt: expect.any(Date) },
      });
    });

    it('declines the request and stamps decidedAt', async () => {
      prisma.schoolOlympiad.findUnique.mockResolvedValue({ id: 'so-1', status: 'pending' });
      prisma.schoolOlympiad.update.mockResolvedValue({ id: 'so-1', status: 'declined' });

      const res = await request(app).post('/api/olympiads/access-requests/so-1/decline');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ id: 'so-1', status: 'declined' });
      expect(prisma.schoolOlympiad.update).toHaveBeenCalledWith({
        where: { id: 'so-1' },
        data: { status: 'declined', decidedAt: expect.any(Date) },
      });
    });

    it('returns 500 on prisma error', async () => {
      prisma.schoolOlympiad.findUnique.mockResolvedValue({ id: 'so-1', status: 'pending' });
      prisma.schoolOlympiad.update.mockRejectedValue(new Error('DB error'));
      const res = await request(app).post('/api/olympiads/access-requests/so-1/approve');
      expect(res.status).toBe(500);
      expect(res.body.error).toMatch(/Could not approve access request/);
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

    it("returns 403 when the school doesn't have approved access to the olympiad", async () => {
      prisma.round.findUnique.mockResolvedValue({
        id: '1',
        state: 'open',
        olympiadId: 'olympiad-1',
      });
      prisma.schoolOlympiad.findUnique.mockResolvedValue(null);
      const res = await request(app).post('/api/rounds/1/entrants').send({ entrantId: 'e1' });
      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/request access from the organiser/);
      expect(prisma.roundEntrant.create).not.toHaveBeenCalled();
    });

    it('returns 403 when the access request is still pending', async () => {
      prisma.round.findUnique.mockResolvedValue({
        id: '1',
        state: 'open',
        olympiadId: 'olympiad-1',
      });
      prisma.schoolOlympiad.findUnique.mockResolvedValue({ status: 'pending' });
      const res = await request(app).post('/api/rounds/1/entrants').send({ entrantId: 'e1' });
      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/request access from the organiser/);
      expect(prisma.roundEntrant.create).not.toHaveBeenCalled();
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
      prisma.round.findUnique.mockResolvedValue({
        id: '1',
        state: 'open',
        olympiadId: 'olympiad-1',
      });
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
      expect(prisma.schoolOlympiad.findUnique).toHaveBeenCalledWith({
        where: {
          schoolId_olympiadId: { schoolId: 'school-1', olympiadId: 'olympiad-1' },
        },
      });
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

    it('returns 403 when the prerequisite round was not passed', async () => {
      prisma.round.findUnique.mockResolvedValue({
        id: '1',
        state: 'open',
        prerequisiteRoundId: 'prereq-1',
        qualifyingThreshold: 50,
        prerequisiteRound: { id: 'prereq-1', name: 'Round 0' },
      });
      prisma.entrant.findUnique.mockResolvedValue({
        id: 'e1',
        schoolId: 'school-1',
        name: 'Alice',
        grade: '10',
      });
      prisma.submission.findFirst.mockResolvedValue(null);

      const res = await request(app).post('/api/rounds/1/entrants').send({ entrantId: 'e1' });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Prerequisite not met: Requires at least 50% in Round 0');
      expect(prisma.roundEntrant.create).not.toHaveBeenCalled();
    });

    it('returns 403 when the prerequisite round was not completed', async () => {
      prisma.round.findUnique.mockResolvedValue({
        id: '1',
        state: 'open',
        prerequisiteRoundId: 'prereq-1',
        qualifyingThreshold: null,
        prerequisiteRound: { id: 'prereq-1', name: 'Round 0' },
      });
      prisma.entrant.findUnique.mockResolvedValue({
        id: 'e1',
        schoolId: 'school-1',
        name: 'Alice',
        grade: '10',
      });
      prisma.submission.findFirst.mockResolvedValue(null);

      const res = await request(app).post('/api/rounds/1/entrants').send({ entrantId: 'e1' });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Prerequisite not met: Requires completion of Round 0');
      expect(prisma.roundEntrant.create).not.toHaveBeenCalled();
    });

    it('registers an entrant who passed the prerequisite round', async () => {
      prisma.round.findUnique.mockResolvedValue({
        id: '1',
        state: 'open',
        prerequisiteRoundId: 'prereq-1',
        qualifyingThreshold: 50,
        prerequisiteRound: { id: 'prereq-1', name: 'Round 0' },
      });
      prisma.entrant.findUnique.mockResolvedValue({
        id: 'e1',
        schoolId: 'school-1',
        name: 'Alice',
        grade: '10',
      });
      prisma.submission.findFirst.mockResolvedValue({ id: 'prereq-sub' });
      prisma.roundEntrant.findUnique.mockResolvedValue(null);
      prisma.roundEntrant.create.mockResolvedValue({ id: 're-1', roundId: '1', entrantId: 'e1' });

      const res = await request(app).post('/api/rounds/1/entrants').send({ entrantId: 'e1' });

      expect(res.status).toBe(201);
      expect(prisma.submission.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ entrantId: 'e1', roundId: 'prereq-1' }),
        })
      );
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
      expect(prisma.submission.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: { result: true, entrant: true, remarkRequests: true },
        })
      );
    });

    it('returns 500 on error', async () => {
      prisma.submission.findMany.mockRejectedValue(new Error('DB error'));
      const res = await request(app).get('/api/rounds/1/submissions');
      expect(res.status).toBe(500);
    });
  });
  describe('GET /api/rounds/:id/progression', () => {
    it('returns 404 when the round does not exist', async () => {
      prisma.round.findUnique.mockResolvedValue(null);

      const res = await request(app).get('/api/rounds/round-1/progression');

      expect(res.status).toBe(404);
    });

    it('returns an explanatory message when the round has no qualifyingThreshold', async () => {
      prisma.round.findUnique.mockResolvedValue({
        id: 'round-1',
        qualifyingThreshold: null,
        roundEntrants: [],
      });

      const res = await request(app).get('/api/rounds/round-1/progression');

      expect(res.status).toBe(200);
      expect(res.body.entrants).toEqual([]);
      expect(res.body.message).toMatch(/no qualifyingThreshold/);
    });

    it('marks entrants as qualifying or not based on their score', async () => {
      prisma.round.findUnique.mockResolvedValue({
        id: 'round-1',
        qualifyingThreshold: 50,
        roundEntrants: [
          {
            entrant: {
              id: 'e1',
              name: 'Alice',
              submissions: [{ result: { score: 80 } }],
            },
          },
          {
            entrant: {
              id: 'e2',
              name: 'Bob',
              submissions: [{ result: { score: 30 } }],
            },
          },
        ],
      });

      const res = await request(app).get('/api/rounds/round-1/progression');

      expect(res.status).toBe(200);
      expect(res.body.qualifyingThreshold).toBe(50);
      expect(res.body.entrants).toEqual([
        {
          entrantId: 'e1',
          name: 'Alice',
          score: 80,
          qualifies: true,
        },
        {
          entrantId: 'e2',
          name: 'Bob',
          score: 30,
          qualifies: false,
        },
      ]);
    });

    it('marks unmarked entrants (no result yet) as not qualifying, with a null score', async () => {
      prisma.round.findUnique.mockResolvedValue({
        id: 'round-1',
        qualifyingThreshold: 50,
        roundEntrants: [
          {
            entrant: {
              id: 'e1',
              name: 'Alice',
              submissions: [],
            },
          },
        ],
      });

      const res = await request(app).get('/api/rounds/round-1/progression');

      expect(res.status).toBe(200);
      expect(res.body.entrants).toEqual([
        {
          entrantId: 'e1',
          name: 'Alice',
          score: null,
          qualifies: false,
        },
      ]);
    });

    it('returns 500 on unexpected error', async () => {
      prisma.round.findUnique.mockRejectedValue(new Error('DB error'));

      const res = await request(app).get('/api/rounds/round-1/progression');

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
      prisma.round.findUnique.mockResolvedValue({
        id: 'round-1',
        name: 'Round 1',
      });

      prisma.submission.findMany.mockResolvedValue([]);

      const res = await request(app).get('/api/rounds/round-1/standings');

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('excludes submissions with no result', async () => {
      prisma.round.findUnique.mockResolvedValue({
        id: 'round-1',
        name: 'Round 1',
      });

      prisma.submission.findMany.mockResolvedValue([
        {
          entrant: {
            id: 'entrant-1',
            name: 'Thabo',
            school: { name: 'Wits High School' },
          },
          result: { score: 80 },
          submittedAt: '2026-09-12T20:56:55.855Z',
        },
      ]);

      const res = await request(app).get('/api/rounds/round-1/standings');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);

      expect(prisma.submission.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            roundId: 'round-1',
            result: { isNot: null },
            entrant: { schoolId: 'school-1' },
          },
        })
      );
    });

    it('ranks entrants by score, highest first', async () => {
      prisma.round.findUnique.mockResolvedValue({
        id: 'round-1',
        name: 'Round 1',
      });

      prisma.submission.findMany.mockResolvedValue([
        {
          entrant: {
            id: 'entrant-1',
            name: 'Thabo',
            school: { name: 'Wits High School' },
          },
          result: { score: 50 },
          submittedAt: '2026-09-12T20:00:00.000Z',
        },
        {
          entrant: {
            id: 'entrant-2',
            name: 'Naledi',
            school: { name: "St Mary's" },
          },
          result: { score: 90 },
          submittedAt: '2026-09-12T20:10:00.000Z',
        },
      ]);

      const res = await request(app).get('/api/rounds/round-1/standings');

      expect(res.status).toBe(200);
      expect(res.body[0]).toMatchObject({
        rank: 1,
        entrantName: 'Naledi',
        score: 90,
      });
      expect(res.body[1]).toMatchObject({
        rank: 2,
        entrantName: 'Thabo',
        score: 50,
      });
    });

    it('gives tied scores the same rank, and skips the next rank accordingly', async () => {
      prisma.round.findUnique.mockResolvedValue({
        id: 'round-1',
        name: 'Round 1',
      });

      prisma.submission.findMany.mockResolvedValue([
        {
          entrant: {
            id: 'entrant-1',
            name: 'A',
            school: { name: 'School A' },
          },
          result: { score: 70 },
          submittedAt: '2026-09-12T20:00:00.000Z',
        },
        {
          entrant: {
            id: 'entrant-2',
            name: 'B',
            school: { name: 'School B' },
          },
          result: { score: 70 },
          submittedAt: '2026-09-12T20:10:00.000Z',
        },
        {
          entrant: {
            id: 'entrant-3',
            name: 'C',
            school: { name: 'School C' },
          },
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
      prisma.round.findUnique.mockResolvedValue({
        id: 'round-1',
        name: 'Round 1',
      });

      prisma.submission.findMany.mockResolvedValue([
        {
          entrant: {
            id: 'entrant-1',
            name: 'Paper Entrant',
            school: { name: 'School A' },
          },
          result: { score: 40 },
          submittedAt: '2026-09-12T20:00:00.000Z',
        },
        {
          entrant: {
            id: 'entrant-2',
            name: 'Online Entrant',
            school: { name: 'School B' },
          },
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
      prisma.round.findUnique.mockResolvedValue({
        id: 'round-1',
        name: 'Round 1',
      });

      prisma.submission.findMany.mockRejectedValue(new Error('DB error'));

      const res = await request(app).get('/api/rounds/round-1/standings');

      expect(res.status).toBe(500);
      expect(res.body.error).toMatch(/Failed/);
    });
  });

  describe('GET /api/rounds/:id/standings/schools', () => {
    it('returns 404 when the round does not exist', async () => {
      prisma.round.findUnique.mockResolvedValue(null);

      const res = await request(app).get('/api/rounds/missing-round/standings/schools');

      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/not found/i);
    });

    it('returns an empty array when no submissions have a result yet', async () => {
      prisma.round.findUnique.mockResolvedValue({
        id: 'round-1',
        name: 'Round 1',
      });

      prisma.submission.findMany.mockResolvedValue([]);

      const res = await request(app).get('/api/rounds/round-1/standings/schools');

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('sums scores per school and returns entrant counts', async () => {
      prisma.round.findUnique.mockResolvedValue({
        id: 'round-1',
        name: 'Round 1',
      });

      prisma.submission.findMany.mockResolvedValue([
        {
          entrant: {
            id: 'e1',
            school: {
              id: 'school-1',
              name: 'Wits High School',
            },
          },
          result: { score: 20 },
        },
        {
          entrant: {
            id: 'e2',
            school: {
              id: 'school-1',
              name: 'Wits High School',
            },
          },
          result: { score: 30 },
        },
        {
          entrant: {
            id: 'e3',
            school: {
              id: 'school-2',
              name: "St Mary's",
            },
          },
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
      prisma.round.findUnique.mockResolvedValue({
        id: 'round-1',
        name: 'Round 1',
      });

      prisma.submission.findMany.mockResolvedValue([
        {
          entrant: {
            id: 'e1',
            school: {
              id: 'school-1',
              name: 'School A',
            },
          },
          result: { score: 30 },
        },
        {
          entrant: {
            id: 'e2',
            school: {
              id: 'school-2',
              name: 'School B',
            },
          },
          result: { score: 90 },
        },
      ]);

      const res = await request(app).get('/api/rounds/round-1/standings/schools');

      expect(res.body[0]).toMatchObject({
        rank: 1,
        schoolName: 'School B',
        totalScore: 90,
      });

      expect(res.body[1]).toMatchObject({
        rank: 2,
        schoolName: 'School A',
        totalScore: 30,
      });
    });

    it('gives tied school totals the same rank, skipping the next rank accordingly', async () => {
      prisma.round.findUnique.mockResolvedValue({
        id: 'round-1',
        name: 'Round 1',
      });

      prisma.submission.findMany.mockResolvedValue([
        {
          entrant: {
            id: 'e1',
            school: {
              id: 'school-1',
              name: 'School A',
            },
          },
          result: { score: 50 },
        },
        {
          entrant: {
            id: 'e2',
            school: {
              id: 'school-2',
              name: 'School B',
            },
          },
          result: { score: 50 },
        },
        {
          entrant: {
            id: 'e3',
            school: {
              id: 'school-3',
              name: 'School C',
            },
          },
          result: { score: 40 },
        },
      ]);

      const res = await request(app).get('/api/rounds/round-1/standings/schools');

      expect(res.body[0].rank).toBe(1);
      expect(res.body[1].rank).toBe(1);
      expect(res.body[2].rank).toBe(3);
    });

    it('returns 500 on prisma error', async () => {
      prisma.round.findUnique.mockResolvedValue({
        id: 'round-1',
        name: 'Round 1',
      });

      prisma.submission.findMany.mockRejectedValue(new Error('DB error'));

      const res = await request(app).get('/api/rounds/round-1/standings/schools');

      expect(res.status).toBe(500);
      expect(res.body.error).toMatch(/Failed/);
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
      prisma.round.findUnique.mockResolvedValue({
        id: 'round-1',
      });

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
      prisma.round.findUnique.mockResolvedValue({
        id: 'round-1',
      });

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

      expect(beforeOpen).toMatchObject({
        enabled: false,
        recipientRole: 'organiser',
      });

      expect(beforeClose).toMatchObject({
        enabled: true,
        recipientRole: 'educator',
        id: null,
      });
    });

    it('returns 500 on prisma error', async () => {
      prisma.round.findUnique.mockResolvedValue({
        id: 'round-1',
      });

      prisma.notificationRule.findMany.mockRejectedValue(new Error('DB error'));

      const res = await request(app).get('/api/rounds/round-1/notifications');

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
              school: {
                educators: [{ user: { email: 'teacher-c@school.com' } }],
              },
            },
          },
        ],
      });

      prisma.notificationLog.findMany.mockResolvedValue([
        {
          recipientEmail: 'teacher-a@school.com',
        },
      ]);

      const res = await request(app)
        .post('/api/rounds/round-1/notifications/test')
        .send({ triggerType: 'before_open' });

      expect(res.status).toBe(200);
      expect(res.body.dryRun).toBe(true);
      expect(res.body.triggerType).toBe('before_open');
      expect(res.body.enabled).toBe(true);

      expect(res.body.recipients).toEqual([
        {
          email: 'teacher-a@school.com',
          alreadyNotified: true,
        },
        {
          email: 'teacher-b@school.com',
          alreadyNotified: false,
        },
        {
          email: 'teacher-c@school.com',
          alreadyNotified: false,
        },
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

      expect(closing.body.emailPreview.text).toContain(
        'Round One closes at 2026-01-02T10:00:00.000Z'
      );

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
              school: {
                educators: [
                  {
                    user: {
                      email: 'teacher@school.com',
                    },
                  },
                ],
              },
              submissions: [{ roundId: 'round-1' }],
            },
          },
          {
            entrant: {
              id: 'entrant-2',
              name: 'Bob',
              school: {
                educators: [
                  {
                    user: {
                      email: 'teacher@school.com',
                    },
                  },
                ],
              },
              submissions: [],
            },
          },
          {
            entrant: {
              id: 'entrant-3',
              name: 'Carol',
              school: {
                educators: [
                  {
                    user: {
                      email: 'teacher@school.com',
                    },
                  },
                ],
              },
              submissions: [],
            },
          },
        ],
      });

      prisma.notificationLog.findMany.mockResolvedValue([
        {
          recipientEmail: 'teacher@school.com',
          entrantId: 'entrant-3',
        },
      ]);

      const res = await request(app)
        .post('/api/rounds/round-1/notifications/test')
        .send({ triggerType: 'missing_submission' });

      expect(res.status).toBe(200);

      expect(res.body.recipients).toEqual([
        {
          email: 'teacher@school.com',
          entrantId: 'entrant-2',
          entrantName: 'Bob',
          alreadyNotified: false,
        },
        {
          email: 'teacher@school.com',
          entrantId: 'entrant-3',
          entrantName: 'Carol',
          alreadyNotified: true,
        },
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
              school: {
                educators: [
                  {
                    user: {
                      email: 'teacher@school.com',
                    },
                  },
                ],
              },
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
      prisma.round.findUnique.mockResolvedValue({
        id: 'r1',
        state: 'closed',
      });

      prisma.result.updateMany.mockResolvedValue({
        count: 5,
      });

      const res = await request(app).post('/api/rounds/r1/release-results');

      expect(res.status).toBe(200);
      expect(res.body.releasedCount).toBe(5);
      expect(res.body.releasedAt).toBeTruthy();

      expect(prisma.result.updateMany).toHaveBeenCalledWith({
        where: {
          releasedAt: null,
          submission: {
            roundId: 'r1',
          },
        },
        data: expect.objectContaining({
          releasedAt: expect.any(Date),
        }),
      });
      expect(prisma.round.updateMany).toHaveBeenCalledWith({
        where: { id: 'r1', state: 'closed' },
        data: { state: 'released' },
      });
    });

    it('flips the round to released even when no results were pending', async () => {
      prisma.round.findUnique.mockResolvedValue({ id: 'r1', state: 'closed' });
      prisma.result.updateMany.mockResolvedValue({ count: 0 });

      const res = await request(app).post('/api/rounds/r1/release-results');
      expect(res.status).toBe(200);
      expect(res.body.releasedCount).toBe(0);
      expect(prisma.round.updateMany).toHaveBeenCalledWith({
        where: { id: 'r1', state: 'closed' },
        data: { state: 'released' },
      });
    });

    it('returns 409 when the round state changed concurrently', async () => {
      prisma.round.findUnique.mockResolvedValue({ id: 'r1', state: 'closed' });
      prisma.result.updateMany.mockResolvedValue({ count: 2 });
      prisma.round.updateMany.mockResolvedValue({ count: 0 });

      const res = await request(app).post('/api/rounds/r1/release-results');
      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/no longer closed/);
    });

    it('returns 404 when round does not exist', async () => {
      prisma.round.findUnique.mockResolvedValue(null);

      const res = await request(app).post('/api/rounds/nope/release-results');

      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/Round not found/);
    });

    it('returns 403 when round is not closed', async () => {
      prisma.round.findUnique.mockResolvedValue({
        id: 'r1',
        state: 'open',
      });

      const res = await request(app).post('/api/rounds/r1/release-results');

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/closed/);
      expect(prisma.result.updateMany).not.toHaveBeenCalled();
    });

    it('returns 500 on database error', async () => {
      prisma.round.findUnique.mockResolvedValue({
        id: 'r1',
        state: 'closed',
      });

      prisma.result.updateMany.mockRejectedValue(new Error('DB error'));

      const res = await request(app).post('/api/rounds/r1/release-results');

      expect(res.status).toBe(500);
      expect(res.body.error).toMatch(/Could not release/);
    });

    it('returns 500 when the round state update fails', async () => {
      prisma.round.findUnique.mockResolvedValue({ id: 'r1', state: 'closed' });
      prisma.result.updateMany.mockResolvedValue({ count: 5 });
      prisma.round.updateMany.mockRejectedValue(new Error('DB error'));

      const res = await request(app).post('/api/rounds/r1/release-results');
      expect(res.status).toBe(500);
      expect(res.body.error).toMatch(/Could not release/);
    });
  });

  describe('POST /api/rounds/:id/unrelease-results', () => {
    it('unreleases all released results for a round', async () => {
      prisma.round.findUnique.mockResolvedValue({
        id: 'r1',
        state: 'closed',
      });

      prisma.result.updateMany.mockResolvedValue({
        count: 3,
      });

      const res = await request(app).post('/api/rounds/r1/unrelease-results');

      expect(res.status).toBe(200);
      expect(res.body.unreleasedCount).toBe(3);

      expect(prisma.result.updateMany).toHaveBeenCalledWith({
        where: {
          releasedAt: { not: null },
          submission: {
            roundId: 'r1',
          },
        },
        data: {
          releasedAt: null,
        },
      });
      expect(prisma.round.update).not.toHaveBeenCalled();
    });

    it('reverts a released round back to closed', async () => {
      prisma.round.findUnique.mockResolvedValue({ id: 'r1', state: 'released' });
      prisma.result.updateMany.mockResolvedValue({ count: 3 });

      const res = await request(app).post('/api/rounds/r1/unrelease-results');
      expect(res.status).toBe(200);
      expect(prisma.round.update).toHaveBeenCalledWith({
        where: { id: 'r1' },
        data: { state: 'closed' },
      });
    });

    it('returns 404 when round does not exist', async () => {
      prisma.round.findUnique.mockResolvedValue(null);

      const res = await request(app).post('/api/rounds/nope/unrelease-results');

      expect(res.status).toBe(404);
    });

    it('returns 500 on database error', async () => {
      prisma.round.findUnique.mockResolvedValue({
        id: 'r1',
        state: 'closed',
      });

      prisma.result.updateMany.mockRejectedValue(new Error('DB error'));

      const res = await request(app).post('/api/rounds/r1/unrelease-results');

      expect(res.status).toBe(500);
      expect(res.body.error).toMatch(/Could not unrelease/);
    });
  });
});
