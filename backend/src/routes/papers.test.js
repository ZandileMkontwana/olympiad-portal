import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// ===== Mock Clerk and Supabase BEFORE loading source modules =====
const clerk = require('@clerk/express');
vi.spyOn(clerk, 'requireAuth').mockReturnValue((req, res, next) => {
  req.auth = () => ({ userId: 'clerk-user-1' });
  next();
});

// Spy on createClient to prevent real WebSocket initialization on Node.js < 22
const supabaseJs = require('@supabase/supabase-js');
vi.spyOn(supabaseJs, 'createClient').mockReturnValue({
  storage: {
    from: () => ({
      upload: () => Promise.resolve({ error: null }),
      getPublicUrl: () => ({ data: { publicUrl: '' } }),
    }),
  },
});

// ===== Load source modules (they will use our mocked Clerk + Supabase) =====
const prisma = require('../lib/prisma');
const supabase = require('../lib/supabase');
const papersRouter = require('./papers');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api', papersRouter);
  return app;
}

describe('Papers routes', () => {
  let app;
  let mockUpload;
  let mockGetPublicUrl;

  beforeEach(() => {
    vi.spyOn(prisma.user, 'findUnique');
    vi.spyOn(prisma.paper, 'create');
    vi.spyOn(prisma.round, 'findUnique');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    // Default: user is an organiser
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1', role: 'organiser' });

    // Default Supabase mock: uploads succeed, returns public URL
    mockUpload = vi.fn().mockResolvedValue({ error: null });
    mockGetPublicUrl = vi.fn().mockReturnValue({
      data: { publicUrl: 'https://test.supabase.co/test-bucket/file.pdf' },
    });
    vi.spyOn(supabase.storage, 'from').mockReturnValue({
      upload: mockUpload,
      getPublicUrl: mockGetPublicUrl,
    });

    app = createApp();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('POST /api/rounds/:id/papers', () => {
    it('returns 403 without organiser role', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1', role: 'educator' });
      const res = await request(app).post('/api/rounds/round-1/papers');
      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/Organiser/);
    });

    it('returns 400 when both files are missing', async () => {
      const res = await request(app)
        .post('/api/rounds/round-1/papers')
        .field('memoAnswers', JSON.stringify({ q1: 'A' }));
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Both paper and memo/);
    });

    it('returns 400 when only paper is provided', async () => {
      const res = await request(app)
        .post('/api/rounds/round-1/papers')
        .attach('paper', Buffer.from('fake'), 'paper.pdf');
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Both paper and memo/);
    });

    it('returns 400 when memoAnswers is not valid JSON', async () => {
      const res = await request(app)
        .post('/api/rounds/round-1/papers')
        .field('memoAnswers', 'not-json{')
        .attach('paper', Buffer.from('fake'), 'paper.pdf')
        .attach('memo', Buffer.from('fake'), 'memo.pdf');
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/valid JSON/);
    });

    it('creates paper and returns 201', async () => {
      prisma.paper.create.mockResolvedValue({
        id: 'paper-1',
        roundId: 'round-1',
        fileUrl: 'https://test.supabase.co/test-bucket/file.pdf',
        memoUrl: 'https://test.supabase.co/test-bucket/file.pdf',
      });

      const res = await request(app)
        .post('/api/rounds/round-1/papers')
        .field('memoAnswers', JSON.stringify({ q1: 'A' }))
        .attach('paper', Buffer.from('fake pdf content'), 'paper.pdf')
        .attach('memo', Buffer.from('fake memo content'), 'memo.pdf');

      expect(res.status).toBe(201);
      expect(res.body.id).toBe('paper-1');
      expect(prisma.paper.create).toHaveBeenCalled();
      expect(mockUpload).toHaveBeenCalledTimes(2);
    });

    it('creates paper without memoAnswers when not provided', async () => {
      prisma.paper.create.mockResolvedValue({
        id: 'paper-2',
        roundId: 'round-1',
      });

      const res = await request(app)
        .post('/api/rounds/round-1/papers')
        .attach('paper', Buffer.from('fake'), 'paper.pdf')
        .attach('memo', Buffer.from('fake'), 'memo.pdf');

      expect(res.status).toBe(201);
      expect(prisma.paper.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ memoAnswers: null }),
        })
      );
    });

    it('returns 500 when Supabase upload fails', async () => {
      mockUpload.mockResolvedValue({ error: { message: 'Storage error' } });

      const res = await request(app)
        .post('/api/rounds/round-1/papers')
        .attach('paper', Buffer.from('fake'), 'paper.pdf')
        .attach('memo', Buffer.from('fake'), 'memo.pdf');

      expect(res.status).toBe(500);
      expect(res.body.error).toMatch(/Could not save/);
    });

    it('returns 500 when prisma fails', async () => {
      prisma.paper.create.mockRejectedValue(new Error('DB error'));

      const res = await request(app)
        .post('/api/rounds/round-1/papers')
        .attach('paper', Buffer.from('fake'), 'paper.pdf')
        .attach('memo', Buffer.from('fake'), 'memo.pdf');

      expect(res.status).toBe(500);
      expect(res.body.error).toMatch(/Could not save/);
    });
  });

  describe('GET /api/rounds/:id/papers', () => {
    it('returns 404 when round not found', async () => {
      prisma.round.findUnique.mockResolvedValue(null);
      const res = await request(app).get('/api/rounds/round-1/papers');
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Round not found');
    });

    it('returns 403 when round is scheduled', async () => {
      prisma.round.findUnique.mockResolvedValue({
        id: 'round-1',
        state: 'scheduled',
        paper: null,
      });
      const res = await request(app).get('/api/rounds/round-1/papers');
      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/scheduled/);
    });

    it('returns 403 when round is closed', async () => {
      prisma.round.findUnique.mockResolvedValue({
        id: 'round-1',
        state: 'closed',
        paper: null,
      });
      const res = await request(app).get('/api/rounds/round-1/papers');
      expect(res.status).toBe(403);
    });

    it('returns 404 when round is open but no paper uploaded', async () => {
      prisma.round.findUnique.mockResolvedValue({
        id: 'round-1',
        state: 'open',
        paper: null,
      });
      const res = await request(app).get('/api/rounds/round-1/papers');
      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/No paper uploaded/);
    });

    it('returns paper when round is open', async () => {
      const paper = {
        id: 'paper-1',
        fileUrl: 'https://test.supabase.co/test-bucket/file.pdf',
      };
      prisma.round.findUnique.mockResolvedValue({
        id: 'round-1',
        state: 'open',
        paper,
      });
      const res = await request(app).get('/api/rounds/round-1/papers');
      expect(res.status).toBe(200);
      expect(res.body).toEqual(paper);
    });

    it('returns paper when round is released', async () => {
      const paper = {
        id: 'paper-1',
        fileUrl: 'https://test.supabase.co/test-bucket/file.pdf',
      };
      prisma.round.findUnique.mockResolvedValue({
        id: 'round-1',
        state: 'released',
        paper,
      });
      const res = await request(app).get('/api/rounds/round-1/papers');
      expect(res.status).toBe(200);
      expect(res.body).toEqual(paper);
    });
  });
});
