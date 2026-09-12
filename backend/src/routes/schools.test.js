import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// ===== Load source modules =====
const prisma = require('../lib/prisma');
const schoolsRouter = require('./schools');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api', schoolsRouter);
  return app;
}

describe('Schools routes', () => {
  let app;

  beforeEach(() => {
    vi.spyOn(prisma.school, 'findMany');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    app = createApp();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /api/schools', () => {
    it('returns the school list sorted by name', async () => {
      prisma.school.findMany.mockResolvedValue([
        { id: 'school-1', name: 'Alpha School' },
        { id: 'school-2', name: 'Beta School' },
      ]);

      const res = await request(app).get('/api/schools');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].name).toBe('Alpha School');
      expect(prisma.school.findMany).toHaveBeenCalledWith({
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      });
    });

    it('returns an empty list when no schools exist', async () => {
      prisma.school.findMany.mockResolvedValue([]);

      const res = await request(app).get('/api/schools');

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('returns 500 when the database query fails', async () => {
      prisma.school.findMany.mockRejectedValue(new Error('DB down'));

      const res = await request(app).get('/api/schools');

      expect(res.status).toBe(500);
      expect(res.body.error).toMatch(/Could not fetch schools/);
    });
  });
});
