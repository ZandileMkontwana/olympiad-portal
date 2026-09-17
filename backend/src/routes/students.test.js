import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
const prisma = require('../lib/prisma');
const studentsRouter = require('./students');

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
  app.use('/api', studentsRouter);
  return app;
}

describe('Students routes', () => {
  let app;

  beforeEach(() => {
    vi.spyOn(prisma.user, 'findUnique');
    vi.spyOn(prisma.entrant, 'findFirst');
    vi.spyOn(prisma.sitting, 'findMany');
    vi.spyOn(prisma.sitting, 'findFirst');
    vi.spyOn(prisma.submission, 'findMany');
    vi.spyOn(prisma.submission, 'findFirst');
    vi.spyOn(prisma.paper, 'findUnique');
    vi.spyOn(prisma.roundEntrant, 'findMany');
    vi.spyOn(prisma.roundEntrant, 'upsert');
    vi.spyOn(prisma.round, 'findMany');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    // Default: the Clerk user maps to a student linked to entrant-1
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'student@school.com',
      role: 'student',
      name: 'Thabo',
    });
    prisma.entrant.findFirst.mockResolvedValue({
      id: 'entrant-1',
      userId: 'user-1',
      name: 'Thabo',
      grade: '10',
      schoolId: 'school-1',
    });
    app = createApp();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /api/students/me/sittings', () => {
    it('returns 401 when not authenticated (no Clerk session)', async () => {
      const unauthApp = createApp(false);
      const res = await request(unauthApp).get('/api/students/me/sittings');
      expect(res.status).toBe(401);
      expect(prisma.sitting.findMany).not.toHaveBeenCalled();
    });

    it('returns 404 when the Clerk user has no database record', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      const res = await request(app).get('/api/students/me/sittings');
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('User not found');
    });

    it('returns 403 when user is not a student', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'teacher@school.com',
        role: 'educator',
        name: 'Teacher One',
      });
      const res = await request(app).get('/api/students/me/sittings');
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('student access required');
    });

    it('returns 404 when no entrant record is linked to the account', async () => {
      prisma.entrant.findFirst.mockResolvedValue(null);
      const res = await request(app).get('/api/students/me/sittings');
      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/No entrant record linked/);
      expect(prisma.sitting.findMany).not.toHaveBeenCalled();
    });

    it('returns the student sittings scoped to their entrant, newest first', async () => {
      const sittings = [
        {
          id: 'sitting-1',
          entrantId: 'entrant-1',
          roundId: 'round-1',
          answers: null,
          startedAt: '2026-09-01T10:00:00.000Z',
          expiresAt: '2026-09-01T12:00:00.000Z',
          completedAt: null,
          round: {
            id: 'round-1',
            name: 'Round 1',
            state: 'open',
            closeTime: '2026-09-01T12:00:00.000Z',
          },
        },
      ];
      prisma.sitting.findMany.mockResolvedValue(sittings);

      const res = await request(app).get('/api/students/me/sittings');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(sittings);
      expect(prisma.sitting.findMany).toHaveBeenCalledWith({
        where: { entrantId: 'entrant-1' },
        include: {
          round: { select: { id: true, name: true, state: true, closeTime: true } },
        },
        orderBy: { startedAt: 'desc' },
      });
    });

    it('returns 500 when the database query fails', async () => {
      prisma.sitting.findMany.mockRejectedValue(new Error('DB down'));
      const res = await request(app).get('/api/students/me/sittings');
      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Could not fetch sittings');
    });
  });

  describe('GET /api/students/me/results', () => {
    it('returns 401 when not authenticated (no Clerk session)', async () => {
      const unauthApp = createApp(false);
      const res = await request(unauthApp).get('/api/students/me/results');
      expect(res.status).toBe(401);
      expect(prisma.submission.findMany).not.toHaveBeenCalled();
    });

    it('returns 404 when no entrant record is linked to the account', async () => {
      prisma.entrant.findFirst.mockResolvedValue(null);
      const res = await request(app).get('/api/students/me/results');
      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/No entrant record linked/);
    });

    it('returns only released results, mapped to a flat shape', async () => {
      prisma.submission.findMany.mockResolvedValue([
        {
          id: 'submission-1',
          entrantId: 'entrant-1',
          submittedAt: '2026-09-01T11:00:00.000Z',
          round: { id: 'round-1', name: 'Round 1' },
          result: { id: 'result-1', score: 85, releasedAt: '2026-09-02T08:00:00.000Z' },
        },
      ]);

      const res = await request(app).get('/api/students/me/results');

      expect(res.status).toBe(200);
      expect(res.body).toEqual([
        {
          id: 'result-1',
          score: 85,
          releasedAt: '2026-09-02T08:00:00.000Z',
          submittedAt: '2026-09-01T11:00:00.000Z',
          round: { id: 'round-1', name: 'Round 1' },
        },
      ]);
    });

    it('filters to released results only in the query', async () => {
      prisma.submission.findMany.mockResolvedValue([]);
      const res = await request(app).get('/api/students/me/results');
      expect(res.status).toBe(200);
      expect(prisma.submission.findMany).toHaveBeenCalledWith({
        where: {
          entrantId: 'entrant-1',
          result: { releasedAt: { not: null } },
        },
        include: {
          round: { select: { id: true, name: true } },
          result: true,
        },
        orderBy: { submittedAt: 'desc' },
      });
    });

    it('returns an empty list when the student has no released results', async () => {
      prisma.submission.findMany.mockResolvedValue([]);
      const res = await request(app).get('/api/students/me/results');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('returns 500 when the database query fails', async () => {
      prisma.submission.findMany.mockRejectedValue(new Error('DB down'));
      const res = await request(app).get('/api/students/me/results');
      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Could not fetch results');
    });
  });

  describe('GET /api/students/me/results/:resultId', () => {
    it('returns 401 when not authenticated (no Clerk session)', async () => {
      const unauthApp = createApp(false);
      const res = await request(unauthApp).get('/api/students/me/results/result-1');
      expect(res.status).toBe(401);
      expect(prisma.submission.findFirst).not.toHaveBeenCalled();
    });

    it('returns 404 when no entrant record is linked to the account', async () => {
      prisma.entrant.findFirst.mockResolvedValue(null);
      const res = await request(app).get('/api/students/me/results/result-1');
      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/No entrant record linked/);
    });

    it("scopes the lookup to the student's own released result", async () => {
      prisma.submission.findFirst.mockResolvedValue(null);
      const res = await request(app).get('/api/students/me/results/result-1');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Result not found or not released yet');
      expect(prisma.submission.findFirst).toHaveBeenCalledWith({
        where: {
          entrantId: 'entrant-1',
          result: { id: 'result-1', releasedAt: { not: null } },
        },
        include: {
          round: { select: { id: true, name: true } },
          result: true,
        },
      });
      expect(prisma.paper.findUnique).not.toHaveBeenCalled();
    });

    it('returns the score and a question-by-question review', async () => {
      prisma.submission.findFirst.mockResolvedValue({
        id: 'submission-1',
        roundId: 'round-1',
        entrantId: 'entrant-1',
        answers: { q1: 'A', q2: 'C' },
        submittedAt: '2026-09-01T11:00:00.000Z',
        round: { id: 'round-1', name: 'Round 1' },
        result: { id: 'result-1', score: 40, releasedAt: '2026-09-02T08:00:00.000Z' },
      });
      prisma.paper.findUnique.mockResolvedValue({
        fileUrl: 'https://example.com/paper.pdf',
        memoAnswers: { q1: 'A', q2: 'B', q3: 'B' },
      });

      const res = await request(app).get('/api/students/me/results/result-1');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        id: 'result-1',
        score: 40,
        submittedAt: '2026-09-01T11:00:00.000Z',
        releasedAt: '2026-09-02T08:00:00.000Z',
        round: { id: 'round-1', name: 'Round 1' },
        paperFileUrl: 'https://example.com/paper.pdf',
        questions: [
          { questionId: 'q1', correctAnswer: 'A', studentAnswer: 'A', isCorrect: true },
          { questionId: 'q2', correctAnswer: 'B', studentAnswer: 'C', isCorrect: false },
          { questionId: 'q3', correctAnswer: 'B', studentAnswer: null, isCorrect: false },
        ],
      });
      expect(prisma.paper.findUnique).toHaveBeenCalledWith({
        where: { roundId: 'round-1' },
        select: { fileUrl: true, memoAnswers: true },
      });
    });

    it('returns an empty question list when the paper has no memo answer key', async () => {
      prisma.submission.findFirst.mockResolvedValue({
        id: 'submission-1',
        roundId: 'round-1',
        entrantId: 'entrant-1',
        answers: {},
        submittedAt: '2026-09-01T11:00:00.000Z',
        round: { id: 'round-1', name: 'Round 1' },
        result: { id: 'result-1', score: 70, releasedAt: '2026-09-02T08:00:00.000Z' },
      });
      prisma.paper.findUnique.mockResolvedValue(null);

      const res = await request(app).get('/api/students/me/results/result-1');

      expect(res.status).toBe(200);
      expect(res.body.questions).toEqual([]);
      expect(res.body.paperFileUrl).toBeNull();
    });

    it('returns 500 when the database query fails', async () => {
      prisma.submission.findFirst.mockRejectedValue(new Error('DB down'));
      const res = await request(app).get('/api/students/me/results/result-1');
      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Could not fetch result');
    });
  });

  describe('GET /api/students/me/rounds', () => {
    it('returns 401 when not authenticated', async () => {
      const unauthApp = createApp(false);
      const res = await request(unauthApp).get('/api/students/me/rounds');
      expect(res.status).toBe(401);
    });

    it('returns 404 when no entrant is linked', async () => {
      prisma.entrant.findFirst.mockResolvedValue(null);
      const res = await request(app).get('/api/students/me/rounds');
      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/No entrant record linked/);
    });

    it('returns all open rounds with sitting status and lazy-registers', async () => {
      prisma.round.findMany.mockResolvedValue([
        {
          id: 'round-1',
          name: 'Round 1',
          state: 'open',
          closeTime: '2030-01-01T00:00:00.000Z',
          qualifyingThreshold: null,
          prerequisiteRoundId: null,
          prerequisiteRound: null,
        },
        {
          id: 'round-2',
          name: 'Round 2',
          state: 'open',
          closeTime: '2030-01-01T00:00:00.000Z',
          qualifyingThreshold: null,
          prerequisiteRoundId: null,
          prerequisiteRound: null,
        },
      ]);
      prisma.roundEntrant.upsert.mockResolvedValue({ id: 're-1' });
      // Round 1 has a sitting, Round 2 does not
      prisma.sitting.findFirst
        .mockResolvedValueOnce({
          id: 'sitting-1',
          completedAt: null,
          startedAt: '2026-09-01T10:00:00.000Z',
          expiresAt: '2030-01-01T00:00:00.000Z',
        })
        .mockResolvedValueOnce(null);

      const res = await request(app).get('/api/students/me/rounds');

      expect(res.status).toBe(200);
      expect(res.body).toEqual([
        {
          round: {
            id: 'round-1',
            name: 'Round 1',
            state: 'open',
            closeTime: '2030-01-01T00:00:00.000Z',
          },
          sitting: {
            id: 'sitting-1',
            completedAt: null,
            startedAt: '2026-09-01T10:00:00.000Z',
            expiresAt: '2030-01-01T00:00:00.000Z',
          },
          locked: false,
          lockedReason: null,
        },
        {
          round: {
            id: 'round-2',
            name: 'Round 2',
            state: 'open',
            closeTime: '2030-01-01T00:00:00.000Z',
          },
          sitting: null,
          locked: false,
          lockedReason: null,
        },
      ]);
      expect(prisma.round.findMany).toHaveBeenCalledWith({
        where: { state: 'open' },
        select: {
          id: true,
          name: true,
          state: true,
          closeTime: true,
          qualifyingThreshold: true,
          prerequisiteRoundId: true,
          prerequisiteRound: { select: { id: true, name: true } },
        },
        orderBy: { openTime: 'desc' },
      });
      // Lazy registration was called for both rounds (both unlocked)
      expect(prisma.roundEntrant.upsert).toHaveBeenCalledTimes(2);
    });

    it('marks a gated round locked when the prerequisite was not passed', async () => {
      prisma.round.findMany.mockResolvedValue([
        {
          id: 'round-2',
          name: 'Round 2',
          state: 'open',
          closeTime: '2030-01-01T00:00:00.000Z',
          qualifyingThreshold: 60,
          prerequisiteRoundId: 'round-1',
          prerequisiteRound: { id: 'round-1', name: 'Round 1' },
        },
      ]);
      prisma.submission.findFirst.mockResolvedValue(null);

      const res = await request(app).get('/api/students/me/rounds');

      expect(res.status).toBe(200);
      expect(res.body[0].locked).toBe(true);
      expect(res.body[0].lockedReason).toBe('Score at least 60% in Round 1 to unlock');
      // Locked rounds are not lazy-registered
      expect(prisma.roundEntrant.upsert).not.toHaveBeenCalled();
    });

    it('locks a gated round without a threshold until the prerequisite is completed', async () => {
      prisma.round.findMany.mockResolvedValue([
        {
          id: 'round-2',
          name: 'Round 2',
          state: 'open',
          closeTime: '2030-01-01T00:00:00.000Z',
          qualifyingThreshold: null,
          prerequisiteRoundId: 'round-1',
          prerequisiteRound: { id: 'round-1', name: 'Round 1' },
        },
      ]);
      prisma.submission.findFirst.mockResolvedValue(null);

      const res = await request(app).get('/api/students/me/rounds');

      expect(res.status).toBe(200);
      expect(res.body[0].locked).toBe(true);
      expect(res.body[0].lockedReason).toBe('Complete Round 1 first');
    });

    it('unlocks a gated round once the prerequisite was passed', async () => {
      prisma.round.findMany.mockResolvedValue([
        {
          id: 'round-2',
          name: 'Round 2',
          state: 'open',
          closeTime: '2030-01-01T00:00:00.000Z',
          qualifyingThreshold: 60,
          prerequisiteRoundId: 'round-1',
          prerequisiteRound: { id: 'round-1', name: 'Round 1' },
        },
      ]);
      prisma.submission.findFirst.mockResolvedValue({ id: 'prereq-sub' });
      prisma.roundEntrant.upsert.mockResolvedValue({ id: 're-1' });
      prisma.sitting.findFirst.mockResolvedValue(null);

      const res = await request(app).get('/api/students/me/rounds');

      expect(res.status).toBe(200);
      expect(res.body[0].locked).toBe(false);
      expect(res.body[0].lockedReason).toBeNull();
      expect(res.body[0].sitting).toBeNull();
      expect(prisma.roundEntrant.upsert).toHaveBeenCalledTimes(1);
    });

    it('returns an empty list when no open rounds exist', async () => {
      prisma.round.findMany.mockResolvedValue([]);
      const res = await request(app).get('/api/students/me/rounds');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('returns 500 when the database query fails', async () => {
      prisma.round.findMany.mockRejectedValue(new Error('DB down'));
      const res = await request(app).get('/api/students/me/rounds');
      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Could not fetch rounds');
    });
  });
});
