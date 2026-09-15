import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import jwt from 'jsonwebtoken';
const prisma = require('../lib/prisma');
const { requireAuth, requireRole, loadAuthUser } = require('./auth');

// The middleware is dual-mode: a student JWT in the Authorization header
// (issued by POST /api/students/login) takes priority; otherwise it falls
// back to req.auth() (populated by clerkMiddleware()).

function makeReqRes(auth, headers = {}) {
  const req = auth ? { auth, headers } : { headers };
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  };
  const next = vi.fn();
  return { req, res, next };
}

function studentToken(sub = 'user-1') {
  return jwt.sign({ sub, role: 'student' }, 'test-secret');
}

describe('requireAuth', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 401 when req.auth is missing (clerkMiddleware not run)', () => {
    const { req, res, next } = makeReqRes(null);
    requireAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Not authenticated' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when auth has no userId (signed out)', () => {
    const { req, res, next } = makeReqRes(() => ({ userId: null }));
    requireAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Not authenticated' });
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next when auth has a userId', () => {
    const { req, res, next } = makeReqRes(() => ({ userId: 'clerk-user-1' }));
    requireAuth(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(req.authMode).toBe('clerk');
  });

  it('authenticates a valid student JWT from the Authorization header', () => {
    const { req, res, next } = makeReqRes(null, {
      authorization: `Bearer ${studentToken()}`,
    });
    requireAuth(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(req.authMode).toBe('jwt');
    expect(req.authUserId).toBe('user-1');
  });

  it('falls back to Clerk when the Bearer token is not our JWT', () => {
    const { req, res, next } = makeReqRes(() => ({ userId: 'clerk-user-1' }), {
      authorization: 'Bearer some-clerk-session-token',
    });
    requireAuth(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.authMode).toBe('clerk');
    expect(req.authUserId).toBe('clerk-user-1');
  });

  it('returns 401 when a Bearer JWT is invalid and there is no Clerk session', () => {
    const { req, res, next } = makeReqRes(null, {
      authorization: 'Bearer not-a-jwt',
    });
    requireAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('loadAuthUser', () => {
  beforeEach(() => {
    vi.spyOn(prisma.user, 'findUnique');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads a JWT-authenticated user by id', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1', role: 'student' });
    const { req } = makeReqRes(null, {
      authorization: `Bearer ${studentToken()}`,
    });
    requireAuth(
      req,
      () => {},
      () => {}
    );

    const user = await loadAuthUser(req);
    expect(user).toEqual({ id: 'user-1', role: 'student' });
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: 'user-1' } });
  });

  it('loads a Clerk-authenticated user by clerkUserId', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'user-2', role: 'educator' });
    const { req } = makeReqRes(() => ({ userId: 'clerk-user-1' }));
    requireAuth(
      req,
      () => {},
      () => {}
    );

    const user = await loadAuthUser(req);
    expect(user).toEqual({ id: 'user-2', role: 'educator' });
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { clerkUserId: 'clerk-user-1' } });
  });

  it('returns null when no auth mode was established', async () => {
    const user = await loadAuthUser({});
    expect(user).toBeNull();
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });
});

describe('requireRole with student JWTs', () => {
  beforeEach(() => {
    vi.spyOn(prisma.user, 'findUnique');
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('authorizes a student JWT without any Clerk session', async () => {
    const dbUser = { id: 'user-1', role: 'student', email: 's@school.com' };
    prisma.user.findUnique.mockResolvedValue(dbUser);
    const [authMiddleware, roleMiddleware] = requireRole('student');
    const { req, res, next } = makeReqRes(null, {
      authorization: `Bearer ${studentToken()}`,
    });

    authMiddleware(req, res, next);
    roleMiddleware(req, res, next);

    await vi.waitFor(() => {
      expect(next).toHaveBeenCalledTimes(2);
    });
    expect(req.user).toEqual(dbUser);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('rejects a JWT whose user has the wrong role', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1', role: 'educator' });
    const [authMiddleware, roleMiddleware] = requireRole('student');
    const { req, res, next } = makeReqRes(null, {
      authorization: `Bearer ${studentToken()}`,
    });

    authMiddleware(req, res, next);
    roleMiddleware(req, res, next);

    await vi.waitFor(() => {
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'student access required' });
    });
  });
});

describe('requireRole', () => {
  beforeEach(() => {
    vi.spyOn(prisma.user, 'findUnique');
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns an array of two middleware functions', () => {
    const middleware = requireRole('organiser');
    expect(Array.isArray(middleware)).toBe(true);
    expect(middleware).toHaveLength(2);
  });

  it('returns 401 via requireAuth when not authenticated', () => {
    const [authMiddleware] = requireRole('organiser');
    const { req, res, next } = makeReqRes(null);
    authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 404 when the Clerk user has no database record', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    const [authMiddleware, roleMiddleware] = requireRole('organiser');
    const { req, res, next } = makeReqRes(() => ({ userId: 'clerk-user-1' }));

    authMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();

    await roleMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'User not found' });
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { clerkUserId: 'clerk-user-1' },
    });
  });

  it('returns 403 when user role does not match', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1', role: 'educator' });
    const [authMiddleware, roleMiddleware] = requireRole('organiser');
    const { req, res, next } = makeReqRes(() => ({ userId: 'clerk-user-1' }));

    authMiddleware(req, res, next);
    roleMiddleware(req, res, next);

    await vi.waitFor(() => {
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'organiser access required' });
    });
    expect(next).toHaveBeenCalledTimes(1); // only requireAuth's next
  });

  it('calls next and sets req.user when user role matches', async () => {
    const dbUser = { id: 'user-1', role: 'organiser', email: 'o@test.com' };
    prisma.user.findUnique.mockResolvedValue(dbUser);
    const [authMiddleware, roleMiddleware] = requireRole('organiser');
    const { req, res, next } = makeReqRes(() => ({ userId: 'clerk-user-1' }));

    authMiddleware(req, res, next);
    roleMiddleware(req, res, next);

    await vi.waitFor(() => {
      expect(next).toHaveBeenCalledTimes(2);
    });
    expect(req.user).toEqual(dbUser);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 500 when the database lookup fails', async () => {
    prisma.user.findUnique.mockRejectedValue(new Error('DB error'));
    const [authMiddleware, roleMiddleware] = requireRole('organiser');
    const { req, res, next } = makeReqRes(() => ({ userId: 'clerk-user-1' }));

    authMiddleware(req, res, next);
    roleMiddleware(req, res, next);

    await vi.waitFor(() => {
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Authorization check failed' });
    });
  });
});
