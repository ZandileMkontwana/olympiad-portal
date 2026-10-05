import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
const prisma = require('../lib/prisma');
const roundsRouter = require('./rounds');
const olympiadOrganisersRouter = require('./olympiadOrganisers');
const { toUTCDate } = require('../lib/timezone');

/**
 * Acceptance criteria verification for Sprint 3 user stories:
 *
 * #171 – Multi-olympiad support
 * #176 – Timezone-aware scheduling
 * #181 – Audit log
 * #186 – Round replay
 * #242 – Co-organiser access
 */

function createRoundsApp(role = 'organiser', userId = 'user-1') {
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

function createOrganisersApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.auth = () => ({ userId: 'clerk-user-1' });
    next();
  });
  app.use('/api', olympiadOrganisersRouter);
  return app;
}

// ─── #171: Multi-olympiad support ───────────────────────────────────────────
describe('#171 – Multi-olympiad support', () => {
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
    vi.spyOn(prisma.olympiadOrganiser, 'findMany');
    vi.spyOn(prisma.olympiad, 'findUnique');
    vi.spyOn(prisma.olympiad, 'findMany');
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('AC1: organiser only sees olympiads they created or co-organise', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'org-1',
      role: 'organiser',
      email: 'org@test.com',
      name: 'Organiser',
    });
    prisma.olympiadOrganiser.findMany.mockResolvedValue([{ olympiadId: 'oly-a' }]);
    prisma.olympiad.findMany.mockResolvedValue([
      { id: 'oly-a', name: 'Olympiad A', organiserId: 'org-1' },
    ]);

    app = createRoundsApp('organiser', 'org-1');
    const res = await request(app).get('/api/olympiads');

    expect(res.status).toBe(200);
    const ids = res.body.map((o) => o.id);
    expect(ids).not.toContain('oly-b');
  });

  it('AC2: organiser cannot access rounds of non-member olympiad', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'org-1',
      role: 'organiser',
      email: 'org@test.com',
      name: 'Organiser',
    });
    prisma.round.findUnique.mockResolvedValue({
      id: 'round-x',
      name: 'Round X',
      olympiadId: 'oly-x',
      state: 'open',
    });
    prisma.olympiadOrganiser.findUnique.mockResolvedValue(null);

    app = createRoundsApp('organiser', 'org-1');
    const res = await request(app).get('/api/rounds/round-x/entrants');

    expect(res.status).toBe(403);
  });

  it('AC3: educator school with access to olympiad A cannot see olympiad B data', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'edu-user-1',
      role: 'educator',
      email: 'edu@test.com',
      name: 'Educator',
    });
    prisma.round.findUnique.mockResolvedValue({
      id: 'round-b',
      name: 'Round B',
      olympiadId: 'olympiad-b',
      state: 'open',
    });
    prisma.educator.findUnique.mockResolvedValue({
      id: 'edu-1',
      schoolId: 'school-1',
      userId: 'edu-user-1',
    });
    prisma.schoolOlympiad.findUnique.mockResolvedValue(null);

    app = createRoundsApp('educator', 'edu-user-1');
    const res = await request(app).get('/api/rounds/round-b/submissions');

    expect(res.status).toBe(403);
  });

  it('AC4: educator with approved access can see their olympiad data', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'edu-user-1',
      role: 'educator',
      email: 'edu@test.com',
      name: 'Educator',
    });
    prisma.round.findUnique.mockResolvedValue({
      id: 'round-a',
      name: 'Round A',
      olympiadId: 'olympiad-a',
      state: 'open',
    });
    prisma.educator.findUnique.mockResolvedValue({
      id: 'edu-1',
      schoolId: 'school-1',
      userId: 'edu-user-1',
    });
    prisma.schoolOlympiad.findUnique.mockResolvedValue({
      id: 'so-1',
      schoolId: 'school-1',
      olympiadId: 'olympiad-a',
      status: 'approved',
    });
    prisma.roundEntrant.findMany.mockResolvedValue([]);

    app = createRoundsApp('educator', 'edu-user-1');
    const res = await request(app).get('/api/rounds/round-a/entrants');

    expect(res.status).toBe(200);
  });
});

