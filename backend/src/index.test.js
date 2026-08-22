import { describe, it, expect } from 'vitest';
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
