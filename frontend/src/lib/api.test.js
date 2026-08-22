import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ApiError,
  createOlympiad,
  createRound,
  listOlympiadRounds,
  listRounds,
  getRound,
  uploadPaper,
  register,
  login,
  fetchCurrentUser,
  logout,
  dashboardPathForRole,
} from './api';

describe('api client', () => {
  let fetchMock;

  beforeEach(() => {
    fetchMock = vi.fn();
    global.fetch = fetchMock;
    process.env.NEXT_PUBLIC_API_BASE_URL = 'http://localhost:5000';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('requestJson (via exported functions)', () => {
    it('returns parsed JSON on success', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ id: '1', name: 'Test' }),
      });

      const result = await listRounds();
      expect(result).toEqual({ id: '1', name: 'Test' });
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:5000/api/rounds',
        expect.objectContaining({
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });

    it('throws ApiError on network failure', async () => {
      fetchMock.mockRejectedValue(new Error('Network error'));

      try {
        await listRounds();
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect(err.status).toBe(0);
        expect(err.message).toMatch(/Could not reach/);
      }
    });

    it('throws ApiError on non-2xx response with error field', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: 'Not found' }),
      });

      try {
        await getRound('123');
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect(err.message).toBe('Not found');
        expect(err.status).toBe(404);
      }
    });

    it('throws ApiError with generic message when no error field', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({}),
      });

      try {
        await listRounds();
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err.message).toBe('Request failed with status 500');
        expect(err.status).toBe(500);
      }
    });

    it('handles non-JSON response bodies', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 502,
        json: () => Promise.reject(new Error('Not JSON')),
      });

      try {
        await listRounds();
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err.message).toBe('Request failed with status 502');
      }
    });
  });

  describe('createOlympiad', () => {
    it('sends POST with correct body', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 201,
        json: () => Promise.resolve({ id: '1' }),
      });
      await createOlympiad({ name: 'Test', timezone: 'UTC' });
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:5000/api/olympiads',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ name: 'Test', timezone: 'UTC' }),
        })
      );
    });
  });

  describe('createRound', () => {
    it('sends POST with correct body', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 201,
        json: () => Promise.resolve({ id: '1' }),
      });
      await createRound({
        olympiadId: '1',
        name: 'R1',
        openTime: '2026',
        closeTime: '2027',
      });
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:5000/api/rounds',
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  describe('listOlympiadRounds', () => {
    it('sends GET with correct path', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve([]),
      });
      await listOlympiadRounds('olympiad-1');
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:5000/api/olympiads/olympiad-1/rounds',
        expect.any(Object)
      );
    });
  });

  describe('getRound', () => {
    it('sends GET with correct path', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ id: '1' }),
      });
      await getRound('round-1');
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:5000/api/rounds/round-1',
        expect.any(Object)
      );
    });
  });

  describe('uploadPaper', () => {
    it('sends multipart form data', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 201,
        json: () => Promise.resolve({ id: 'paper-1' }),
      });
      const paperFile = new File(['content'], 'paper.pdf');
      const memoFile = new File(['content'], 'memo.pdf');
      const result = await uploadPaper('round-1', { paperFile, memoFile });
      expect(result).toEqual({ id: 'paper-1' });
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:5000/api/rounds/round-1/papers',
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
        })
      );
    });

    it('appends memoAnswers as JSON when provided', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 201,
        json: () => Promise.resolve({ id: 'paper-1' }),
      });
      const paperFile = new File(['content'], 'paper.pdf');
      const memoFile = new File(['content'], 'memo.pdf');
      await uploadPaper('round-1', {
        paperFile,
        memoFile,
        memoAnswers: { q1: 'A' },
      });
      // The body should be a FormData object
      const callArgs = fetchMock.mock.calls[0];
      expect(callArgs[1].body).toBeInstanceOf(FormData);
    });

    it('throws ApiError on network failure', async () => {
      fetchMock.mockRejectedValue(new Error('Network'));
      try {
        await uploadPaper('round-1', { paperFile: new File(['c'], 'p.pdf') });
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
      }
    });

    it('throws ApiError on non-2xx', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: 'Missing files' }),
      });
      try {
        await uploadPaper('round-1', { paperFile: new File(['c'], 'p.pdf') });
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err.message).toBe('Missing files');
        expect(err.status).toBe(400);
      }
    });
  });

  describe('register', () => {
    it('sends POST with email and password', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 201,
        json: () => Promise.resolve({ user: {} }),
      });
      await register({ email: 'a@b.com', password: 'pass' });
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:5000/api/auth/register',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ email: 'a@b.com', password: 'pass' }),
        })
      );
    });
  });

  describe('login', () => {
    it('sends POST with email and password', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ user: {} }),
      });
      await login({ email: 'a@b.com', password: 'pass' });
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:5000/api/auth/login',
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  describe('fetchCurrentUser', () => {
    it('returns user on success', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ user: { id: '1', email: 'a@b.com' } }),
      });
      const user = await fetchCurrentUser();
      expect(user).toEqual({ id: '1', email: 'a@b.com' });
    });

    it('returns null on error response', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: 'Unauthorized' }),
      });
      const user = await fetchCurrentUser();
      expect(user).toBeNull();
    });

    it('returns null on network failure', async () => {
      fetchMock.mockRejectedValue(new Error('Network'));
      const user = await fetchCurrentUser();
      expect(user).toBeNull();
    });
  });

  describe('logout', () => {
    it('sends POST to logout endpoint', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ message: 'ok' }),
      });
      await logout();
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:5000/api/auth/logout',
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  describe('dashboardPathForRole', () => {
    it('returns /organiser for organiser role', () => {
      expect(dashboardPathForRole('organiser')).toBe('/organiser');
    });

    it('returns /educator for educator role', () => {
      expect(dashboardPathForRole('educator')).toBe('/educator');
    });

    it('returns /login for unknown role', () => {
      expect(dashboardPathForRole('unknown')).toBe('/login');
    });

    it('returns /login for undefined role', () => {
      expect(dashboardPathForRole(undefined)).toBe('/login');
    });
  });
});
