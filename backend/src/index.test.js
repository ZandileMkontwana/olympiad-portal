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
});
