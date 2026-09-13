import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
const prisma = require('../lib/prisma');
const remarkRouter = require('./remark');

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
  app.use('/api', remarkRouter);
  return app;
}

describe('PATCH /api/remark/:id/review', () => {
  let app;

  beforeEach(() => {
    vi.spyOn(prisma.remarkRequest, 'findUnique');
    vi.spyOn(prisma.remarkRequest, 'update');
    vi.spyOn(prisma.result, 'upsert');
    vi.spyOn(prisma.user, 'findUnique');
    vi.spyOn(console, 'error').mockImplementation(() => {});

    // Default: the Clerk user maps to an organiser
    prisma.user.findUnique.mockResolvedValue({
      id: 'organiser-1',
      email: 'organiser@school.com',
      role: 'organiser',
      name: 'Organiser One',
    });

    app = createApp();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    const unauthApp = createApp(false);
    const res = await request(unauthApp)
      .patch('/api/remark/remark-1/review')
      .send({ status: 'approved', newScore: 8 });
    expect(res.status).toBe(401);
  });

  it("returns 400 when status is not 'approved' or 'rejected'", async () => {
    const res = await request(app).patch('/api/remark/remark-1/review').send({ status: 'maybe' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when approving without a newScore', async () => {
    const res = await request(app)
      .patch('/api/remark/remark-1/review')
      .send({ status: 'approved' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/newScore/);
  });

  it('returns 404 when the remark request does not exist', async () => {
    prisma.remarkRequest.findUnique.mockResolvedValue(null);
    const res = await request(app)
      .patch('/api/remark/remark-1/review')
      .send({ status: 'rejected' });
    expect(res.status).toBe(404);
  });

  it('returns 403 when the remark request is not pending', async () => {
    prisma.remarkRequest.findUnique.mockResolvedValue({ id: 'remark-1', status: 'approved' });
    const res = await request(app)
      .patch('/api/remark/remark-1/review')
      .send({ status: 'rejected' });
    expect(res.status).toBe(403);
  });

  it('rejects a remark request without touching the Result', async () => {
    prisma.remarkRequest.findUnique.mockResolvedValue({
      id: 'remark-1',
      status: 'pending',
      submissionId: 'sub-1',
    });
    prisma.remarkRequest.update.mockResolvedValue({
      id: 'remark-1',
      status: 'rejected',
      reviewedById: 'organiser-1',
    });

    const res = await request(app)
      .patch('/api/remark/remark-1/review')
      .send({ status: 'rejected', reviewNotes: 'Marking was correct' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('rejected');
    expect(prisma.remarkRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'remark-1' },
        data: expect.objectContaining({
          status: 'rejected',
          newScore: undefined,
          reviewedById: 'organiser-1',
        }),
      })
    );
    expect(prisma.result.upsert).not.toHaveBeenCalled();
  });

  it('approves a remark request and upserts the Result score', async () => {
    prisma.remarkRequest.findUnique.mockResolvedValue({
      id: 'remark-1',
      status: 'pending',
      submissionId: 'sub-1',
    });
    prisma.remarkRequest.update.mockResolvedValue({
      id: 'remark-1',
      status: 'approved',
      newScore: 9,
      reviewedById: 'organiser-1',
    });
    prisma.result.upsert.mockResolvedValue({ submissionId: 'sub-1', score: 9 });

    const res = await request(app)
      .patch('/api/remark/remark-1/review')
      .send({ status: 'approved', newScore: 9 });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('approved');
    expect(prisma.result.upsert).toHaveBeenCalledWith({
      where: { submissionId: 'sub-1' },
      update: { score: 9 },
      create: { submissionId: 'sub-1', score: 9 },
    });
  });

  it('returns 500 on unexpected error', async () => {
    prisma.remarkRequest.findUnique.mockRejectedValue(new Error('Unexpected'));
    const res = await request(app)
      .patch('/api/remark/remark-1/review')
      .send({ status: 'rejected' });
    expect(res.status).toBe(500);
  });
});
