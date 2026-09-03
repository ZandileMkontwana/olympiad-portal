import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
const prisma = require('../lib/prisma');
const { requireAuth, requireRole } = require('./auth');

// The middleware is Clerk-based: it reads req.auth() (populated by
// clerkMiddleware()) and looks up the user's role in our database.

function makeReqRes(auth) {
  const req = auth ? { auth } : {};
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  };
  const next = vi.fn();
  return { req, res, next };
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
