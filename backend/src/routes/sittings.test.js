import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// ===== Mock Supabase BEFORE loading source modules =====
const supabaseJs = require('@supabase/supabase-js');
vi.spyOn(supabaseJs, 'createClient').mockReturnValue({});

// ===== Load source modules =====
const prisma = require('../lib/prisma');
const sittingsRouter = require('./sittings');

function createApp() {
  const app = express();
  app.use(express.json());
  // Simulate Clerk's clerkMiddleware() having run — sittings routes
  // authenticate via req.auth() (see middleware/auth.js).
  app.use((req, _res, next) => {
    req.auth = () => ({ userId: 'clerk-user-1' });
    next();
  });
  app.use('/api', sittingsRouter);
  return app;
}

describe('Sittings routes', () => {
  let app;

  const openRound = {
    id: 'round-1',
    name: 'Round 1',
    state: 'open',
    closeTime: new Date('2030-01-01T00:00:00.000Z'),
    paper: {
      fileUrl: 'https://test.supabase.co/test-bucket/paper.pdf',
      memoUrl: 'https://test.supabase.co/test-bucket/memo.pdf',
      memoAnswers: { 1: 'A', 2: 'C', 3: 'B' },
    },
  };

  beforeEach(() => {
    vi.spyOn(prisma.round, 'findUnique');
    vi.spyOn(prisma.roundEntrant, 'findUnique');
    vi.spyOn(prisma.sitting, 'findUnique');
    vi.spyOn(prisma.sitting, 'create');
    vi.spyOn(prisma.sitting, 'update');
    vi.spyOn(console, 'error').mockImplementation(() => {});

    // Defaults: round is open with a paper, entrant is registered,
    // no existing sitting.
    prisma.round.findUnique.mockResolvedValue(openRound);
    prisma.roundEntrant.findUnique.mockResolvedValue({ id: 're-1' });
    prisma.sitting.findUnique.mockResolvedValue(null);
    prisma.sitting.create.mockResolvedValue({
      id: 'sitting-1',
      entrantId: 'entrant-1',
      roundId: 'round-1',
      answers: null,
      startedAt: new Date('2026-01-01T00:00:00.000Z'),
      expiresAt: openRound.closeTime,
      completedAt: null,
    });
    prisma.sitting.update.mockImplementation(({ data }) =>
      Promise.resolve({
        id: 'sitting-1',
        entrantId: 'entrant-1',
        roundId: 'round-1',
        ...data,
      })
    );

    app = createApp();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('POST /api/rounds/:id/sittings', () => {
    it('creates a sitting and returns 201 with questions (no answer key)', async () => {
      const res = await request(app)
        .post('/api/rounds/round-1/sittings')
        .send({ entrantId: 'entrant-1' });

      expect(res.status).toBe(201);
      expect(res.body.sitting.id).toBe('sitting-1');
      expect(res.body.round.name).toBe('Round 1');
      expect(res.body.paper.fileUrl).toBe(openRound.paper.fileUrl);
      // Question IDs only — the memo answers must never leak
      expect(res.body.paper.questions).toEqual(['1', '2', '3']);
      expect(JSON.stringify(res.body)).not.toContain('"A"');
      expect(JSON.stringify(res.body)).not.toContain('memoAnswers');
      // expiresAt is the round's close time (the time limit)
      expect(res.body.sitting.expiresAt).toBe(openRound.closeTime.toISOString());
      expect(prisma.sitting.create).toHaveBeenCalledWith({
        data: { roundId: 'round-1', entrantId: 'entrant-1', expiresAt: openRound.closeTime },
      });
    });

    it('returns 400 when entrantId is missing', async () => {
      const res = await request(app).post('/api/rounds/round-1/sittings').send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/entrantId is required/);
    });

    it('returns 404 when round does not exist', async () => {
      prisma.round.findUnique.mockResolvedValue(null);
      const res = await request(app)
        .post('/api/rounds/nope/sittings')
        .send({ entrantId: 'entrant-1' });
      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/Round not found/);
    });

    it('returns 403 when round is not open', async () => {
      prisma.round.findUnique.mockResolvedValue({ ...openRound, state: 'closed' });
      const res = await request(app)
        .post('/api/rounds/round-1/sittings')
        .send({ entrantId: 'entrant-1' });
      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/currently 'closed'/);
    });

    it('returns 404 when round has no paper', async () => {
      prisma.round.findUnique.mockResolvedValue({ ...openRound, paper: null });
      const res = await request(app)
        .post('/api/rounds/round-1/sittings')
        .send({ entrantId: 'entrant-1' });
      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/No paper uploaded/);
    });

    it('returns 403 when entrant is not registered for the round', async () => {
      prisma.roundEntrant.findUnique.mockResolvedValue(null);
      const res = await request(app)
        .post('/api/rounds/round-1/sittings')
        .send({ entrantId: 'entrant-1' });
      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/not registered/);
    });

    it('returns 403 when the entrant already completed a sitting', async () => {
      prisma.sitting.findUnique.mockResolvedValue({
        id: 'sitting-old',
        entrantId: 'entrant-1',
        roundId: 'round-1',
        answers: { 1: 'A' },
        startedAt: new Date('2026-01-01T00:00:00.000Z'),
        expiresAt: openRound.closeTime,
        completedAt: new Date('2026-01-01T01:00:00.000Z'),
      });

      const res = await request(app)
        .post('/api/rounds/round-1/sittings')
        .send({ entrantId: 'entrant-1' });

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/already completed/);
      expect(prisma.sitting.create).not.toHaveBeenCalled();
    });

    it('resumes an in-progress sitting with 200 instead of creating a new one', async () => {
      prisma.sitting.findUnique.mockResolvedValue({
        id: 'sitting-existing',
        entrantId: 'entrant-1',
        roundId: 'round-1',
        answers: { 1: 'B' },
        startedAt: new Date('2026-01-01T00:00:00.000Z'),
        expiresAt: openRound.closeTime,
        completedAt: null,
      });

      const res = await request(app)
        .post('/api/rounds/round-1/sittings')
        .send({ entrantId: 'entrant-1' });

      expect(res.status).toBe(200);
      expect(res.body.sitting.id).toBe('sitting-existing');
      // Saved answers are restored for resume (Story A4)
      expect(res.body.sitting.answers).toEqual({ 1: 'B' });
      expect(prisma.sitting.create).not.toHaveBeenCalled();
    });

    it('returns 401 when not authenticated', async () => {
      const unauthApp = express();
      unauthApp.use(express.json());
      // No req.auth set — requireAuth must reject
      unauthApp.use('/api', sittingsRouter);

      const res = await request(unauthApp)
        .post('/api/rounds/round-1/sittings')
        .send({ entrantId: 'entrant-1' });

      expect(res.status).toBe(401);
    });

    it('returns 500 when prisma fails', async () => {
      prisma.round.findUnique.mockRejectedValue(new Error('DB error'));
      const res = await request(app)
        .post('/api/rounds/round-1/sittings')
        .send({ entrantId: 'entrant-1' });
      expect(res.status).toBe(500);
      expect(res.body.error).toMatch(/Could not start sitting/);
    });
  });

  describe('PATCH /api/sittings/:id/answers', () => {
    const activeSitting = {
      id: 'sitting-1',
      entrantId: 'entrant-1',
      roundId: 'round-1',
      answers: { 1: 'A', 2: 'B' },
      startedAt: new Date('2026-01-01T00:00:00.000Z'),
      expiresAt: new Date('2030-01-01T00:00:00.000Z'),
      completedAt: null,
    };

    it('merges partial answers into the stored answers', async () => {
      prisma.sitting.findUnique.mockResolvedValue(activeSitting);

      const res = await request(app)
        .patch('/api/sittings/sitting-1/answers')
        .send({ answers: { 2: 'C', 3: 'A' } });

      expect(res.status).toBe(200);
      expect(prisma.sitting.update).toHaveBeenCalledWith({
        where: { id: 'sitting-1' },
        data: { answers: { 1: 'A', 2: 'C', 3: 'A' } },
      });
      expect(res.body.sitting.answers).toEqual({ 1: 'A', 2: 'C', 3: 'A' });
    });

    it('stores answers when the sitting had none yet', async () => {
      prisma.sitting.findUnique.mockResolvedValue({ ...activeSitting, answers: null });

      const res = await request(app)
        .patch('/api/sittings/sitting-1/answers')
        .send({ answers: { 1: 'B' } });

      expect(res.status).toBe(200);
      expect(prisma.sitting.update).toHaveBeenCalledWith({
        where: { id: 'sitting-1' },
        data: { answers: { 1: 'B' } },
      });
    });

    it('returns 400 when answers is missing or not an object', async () => {
      const missing = await request(app).patch('/api/sittings/sitting-1/answers').send({});
      expect(missing.status).toBe(400);

      const notObject = await request(app)
        .patch('/api/sittings/sitting-1/answers')
        .send({ answers: ['A', 'B'] });
      expect(notObject.status).toBe(400);
      expect(prisma.sitting.update).not.toHaveBeenCalled();
    });

    it('returns 404 when sitting not found', async () => {
      prisma.sitting.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .patch('/api/sittings/sitting-1/answers')
        .send({ answers: { 1: 'A' } });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Sitting not found');
    });

    it('returns 403 when the sitting is already completed', async () => {
      prisma.sitting.findUnique.mockResolvedValue({
        ...activeSitting,
        completedAt: new Date('2026-01-02T00:00:00.000Z'),
      });

      const res = await request(app)
        .patch('/api/sittings/sitting-1/answers')
        .send({ answers: { 1: 'A' } });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Sitting already completed');
      expect(prisma.sitting.update).not.toHaveBeenCalled();
    });

    it('returns 500 on unexpected error', async () => {
      prisma.sitting.findUnique.mockRejectedValue(new Error('DB error'));

      const res = await request(app)
        .patch('/api/sittings/sitting-1/answers')
        .send({ answers: { 1: 'A' } });

      expect(res.status).toBe(500);
      expect(res.body.error).toMatch(/Could not save answers/);
    });
  });
});