// ─── #176: Timezone-aware scheduling ────────────────────────────────────────
describe('#176 – Timezone-aware scheduling', () => {
  let app;

  beforeEach(() => {
    vi.spyOn(prisma.olympiad, 'findUnique');
    vi.spyOn(prisma.round, 'create');
    vi.spyOn(prisma.user, 'findUnique');
    vi.spyOn(prisma.olympiadOrganiser, 'findUnique');
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('AC1: converts local openTime/closeTime to UTC using olympiad timezone', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'org-1',
      role: 'organiser',
      email: 'org@test.com',
      name: 'Organiser',
    });
    prisma.olympiad.findUnique.mockResolvedValue({
      id: 'oly-1',
      timezone: 'Africa/Johannesburg',
    });
    prisma.olympiadOrganiser.findUnique.mockResolvedValue({
      id: 'oo-1',
      olympiadId: 'oly-1',
      organiserId: 'org-1',
    });
    prisma.round.create.mockResolvedValue({ id: 'r-1', name: 'Round 1' });

    app = createRoundsApp('organiser', 'org-1');
    const res = await request(app).post('/api/rounds').send({
      olympiadId: 'oly-1',
      name: 'Round 1',
      openTime: '2026-06-15T09:00:00',
      closeTime: '2026-06-15T11:00:00',
    });

    expect(res.status).toBe(201);
    const createCall = prisma.round.create.mock.calls[0][0];
    // 09:00 SAST (UTC+2) = 07:00 UTC
    expect(createCall.data.openTime.getUTCHours()).toBe(7);
    // 11:00 SAST (UTC+2) = 09:00 UTC
    expect(createCall.data.closeTime.getUTCHours()).toBe(9);
  });

  it('AC2: stores times unchanged when olympiad timezone is UTC', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'org-1',
      role: 'organiser',
      email: 'org@test.com',
      name: 'Organiser',
    });
    prisma.olympiad.findUnique.mockResolvedValue({
      id: 'oly-1',
      timezone: 'UTC',
    });
    prisma.olympiadOrganiser.findUnique.mockResolvedValue({
      id: 'oo-1',
      olympiadId: 'oly-1',
      organiserId: 'org-1',
    });
    prisma.round.create.mockResolvedValue({ id: 'r-1', name: 'Round 1' });

    app = createRoundsApp('organiser', 'org-1');
    const res = await request(app).post('/api/rounds').send({
      olympiadId: 'oly-1',
      name: 'Round 1',
      openTime: '2026-06-15T09:00:00',
      closeTime: '2026-06-15T11:00:00',
    });

    expect(res.status).toBe(201);
    const createCall = prisma.round.create.mock.calls[0][0];
    expect(createCall.data.openTime.getUTCHours()).toBe(9);
    expect(createCall.data.closeTime.getUTCHours()).toBe(11);
  });

  it('AC3: toUTCDate handles various IANA timezones correctly', () => {
    // SAST UTC+2
    expect(toUTCDate('2026-06-15T09:00:00', 'Africa/Johannesburg').getUTCHours()).toBe(7);
    // UTC
    expect(toUTCDate('2026-06-15T09:00:00', 'UTC').getUTCHours()).toBe(9);
    // EDT UTC-4
    expect(toUTCDate('2026-06-15T09:00:00', 'America/New_York').getUTCHours()).toBe(13);
    // IST UTC+5:30
    const ist = toUTCDate('2026-06-15T09:00:00', 'Asia/Kolkata');
    expect(ist.getUTCHours()).toBe(3);
    expect(ist.getUTCMinutes()).toBe(30);
  });

  it('AC4: rejects round creation when closeTime is before openTime', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'org-1',
      role: 'organiser',
      email: 'org@test.com',
      name: 'Organiser',
    });
    prisma.olympiad.findUnique.mockResolvedValue({
      id: 'oly-1',
      timezone: 'Africa/Johannesburg',
    });
    prisma.olympiadOrganiser.findUnique.mockResolvedValue({
      id: 'oo-1',
      olympiadId: 'oly-1',
      organiserId: 'org-1',
    });

    app = createRoundsApp('organiser', 'org-1');
    const res = await request(app).post('/api/rounds').send({
      olympiadId: 'oly-1',
      name: 'Round 1',
      openTime: '2026-06-15T11:00:00',
      closeTime: '2026-06-15T09:00:00',
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/after openTime/);
  });

  it('AC5: defaults olympiad timezone to UTC when not provided', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'org-1',
      role: 'organiser',
      email: 'org@test.com',
      name: 'Organiser',
    });
    vi.spyOn(prisma.olympiad, 'create').mockResolvedValue({
      id: 'oly-1',
      name: 'Test Olympiad',
      timezone: 'UTC',
    });
    vi.spyOn(prisma.olympiadOrganiser, 'create').mockResolvedValue({});

    app = createRoundsApp('organiser', 'org-1');
    const res = await request(app).post('/api/olympiads').send({
      name: 'Test Olympiad',
    });

    expect(res.status).toBe(201);
    const createCall = prisma.olympiad.create.mock.calls[0][0];
    expect(createCall.data.timezone).toBe('UTC');
  });
});

