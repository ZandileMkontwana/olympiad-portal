import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
const http = require('http');
const prisma = require('../lib/prisma');
const activityBus = require('../lib/activityBus');
const activityRouter = require('./activity');

function createApp(authenticated = true) {
  const app = express();
  app.use(express.json());
  if (authenticated) {
    app.use((req, _res, next) => {
      req.auth = () => ({ userId: 'clerk-user-1' });
      next();
    });
  }
  app.use('/api', activityRouter);
  return app;
}

// The stream never ends on its own, so supertest is no good for it — open a
// real socket, collect chunks until a predicate matches, then destroy.
function listen(app) {
  return new Promise((resolve) => {
    const server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

function collectStream(server, path, untilPredicate, onConnected, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const { port } = server.address();
    const chunks = [];
    const req = http.get({ host: '127.0.0.1', port, path }, (res) => {
      res.setEncoding('utf8');
      if (onConnected) onConnected();
      res.on('data', (chunk) => {
        chunks.push(chunk);
        if (untilPredicate(chunks.join(''))) {
          req.destroy();
          resolve({ headers: res.headers, body: chunks.join('') });
        }
      });
      // Destroying the request surfaces as a socket error — expected.
      res.on('error', () => {});
    });
    req.on('error', () => {});
    const timer = setTimeout(() => {
      req.destroy();
      reject(new Error(`stream timed out; received: ${chunks.join('')}`));
    }, timeoutMs);
    timer.unref();
  });
}

describe('GET /activity/stream', () => {
  let server;

  beforeEach(() => {
    activityBus.reset();
    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue({
      id: 'user-1',
      email: 'test@test.com',
      role: 'organiser',
      name: 'Organiser',
    });
  });

  afterEach(async () => {
    activityBus.reset();
    vi.restoreAllMocks();
    if (server) {
      await new Promise((resolve) => server.close(resolve));
      server = null;
    }
  });

  it('returns 401 when unauthenticated', async () => {
    const res = await request(createApp(false)).get('/api/activity/stream');
    expect(res.status).toBe(401);
  });

  it('returns 403 for a non-organiser', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'teach@test.com',
      role: 'educator',
      name: 'Educator',
    });

    const res = await request(createApp(true)).get('/api/activity/stream');
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('organiser access required');
  });

  it('sends SSE headers, a retry hint, catch-up history, then live events', async () => {
    activityBus.broadcast({ type: 'round_opened', message: 'seeded event' });

    server = await listen(createApp());
    const { body, headers } = await collectStream(
      server,
      '/api/activity/stream',
      // Wait until the live broadcast has also arrived.
      (text) => text.includes('live event'),
      // Once connected, broadcast a live event after the history frame.
      () => {
        setTimeout(() => {
          activityBus.broadcast({ type: 'submission_received', message: 'live event' });
        }, 25).unref();
      }
    );

    expect(headers['content-type']).toMatch(/^text\/event-stream/);
    expect(headers['cache-control']).toContain('no-cache');
    expect(body).toContain('retry: 5000');
    expect(body).toContain('event: history');
    expect(body).toContain('"message":"seeded event"');
    expect(body).toContain('"message":"live event"');
  });

  it('unsubscribes the stream when the client disconnects', async () => {
    server = await listen(createApp());
    const { body } = await collectStream(server, '/api/activity/stream', (text) =>
      text.includes('event: history')
    );
    expect(body).toContain('event: history');
    expect(activityBus.listenerCount()).toBe(1);

    // The collectStream helper destroyed its request once history arrived;
    // give the server a tick to fire the close handler.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(activityBus.listenerCount()).toBe(0);
  });
});
