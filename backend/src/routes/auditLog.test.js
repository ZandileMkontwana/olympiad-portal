import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
const prisma = require('../lib/prisma');
const roundsRouter = require('./rounds');

function createApp(authenticated = true, role = 'organiser') {
  const app = express();
  app.use(express.json());
  if (authenticated) {
    app.use((req, _res, next) => {
      req.auth = () => ({ userId: 'clerk-user-1' });
      req.user = { id: 'user-1', role, email: 'test@test.com' };
      next();
    });
  }
  app.use('/api', roundsRouter);
  return app;
}

describe('GET /rounds/:id/audit-log', () => {
  let app;

  beforeEach(() => {
    vi.spyOn(prisma.round, 'findUnique');
    vi.spyOn(prisma.auditLog, 'findMany');
    vi.spyOn(prisma.user, 'findUnique');
    vi.spyOn(prisma.educator, 'findUnique');
    vi.spyOn(prisma.schoolOlympiad, 'findUnique');
    // Default: loadAuthUser returns an organiser
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'test@test.com',
      role: 'organiser',
      name: 'Organiser',
    });
    app = createApp(true, 'organiser');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 404 when round does not exist', async () => {
    prisma.round.findUnique.mockResolvedValue(null);

    const res = await request(app).get('/api/rounds/nonexistent/audit-log');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Round not found');
  });

  it('returns audit log entries for a round ordered by timestamp desc', async () => {
    const mockRound = { id: 'r1', name: 'Round 1', olympiadId: 'oly-1', olympiad: { id: 'oly-1', name: 'Test Olympiad', timezone: 'UTC' } };
    const mockLogs = [
      { id: 'log-2', action: 'round_closed', timestamp: new Date('2026-06-15T12:00:00Z'), roundId: 'r1', payload: {} },
      { id: 'log-1', action: 'round_opened', timestamp: new Date('2026-06-15T08:00:00Z'), roundId: 'r1', payload: {} },
    ];

    prisma.round.findUnique.mockResolvedValue(mockRound);
    prisma.auditLog.findMany.mockResolvedValue(mockLogs);

    const res = await request(app).get('/api/rounds/r1/audit-log');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].action).toBe('round_closed');
    expect(res.body[1].action).toBe('round_opened');
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
      where: { roundId: 'r1' },
      orderBy: { timestamp: 'desc' },
    });
  });

  it('blocks educators without olympiad access', async () => {
    app = createApp(true, 'educator');
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'test@test.com',
      role: 'educator',
      name: 'Educator',
    });
    const mockRound = { id: 'r1', name: 'Round 1', olympiadId: 'oly-1', olympiad: { id: 'oly-1', name: 'Test Olympiad', timezone: 'UTC' } };

    prisma.round.findUnique.mockResolvedValue(mockRound);
    prisma.educator.findUnique.mockResolvedValue({ id: 'edu-1', schoolId: 'school-1', userId: 'user-1' });
    prisma.schoolOlympiad.findUnique.mockResolvedValue(null);

    const res = await request(app).get('/api/rounds/r1/audit-log');

    expect(res.status).toBe(403);
  });
});

describe('GET /rounds/:id/replay', () => {
  let app;

  beforeEach(() => {
    vi.spyOn(prisma.round, 'findUnique');
    vi.spyOn(prisma.auditLog, 'findMany');
    vi.spyOn(prisma.user, 'findUnique');
    vi.spyOn(prisma.educator, 'findUnique');
    vi.spyOn(prisma.schoolOlympiad, 'findUnique');
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'test@test.com',
      role: 'organiser',
      name: 'Organiser',
    });
    app = createApp(true, 'organiser');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 404 when round does not exist', async () => {
    prisma.round.findUnique.mockResolvedValue(null);

    const res = await request(app).get('/api/rounds/nonexistent/replay');

    expect(res.status).toBe(404);
  });

  it('returns a structured timeline with summaries', async () => {
    const mockRound = {
      id: 'r1',
      name: 'Round 1',
      state: 'closed',
      openTime: new Date('2026-06-15T08:00:00Z'),
      closeTime: new Date('2026-06-15T12:00:00Z'),
      olympiadId: 'oly-1',
      olympiad: { id: 'oly-1', name: 'Test Olympiad', timezone: 'UTC' },
    };
    const mockLogs = [
      { id: 'log-1', action: 'round_opened', timestamp: new Date('2026-06-15T08:00:00Z'), roundId: 'r1', payload: { openedAt: '2026-06-15T08:00:00.000Z' } },
      { id: 'log-3', action: 'round_closed', timestamp: new Date('2026-06-15T12:00:00Z'), roundId: 'r1', payload: { closedAt: '2026-06-15T12:00:00.000Z' } },
      { id: 'log-2', action: 'auto_advanced', timestamp: new Date('2026-06-15T12:30:00Z'), roundId: 'r1', payload: { entrantId: 'e1', entrantName: 'Alice', nextRoundId: 'r2', score: 85 } },
    ];

    prisma.round.findUnique.mockResolvedValue(mockRound);
    prisma.auditLog.findMany.mockResolvedValue(mockLogs);

    const res = await request(app).get('/api/rounds/r1/replay');

    expect(res.status).toBe(200);
    expect(res.body.round.name).toBe('Round 1');
    expect(res.body.round.olympiadName).toBe('Test Olympiad');
    expect(res.body.timeline).toHaveLength(3);
    // Timeline is in ascending order
    expect(res.body.timeline[0].action).toBe('round_opened');
    expect(res.body.timeline[1].action).toBe('round_closed');
    expect(res.body.timeline[2].action).toBe('auto_advanced');
    // Each entry has a human-readable summary
    expect(res.body.timeline[0].summary).toContain('Round opened');
    expect(res.body.timeline[2].summary).toContain('Alice');
  });

  it('blocks educators without olympiad access', async () => {
    app = createApp(true, 'educator');
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'test@test.com',
      role: 'educator',
      name: 'Educator',
    });
    const mockRound = { id: 'r1', name: 'Round 1', olympiadId: 'oly-1', olympiad: { id: 'oly-1', name: 'Test Olympiad', timezone: 'UTC' } };

    prisma.round.findUnique.mockResolvedValue(mockRound);
    prisma.educator.findUnique.mockResolvedValue({ id: 'edu-1', schoolId: 'school-1', userId: 'user-1' });
    prisma.schoolOlympiad.findUnique.mockResolvedValue(null);

    const res = await request(app).get('/api/rounds/r1/replay');

    expect(res.status).toBe(403);
  });
});
