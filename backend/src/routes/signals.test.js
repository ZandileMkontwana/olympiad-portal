import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
const prisma = require('../lib/prisma');
const signalsRouter = require('./signals');

function createApp(authenticated = true) {
  const app = express();
  app.use(express.json());
  if (authenticated) {
    app.use((req, _res, next) => {
      req.auth = () => ({ userId: 'clerk-organiser-1' });
      next();
    });
  }
  app.use('/api', signalsRouter);
  return app;
}

describe('GET /rounds/:id/signals', () => {
  let app;

  beforeEach(() => {
    vi.spyOn(prisma.user, 'findUnique');
    vi.spyOn(prisma.round, 'findUnique');
    vi.spyOn(prisma.sitting, 'findMany');
    vi.spyOn(prisma.submission, 'findMany');
    vi.spyOn(prisma.paper, 'findUnique');
    vi.spyOn(prisma.entrant, 'findMany');
    vi.spyOn(prisma.olympiadOrganiser, 'findUnique');
    vi.spyOn(prisma.olympiad, 'findUnique');
    vi.spyOn(console, 'error').mockImplementation(() => {});

    // Default: the Clerk user maps to an organiser
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-organiser',
      email: 'organiser@olympiad.com',
      role: 'organiser',
      name: 'Organiser One',
    });

    // Default: organiser is a member of the olympiad
    prisma.olympiadOrganiser.findUnique.mockResolvedValue({
      id: 'oo-1',
      olympiadId: 'oly-1',
      organiserId: 'user-organiser',
    });

    // Default: olympiad creator fallback (not used when join row exists)
    prisma.olympiad.findUnique.mockResolvedValue(null);

    app = createApp();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    const unauthApp = createApp(false);
    const res = await request(unauthApp).get('/api/rounds/round-1/signals');
    expect(res.status).toBe(401);
  });

  it('returns 403 when user is not an organiser', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-educator',
      email: 'teacher@school.com',
      role: 'educator',
      name: 'Teacher One',
    });

    const res = await request(app).get('/api/rounds/round-1/signals');
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('organiser access required');
  });

  it('returns 404 when the round does not exist', async () => {
    prisma.round.findUnique.mockResolvedValue(null);

    const res = await request(app).get('/api/rounds/missing-round/signals');
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });

  it('returns 403 when the organiser is not a member of the olympiad', async () => {
    prisma.round.findUnique.mockResolvedValue({
      id: 'round-1',
      olympiadId: 'oly-1',
      openTime: new Date('2026-01-01T00:00:00.000Z'),
      closeTime: new Date('2026-01-02T00:00:00.000Z'),
    });

    // Organiser is not a member of this olympiad
    prisma.olympiadOrganiser.findUnique.mockResolvedValue(null);

    const res = await request(app).get('/api/rounds/round-1/signals');
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/not authorised/i);
  });

  it('returns signals for a valid round', async () => {
    prisma.round.findUnique.mockResolvedValue({
      id: 'round-1',
      olympiadId: 'oly-1',
      openTime: new Date('2026-01-01T00:00:00.000Z'),
      closeTime: new Date('2026-01-02T00:00:00.000Z'),
    });

    prisma.sitting.findMany.mockResolvedValue([
      {
        entrantId: 'entrant-1',
        startedAt: new Date('2026-01-01T10:00:00.000Z'),
        completedAt: new Date('2026-01-01T11:00:00.000Z'),
      },
    ]);

    prisma.submission.findMany.mockResolvedValue([
      {
        entrantId: 'entrant-1',
        answers: { q1: 'A', q2: 'B' },
        submittedAt: new Date('2026-01-01T11:00:00.000Z'),
      },
    ]);

    prisma.paper.findUnique.mockResolvedValue({
      memoAnswers: { q1: 'A', q2: 'B' },
    });

    prisma.entrant.findMany.mockResolvedValue([
      { id: 'entrant-1', name: 'Alice Smith', grade: '10' },
    ]);

    const res = await request(app).get('/api/rounds/round-1/signals');

    expect(res.status).toBe(200);
    expect(res.body.round).toEqual({ id: 'round-1' });
    expect(res.body.flags).toBeDefined();
    expect(Array.isArray(res.body.flags)).toBe(true);
  });

  it('returns empty flags when no sittings exist', async () => {
    prisma.round.findUnique.mockResolvedValue({
      id: 'round-1',
      olympiadId: 'oly-1',
      openTime: new Date('2026-01-01T00:00:00.000Z'),
      closeTime: new Date('2026-01-02T00:00:00.000Z'),
    });

    prisma.sitting.findMany.mockResolvedValue([]);
    prisma.submission.findMany.mockResolvedValue([]);
    prisma.paper.findUnique.mockResolvedValue(null);
    prisma.entrant.findMany.mockResolvedValue([]);

    const res = await request(app).get('/api/rounds/round-1/signals');

    expect(res.status).toBe(200);
    expect(res.body.flags).toEqual([]);
  });

  it('returns 500 on unexpected error', async () => {
    prisma.round.findUnique.mockRejectedValue(new Error('DB error'));

    const res = await request(app).get('/api/rounds/round-1/signals');
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/could not compute/i);
  });
});
