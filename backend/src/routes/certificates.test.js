import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
const prisma = require('../lib/prisma');
const certificatesRouter = require('./certificates');

// Same Clerk-simulation helper used in rounds.test.js
function createApp(authenticated = true) {
  const app = express();
  app.use(express.json());
  if (authenticated) {
    app.use((req, _res, next) => {
      req.auth = () => ({ userId: 'clerk-user-1' });
      next();
    });
  }
  app.use('/api', certificatesRouter);
  return app;
}

// Minimal valid PDF header — real pdfkit output always starts with %PDF
const PDF_MAGIC = '%PDF';

describe('Certificates routes', () => {
  let app;

  beforeEach(() => {
    vi.spyOn(prisma.round, 'findUnique');
    vi.spyOn(prisma.educator, 'findUnique');
    vi.spyOn(prisma.entrant, 'findUnique');
    vi.spyOn(prisma.user, 'findUnique');
    vi.spyOn(console, 'error').mockImplementation(() => {});

    // Default: the Clerk user maps to an educator linked to school-1
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'teacher@school.com',
      role: 'educator',
      name: 'Teacher One',
    });
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

  describe('GET /api/rounds/:id/certificates/:entrantId', () => {
    it('returns 401 when not authenticated', async () => {
      const unauthApp = createApp(false);
      const res = await request(unauthApp).get('/api/rounds/round-1/certificates/entrant-1');
      expect(res.status).toBe(401);
    });

    it('returns 403 when user is not an educator', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-2',
        email: 'organiser@olympiad.com',
        role: 'organiser',
        name: 'Organiser One',
      });
      const res = await request(app).get('/api/rounds/round-1/certificates/entrant-1');
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('educator access required');
    });

    it('returns 404 when round not found', async () => {
      prisma.round.findUnique.mockResolvedValue(null);
      const res = await request(app).get('/api/rounds/nonexistent/certificates/entrant-1');
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Round not found');
    });

    it('returns 403 when round is not released', async () => {
      prisma.round.findUnique.mockResolvedValue({
        id: 'round-1',
        name: 'Round 1',
        state: 'closed',
        olympiad: { name: 'Math Olympiad' },
      });
      const res = await request(app).get('/api/rounds/round-1/certificates/entrant-1');
      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/results are released/);
    });

    it('returns 403 when educator has no school linked', async () => {
      prisma.round.findUnique.mockResolvedValue({
        id: 'round-1',
        name: 'Round 1',
        state: 'released',
        olympiad: { name: 'Math Olympiad' },
      });
      prisma.educator.findUnique.mockResolvedValue(null);

      const res = await request(app).get('/api/rounds/round-1/certificates/entrant-1');
      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/No school linked/);
    });

    it('returns 404 when entrant not found', async () => {
      prisma.round.findUnique.mockResolvedValue({
        id: 'round-1',
        name: 'Round 1',
        state: 'released',
        olympiad: { name: 'Math Olympiad' },
      });
      prisma.entrant.findUnique.mockResolvedValue(null);

      const res = await request(app).get('/api/rounds/round-1/certificates/nonexistent');
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Entrant not found');
    });

    it('returns 403 when entrant belongs to a different school', async () => {
      prisma.round.findUnique.mockResolvedValue({
        id: 'round-1',
        name: 'Round 1',
        state: 'released',
        olympiad: { name: 'Math Olympiad' },
      });
      prisma.entrant.findUnique.mockResolvedValue({
        id: 'entrant-1',
        name: 'Alice',
        schoolId: 'school-2',
        school: { id: 'school-2', name: 'Other School' },
        submissions: [],
      });

      const res = await request(app).get('/api/rounds/round-1/certificates/entrant-1');
      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/different school/);
    });

    it('returns 404 when entrant has no submission for this round', async () => {
      prisma.round.findUnique.mockResolvedValue({
        id: 'round-1',
        name: 'Round 1',
        state: 'released',
        olympiad: { name: 'Math Olympiad' },
      });
      prisma.entrant.findUnique.mockResolvedValue({
        id: 'entrant-1',
        name: 'Alice',
        schoolId: 'school-1',
        school: { id: 'school-1', name: 'School One' },
        submissions: [],
      });

      const res = await request(app).get('/api/rounds/round-1/certificates/entrant-1');
      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/No result found/);
    });

    it('returns 404 when submission has no result (not yet marked)', async () => {
      prisma.round.findUnique.mockResolvedValue({
        id: 'round-1',
        name: 'Round 1',
        state: 'released',
        olympiad: { name: 'Math Olympiad' },
      });
      prisma.entrant.findUnique.mockResolvedValue({
        id: 'entrant-1',
        name: 'Alice',
        schoolId: 'school-1',
        school: { id: 'school-1', name: 'School One' },
        submissions: [{ id: 'sub-1', roundId: 'round-1', result: null }],
      });

      const res = await request(app).get('/api/rounds/round-1/certificates/entrant-1');
      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/No result found/);
    });

    it('returns a PDF certificate on success', async () => {
      prisma.round.findUnique.mockResolvedValue({
        id: 'round-1',
        name: 'Round 1',
        state: 'released',
        olympiad: { name: 'Math Olympiad' },
      });
      prisma.entrant.findUnique.mockResolvedValue({
        id: 'entrant-1',
        name: 'Alice',
        schoolId: 'school-1',
        school: { id: 'school-1', name: 'School One' },
        submissions: [
          {
            id: 'sub-1',
            roundId: 'round-1',
            result: { id: 'result-1', score: 85 },
          },
        ],
      });

      const res = await request(app).get('/api/rounds/round-1/certificates/entrant-1');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/application\/pdf/);
      expect(res.headers['content-disposition']).toMatch(/attachment/);
      expect(res.headers['content-disposition']).toMatch(/Alice/);

      // The body is a binary buffer — verify it starts with the PDF magic bytes
      const bodyStr = res.body.toString('utf8', 0, 4);
      expect(bodyStr).toBe(PDF_MAGIC);
    });

    it('includes correct Content-Length header', async () => {
      prisma.round.findUnique.mockResolvedValue({
        id: 'round-1',
        name: 'Round 1',
        state: 'released',
        olympiad: { name: 'Math Olympiad' },
      });
      prisma.entrant.findUnique.mockResolvedValue({
        id: 'entrant-1',
        name: 'Bob',
        schoolId: 'school-1',
        school: { id: 'school-1', name: 'School One' },
        submissions: [
          {
            id: 'sub-1',
            roundId: 'round-1',
            result: { id: 'result-1', score: 50 },
          },
        ],
      });

      const res = await request(app).get('/api/rounds/round-1/certificates/entrant-1');

      expect(res.status).toBe(200);
      expect(res.headers['content-length']).toBeDefined();
      expect(parseInt(res.headers['content-length'], 10)).toBeGreaterThan(0);
      // Content-Length must match the actual body size
      expect(parseInt(res.headers['content-length'], 10)).toBe(res.body.length);
    });

    it('sanitises special characters in the filename', async () => {
      prisma.round.findUnique.mockResolvedValue({
        id: 'round-1',
        name: 'Round 1',
        state: 'released',
        olympiad: { name: 'Math Olympiad' },
      });
      prisma.entrant.findUnique.mockResolvedValue({
        id: 'entrant-1',
        name: "O'Brien",
        schoolId: 'school-1',
        school: { id: 'school-1', name: 'School One' },
        submissions: [
          {
            id: 'sub-1',
            roundId: 'round-1',
            result: { id: 'result-1', score: 70 },
          },
        ],
      });

      const res = await request(app).get('/api/rounds/round-1/certificates/entrant-1');

      expect(res.status).toBe(200);
      // Apostrophe should be stripped from the filename
      expect(res.headers['content-disposition']).not.toMatch(/'/);
      expect(res.headers['content-disposition']).toMatch(/OBrien/);
    });

    it('returns 500 on unexpected error', async () => {
      prisma.round.findUnique.mockRejectedValue(new Error('DB error'));
      const res = await request(app).get('/api/rounds/round-1/certificates/entrant-1');
      expect(res.status).toBe(500);
      expect(res.body.error).toMatch(/Failed to generate/);
    });
  });
});
