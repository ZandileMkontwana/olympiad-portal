import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ApiError,
  createOlympiad,
  createRound,
  listOlympiadRounds,
  listRounds,
  getRound,
  uploadPaper,
  fetchArchivedPapers,
  fetchCurrentUser,
  listSchoolEntrants,
  createEntrant,
  registerRoundEntrant,
  submitSitting,
  listSchools,
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
    it('sends multipart form data with Bearer token', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 201,
        json: () => Promise.resolve({ id: 'paper-1' }),
      });
      const paperFile = new File(['content'], 'paper.pdf');
      const memoFile = new File(['content'], 'memo.pdf');
      const result = await uploadPaper('round-1', { paperFile, memoFile }, 'test-token');
      expect(result).toEqual({ id: 'paper-1' });
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:5000/api/rounds/round-1/papers',
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
          headers: { Authorization: 'Bearer test-token' },
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
      await uploadPaper(
        'round-1',
        {
          paperFile,
          memoFile,
          memoAnswers: { q1: 'A' },
        },
        'test-token'
      );
      // The body should be a FormData object
      const callArgs = fetchMock.mock.calls[0];
      expect(callArgs[1].body).toBeInstanceOf(FormData);
    });

    it('throws ApiError on network failure', async () => {
      fetchMock.mockRejectedValue(new Error('Network'));
      try {
        await uploadPaper('round-1', { paperFile: new File(['c'], 'p.pdf') }, 'test-token');
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
        await uploadPaper('round-1', { paperFile: new File(['c'], 'p.pdf') }, 'test-token');
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err.message).toBe('Missing files');
        expect(err.status).toBe(400);
      }
    });
  });

  describe('fetchCurrentUser', () => {
    it('returns user on success with Bearer token', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ user: { id: '1', email: 'a@b.com' } }),
      });
      const user = await fetchCurrentUser('test-token');
      expect(user).toEqual({ id: '1', email: 'a@b.com' });
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:5000/api/auth/me',
        expect.objectContaining({
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-token',
          },
        })
      );
    });

    it('returns null when no token provided', async () => {
      const user = await fetchCurrentUser();
      expect(user).toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('returns null on error response', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: 'Unauthorized' }),
      });
      const user = await fetchCurrentUser('test-token');
      expect(user).toBeNull();
    });

    it('returns null on network failure', async () => {
      fetchMock.mockRejectedValue(new Error('Network'));
      const user = await fetchCurrentUser('test-token');
      expect(user).toBeNull();
    });
  });

  describe('fetchArchivedPapers', () => {
    it('sends GET to correct archive path', async () => {
      const archiveData = [{ id: 'p1', roundName: 'Round 1', olympiadName: 'Maths' }];
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(archiveData),
      });
      const result = await fetchArchivedPapers();
      expect(result).toEqual(archiveData);
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:5000/api/papers/archive',
        expect.objectContaining({
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });

    it('returns empty array when no papers are archived', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve([]),
      });
      const result = await fetchArchivedPapers();
      expect(result).toEqual([]);
    });

    it('throws ApiError on network failure', async () => {
      fetchMock.mockRejectedValue(new Error('Network'));
      try {
        await fetchArchivedPapers();
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect(err.status).toBe(0);
      }
    });

    it('throws ApiError on non-2xx response', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Failed to fetch archived papers' }),
      });
      try {
        await fetchArchivedPapers();
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect(err.message).toBe('Failed to fetch archived papers');
        expect(err.status).toBe(500);
      }
    });
  });

  describe('listSchoolEntrants', () => {
    it('sends GET to /api/entrants with Bearer token', async () => {
      const entrants = [{ id: 'e1', name: 'Alice', grade: '10', schoolId: 's1' }];
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(entrants),
      });
      const result = await listSchoolEntrants('test-token');
      expect(result).toEqual(entrants);
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:5000/api/entrants',
        expect.objectContaining({
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-token',
          },
        })
      );
    });
  });

  describe('createEntrant', () => {
    it('sends POST with correct body and Bearer token', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 201,
        json: () => Promise.resolve({ id: 'e1', name: 'Alice', grade: '10' }),
      });
      const result = await createEntrant({ name: 'Alice', grade: '10' }, 'test-token');
      expect(result.id).toBe('e1');
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:5000/api/entrants',
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-token',
          },
          body: JSON.stringify({ name: 'Alice', grade: '10' }),
        })
      );
    });

    it('throws ApiError when the school link is missing', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 403,
        json: () => Promise.resolve({ error: 'No school linked to this account' }),
      });
      try {
        await createEntrant({ name: 'Alice', grade: '10' }, 'test-token');
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect(err.status).toBe(403);
        expect(err.message).toBe('No school linked to this account');
      }
    });
  });

  describe('registerRoundEntrant', () => {
    it('sends POST to the round entrants path with Bearer token', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 201,
        json: () => Promise.resolve({ id: 're1', roundId: 'round-1', entrantId: 'e1' }),
      });
      const result = await registerRoundEntrant('round-1', 'e1', 'test-token');
      expect(result.roundId).toBe('round-1');
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:5000/api/rounds/round-1/entrants',
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-token',
          },
          body: JSON.stringify({ entrantId: 'e1' }),
        })
      );
    });

    it('throws ApiError on duplicate registration', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 409,
        json: () => Promise.resolve({ error: 'Entrant is already registered for this round' }),
      });
      try {
        await registerRoundEntrant('round-1', 'e1', 'test-token');
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err.status).toBe(409);
        expect(err.message).toMatch(/already registered/);
      }
    });
  });

  describe('submitSitting', () => {
    it('sends POST to the sitting submit path with Bearer token', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 201,
        json: () => Promise.resolve({ submission: { id: 'sub-1' }, result: { score: 100 } }),
      });

      const result = await submitSitting('sitting-1', 'test-token');

      expect(result.submission.id).toBe('sub-1');
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:5000/api/sittings/sitting-1/submit',
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-token',
          },
        })
      );
    });
  });

  describe('listSchools', () => {
    it('fetches the school list from /api/schools', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve([
          { id: 'school-1', name: 'Alpha School' },
          { id: 'school-2', name: 'Beta School' },
        ]),
      });

      const result = await listSchools();

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Alpha School');
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:5000/api/schools',
        expect.objectContaining({ credentials: 'include' })
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

    it('returns /student for student role', () => {
      expect(dashboardPathForRole('student')).toBe('/student');
    });

    it('returns /login for unknown role', () => {
      expect(dashboardPathForRole('unknown')).toBe('/login');
    });

    it('returns /login for undefined role', () => {
      expect(dashboardPathForRole(undefined)).toBe('/login');
    });
  });
});
