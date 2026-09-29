import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
const prisma = require('../lib/prisma');
const olympiadOrganisersRouter = require('./olympiadOrganisers');

function createApp(authenticated = true) {
  const app = express();
  app.use(express.json());
  if (authenticated) {
    app.use((req, _res, next) => {
      req.auth = () => ({ userId: 'clerk-user-1' });
      next();
    });
  }
  app.use('/api', olympiadOrganisersRouter);
  return app;
}

describe('Olympiad Organisers routes', () => {
  let app;

  beforeEach(() => {
    vi.spyOn(prisma.olympiad, 'findUnique');
    vi.spyOn(prisma.olympiadOrganiser, 'findMany');
    vi.spyOn(prisma.olympiadOrganiser, 'findUnique');
    vi.spyOn(prisma.olympiadOrganiser, 'create');
    vi.spyOn(prisma.olympiadOrganiser, 'delete');
    vi.spyOn(prisma.user, 'findMany');
    vi.spyOn(prisma.user, 'findUnique');
    vi.spyOn(console, 'error').mockImplementation(() => {});

    // Default: authenticated user is an organiser
    prisma.user.findUnique.mockResolvedValue({
      id: 'organiser-1',
      email: 'organiser@olympiad.com',
      role: 'organiser',
      name: 'Organiser One',
    });

    app = createApp();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /api/organisers', () => {
    it('returns all organiser-role users', async () => {
      prisma.user.findMany.mockResolvedValue([
        { id: 'organiser-1', name: 'Org One', email: 'org1@test.com' },
        { id: 'organiser-2', name: 'Org Two', email: 'org2@test.com' },
      ]);

      const res = await request(app).get('/api/organisers');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].name).toBe('Org One');
    });

    it('returns 403 when user is not an organiser', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'educator-1',
        email: 'edu@school.com',
        role: 'educator',
        name: 'Educator',
      });

      const res = await request(app).get('/api/organisers');
      expect(res.status).toBe(403);
    });

    it('returns 401 when not authenticated', async () => {
      const unauthApp = createApp(false);
      const res = await request(unauthApp).get('/api/organisers');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/olympiads/:id/organisers', () => {
    it('returns organisers for an olympiad', async () => {
      // User is an organiser of this olympiad
      prisma.olympiadOrganiser.findUnique.mockResolvedValue({
        id: 'oo-1',
        olympiadId: 'oly-1',
        organiserId: 'organiser-1',
      });
      prisma.olympiadOrganiser.findMany.mockResolvedValue([
        {
          id: 'oo-1',
          organiserId: 'organiser-1',
          addedAt: new Date(),
          organiser: { id: 'organiser-1', name: 'Org One', email: 'org1@test.com' },
        },
        {
          id: 'oo-2',
          organiserId: 'organiser-2',
          addedAt: new Date(),
          organiser: { id: 'organiser-2', name: 'Org Two', email: 'org2@test.com' },
        },
      ]);
      prisma.olympiad.findUnique.mockResolvedValue({ organiserId: 'organiser-1' });

      const res = await request(app).get('/api/olympiads/oly-1/organisers');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].isCreator).toBe(true);
      expect(res.body[1].isCreator).toBe(false);
    });

    it('returns 403 when user is not an organiser of the olympiad', async () => {
      prisma.olympiadOrganiser.findUnique.mockResolvedValue(null);

      const res = await request(app).get('/api/olympiads/oly-1/organisers');
      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/not an organiser/);
    });
  });

  describe('POST /api/olympiads/:id/organisers', () => {
    it('adds an organiser to the olympiad', async () => {
      // User is an organiser of this olympiad
      prisma.olympiadOrganiser.findUnique.mockResolvedValue(null); // not already added
      prisma.olympiad.findUnique.mockResolvedValue({ id: 'oly-1', organiserId: 'organiser-1' });
      prisma.user.findUnique
        .mockResolvedValueOnce({
          id: 'organiser-1',
          email: 'organiser@olympiad.com',
          role: 'organiser',
          name: 'Organiser One',
        }) // loadAuthUser
        .mockResolvedValueOnce({
          id: 'organiser-2',
          email: 'org2@test.com',
          role: 'organiser',
          name: 'Org Two',
        }); // target user

      // First call is the membership check, second is the duplicate check
      prisma.olympiadOrganiser.findUnique
        .mockResolvedValueOnce({
          id: 'oo-1',
          olympiadId: 'oly-1',
          organiserId: 'organiser-1',
        }) // membership check
        .mockResolvedValueOnce(null); // duplicate check

      prisma.olympiadOrganiser.create.mockResolvedValue({
        id: 'oo-new',
        olympiadId: 'oly-1',
        organiserId: 'organiser-2',
        addedAt: new Date(),
      });

      const res = await request(app)
        .post('/api/olympiads/oly-1/organisers')
        .send({ organiserId: 'organiser-2' });

      expect(res.status).toBe(201);
      expect(res.body.organiserId).toBe('organiser-2');
      expect(prisma.olympiadOrganiser.create).toHaveBeenCalled();
    });

    it('returns 400 when organiserId is missing', async () => {
      const res = await request(app).post('/api/olympiads/oly-1/organisers').send({});
      expect(res.status).toBe(400);
    });

    it('returns 403 when caller is not an organiser of the olympiad', async () => {
      prisma.olympiadOrganiser.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .post('/api/olympiads/oly-1/organisers')
        .send({ organiserId: 'organiser-2' });
      expect(res.status).toBe(403);
    });

    it('returns 400 when target user is not an organiser', async () => {
      prisma.olympiadOrganiser.findUnique.mockResolvedValueOnce({
        id: 'oo-1',
        olympiadId: 'oly-1',
        organiserId: 'organiser-1',
      }); // membership check
      prisma.olympiad.findUnique.mockResolvedValue({ id: 'oly-1' });
      prisma.user.findUnique
        .mockResolvedValueOnce({
          id: 'organiser-1',
          role: 'organiser',
          name: 'Org',
          email: 'org@test.com',
        }) // loadAuthUser
        .mockResolvedValueOnce({
          id: 'educator-1',
          role: 'educator',
          name: 'Edu',
          email: 'edu@test.com',
        }); // target user

      const res = await request(app)
        .post('/api/olympiads/oly-1/organisers')
        .send({ organiserId: 'educator-1' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/not an organiser/);
    });

    it('returns 409 when user is already an organiser of the olympiad', async () => {
      prisma.olympiadOrganiser.findUnique
        .mockResolvedValueOnce({
          id: 'oo-1',
          olympiadId: 'oly-1',
          organiserId: 'organiser-1',
        }) // membership check
        .mockResolvedValueOnce({
          id: 'oo-existing',
          olympiadId: 'oly-1',
          organiserId: 'organiser-2',
        }); // duplicate check
      prisma.olympiad.findUnique.mockResolvedValue({ id: 'oly-1' });
      prisma.user.findUnique
        .mockResolvedValueOnce({
          id: 'organiser-1',
          role: 'organiser',
          name: 'Org',
          email: 'org@test.com',
        })
        .mockResolvedValueOnce({
          id: 'organiser-2',
          role: 'organiser',
          name: 'Org2',
          email: 'org2@test.com',
        });

      const res = await request(app)
        .post('/api/olympiads/oly-1/organisers')
        .send({ organiserId: 'organiser-2' });
      expect(res.status).toBe(409);
    });
  });

  describe('DELETE /api/olympiads/:id/organisers/:organiserId', () => {
    it('removes a co-organiser when caller is the creator', async () => {
      prisma.olympiad.findUnique.mockResolvedValue({ organiserId: 'organiser-1' });
      prisma.olympiadOrganiser.findUnique.mockResolvedValue({
        id: 'oo-2',
        olympiadId: 'oly-1',
        organiserId: 'organiser-2',
      });
      prisma.olympiadOrganiser.delete.mockResolvedValue({});

      const res = await request(app).delete('/api/olympiads/oly-1/organisers/organiser-2');
      expect(res.status).toBe(204);
      expect(prisma.olympiadOrganiser.delete).toHaveBeenCalled();
    });

    it('prevents removing the creator', async () => {
      prisma.olympiad.findUnique.mockResolvedValue({ organiserId: 'organiser-1' });

      const res = await request(app).delete('/api/olympiads/oly-1/organisers/organiser-1');
      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/creator/);
    });

    it('returns 403 when caller is not the creator', async () => {
      prisma.olympiad.findUnique.mockResolvedValue({ organiserId: 'organiser-other' });

      const res = await request(app).delete('/api/olympiads/oly-1/organisers/organiser-2');
      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/creator/i);
    });

    it('returns 404 when target organiser is not found', async () => {
      prisma.olympiad.findUnique.mockResolvedValue({ organiserId: 'organiser-1' });
      prisma.olympiadOrganiser.findUnique.mockResolvedValue(null);

      const res = await request(app).delete('/api/olympiads/oly-1/organisers/organiser-2');
      expect(res.status).toBe(404);
    });
  });
});
