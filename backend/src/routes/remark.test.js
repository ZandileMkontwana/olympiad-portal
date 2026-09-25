import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
const prisma = require('../lib/prisma');
const remarkRouter = require('./remark');

// Simulate Clerk's clerkMiddleware() having run: req.auth() returns the
// signed-in Clerk user. requireRole() (middleware/auth.js) then loads the
// matching database record to check the role and set req.user.
function createApp(authenticated = true, clerkUserId = 'clerk-user-1') {
  const app = express();
  app.use(express.json());
  if (authenticated) {
    app.use((req, _res, next) => {
      req.auth = () => ({ userId: clerkUserId });
      next();
    });
  }
  app.use('/api', remarkRouter);
  return app;
}

const organiser = {
  id: 'organiser-1',
  email: 'organiser@school.com',
  role: 'organiser',
  name: 'Organiser One',
};

const reviewer = {
  id: 'organiser-2',
  email: 'reviewer@school.com',
  role: 'organiser',
  name: 'Reviewer Two',
};

function ownedRemark(overrides = {}) {
  return {
    id: 'remark-1',
    status: 'pending',
    submission: {
      round: {
        olympiad: { organiserId: organiser.id },
      },
    },
    ...overrides,
  };
}

describe('Remark routes', () => {
  let app;

  beforeEach(() => {
    vi.spyOn(prisma.remarkRequest, 'findFirst');
    vi.spyOn(prisma.remarkRequest, 'findMany');
    vi.spyOn(prisma.remarkRequest, 'findUnique');
    vi.spyOn(prisma.remarkRequest, 'create');
    vi.spyOn(prisma.remarkRequest, 'updateMany');
    vi.spyOn(prisma.result, 'upsert');
    vi.spyOn(prisma.submission, 'findUnique');
    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(organiser);
    vi.spyOn(prisma, '$transaction').mockImplementation(async (callback) => callback(prisma));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    app = createApp();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('PATCH /api/remark/:id/assign', () => {
    it('returns 401 when not authenticated', async () => {
      const unauthApp = createApp(false);
      const res = await request(unauthApp).patch('/api/remark/remark-1/assign').send({});
      expect(res.status).toBe(401);
    });

    it('returns 404 when the remark request does not exist', async () => {
      prisma.remarkRequest.findUnique.mockResolvedValue(null);

      const res = await request(app).patch('/api/remark/remark-1/assign').send({});

      expect(res.status).toBe(404);
    });

    it('assigns a pending appeal to the olympiad owner by default', async () => {
      prisma.remarkRequest.findUnique.mockResolvedValueOnce(ownedRemark()).mockResolvedValueOnce({
        id: 'remark-1',
        status: 'assigned',
        assignedToId: organiser.id,
      });
      prisma.remarkRequest.updateMany.mockResolvedValue({ count: 1 });

      const res = await request(app).patch('/api/remark/remark-1/assign').send({});

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id: 'remark-1',
        status: 'assigned',
        assignedToId: organiser.id,
      });
      expect(prisma.remarkRequest.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'remark-1',
          status: 'pending',
        },
        data: {
          assignedToId: organiser.id,
          status: 'assigned',
        },
      });
    });

    it('assigns an appeal to a different organiser reviewer', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(organiser).mockResolvedValueOnce(reviewer);
      prisma.remarkRequest.findUnique.mockResolvedValueOnce(ownedRemark()).mockResolvedValueOnce({
        id: 'remark-1',
        status: 'assigned',
        assignedToId: reviewer.id,
      });
      prisma.remarkRequest.updateMany.mockResolvedValue({ count: 1 });

      const res = await request(app)
        .patch('/api/remark/remark-1/assign')
        .send({ assignedToId: reviewer.id });

      expect(res.status).toBe(200);
      expect(prisma.remarkRequest.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            assignedToId: reviewer.id,
            status: 'assigned',
          },
        })
      );
    });

    it('does not let a different organiser route the appeal', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(reviewer);
      prisma.remarkRequest.findUnique.mockResolvedValue(ownedRemark());

      const reviewerApp = createApp(true, 'clerk-user-2');
      const res = await request(reviewerApp).patch('/api/remark/remark-1/assign').send({});

      expect(res.status).toBe(404);
      expect(prisma.remarkRequest.updateMany).not.toHaveBeenCalled();
    });

    it('rejects an assignee who is not an organiser', async () => {
      prisma.user.findUnique
        .mockResolvedValueOnce(organiser)
        .mockResolvedValueOnce({ id: 'educator-1', role: 'educator', name: 'Educator One' });
      prisma.remarkRequest.findUnique.mockResolvedValue(ownedRemark());

      const res = await request(app)
        .patch('/api/remark/remark-1/assign')
        .send({ assignedToId: 'educator-1' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/organiser reviewer/);
      expect(prisma.remarkRequest.updateMany).not.toHaveBeenCalled();
    });

    it('does not reassign an appeal that has already been routed', async () => {
      prisma.remarkRequest.findUnique.mockResolvedValue(ownedRemark({ status: 'assigned' }));

      const res = await request(app).patch('/api/remark/remark-1/assign').send({});

      expect(res.status).toBe(409);
      expect(prisma.remarkRequest.updateMany).not.toHaveBeenCalled();
    });

    it('does not assign an appeal that has already been resolved', async () => {
      prisma.remarkRequest.findUnique.mockResolvedValue(ownedRemark({ status: 'approved' }));

      const res = await request(app).patch('/api/remark/remark-1/assign').send({});

      expect(res.status).toBe(409);
      expect(prisma.remarkRequest.updateMany).not.toHaveBeenCalled();
    });

    it('returns 409 when the appeal changes before assignment completes', async () => {
      prisma.remarkRequest.findUnique.mockResolvedValue(ownedRemark());
      prisma.remarkRequest.updateMany.mockResolvedValue({ count: 0 });

      const res = await request(app).patch('/api/remark/remark-1/assign').send({});

      expect(res.status).toBe(409);
    });
  });

  describe('PATCH /api/remark/:id/review', () => {
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

    it('returns 409 until an appeal has been assigned', async () => {
      prisma.remarkRequest.findUnique.mockResolvedValue({ id: 'remark-1', status: 'pending' });

      const res = await request(app)
        .patch('/api/remark/remark-1/review')
        .send({ status: 'rejected' });

      expect(res.status).toBe(409);
      expect(prisma.remarkRequest.updateMany).not.toHaveBeenCalled();
    });

    it('rejects a review from an organiser other than the assigned reviewer', async () => {
      prisma.remarkRequest.findUnique.mockResolvedValue({
        id: 'remark-1',
        status: 'assigned',
        assignedToId: reviewer.id,
      });

      const res = await request(app)
        .patch('/api/remark/remark-1/review')
        .send({ status: 'rejected' });

      expect(res.status).toBe(403);
      expect(prisma.remarkRequest.updateMany).not.toHaveBeenCalled();
    });

    it('allows the specifically assigned reviewer to decide an appeal', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(reviewer);
      prisma.remarkRequest.findUnique
        .mockResolvedValueOnce({
          id: 'remark-1',
          status: 'assigned',
          assignedToId: reviewer.id,
          submissionId: 'sub-1',
        })
        .mockResolvedValueOnce({
          id: 'remark-1',
          status: 'rejected',
          reviewedById: reviewer.id,
        });
      prisma.remarkRequest.updateMany.mockResolvedValue({ count: 1 });

      const reviewerApp = createApp(true, 'clerk-user-2');
      const res = await request(reviewerApp)
        .patch('/api/remark/remark-1/review')
        .send({ status: 'rejected' });

      expect(res.status).toBe(200);
      expect(res.body.reviewedById).toBe(reviewer.id);
    });

    it('rejects an assigned remark request without touching the Result', async () => {
      prisma.remarkRequest.findUnique
        .mockResolvedValueOnce({
          id: 'remark-1',
          status: 'assigned',
          assignedToId: organiser.id,
          submissionId: 'sub-1',
        })
        .mockResolvedValueOnce({
          id: 'remark-1',
          status: 'rejected',
          reviewedById: organiser.id,
        });
      prisma.remarkRequest.updateMany.mockResolvedValue({ count: 1 });

      const res = await request(app)
        .patch('/api/remark/remark-1/review')
        .send({ status: 'rejected', reviewNotes: 'Marking was correct' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('rejected');
      expect(prisma.remarkRequest.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: 'remark-1',
            status: 'assigned',
            assignedToId: organiser.id,
          },
          data: expect.objectContaining({
            status: 'rejected',
            newScore: undefined,
            reviewedById: organiser.id,
          }),
        })
      );
      expect(prisma.result.upsert).not.toHaveBeenCalled();
    });

    it('approves an assigned remark request and upserts the Result score', async () => {
      prisma.remarkRequest.findUnique
        .mockResolvedValueOnce({
          id: 'remark-1',
          status: 'assigned',
          assignedToId: organiser.id,
          submissionId: 'sub-1',
        })
        .mockResolvedValueOnce({
          id: 'remark-1',
          status: 'approved',
          newScore: 9,
          reviewedById: organiser.id,
        });
      prisma.remarkRequest.updateMany.mockResolvedValue({ count: 1 });
      prisma.result.upsert.mockResolvedValue({ submissionId: 'sub-1', score: 9 });

      const res = await request(app)
        .patch('/api/remark/remark-1/review')
        .send({ status: 'approved', newScore: 9 });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('approved');
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.result.upsert).toHaveBeenCalledWith({
        where: { submissionId: 'sub-1' },
        update: { score: 9 },
        create: {
          submissionId: 'sub-1',
          score: 9,
        },
      });
    });

    it('returns 409 when the appeal changes before review completes', async () => {
      prisma.remarkRequest.findUnique.mockResolvedValue({
        id: 'remark-1',
        status: 'assigned',
        assignedToId: organiser.id,
        submissionId: 'sub-1',
      });
      prisma.remarkRequest.updateMany.mockResolvedValue({ count: 0 });

      const res = await request(app)
        .patch('/api/remark/remark-1/review')
        .send({ status: 'rejected' });

      expect(res.status).toBe(409);
      expect(prisma.result.upsert).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/remark/queue', () => {
    it('returns 401 when not authenticated', async () => {
      const unauthApp = createApp(false);
      const res = await request(unauthApp).get('/api/remark/queue');
      expect(res.status).toBe(401);
    });

    it('defaults to the owner’s pending appeals', async () => {
      prisma.remarkRequest.findMany.mockResolvedValue([]);

      const res = await request(app).get('/api/remark/queue');

      expect(res.status).toBe(200);
      expect(prisma.remarkRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            status: 'pending',
            OR: [
              {
                submission: {
                  round: {
                    olympiad: { organiserId: organiser.id },
                  },
                },
              },
              { assignedToId: organiser.id },
            ],
          },
          include: expect.objectContaining({
            assignedTo: { select: { id: true, name: true, email: true } },
          }),
        })
      );
    });

    it('returns an assigned reviewer’s work when assignedTo=me is passed', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(reviewer);
      prisma.remarkRequest.findMany.mockResolvedValue([]);

      const reviewerApp = createApp(true, 'clerk-user-2');
      const res = await request(reviewerApp).get('/api/remark/queue?assignedTo=me');

      expect(res.status).toBe(200);
      expect(prisma.remarkRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            status: 'assigned',
            assignedToId: reviewer.id,
            OR: [
              {
                submission: {
                  round: {
                    olympiad: { organiserId: reviewer.id },
                  },
                },
              },
              { assignedToId: reviewer.id },
            ],
          },
        })
      );
    });

    it('keeps visibility scoped when status=all is passed', async () => {
      prisma.remarkRequest.findMany.mockResolvedValue([]);

      const res = await request(app).get('/api/remark/queue?status=all');

      expect(res.status).toBe(200);
      expect(prisma.remarkRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              {
                submission: {
                  round: {
                    olympiad: { organiserId: organiser.id },
                  },
                },
              },
              { assignedToId: organiser.id },
            ],
          },
        })
      );
    });

    it('returns 500 on an unexpected error', async () => {
      prisma.remarkRequest.findMany.mockRejectedValue(new Error('DB error'));

      const res = await request(app).get('/api/remark/queue');

      expect(res.status).toBe(500);
    });
  });
});
