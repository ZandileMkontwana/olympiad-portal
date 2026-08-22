import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import fs from 'fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');
const papersRouter = require('./papers');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.join(__dirname, '../../uploads/papers');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api', papersRouter);
  return app;
}

describe('Papers routes', () => {
  let app;

  beforeEach(() => {
    vi.spyOn(jwt, 'verify');
    vi.spyOn(prisma.paper, 'create');
    vi.spyOn(prisma.round, 'findUnique');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    process.env.JWT_SECRET = 'test-secret';
    jwt.verify.mockReturnValue({ userId: 'user-1', role: 'organiser' });
    app = createApp();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (fs.existsSync(UPLOAD_DIR)) {
      const files = fs.readdirSync(UPLOAD_DIR);
      for (const file of files) {
        fs.unlinkSync(path.join(UPLOAD_DIR, file));
      }
    }
  });

  describe('POST /api/rounds/:id/papers', () => {
    it('returns 403 without organiser role', async () => {
      jwt.verify.mockReturnValue({ userId: 'user-1', role: 'educator' });
      const res = await request(app)
        .post('/api/rounds/round-1/papers')
        .set('Cookie', 'token=valid');
      expect(res.status).toBe(403);
    });

    it('returns 400 when both files are missing', async () => {
      const res = await request(app)
        .post('/api/rounds/round-1/papers')
        .set('Cookie', 'token=valid')
        .field('memoAnswers', JSON.stringify({ q1: 'A' }));
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Both paper and memo/);
    });

    it('returns 400 when only paper is provided', async () => {
      const res = await request(app)
        .post('/api/rounds/round-1/papers')
        .set('Cookie', 'token=valid')
        .attach('paper', Buffer.from('fake'), 'paper.pdf');
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Both paper and memo/);
    });

    it('returns 400 when memoAnswers is not valid JSON', async () => {
      const res = await request(app)
        .post('/api/rounds/round-1/papers')
        .set('Cookie', 'token=valid')
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
        fileUrl: '/uploads/papers/paper.pdf',
        memoUrl: '/uploads/papers/memo.pdf',
      });

      const res = await request(app)
        .post('/api/rounds/round-1/papers')
        .set('Cookie', 'token=valid')
        .field('memoAnswers', JSON.stringify({ q1: 'A' }))
        .attach('paper', Buffer.from('fake pdf content'), 'paper.pdf')
        .attach('memo', Buffer.from('fake memo content'), 'memo.pdf');

      expect(res.status).toBe(201);
      expect(res.body.id).toBe('paper-1');
      expect(prisma.paper.create).toHaveBeenCalled();
    });

    it('creates paper without memoAnswers when not provided', async () => {
      prisma.paper.create.mockResolvedValue({
        id: 'paper-2',
        roundId: 'round-1',
      });

      const res = await request(app)
        .post('/api/rounds/round-1/papers')
        .set('Cookie', 'token=valid')
        .attach('paper', Buffer.from('fake'), 'paper.pdf')
        .attach('memo', Buffer.from('fake'), 'memo.pdf');

      expect(res.status).toBe(201);
      expect(prisma.paper.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ memoAnswers: null }),
        })
      );
    });

    it('returns 500 when prisma fails', async () => {
      prisma.paper.create.mockRejectedValue(new Error('DB error'));

      const res = await request(app)
        .post('/api/rounds/round-1/papers')
        .set('Cookie', 'token=valid')
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
      const paper = { id: 'paper-1', fileUrl: '/uploads/papers/paper.pdf' };
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
      const paper = { id: 'paper-1', fileUrl: '/uploads/papers/paper.pdf' };
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
