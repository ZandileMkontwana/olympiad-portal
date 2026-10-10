import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
const prisma = require('../lib/prisma');
const markingRouter = require('./marking');

// Simulate Clerk's clerkMiddleware() having run: req.auth() returns the
// signed-in Clerk user. requireRole() (middleware/auth.js) then loads the
// matching database record to check the role and set req.user.
function createApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.auth = () => ({ userId: 'clerk-user-1' });
    next();
  });
  app.use('/api', markingRouter);
  return app;
}

describe('Marking routes', () => {
  let app;

  beforeEach(() => {
    vi.spyOn(prisma.markingTask, 'findMany');
    vi.spyOn(prisma.markingTask, 'findUnique');
    vi.spyOn(prisma.markingTask, 'update');
    vi.spyOn(prisma.user, 'findUnique');
    vi.spyOn(prisma.olympiadOrganiser, 'findUnique');
    vi.spyOn(prisma.olympiadOrganiser, 'findMany');
    vi.spyOn(prisma.round, 'findUnique');
    vi.spyOn(prisma.sitting, 'findMany');
    vi.spyOn(prisma.submission, 'findMany');
    vi.spyOn(prisma.paper, 'findUnique');
    vi.spyOn(console, 'error').mockImplementation(() => {});

    // Default: the Clerk user maps to an organiser
    prisma.user.findUnique.mockResolvedValue({
      id: 'organiser-1',
      email: 'marker@school.com',
      role: 'organiser',
      name: 'Marker One',
    });

    // Default: organiser is a member of olympiad 'oly-1'
    prisma.olympiadOrganiser.findUnique.mockResolvedValue({
      id: 'oo-1',
      olympiadId: 'oly-1',
      organiserId: 'organiser-1',
    });
    prisma.olympiadOrganiser.findMany.mockResolvedValue([{ olympiadId: 'oly-1' }]);

    app = createApp();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /api/marking/queue', () => {
    it('defaults to unassigned tasks only', async () => {
      prisma.markingTask.findMany.mockResolvedValue([]);
      const res = await request(app).get('/api/marking/queue');
      expect(res.status).toBe(200);
      expect(prisma.markingTask.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'unassigned' }),
        })
      );
    });

    it('returns all tasks when status=all is passed', async () => {
      prisma.markingTask.findMany.mockResolvedValue([]);
      const res = await request(app).get('/api/marking/queue?status=all');
      expect(res.status).toBe(200);
      expect(prisma.markingTask.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({}),
        })
      );
    });

    it('returns 500 on prisma error', async () => {
      prisma.markingTask.findMany.mockRejectedValue(new Error('DB error'));
      const res = await request(app).get('/api/marking/queue');
      expect(res.status).toBe(500);
    });

    it('attaches signal badges from the round to each task', async () => {
      const now = new Date('2026-06-01T10:00:00Z');
      prisma.markingTask.findMany.mockResolvedValue([
        {
          id: 'task-1',
          status: 'unassigned',
          submissionId: 'sub-1',
          submission: {
            id: 'sub-1',
            entrantId: 'entrant-fast',
            roundId: 'round-1',
            entrant: { id: 'entrant-fast', name: 'Speedy' },
            round: { id: 'round-1', openTime: now, closeTime: now },
          },
          assignedTo: null,
          moderatedBy: null,
        },
      ]);

      // Round time window: 60 minutes
      prisma.round.findUnique.mockResolvedValue({
        openTime: new Date('2026-06-01T09:00:00Z'),
        closeTime: new Date('2026-06-01T10:00:00Z'),
      });

      // 8 sittings: one extreme outlier (2 min) among a tight cohort (~50 min)
      prisma.sitting.findMany.mockResolvedValue([
        { entrantId: 'entrant-fast', startedAt: new Date('2026-06-01T09:58:00Z'), completedAt: new Date('2026-06-01T10:00:00Z') },
        { entrantId: 'e2', startedAt: new Date('2026-06-01T09:10:00Z'), completedAt: new Date('2026-06-01T09:59:00Z') },
        { entrantId: 'e3', startedAt: new Date('2026-06-01T09:09:00Z'), completedAt: new Date('2026-06-01T09:58:00Z') },
        { entrantId: 'e4', startedAt: new Date('2026-06-01T09:11:00Z'), completedAt: new Date('2026-06-01T10:00:00Z') },
        { entrantId: 'e5', startedAt: new Date('2026-06-01T09:10:00Z'), completedAt: new Date('2026-06-01T09:57:00Z') },
        { entrantId: 'e6', startedAt: new Date('2026-06-01T09:12:00Z'), completedAt: new Date('2026-06-01T10:01:00Z') },
        { entrantId: 'e7', startedAt: new Date('2026-06-01T09:08:00Z'), completedAt: new Date('2026-06-01T09:56:00Z') },
        { entrantId: 'e8', startedAt: new Date('2026-06-01T09:10:00Z'), completedAt: new Date('2026-06-01T09:58:00Z') },
      ]);

      prisma.submission.findMany.mockResolvedValue([]);
      prisma.paper.findUnique.mockResolvedValue(null);

      const res = await request(app).get('/api/marking/queue');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      // The fast entrant should have at least one signal badge
      expect(res.body[0].signals.length).toBeGreaterThan(0);
      expect(res.body[0].signals[0]).toHaveProperty('type');
      expect(res.body[0].signals[0]).toHaveProperty('severity');
    });

    it('returns empty signals array when no flags are detected', async () => {
      prisma.markingTask.findMany.mockResolvedValue([
        {
          id: 'task-1',
          status: 'unassigned',
          submissionId: 'sub-1',
          submission: {
            id: 'sub-1',
            entrantId: 'entrant-normal',
            roundId: 'round-1',
            entrant: { id: 'entrant-normal', name: 'Normal' },
            round: { id: 'round-1' },
          },
          assignedTo: null,
          moderatedBy: null,
        },
      ]);

      // Normal cohort — no outliers
      prisma.round.findUnique.mockResolvedValue({
        openTime: new Date('2026-06-01T09:00:00Z'),
        closeTime: new Date('2026-06-01T10:00:00Z'),
      });
      prisma.sitting.findMany.mockResolvedValue([
        { entrantId: 'entrant-normal', startedAt: new Date('2026-06-01T09:10:00Z'), completedAt: new Date('2026-06-01T09:55:00Z') },
        { entrantId: 'e2', startedAt: new Date('2026-06-01T09:12:00Z'), completedAt: new Date('2026-06-01T09:50:00Z') },
        { entrantId: 'e3', startedAt: new Date('2026-06-01T09:08:00Z'), completedAt: new Date('2026-06-01T09:52:00Z') },
        { entrantId: 'e4', startedAt: new Date('2026-06-01T09:15:00Z'), completedAt: new Date('2026-06-01T09:58:00Z') },
      ]);
      prisma.submission.findMany.mockResolvedValue([]);
      prisma.paper.findUnique.mockResolvedValue(null);

      const res = await request(app).get('/api/marking/queue');
      expect(res.status).toBe(200);
      expect(res.body[0].signals).toEqual([]);
    });
  });

  describe('PATCH /api/marking/:id/assign', () => {
    it('returns 404 when task does not exist', async () => {
      prisma.markingTask.findUnique.mockResolvedValue(null);
      const res = await request(app).patch('/api/marking/task-1/assign').send({});
      expect(res.status).toBe(404);
    });

    it('assigns to the requester when no assignedToId is given', async () => {
      prisma.markingTask.findUnique.mockResolvedValue({
        id: 'task-1',
        status: 'unassigned',
        submission: { round: { olympiadId: 'oly-1' } },
      });
      prisma.user.findUnique
        .mockResolvedValueOnce({ id: 'organiser-1', role: 'organiser', name: 'Marker One' }) // role check
        .mockResolvedValueOnce({ id: 'organiser-1', name: 'Marker One' }); // assignee lookup
      prisma.markingTask.update.mockResolvedValue({
        id: 'task-1',
        status: 'assigned',
        assignedToId: 'organiser-1',
      });

      const res = await request(app).patch('/api/marking/task-1/assign').send({});
      expect(res.status).toBe(200);
      expect(prisma.markingTask.update).toHaveBeenCalledWith({
        where: { id: 'task-1' },
        data: { assignedToId: 'organiser-1', status: 'assigned' },
      });
    });

    it('returns 400 when assignedToId does not match a user', async () => {
      prisma.markingTask.findUnique.mockResolvedValue({
        id: 'task-1',
        status: 'unassigned',
        submission: { round: { olympiadId: 'oly-1' } },
      });
      prisma.user.findUnique
        .mockResolvedValueOnce({ id: 'organiser-1', role: 'organiser', name: 'Marker One' }) // role check
        .mockResolvedValueOnce(null); // assignee lookup fails

      const res = await request(app)
        .patch('/api/marking/task-1/assign')
        .send({ assignedToId: 'ghost-user' });
      expect(res.status).toBe(400);
    });
  });

  describe('PATCH /api/marking/:id', () => {
    it('returns 400 when score is missing', async () => {
      const res = await request(app).patch('/api/marking/task-1').send({});
      expect(res.status).toBe(400);
    });

    it('records score, breakdown, and marks task as marked', async () => {
      prisma.markingTask.findUnique.mockResolvedValue({
        id: 'task-1',
        status: 'assigned',
        submission: { round: { olympiadId: 'oly-1' } },
      });
      prisma.markingTask.update.mockResolvedValue({
        id: 'task-1',
        status: 'marked',
        score: 8,
        breakdown: { q1: 3, q2: 5 },
      });

      const res = await request(app)
        .patch('/api/marking/task-1')
        .send({ score: 8, breakdown: { q1: 3, q2: 5 } });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('marked');
      expect(prisma.markingTask.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'task-1' },
          data: expect.objectContaining({ score: 8, status: 'marked' }),
        })
      );
    });

    it('returns 404 when task does not exist', async () => {
      prisma.markingTask.findUnique.mockResolvedValue(null);
      const res = await request(app).patch('/api/marking/task-1').send({ score: 5 });
      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /api/marking/:id/moderate', () => {
    it('returns 400 when moderatedScore is missing', async () => {
      const res = await request(app).patch('/api/marking/task-1/moderate').send({});
      expect(res.status).toBe(400);
    });

    it('returns 403 when task has not been marked yet', async () => {
      prisma.markingTask.findUnique.mockResolvedValue({
        id: 'task-1',
        status: 'unassigned',
        submission: { round: { olympiadId: 'oly-1' } },
      });
      const res = await request(app)
        .patch('/api/marking/task-1/moderate')
        .send({ moderatedScore: 9 });
      expect(res.status).toBe(403);
    });

    it('records moderated score and marks task as moderated', async () => {
      prisma.markingTask.findUnique.mockResolvedValue({
        id: 'task-1',
        status: 'marked',
        submission: { round: { olympiadId: 'oly-1' } },
      });
      prisma.markingTask.update.mockResolvedValue({
        id: 'task-1',
        status: 'moderated',
        moderatedScore: 9,
        moderatedById: 'organiser-1',
      });

      const res = await request(app)
        .patch('/api/marking/task-1/moderate')
        .send({ moderatedScore: 9 });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('moderated');
      expect(prisma.markingTask.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'task-1' },
          data: expect.objectContaining({
            moderatedScore: 9,
            moderatedById: 'organiser-1',
            status: 'moderated',
          }),
        })
      );
    });

    it('returns 404 when task does not exist', async () => {
      prisma.markingTask.findUnique.mockResolvedValue(null);
      const res = await request(app)
        .patch('/api/marking/task-1/moderate')
        .send({ moderatedScore: 9 });
      expect(res.status).toBe(404);
    });
  });
});
