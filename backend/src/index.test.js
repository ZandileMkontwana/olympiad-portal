import { describe, it, expect, vi } from 'vitest';

// Mock clerkMiddleware and Supabase createClient BEFORE loading index.js
const clerk = require('@clerk/express');
vi.spyOn(clerk, 'clerkMiddleware').mockReturnValue((req, res, next) => next());

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

const request = require('supertest');
const jwt = require('jsonwebtoken');
const prisma = require('./lib/prisma');
const app = require('./index');

describe('Express app (index.js)', () => {
  it('returns 404 for unknown routes', async () => {
    const res = await request(app).get('/nonexistent');
    expect(res.status).toBe(404);
  });

  it('has CORS headers', async () => {
    const res = await request(app).options('/api/rounds').set('Origin', 'http://localhost:3000');
    expect(res.headers['access-control-allow-origin']).toBeDefined();
  });

  it('serves /api routes (returns 404 for unknown /api paths)', async () => {
    const res = await request(app).get('/api/nonexistent');
    expect(res.status).toBe(404);
  });

  it('promotes an SSE query token to a Bearer header so the auth chain applies', async () => {
    // EventSource cannot set Authorization headers, so the activity feed's
    // token arrives as ?token= and must reach requireAuth regardless.
    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue({
      id: 'user-9',
      email: 'organiser@test.com',
      role: 'organiser',
      name: 'Organiser',
    });
    vi.spyOn(prisma.markingTask, 'findMany').mockResolvedValue([]);
    vi.spyOn(prisma.olympiadOrganiser, 'findMany').mockResolvedValue([]);

    const token = jwt.sign({ sub: 'user-9' }, process.env.JWT_SECRET);
    const res = await request(app).get(`/api/marking/queue?token=${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: 'user-9' } });
  });

  it('rejects requests without any token (query or header)', async () => {
    const res = await request(app).get('/api/marking/queue');
    expect(res.status).toBe(401);
  });
});
