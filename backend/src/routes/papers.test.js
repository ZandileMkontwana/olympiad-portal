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
    vi.spyOn(prisma.paper, 'upsert');
    vi.spyOn(prisma.paper, 'findMany');
    vi.spyOn(prisma.round, 'findUnique');
    vi.spyOn(prisma.olympiadOrganiser, 'findUnique');
    vi.spyOn(prisma.olympiadOrganiser, 'findMany');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    // Default: user is an organiser
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1', role: 'organiser' });

    // Default: organiser is a member of olympiad 'oly-1'
    prisma.olympiadOrganiser.findUnique.mockResolvedValue({
      id: 'oo-1',
      olympiadId: 'oly-1',
      organiserId: 'user-1',
    });
    prisma.olympiadOrganiser.findMany.mockResolvedValue([{ olympiadId: 'oly-1' }]);

    // Default: round belongs to olympiad 'oly-1'
    prisma.round.findUnique.mockResolvedValue({ id: 'round-1', olympiadId: 'oly-1' });

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
      expect(res.body.error).toMatch(/A paper file is required/);
    });

    it('returns 201 when only paper is provided (memo is optional)', async () => {
      prisma.paper.upsert.mockResolvedValue({
        id: 'paper-1',
        roundId: 'round-1',
        fileUrl: 'https://test.supabase.co/test-bucket/file.pdf',
        memoUrl: null,
        memoAnswers: null,
      });

      const res = await request(app)
        .post('/api/rounds/round-1/papers')
        .attach('paper', Buffer.from('fake'), 'paper.pdf');
      expect(res.status).toBe(201);
      expect(mockUpload).toHaveBeenCalledTimes(1);
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

    it('upserts paper and returns 201', async () => {
      prisma.paper.upsert.mockResolvedValue({
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
      expect(prisma.paper.upsert).toHaveBeenCalled();
      expect(mockUpload).toHaveBeenCalledTimes(2);
    });

    it('upserts paper without memoAnswers when not provided', async () => {
      prisma.paper.upsert.mockResolvedValue({
        id: 'paper-2',
        roundId: 'round-1',
      });

      const res = await request(app)
        .post('/api/rounds/round-1/papers')
        .attach('paper', Buffer.from('fake'), 'paper.pdf')
        .attach('memo', Buffer.from('fake'), 'memo.pdf');

      expect(res.status).toBe(201);
      expect(prisma.paper.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ memoAnswers: null }),
          update: expect.objectContaining({ memoAnswers: null }),
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
      prisma.paper.upsert.mockRejectedValue(new Error('DB error'));

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

  describe('GET /api/papers/archive', () => {
    it('returns archived papers from closed and released rounds', async () => {
      prisma.paper.findMany.mockResolvedValue([
        {
          id: 'paper-1',
          roundId: 'round-1',
          fileUrl: 'https://test.supabase.co/paper1.pdf',
          memoUrl: 'https://test.supabase.co/memo1.pdf',
          uploadedAt: '2026-08-01T00:00:00Z',
          round: {
            name: 'Round 1',
            closeTime: '2026-08-10T00:00:00Z',
            state: 'closed',
            olympiad: { name: 'Maths Olympiad' },
          },
        },
        {
          id: 'paper-2',
          roundId: 'round-2',
          fileUrl: 'https://test.supabase.co/paper2.pdf',
          memoUrl: null,
          uploadedAt: '2026-07-15T00:00:00Z',
          round: {
            name: 'Round 2',
            closeTime: '2026-07-20T00:00:00Z',
            state: 'released',
            olympiad: { name: 'Science Olympiad' },
          },
        },
      ]);

      const res = await request(app).get('/api/papers/archive');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0]).toEqual({
        id: 'paper-1',
        roundId: 'round-1',
        roundName: 'Round 1',
        olympiadName: 'Maths Olympiad',
        closeTime: '2026-08-10T00:00:00Z',
        fileUrl: 'https://test.supabase.co/paper1.pdf',
        memoUrl: 'https://test.supabase.co/memo1.pdf',
        uploadedAt: '2026-08-01T00:00:00Z',
      });
      expect(prisma.paper.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { round: { state: { in: ['closed', 'released'] } } },
        })
      );
    });

    it('returns empty array when no archived papers exist', async () => {
      prisma.paper.findMany.mockResolvedValue([]);
      const res = await request(app).get('/api/papers/archive');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('returns 500 on database error', async () => {
      prisma.paper.findMany.mockRejectedValue(new Error('DB error'));
      const res = await request(app).get('/api/papers/archive');
      expect(res.status).toBe(500);
      expect(res.body.error).toMatch(/Failed to fetch/);
    });
  });
});
