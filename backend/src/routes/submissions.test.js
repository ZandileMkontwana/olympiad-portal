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
    vi.spyOn(prisma.remarkRequest, 'create');
    vi.spyOn(prisma.user, 'findUnique');
    vi.spyOn(prisma.entrant, 'findUnique');
    vi.spyOn(prisma.educator, 'findUnique');
    vi.spyOn(prisma.submission, 'findFirst');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    sgMail.send.mockResolvedValue({});
    prisma.markingTask.create.mockResolvedValue({
      id: 'default-task-id',
      status: 'unassigned',
    });
    // Default: the Clerk user maps to an educator in our database
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'a@b.com',
      role: 'educator',
      name: 'Educator One',
    });
    // Default: that educator is linked to school-1
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
      prisma.entrant.findUnique.mockResolvedValue({
        id: 'e1',
        name: 'Alice',
        schoolId: 'school-1',
      });

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
      prisma.entrant.findUnique.mockResolvedValue({ id: 'e1', name: 'Alice', schoolId: 'school-1' });

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
      prisma.entrant.findUnique.mockResolvedValue({ id: 'e1', name: 'Alice', schoolId: 'school-1' });

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
      prisma.entrant.findUnique.mockResolvedValue({
        id: 'e1',
        name: 'Alice',
        schoolId: 'school-1',
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
      prisma.entrant.findUnique.mockResolvedValue({
        id: 'e1',
        name: 'Alice',
        schoolId: 'school-1',
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
      prisma.entrant.findUnique.mockResolvedValue({ id: 'e1', name: 'Alice', schoolId: 'school-1' });

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

    it('returns 404 when entrant not found', async () => {
      prisma.round.findUnique.mockResolvedValue({
        id: 'round-1',
        state: 'open',
        name: 'Round 1',
        paper: null,
      });
      prisma.entrant.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .post('/api/rounds/round-1/submissions')
        .send({ entrantId: 'e1', answers: { q1: 'A' }, idempotencyKey: 'key-1' });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Entrant not found');
      expect(prisma.submission.create).not.toHaveBeenCalled();
      expect(sgMail.send).not.toHaveBeenCalled();
    });

    it('returns 403 when the account has no linked school', async () => {
      prisma.educator.findUnique.mockResolvedValue(null);
      prisma.round.findUnique.mockResolvedValue({
        id: 'round-1',
        state: 'open',
        name: 'Round 1',
        paper: null,
      });

      const res = await request(app)
        .post('/api/rounds/round-1/submissions')
        .send({ entrantId: 'e1', answers: { q1: 'A' }, idempotencyKey: 'key-1' });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('No school linked to this account');
      expect(prisma.submission.create).not.toHaveBeenCalled();
    });

    it('returns 403 when the entrant belongs to a different school', async () => {
      prisma.round.findUnique.mockResolvedValue({
        id: 'round-1',
        state: 'open',
        name: 'Round 1',
        paper: null,
      });
      prisma.entrant.findUnique.mockResolvedValue({
        id: 'e1',
        name: 'Alice',
        schoolId: 'school-2',
      });

      const res = await request(app)
        .post('/api/rounds/round-1/submissions')
        .send({ entrantId: 'e1', answers: { q1: 'A' }, idempotencyKey: 'key-1' });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Entrant belongs to a different school');
      expect(prisma.submission.create).not.toHaveBeenCalled();
    });

    it('returns 403 when the prerequisite round was not passed', async () => {
      prisma.round.findUnique.mockResolvedValue({
        id: 'round-1',
        state: 'open',
        name: 'Round 2',
        paper: null,
        prerequisiteRoundId: 'round-0',
        qualifyingThreshold: 50,
        prerequisiteRound: { id: 'round-0', name: 'Round 1' },
      });
      prisma.entrant.findUnique.mockResolvedValue({
        id: 'e1',
        name: 'Alice',
        schoolId: 'school-1',
      });
      prisma.submission.findFirst.mockResolvedValue(null);

      const res = await request(app)
        .post('/api/rounds/round-1/submissions')
        .send({ entrantId: 'e1', answers: { q1: 'A' }, idempotencyKey: 'key-1' });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Prerequisite not met: Requires at least 50% in Round 1');
      expect(prisma.submission.create).not.toHaveBeenCalled();
    });

    it('creates the submission when the prerequisite round was passed', async () => {
      prisma.round.findUnique.mockResolvedValue({
        id: 'round-1',
        state: 'open',
        name: 'Round 2',
        paper: null,
        prerequisiteRoundId: 'round-0',
        qualifyingThreshold: 50,
        prerequisiteRound: { id: 'round-0', name: 'Round 1' },
      });
      prisma.entrant.findUnique.mockResolvedValue({
        id: 'e1',
        name: 'Alice',
        schoolId: 'school-1',
      });
      prisma.submission.findFirst.mockResolvedValue({ id: 'prereq-sub' });
      prisma.submission.create.mockResolvedValue({
        id: 'sub-1',
        submittedAt: new Date('2026-01-01'),
      });

      const res = await request(app)
        .post('/api/rounds/round-1/submissions')
        .send({ entrantId: 'e1', answers: { q1: 'A' }, idempotencyKey: 'key-1' });

      expect(res.status).toBe(201);
      expect(prisma.submission.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ entrantId: 'e1', roundId: 'round-0' }),
        })
      );
    });
  });

  describe('POST /submissions/:id/remark', () => {
    it('returns 401 when not authenticated', async () => {
      const unauthApp = createApp(false);
      const res = await request(unauthApp)
        .post('/api/submissions/sub-1/remark')
        .send({ reason: 'Question 3 was marked wrong' });
      expect(res.status).toBe(401);
    });

    it('returns 400 when reason is missing', async () => {
      const res = await request(app).post('/api/submissions/sub-1/remark').send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/reason/);
    });

    it('returns 404 when submission does not exist', async () => {
      prisma.submission.findUnique.mockResolvedValue(null);
      const res = await request(app)
        .post('/api/submissions/sub-1/remark')
        .send({ reason: 'Question 3 was marked wrong' });
      expect(res.status).toBe(404);
    });

    it('creates a remark request tied to the requesting educator', async () => {
      prisma.submission.findUnique.mockResolvedValue({ id: 'sub-1' });
      prisma.remarkRequest.create.mockResolvedValue({
        id: 'remark-1',
        submissionId: 'sub-1',
        requestedById: 'user-1',
        reason: 'Question 3 was marked wrong',
        status: 'pending',
      });

      const res = await request(app)
        .post('/api/submissions/sub-1/remark')
        .send({ reason: 'Question 3 was marked wrong' });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('pending');
      expect(prisma.remarkRequest.create).toHaveBeenCalledWith({
        data: {
          submissionId: 'sub-1',
          requestedById: 'user-1',
          reason: 'Question 3 was marked wrong',
        },
      });
    });

    it('returns 500 on unexpected error', async () => {
      prisma.submission.findUnique.mockResolvedValue({ id: 'sub-1' });
      prisma.remarkRequest.create.mockRejectedValue(new Error('Unexpected'));

      const res = await request(app)
        .post('/api/submissions/sub-1/remark')
        .send({ reason: 'Question 3 was marked wrong' });

      expect(res.status).toBe(500);
    });
  });
});
