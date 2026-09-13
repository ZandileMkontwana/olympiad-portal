import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
const sgMail = require('@sendgrid/mail');
const prisma = require('../lib/prisma');
const submissionsRouter = require('./submissions');

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
  app.use('/api', submissionsRouter);
  return app;
}

describe('Submissions routes', () => {
  let app;

  beforeEach(() => {
    vi.spyOn(sgMail, 'send');
    vi.spyOn(prisma.round, 'findUnique');
    vi.spyOn(prisma.submission, 'create');
    vi.spyOn(prisma.submission, 'findUnique');
    vi.spyOn(prisma.result, 'create');
    vi.spyOn(prisma.markingTask, 'create');
    vi.spyOn(prisma.user, 'findUnique');
    vi.spyOn(prisma.entrant, 'findUnique');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    sgMail.send.mockResolvedValue({});
    // Default: the Clerk user maps to an educator in our database
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'a@b.com',
      role: 'educator',
      name: 'Educator One',
    });
    app = createApp();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('POST /api/rounds/:id/submissions', () => {
    it('returns 401 when not authenticated (no Clerk session)', async () => {
      const unauthApp = createApp(false);
      const res = await request(unauthApp)
        .post('/api/rounds/round-1/submissions')
        .send({ entrantId: 'e1', answers: { q1: 'A' }, idempotencyKey: 'key-1' });
      expect(res.status).toBe(401);
      expect(prisma.submission.create).not.toHaveBeenCalled();
    });

    it('returns 404 when the Clerk user has no database record', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      const res = await request(app)
        .post('/api/rounds/round-1/submissions')
        .send({ entrantId: 'e1', answers: { q1: 'A' }, idempotencyKey: 'key-1' });
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('User not found');
      expect(prisma.submission.create).not.toHaveBeenCalled();
    });

    it('returns 400 when fields are missing', async () => {
      const res = await request(app)
        .post('/api/rounds/round-1/submissions')
        .send({ entrantId: 'e1' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/required/);
    });

    it('returns 404 when round not found', async () => {
      prisma.round.findUnique.mockResolvedValue(null);
      const res = await request(app)
        .post('/api/rounds/round-1/submissions')
        .send({ entrantId: 'e1', answers: { q1: 'A' }, idempotencyKey: 'key-1' });
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Round not found');
    });

    it('returns 403 when round is not open', async () => {
      prisma.round.findUnique.mockResolvedValue({
        id: 'round-1',
        state: 'closed',
        name: 'Round 1',
        paper: null,
      });
      const res = await request(app)
        .post('/api/rounds/round-1/submissions')
        .send({ entrantId: 'e1', answers: { q1: 'A' }, idempotencyKey: 'key-1' });
      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/closed/);
    });

    it('returns 403 when user is not an educator', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'a@b.com',
        role: 'organiser',
        name: 'Organiser One',
      });
      const res = await request(app)
        .post('/api/rounds/round-1/submissions')
        .send({ entrantId: 'e1', answers: { q1: 'A' }, idempotencyKey: 'key-1' });
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('educator access required');
      expect(prisma.submission.create).not.toHaveBeenCalled();
    });

    it('creates submission without result when no memoAnswers, and queues a MarkingTask', async () => {
      prisma.round.findUnique.mockResolvedValue({
        id: 'round-1',
        state: 'open',
        name: 'Round 1',
        paper: null,
      });
      prisma.submission.create.mockResolvedValue({
        id: 'sub-1',
        roundId: 'round-1',
        submittedAt: new Date('2026-01-01'),
      });
      prisma.markingTask.create.mockResolvedValue({
        id: 'task-1',
        submissionId: 'sub-1',
        status: 'unassigned',
      });
      prisma.entrant.findUnique.mockResolvedValue({ id: 'e1', name: 'Alice' });

      const res = await request(app)
        .post('/api/rounds/round-1/submissions')
        .send({ entrantId: 'e1', answers: { q1: 'A' }, idempotencyKey: 'key-1' });

      expect(res.status).toBe(201);
      expect(res.body.submission.id).toBe('sub-1');
      expect(res.body.result).toBeNull();
      expect(res.body.markingTask.id).toBe('task-1');
      expect(prisma.result.create).not.toHaveBeenCalled();
      expect(prisma.markingTask.create).toHaveBeenCalledWith({
        data: { submissionId: 'sub-1' },
      });
      expect(sgMail.send).toHaveBeenCalled();
    });

    it('automarks with memoAnswers and creates result', async () => {
      prisma.round.findUnique.mockResolvedValue({
        id: 'round-1',
        state: 'open',
        name: 'Round 1',
        paper: { memoAnswers: { q1: 'A', q2: 'B' } },
      });
      prisma.submission.create.mockResolvedValue({
        id: 'sub-1',
        submittedAt: new Date('2026-01-01'),
      });
      prisma.result.create.mockResolvedValue({ id: 'r-1', score: 50 });
      prisma.entrant.findUnique.mockResolvedValue({ id: 'e1', name: 'Alice' });

      const res = await request(app)
        .post('/api/rounds/round-1/submissions')
        .send({ entrantId: 'e1', answers: { q1: 'A', q2: 'C' }, idempotencyKey: 'key-1' });

      expect(res.status).toBe(201);
      expect(res.body.result.score).toBe(50);
      expect(prisma.result.create).toHaveBeenCalledWith({
        data: { submissionId: 'sub-1', score: 50 },
      });
      expect(prisma.markingTask.create).not.toHaveBeenCalled();
    });

    it('handles 0% score when all answers wrong', async () => {
      prisma.round.findUnique.mockResolvedValue({
        id: 'round-1',
        state: 'open',
        name: 'Round 1',
        paper: { memoAnswers: { q1: 'A', q2: 'B' } },
      });
      prisma.submission.create.mockResolvedValue({
        id: 'sub-1',
        submittedAt: new Date('2026-01-01'),
      });
      prisma.result.create.mockResolvedValue({ id: 'r-1', score: 0 });
      prisma.entrant.findUnique.mockResolvedValue({ id: 'e1', name: 'Alice' });

      const res = await request(app)
        .post('/api/rounds/round-1/submissions')
        .send({ entrantId: 'e1', answers: { q1: 'C', q2: 'D' }, idempotencyKey: 'key-1' });

      expect(res.status).toBe(201);
      expect(res.body.result.score).toBe(0);
    });

    it('returns existing submission on idempotency conflict', async () => {
      prisma.round.findUnique.mockResolvedValue({
        id: 'round-1',
        state: 'open',
        name: 'Round 1',
        paper: null,
      });
      const conflictError = new Error('Unique constraint');
      conflictError.code = 'P2002';
      conflictError.meta = { target: ['idempotencyKey'] };
      prisma.submission.create.mockRejectedValue(conflictError);
      prisma.submission.findUnique.mockResolvedValue({
        id: 'existing-sub',
        result: { score: 80 },
        markingTask: null,
      });

      const res = await request(app)
        .post('/api/rounds/round-1/submissions')
        .send({ entrantId: 'e1', answers: { q1: 'A' }, idempotencyKey: 'dup-key' });

      expect(res.status).toBe(200);
      expect(res.body.submission.id).toBe('existing-sub');
      expect(prisma.submission.findUnique).toHaveBeenCalledWith({
        where: { idempotencyKey: 'dup-key' },
        include: { result: true, markingTask: true },
      });
    });

    it('returns 500 on unexpected error', async () => {
      prisma.round.findUnique.mockResolvedValue({
        id: 'round-1',
        state: 'open',
        name: 'Round 1',
        paper: null,
      });
      prisma.submission.create.mockRejectedValue(new Error('Unexpected'));

      const res = await request(app)
        .post('/api/rounds/round-1/submissions')
        .send({ entrantId: 'e1', answers: { q1: 'A' }, idempotencyKey: 'key-1' });

      expect(res.status).toBe(500);
      expect(res.body.error).toMatch(/Could not save/);
    });

    it('sends receipt with requester email and entrant name', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'teacher@school.com',
        role: 'educator',
        name: 'Teacher',
      });
      prisma.round.findUnique.mockResolvedValue({
        id: 'round-1',
        state: 'open',
        name: 'Round 1',
        paper: null,
      });
      const submittedAt = new Date('2026-01-01');
      prisma.submission.create.mockResolvedValue({
        id: 'sub-1',
        submittedAt,
      });
      prisma.entrant.findUnique.mockResolvedValue({ id: 'e1', name: 'Alice' });

      await request(app)
        .post('/api/rounds/round-1/submissions')
        .send({ entrantId: 'e1', answers: { q1: 'A' }, idempotencyKey: 'key-1' });

      expect(sgMail.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'teacher@school.com',
          subject: 'Submission Receipt - Round 1',
        })
      );
    });

    it('sends receipt with Unknown entrant when entrant not found', async () => {
      prisma.round.findUnique.mockResolvedValue({
        id: 'round-1',
        state: 'open',
        name: 'Round 1',
        paper: null,
      });
      prisma.submission.create.mockResolvedValue({
        id: 'sub-1',
        submittedAt: new Date('2026-01-01'),
      });
      prisma.entrant.findUnique.mockResolvedValue(null);

      await request(app)
        .post('/api/rounds/round-1/submissions')
        .send({ entrantId: 'e1', answers: { q1: 'A' }, idempotencyKey: 'key-1' });

      expect(sgMail.send).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('Unknown entrant'),
        })
      );
    });
  });
});