// ─── #181: Audit log ────────────────────────────────────────────────────────
describe('#181 – Audit log', () => {
  let app;

  beforeEach(() => {
    vi.spyOn(prisma.round, 'findUnique');
    vi.spyOn(prisma.auditLog, 'findMany');
    vi.spyOn(prisma.user, 'findUnique');
    vi.spyOn(prisma.educator, 'findUnique');
    vi.spyOn(prisma.schoolOlympiad, 'findUnique');
    vi.spyOn(prisma.olympiadOrganiser, 'findUnique');
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('AC1: returns audit entries ordered by timestamp ascending (chronological)', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'org-1',
      role: 'organiser',
      email: 'org@test.com',
      name: 'Organiser',
    });
    prisma.olympiadOrganiser.findUnique.mockResolvedValue({
      id: 'oo-1',
      olympiadId: 'oly-1',
      organiserId: 'org-1',
    });
    prisma.round.findUnique.mockResolvedValue({
      id: 'r1',
      name: 'Round 1',
      olympiadId: 'oly-1',
      olympiad: { id: 'oly-1', name: 'Test Olympiad', timezone: 'UTC' },
    });
    prisma.auditLog.findMany.mockResolvedValue([
      {
        id: 'log-1',
        action: 'round_opened',
        timestamp: new Date('2026-06-15T08:00:00Z'),
        roundId: 'r1',
        payload: {},
      },
      {
        id: 'log-2',
        action: 'round_closed',
        timestamp: new Date('2026-06-15T12:00:00Z'),
        roundId: 'r1',
        payload: {},
      },
      {
        id: 'log-3',
        action: 'notification_sent',
        timestamp: new Date('2026-06-15T13:00:00Z'),
        roundId: 'r1',
        payload: {},
      },
    ]);

    app = createRoundsApp('organiser', 'org-1');
    const res = await request(app).get('/api/rounds/r1/audit-log');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(3);
    expect(res.body[0].action).toBe('round_opened');
    expect(res.body[1].action).toBe('round_closed');
    expect(res.body[2].action).toBe('notification_sent');
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
      where: { roundId: 'r1' },
      orderBy: { timestamp: 'asc' },
    });
  });

  it('AC2: includes all automatic action types (open, close, auto-advance, notification)', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'org-1',
      role: 'organiser',
      email: 'org@test.com',
      name: 'Organiser',
    });
    prisma.olympiadOrganiser.findUnique.mockResolvedValue({
      id: 'oo-1',
      olympiadId: 'oly-1',
      organiserId: 'org-1',
    });
    prisma.round.findUnique.mockResolvedValue({
      id: 'r1',
      name: 'Round 1',
      olympiadId: 'oly-1',
      olympiad: { id: 'oly-1', name: 'Test', timezone: 'UTC' },
    });
    const logs = [
      { id: 'l1', action: 'round_opened', timestamp: new Date(), roundId: 'r1', payload: {} },
      { id: 'l2', action: 'round_closed', timestamp: new Date(), roundId: 'r1', payload: {} },
      {
        id: 'l3',
        action: 'auto_advanced',
        timestamp: new Date(),
        roundId: 'r1',
        payload: { entrantId: 'e1', entrantName: 'Alice', nextRoundId: 'r2' },
      },
      {
        id: 'l4',
        action: 'notification_sent',
        timestamp: new Date(),
        roundId: 'r1',
        payload: { triggerType: 'before_open', recipientEmail: 'edu@test.com' },
      },
    ];
    prisma.auditLog.findMany.mockResolvedValue(logs);

    app = createRoundsApp('organiser', 'org-1');
    const res = await request(app).get('/api/rounds/r1/audit-log');

    expect(res.status).toBe(200);
    const actions = res.body.map((l) => l.action);
    expect(actions).toContain('round_opened');
    expect(actions).toContain('round_closed');
    expect(actions).toContain('auto_advanced');
    expect(actions).toContain('notification_sent');
  });

  it('AC3: blocks organiser who is not a member of the olympiad', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'org-2',
      role: 'organiser',
      email: 'org2@test.com',
      name: 'Organiser 2',
    });
    prisma.olympiadOrganiser.findUnique.mockResolvedValue(null);
    prisma.round.findUnique.mockResolvedValue({
      id: 'r1',
      name: 'Round 1',
      olympiadId: 'oly-1',
      olympiad: { id: 'oly-1', name: 'Test', timezone: 'UTC' },
    });

    app = createRoundsApp('organiser', 'org-2');
    const res = await request(app).get('/api/rounds/r1/audit-log');

    expect(res.status).toBe(403);
  });

  it('AC4: blocks educator whose school lacks olympiad access', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'edu-user',
      role: 'educator',
      email: 'edu@test.com',
      name: 'Educator',
    });
    prisma.round.findUnique.mockResolvedValue({
      id: 'r1',
      name: 'Round 1',
      olympiadId: 'oly-1',
      olympiad: { id: 'oly-1', name: 'Test', timezone: 'UTC' },
    });
    prisma.educator.findUnique.mockResolvedValue({
      id: 'edu-1',
      schoolId: 'school-1',
      userId: 'edu-user',
    });
    prisma.schoolOlympiad.findUnique.mockResolvedValue(null);

    app = createRoundsApp('educator', 'edu-user');
    const res = await request(app).get('/api/rounds/r1/audit-log');

    expect(res.status).toBe(403);
  });

  it('AC5: returns 404 when round does not exist', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'org-1',
      role: 'organiser',
      email: 'org@test.com',
      name: 'Organiser',
    });
    prisma.round.findUnique.mockResolvedValue(null);

    app = createRoundsApp('organiser', 'org-1');
    const res = await request(app).get('/api/rounds/nonexistent/audit-log');

    expect(res.status).toBe(404);
  });
});

