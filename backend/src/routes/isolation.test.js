import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
const prisma = require('../lib/prisma');
const roundsRouter = require('./rounds');

/**
 * Isolation tests: verify that two olympiads (A and B) are properly
 * isolated. An educator whose school has access to olympiad A must
 * NOT be able to see data from olympiad B's rounds.
 *
 * Also verifies that organisers must be members of the specific olympiad
 * they're trying to access (no cross-olympiad access for organisers).
 */

function createApp(role = 'educator', userId = 'user-1') {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.auth = () => ({ userId: 'clerk-user-1' });
    req.user = { id: userId, role, email: `${role}@test.com` };
    next();
  });
  app.use('/api', roundsRouter);
  return app;
}

describe('Olympiad isolation', () => {
  let app;

  beforeEach(() => {
    vi.spyOn(prisma.round, 'findUnique');
    vi.spyOn(prisma.round, 'findMany');
    vi.spyOn(prisma.roundEntrant, 'findMany');
    vi.spyOn(prisma.submission, 'findMany');
    vi.spyOn(prisma.user, 'findUnique');
    vi.spyOn(prisma.educator, 'findUnique');
    vi.spyOn(prisma.schoolOlympiad, 'findUnique');
    vi.spyOn(prisma.olympiadOrganiser, 'findUnique');
    // Default: loadAuthUser returns an educator
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'educator@test.com',
      role: 'educator',
      name: 'Educator',
    });
    app = createApp('educator');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('blocks educator from seeing round B entrants when school only has access to olympiad A', async () => {
    // Round belongs to olympiad B
    prisma.round.findUnique.mockResolvedValue({
      id: 'round-b',
      name: 'Round B',
      olympiadId: 'olympiad-b',
      state: 'open',
    });
    // Educator's school
    prisma.educator.findUnique.mockResolvedValue({
      id: 'edu-1',
      schoolId: 'school-1',
      userId: 'user-1',
    });
    // School does NOT have access to olympiad B
    prisma.schoolOlympiad.findUnique.mockResolvedValue(null);

    const res = await request(app).get('/api/rounds/round-b/entrants');

    expect(res.status).toBe(403);
    expect(res.body.error).toContain("doesn't have access");
  });

  it('blocks educator from seeing round B submissions when school only has access to olympiad A', async () => {
    prisma.round.findUnique.mockResolvedValue({
      id: 'round-b',
      name: 'Round B',
      olympiadId: 'olympiad-b',
      state: 'open',
    });
    prisma.educator.findUnique.mockResolvedValue({
      id: 'edu-1',
      schoolId: 'school-1',
      userId: 'user-1',
    });
    prisma.schoolOlympiad.findUnique.mockResolvedValue(null);

    const res = await request(app).get('/api/rounds/round-b/submissions');

    expect(res.status).toBe(403);
  });

  it('blocks educator from seeing round B standings when school only has access to olympiad A', async () => {
    prisma.round.findUnique.mockResolvedValue({
      id: 'round-b',
      name: 'Round B',
      olympiadId: 'olympiad-b',
      state: 'closed',
    });
    prisma.educator.findUnique.mockResolvedValue({
      id: 'edu-1',
      schoolId: 'school-1',
      userId: 'user-1',
    });
    prisma.schoolOlympiad.findUnique.mockResolvedValue(null);

    const res = await request(app).get('/api/rounds/round-b/standings');

    expect(res.status).toBe(403);
  });

  it('allows educator to see round A entrants when school has approved access to olympiad A', async () => {
    prisma.round.findUnique.mockResolvedValue({
      id: 'round-a',
      name: 'Round A',
      olympiadId: 'olympiad-a',
      state: 'open',
    });
    prisma.educator.findUnique.mockResolvedValue({
      id: 'edu-1',
      schoolId: 'school-1',
      userId: 'user-1',
    });
    // School HAS approved access to olympiad A
    prisma.schoolOlympiad.findUnique.mockResolvedValue({
      id: 'so-1',
      schoolId: 'school-1',
      olympiadId: 'olympiad-a',
      status: 'approved',
    });
    prisma.roundEntrant.findMany.mockResolvedValue([]);

    const res = await request(app).get('/api/rounds/round-a/entrants');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('blocks organiser from seeing round B entrants when not a member of olympiad B', async () => {
    app = createApp('organiser', 'organiser-1');
    prisma.user.findUnique.mockResolvedValue({
      id: 'organiser-1',
      email: 'organiser@test.com',
      role: 'organiser',
      name: 'Organiser',
    });
    prisma.round.findUnique.mockResolvedValue({
      id: 'round-b',
      name: 'Round B',
      olympiadId: 'olympiad-b',
      state: 'open',
    });
    // Organiser is NOT a member of olympiad B
    prisma.olympiadOrganiser.findUnique.mockResolvedValue(null);

    const res = await request(app).get('/api/rounds/round-b/entrants');

    expect(res.status).toBe(403);
    expect(res.body.error).toContain('not an organiser of this olympiad');
  });

  it('allows organiser to see round B entrants when they are a member of olympiad B', async () => {
    app = createApp('organiser', 'organiser-1');
    prisma.user.findUnique.mockResolvedValue({
      id: 'organiser-1',
      email: 'organiser@test.com',
      role: 'organiser',
      name: 'Organiser',
    });
    prisma.round.findUnique.mockResolvedValue({
      id: 'round-b',
      name: 'Round B',
      olympiadId: 'olympiad-b',
      state: 'open',
    });
    // Organiser IS a member of olympiad B
    prisma.olympiadOrganiser.findUnique.mockResolvedValue({
      id: 'oo-1',
      olympiadId: 'olympiad-b',
      organiserId: 'organiser-1',
    });
    prisma.roundEntrant.findMany.mockResolvedValue([]);

    const res = await request(app).get('/api/rounds/round-b/entrants');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('blocks organiser from accessing audit log of non-member olympiad', async () => {
    app = createApp('organiser', 'organiser-1');
    prisma.user.findUnique.mockResolvedValue({
      id: 'organiser-1',
      email: 'organiser@test.com',
      role: 'organiser',
      name: 'Organiser',
    });
    prisma.round.findUnique.mockResolvedValue({
      id: 'round-a',
      name: 'Round A',
      olympiadId: 'olympiad-a',
      state: 'closed',
      olympiad: { id: 'olympiad-a', name: 'Olympiad A' },
    });
    // Organiser is NOT a member of olympiad A
    prisma.olympiadOrganiser.findUnique.mockResolvedValue(null);

    const res = await request(app).get('/api/rounds/round-a/audit-log');

    expect(res.status).toBe(403);
  });

  it('blocks organiser from accessing replay of non-member olympiad', async () => {
    app = createApp('organiser', 'organiser-1');
    prisma.user.findUnique.mockResolvedValue({
      id: 'organiser-1',
      email: 'organiser@test.com',
      role: 'organiser',
      name: 'Organiser',
    });
    prisma.round.findUnique.mockResolvedValue({
      id: 'round-a',
      name: 'Round A',
      olympiadId: 'olympiad-a',
      state: 'closed',
      olympiad: { id: 'olympiad-a', name: 'Olympiad A' },
    });
    // Organiser is NOT a member of olympiad A
    prisma.olympiadOrganiser.findUnique.mockResolvedValue(null);

    const res = await request(app).get('/api/rounds/round-a/replay');

    expect(res.status).toBe(403);
  });
});
