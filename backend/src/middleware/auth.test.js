import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
const jwt = require('jsonwebtoken');
const { requireAuth, requireRole } = require('./auth');

describe('requireAuth', () => {
  let req, res, next;

  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret';
    req = { cookies: {} };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    next = vi.fn();
    vi.spyOn(jwt, 'verify');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 401 when no token is in cookies', () => {
    requireAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Not authenticated' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when jwt.verify throws', () => {
    req.cookies.token = 'invalid-token';
    jwt.verify.mockImplementation(() => {
      throw new Error('jwt malformed');
    });

    requireAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next and sets req.user when token is valid', () => {
    const decoded = { userId: '123', role: 'educator' };
    req.cookies.token = 'valid-token';
    jwt.verify.mockReturnValue(decoded);

    requireAuth(req, res, next);
    expect(jwt.verify).toHaveBeenCalledWith('valid-token', 'test-secret');
    expect(req.user).toEqual(decoded);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe('requireRole', () => {
  let req, res, next;

  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret';
    req = { cookies: {} };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    next = vi.fn();
    vi.spyOn(jwt, 'verify');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns an array of two middleware functions', () => {
    const middleware = requireRole('organiser');
    expect(Array.isArray(middleware)).toBe(true);
    expect(middleware).toHaveLength(2);
  });

  it('returns 401 via requireAuth when no token', () => {
    const [authMiddleware] = requireRole('organiser');
    authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 when user role does not match', () => {
    const [authMiddleware, roleMiddleware] = requireRole('organiser');
    req.cookies.token = 'valid-token';
    jwt.verify.mockReturnValue({ userId: '123', role: 'educator' });

    authMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();

    roleMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'organiser access required' });
  });

  it('calls next when user role matches', () => {
    const [authMiddleware, roleMiddleware] = requireRole('organiser');
    req.cookies.token = 'valid-token';
    jwt.verify.mockReturnValue({ userId: '123', role: 'organiser' });

    authMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();

    roleMiddleware(req, res, next);
    expect(next).toHaveBeenCalledTimes(2);
    expect(res.status).not.toHaveBeenCalled();
  });
});