// ─── #186: Round replay ─────────────────────────────────────────────────────
describe('#186 – Round replay', () => {
  let app;

  beforeEach(() => {
    vi.spyOn(prisma.round, 'findUnique');
    vi.spyOn(prisma.auditLog, 'findMany');
    vi.spyOn(prisma.user, 'findUnique');
    vi.spyOn(prisma.educator, 'findUnique');
    vi.spyOn(prisma.schoolOlympiad, 'findUnique');
    vi.spyOn(prisma.olympiadOrganiser, 'findUnique');
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('AC1: returns chronological timeline with round metadata', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'org-1',
      role: 'organiser',
      email: 'org@test.com',
      name: 'Organiser',
    });
    prisma.olympiadOrganiser.findUnique.mockResolvedValue({
      id: 'oo-1',
      olympiadId: 'oly-1',
      organiserId: 'org-1',
    });
    prisma.round.findUnique.mockResolvedValue({
      id: 'r1',
      name: 'Round 1',
      state: 'closed',
      openTime: new Date('2026-06-15T08:00:00Z'),
      closeTime: new Date('2026-06-15T12:00:00Z'),
      olympiadId: 'oly-1',
      olympiad: { id: 'oly-1', name: 'Wits Maths Olympiad', timezone: 'UTC' },
    });
    prisma.auditLog.findMany.mockResolvedValue([
      {
        id: 'l1',
        action: 'round_opened',
        timestamp: new Date('2026-06-15T08:00:00Z'),
        roundId: 'r1',
        payload: {},
      },
      {
        id: 'l2',
        action: 'round_closed',
        timestamp: new Date('2026-06-15T12:00:00Z'),
        roundId: 'r1',
        payload: {},
      },
    ]);

    app = createRoundsApp('organiser', 'org-1');
    const res = await request(app).get('/api/rounds/r1/replay');

    expect(res.status).toBe(200);
    expect(res.body.round.name).toBe('Round 1');
    expect(res.body.round.olympiadName).toBe('Wits Maths Olympiad');
    expect(res.body.round.state).toBe('closed');
    expect(res.body.timeline).toHaveLength(2);
    // Ascending order
    expect(res.body.timeline[0].action).toBe('round_opened');
    expect(res.body.timeline[1].action).toBe('round_closed');
  });

  it('AC2: each timeline entry has a human-readable summary', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'org-1',
      role: 'organiser',
      email: 'org@test.com',
      name: 'Organiser',
    });
    prisma.olympiadOrganiser.findUnique.mockResolvedValue({
      id: 'oo-1',
      olympiadId: 'oly-1',
      organiserId: 'org-1',
    });
    prisma.round.findUnique.mockResolvedValue({
      id: 'r1',
      name: 'Round 1',
      state: 'closed',
      openTime: new Date('2026-06-15T08:00:00Z'),
      closeTime: new Date('2026-06-15T12:00:00Z'),
      olympiadId: 'oly-1',
      olympiad: { id: 'oly-1', name: 'Test', timezone: 'UTC' },
    });
    prisma.auditLog.findMany.mockResolvedValue([
      {
        id: 'l1',
        action: 'round_opened',
        timestamp: new Date('2026-06-15T08:00:00Z'),
        roundId: 'r1',
        payload: {},
      },
      {
        id: 'l2',
        action: 'round_closed',
        timestamp: new Date('2026-06-15T12:00:00Z'),
        roundId: 'r1',
        payload: {},
      },
      {
        id: 'l3',
        action: 'auto_advanced',
        timestamp: new Date('2026-06-15T12:30:00Z'),
        roundId: 'r1',
        payload: { entrantName: 'Alice', nextRoundId: 'r2' },
      },
      {
        id: 'l4',
        action: 'notification_sent',
        timestamp: new Date('2026-06-15T07:00:00Z'),
        roundId: 'r1',
        payload: { triggerType: 'before_open', recipientEmail: 'edu@test.com' },
      },
    ]);

    app = createRoundsApp('organiser', 'org-1');
    const res = await request(app).get('/api/rounds/r1/replay');

    expect(res.status).toBe(200);
    const summaries = res.body.timeline.map((e) => e.summary);
    expect(summaries.some((s) => s.includes('Round opened'))).toBe(true);
    expect(summaries.some((s) => s.includes('Round closed'))).toBe(true);
    expect(summaries.some((s) => s.includes('Alice'))).toBe(true);
    expect(summaries.some((s) => s.includes('before_open'))).toBe(true);
  });

  it('AC3: blocks organiser who is not a member of the olympiad', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'org-2',
      role: 'organiser',
      email: 'org2@test.com',
      name: 'Organiser 2',
    });
    prisma.olympiadOrganiser.findUnique.mockResolvedValue(null);
    prisma.round.findUnique.mockResolvedValue({
      id: 'r1',
      name: 'Round 1',
      state: 'closed',
      olympiadId: 'oly-1',
      olympiad: { id: 'oly-1', name: 'Test', timezone: 'UTC' },
    });

    app = createRoundsApp('organiser', 'org-2');
    const res = await request(app).get('/api/rounds/r1/replay');

    expect(res.status).toBe(403);
  });

  it('AC4: blocks educator whose school lacks olympiad access', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'edu-user',
      role: 'educator',
      email: 'edu@test.com',
      name: 'Educator',
    });
    prisma.round.findUnique.mockResolvedValue({
      id: 'r1',
      name: 'Round 1',
      state: 'closed',
      olympiadId: 'oly-1',
      olympiad: { id: 'oly-1', name: 'Test', timezone: 'UTC' },
    });
    prisma.educator.findUnique.mockResolvedValue({
      id: 'edu-1',
      schoolId: 'school-1',
      userId: 'edu-user',
    });
    prisma.schoolOlympiad.findUnique.mockResolvedValue(null);

    app = createRoundsApp('educator', 'edu-user');
    const res = await request(app).get('/api/rounds/r1/replay');

    expect(res.status).toBe(403);
  });

  it('AC5: returns 404 when round does not exist', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'org-1',
      role: 'organiser',
      email: 'org@test.com',
      name: 'Organiser',
    });
    prisma.round.findUnique.mockResolvedValue(null);

    app = createRoundsApp('organiser', 'org-1');
    const res = await request(app).get('/api/rounds/nonexistent/replay');

    expect(res.status).toBe(404);
  });

  it('AC6: returns empty state with message when no automatic actions exist', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'org-1',
      role: 'organiser',
      email: 'org@test.com',
      name: 'Organiser',
    });
    prisma.olympiadOrganiser.findUnique.mockResolvedValue({
      id: 'oo-1',
      olympiadId: 'oly-1',
      organiserId: 'org-1',
    });
    prisma.round.findUnique.mockResolvedValue({
      id: 'r1',
      name: 'Round 1',
      state: 'scheduled',
      olympiadId: 'oly-1',
      openTime: new Date('2026-06-15T08:00:00Z'),
      closeTime: new Date('2026-06-15T12:00:00Z'),
      olympiad: { id: 'oly-1', name: 'Test', timezone: 'UTC' },
    });
    prisma.auditLog.findMany.mockResolvedValue([]);

    app = createRoundsApp('organiser', 'org-1');
    const res = await request(app).get('/api/rounds/r1/replay');

    expect(res.status).toBe(200);
    expect(res.body.timeline).toEqual([]);
    expect(res.body.isEmpty).toBe(true);
    expect(res.body.message).toMatch(/no automatic actions/i);
  });
});

// ─── #242: Co-organiser access ──────────────────────────────────────────────
describe('#242 – Co-organiser access', () => {
  let roundsApp;
  let organisersApp;

  beforeEach(() => {
    vi.spyOn(prisma.round, 'findUnique');
    vi.spyOn(prisma.round, 'findMany');
    vi.spyOn(prisma.roundEntrant, 'findMany');
    vi.spyOn(prisma.olympiad, 'findUnique');
    vi.spyOn(prisma.olympiadOrganiser, 'findUnique');
    vi.spyOn(prisma.olympiadOrganiser, 'findMany');
    vi.spyOn(prisma.olympiadOrganiser, 'create');
    vi.spyOn(prisma.olympiadOrganiser, 'delete');
    vi.spyOn(prisma.olympiadOrganiser, 'deleteMany');
    vi.spyOn(prisma.olympiad, 'delete');
    vi.spyOn(prisma.user, 'findUnique');
    vi.spyOn(prisma.user, 'findMany');
    vi.spyOn(prisma.auditLog, 'findMany');
    vi.spyOn(prisma.educator, 'findUnique');
    vi.spyOn(prisma.schoolOlympiad, 'findUnique');
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('AC1: co-organiser can create rounds for their olympiad', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'co-org-1',
      role: 'organiser',
      email: 'coorg@test.com',
      name: 'Co-organiser',
    });
    // Co-organiser IS a member of olympiad A
    prisma.olympiadOrganiser.findUnique.mockResolvedValue({
      id: 'oo-2',
      olympiadId: 'oly-a',
      organiserId: 'co-org-1',
    });
    prisma.olympiad.findUnique.mockResolvedValue({
      id: 'oly-a',
      timezone: 'UTC',
      organiserId: 'org-1',
    });
    vi.spyOn(prisma.round, 'create').mockResolvedValue({ id: 'r-1', name: 'Round 1' });

    roundsApp = createRoundsApp('organiser', 'co-org-1');
    const res = await request(roundsApp).post('/api/rounds').send({
      olympiadId: 'oly-a',
      name: 'Round 1',
      openTime: '2026-06-15T09:00:00Z',
      closeTime: '2026-06-15T11:00:00Z',
    });

    expect(res.status).toBe(201);
  });

  it('AC2: co-organiser can view audit log for their olympiad', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'co-org-1',
      role: 'organiser',
      email: 'coorg@test.com',
      name: 'Co-organiser',
    });
    prisma.olympiadOrganiser.findUnique.mockResolvedValue({
      id: 'oo-2',
      olympiadId: 'oly-a',
      organiserId: 'co-org-1',
    });
    prisma.round.findUnique.mockResolvedValue({
      id: 'r1',
      name: 'Round 1',
      olympiadId: 'oly-a',
      olympiad: { id: 'oly-a', name: 'Test', timezone: 'UTC' },
    });
    prisma.auditLog.findMany.mockResolvedValue([
      { id: 'l1', action: 'round_opened', timestamp: new Date(), roundId: 'r1', payload: {} },
    ]);

    roundsApp = createRoundsApp('organiser', 'co-org-1');
    const res = await request(roundsApp).get('/api/rounds/r1/audit-log');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  it('AC3: co-organiser can view replay for their olympiad', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'co-org-1',
      role: 'organiser',
      email: 'coorg@test.com',
      name: 'Co-organiser',
    });
    prisma.olympiadOrganiser.findUnique.mockResolvedValue({
      id: 'oo-2',
      olympiadId: 'oly-a',
      organiserId: 'co-org-1',
    });
    prisma.round.findUnique.mockResolvedValue({
      id: 'r1',
      name: 'Round 1',
      state: 'closed',
      olympiadId: 'oly-a',
      openTime: new Date('2026-06-15T08:00:00Z'),
      closeTime: new Date('2026-06-15T12:00:00Z'),
      olympiad: { id: 'oly-a', name: 'Test', timezone: 'UTC' },
    });
    prisma.auditLog.findMany.mockResolvedValue([]);

    roundsApp = createRoundsApp('organiser', 'co-org-1');
    const res = await request(roundsApp).get('/api/rounds/r1/replay');

    expect(res.status).toBe(200);
    expect(res.body.timeline).toBeDefined();
  });

  it('AC4: removed co-organiser loses access to rounds', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'co-org-1',
      role: 'organiser',
      email: 'coorg@test.com',
      name: 'Co-organiser',
    });
    // No longer a member
    prisma.olympiadOrganiser.findUnique.mockResolvedValue(null);
    prisma.round.findUnique.mockResolvedValue({
      id: 'r1',
      name: 'Round 1',
      olympiadId: 'oly-a',
      state: 'open',
    });

    roundsApp = createRoundsApp('organiser', 'co-org-1');
    const res = await request(roundsApp).get('/api/rounds/r1/entrants');

    expect(res.status).toBe(403);
  });

  it('AC5: creator can add and remove co-organisers', async () => {
    // --- Add ---
    prisma.user.findUnique
      .mockResolvedValueOnce({
        id: 'org-1',
        role: 'organiser',
        email: 'org@test.com',
        name: 'Creator',
      })
      .mockResolvedValueOnce({
        id: 'co-org-2',
        role: 'organiser',
        email: 'coorg2@test.com',
        name: 'New Co-org',
      });
    prisma.olympiadOrganiser.findUnique
      .mockResolvedValueOnce({
        id: 'oo-1',
        olympiadId: 'oly-a',
        organiserId: 'org-1',
      })
      .mockResolvedValueOnce(null);
    prisma.olympiad.findUnique.mockResolvedValue({ id: 'oly-a', organiserId: 'org-1' });
    prisma.olympiadOrganiser.create.mockResolvedValue({
      id: 'oo-new',
      olympiadId: 'oly-a',
      organiserId: 'co-org-2',
      addedAt: new Date(),
    });

    organisersApp = createOrganisersApp();
    const addRes = await request(organisersApp)
      .post('/api/olympiads/oly-a/organisers')
      .send({ organiserId: 'co-org-2' });

    expect(addRes.status).toBe(201);
    expect(addRes.body.organiserId).toBe('co-org-2');

    // --- Remove ---
    prisma.user.findUnique.mockResolvedValue({
      id: 'org-1',
      role: 'organiser',
      email: 'org@test.com',
      name: 'Creator',
    });
    prisma.olympiad.findUnique.mockResolvedValue({ id: 'oly-a', organiserId: 'org-1' });
    prisma.olympiadOrganiser.findUnique.mockResolvedValue({
      id: 'oo-new',
      olympiadId: 'oly-a',
      organiserId: 'co-org-2',
    });
    prisma.olympiadOrganiser.delete.mockResolvedValue({});

    const removeRes = await request(organisersApp).delete(
      '/api/olympiads/oly-a/organisers/co-org-2'
    );
    expect(removeRes.status).toBe(204);
  });

  it('AC6: creator cannot be removed from olympiad', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'org-1',
      role: 'organiser',
      email: 'org@test.com',
      name: 'Creator',
    });
    prisma.olympiad.findUnique.mockResolvedValue({ organiserId: 'org-1' });

    organisersApp = createOrganisersApp();
    const res = await request(organisersApp).delete('/api/olympiads/oly-a/organisers/org-1');

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/creator/);
  });

  it('AC7: non-organiser cannot add co-organisers', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'edu-1',
      role: 'educator',
      email: 'edu@test.com',
      name: 'Educator',
    });

    organisersApp = createOrganisersApp();
    const res = await request(organisersApp)
      .post('/api/olympiads/oly-a/organisers')
      .send({ organiserId: 'co-org-2' });

    expect(res.status).toBe(403);
  });

  it('AC8: non-creator co-organiser cannot remove another co-organiser', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'co-org-1',
      role: 'organiser',
      email: 'coorg@test.com',
      name: 'Co-organiser',
    });
    prisma.olympiad.findUnique.mockResolvedValue({ id: 'oly-a', organiserId: 'org-1' });

    organisersApp = createOrganisersApp();
    const res = await request(organisersApp).delete('/api/olympiads/oly-a/organisers/co-org-2');

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/creator/i);
  });

  it('AC9: only creator can delete an olympiad', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'org-1',
      role: 'organiser',
      email: 'org@test.com',
      name: 'Creator',
    });
    prisma.olympiad.findUnique.mockResolvedValue({ organiserId: 'org-1' });
    prisma.olympiadOrganiser.deleteMany.mockResolvedValue({ count: 2 });
    prisma.olympiad.delete.mockResolvedValue({});

    roundsApp = createRoundsApp('organiser', 'org-1');
    const res = await request(roundsApp).delete('/api/olympiads/oly-a');

    expect(res.status).toBe(204);
  });

  it('AC10: non-creator cannot delete an olympiad', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'co-org-1',
      role: 'organiser',
      email: 'coorg@test.com',
      name: 'Co-organiser',
    });
    prisma.olympiad.findUnique.mockResolvedValue({ organiserId: 'org-1' });

    roundsApp = createRoundsApp('organiser', 'co-org-1');
    const res = await request(roundsApp).delete('/api/olympiads/oly-a');

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/creator/i);
  });
});
