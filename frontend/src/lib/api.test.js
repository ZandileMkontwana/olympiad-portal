import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ApiError,
  listOlympiads,
  createOlympiad,
  updateOlympiad,
  requestOlympiadAccess,
  fetchAccessRequests,
  approveAccessRequest,
  declineAccessRequest,
  createRound,
  listOlympiadRounds,
  listRounds,
  getRound,
  uploadPaper,
  fetchArchivedPapers,
  fetchCurrentUser,
  listSchoolEntrants,
  createEntrant,
  resendEntrantInvite,
  deleteEntrant,
  registerRoundEntrant,
  submitSitting,
  studentLogin,
  setStudentPassword,
  fetchMySittings,
  fetchMyResults,
  fetchMyResult,
  fetchMyRounds,
  fetchSchoolDashboard,
  fetchStandings,
  getSchoolStandings,
  fetchNotificationRules,
  updateNotificationRule,
  testNotificationTrigger,
  assignRemarkRequest,
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

  describe('listOlympiads', () => {
    it('sends GET without an Authorization header when no token is given', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve([]),
      });
      await listOlympiads();
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:5000/api/olympiads',
        expect.objectContaining({ headers: { 'Content-Type': 'application/json' } })
      );
    });

    it('attaches the Bearer token so organisers only see their own olympiads', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve([]),
      });
      await listOlympiads('org-token');
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:5000/api/olympiads',
        expect.objectContaining({
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer org-token',
          },
        })
      );
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

    it('attaches the Bearer token so the organiser becomes the owner', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 201,
        json: () => Promise.resolve({ id: '1' }),
      });
      await createOlympiad({ name: 'Test', timezone: 'UTC' }, 'org-token');
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:5000/api/olympiads',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer org-token',
          },
        })
      );
    });

    it('sends the info fields in the body', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 201,
        json: () => Promise.resolve({ id: '1' }),
      });
      await createOlympiad({
        name: 'Test',
        timezone: 'UTC',
        description: 'A maths olympiad',
        grades: 'Grade 8–12',
        startDate: '2026-02-01',
        endDate: '2026-03-01',
      });
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:5000/api/olympiads',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            name: 'Test',
            timezone: 'UTC',
            description: 'A maths olympiad',
            grades: 'Grade 8–12',
            startDate: '2026-02-01',
            endDate: '2026-03-01',
          }),
        })
      );
    });
  });

  describe('updateOlympiad', () => {
    it('sends PUT with Bearer token and JSON body', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ id: 'olympiad-1', name: 'New' }),
      });

      const result = await updateOlympiad(
        'olympiad-1',
        { name: 'New', description: 'A maths olympiad' },
        'test-token'
      );

      expect(result.name).toBe('New');
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:5000/api/olympiads/olympiad-1',
        expect.objectContaining({
          method: 'PUT',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-token' },
          body: JSON.stringify({ name: 'New', description: 'A maths olympiad' }),
        })
      );
    });
  });

  describe('requestOlympiadAccess', () => {
    it('sends POST to /api/olympiads/:id/request-access with Bearer token', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 201,
        json: () => Promise.resolve({ status: 'pending' }),
      });

      const result = await requestOlympiadAccess('olympiad-1', 'test-token');

      expect(result.status).toBe('pending');
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:5000/api/olympiads/olympiad-1/request-access',
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-token' },
        })
      );
    });
  });

  describe('fetchAccessRequests', () => {
    it('sends GET to /api/olympiads/access-requests with Bearer token', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve([
            {
              id: 'so-1',
              school: { id: 'school-1', name: 'Test School' },
              olympiad: { id: 'olympiad-1', name: 'Maths Olympiad' },
              requestedBy: { id: 'user-1', name: 'Teacher One', email: 'teacher@school.com' },
              requestedAt: '2026-02-01T10:00:00.000Z',
            },
          ]),
      });

      const result = await fetchAccessRequests('test-token');

      expect(result[0].school.name).toBe('Test School');
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:5000/api/olympiads/access-requests',
        expect.objectContaining({
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-token' },
        })
      );
    });
  });

  describe('approveAccessRequest', () => {
    it('sends POST to /api/olympiads/access-requests/:id/approve with Bearer token', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ id: 'so-1', status: 'approved' }),
      });

      const result = await approveAccessRequest('so-1', 'test-token');

      expect(result.status).toBe('approved');
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:5000/api/olympiads/access-requests/so-1/approve',
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-token' },
        })
      );
    });
  });

  describe('declineAccessRequest', () => {
    it('sends POST to /api/olympiads/access-requests/:id/decline with Bearer token', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ id: 'so-1', status: 'declined' }),
      });

      const result = await declineAccessRequest('so-1', 'test-token');

      expect(result.status).toBe('declined');
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:5000/api/olympiads/access-requests/so-1/decline',
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-token' },
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

    it('defaults qualifyingThreshold to null when not provided', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 201,
        json: () => Promise.resolve({ id: '1' }),
      });
      await createRound({ olympiadId: '1', name: 'R1', openTime: '2026', closeTime: '2027' });
      const [, options] = fetchMock.mock.calls[0];
      expect(JSON.parse(options.body).qualifyingThreshold).toBeNull();
    });

    it('passes qualifyingThreshold through when provided', async () => {
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
        qualifyingThreshold: 70,
      });
      const [, options] = fetchMock.mock.calls[0];
      expect(JSON.parse(options.body).qualifyingThreshold).toBe(70);
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
    it('sends POST with name, email and grade and Bearer token', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 201,
        json: () =>
          Promise.resolve({
            id: 'e1',
            name: 'Alice',
            grade: '10',
            email: 'alice@school.com',
            accountStatus: 'invite_pending',
            invitationSent: true,
          }),
      });
      const result = await createEntrant(
        { name: 'Alice', email: 'alice@school.com', grade: '10' },
        'test-token'
      );
      expect(result.id).toBe('e1');
      expect(result.invitationSent).toBe(true);
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:5000/api/entrants',
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-token',
          },
          body: JSON.stringify({ name: 'Alice', email: 'alice@school.com', grade: '10' }),
        })
      );
    });

    it('throws ApiError when the email is already registered', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 409,
        json: () => Promise.resolve({ error: 'An account with this email already exists' }),
      });
      try {
        await createEntrant(
          { name: 'Alice', email: 'alice@school.com', grade: '10' },
          'test-token'
        );
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect(err.status).toBe(409);
        expect(err.message).toBe('An account with this email already exists');
      }
    });

    it('throws ApiError when the school link is missing', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 403,
        json: () => Promise.resolve({ error: 'No school linked to this account' }),
      });
      try {
        await createEntrant(
          { name: 'Alice', email: 'alice@school.com', grade: '10' },
          'test-token'
        );
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect(err.status).toBe(403);
        expect(err.message).toBe('No school linked to this account');
      }
    });
  });

  describe('resendEntrantInvite', () => {
    it('sends POST to the resend path with Bearer token', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ message: 'Invitation sent', invitationSent: true }),
      });

      const result = await resendEntrantInvite('e1', 'test-token');

      expect(result.invitationSent).toBe(true);
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:5000/api/entrants/e1/resend-invite',
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-token',
          },
          body: JSON.stringify({}),
        })
      );
    });

    it('passes the email in the body for legacy entrants without an account', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ message: 'Invitation sent', invitationSent: true }),
      });

      await resendEntrantInvite('e2', 'test-token', { email: 'legacy@school.com' });

      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:5000/api/entrants/e2/resend-invite',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ email: 'legacy@school.com' }),
        })
      );
    });
  });

  describe('deleteEntrant', () => {
    it('sends DELETE to the entrant path with Bearer token', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ message: 'Entrant removed' }),
      });

      const result = await deleteEntrant('e1', 'test-token');

      expect(result.message).toBe('Entrant removed');
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:5000/api/entrants/e1',
        expect.objectContaining({
          method: 'DELETE',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-token',
          },
        })
      );
    });

    it('throws ApiError when the entrant is not at the educator school', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: 'Entrant not found at your school' }),
      });

      try {
        await deleteEntrant('e99', 'test-token');
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect(err.status).toBe(404);
        expect(err.message).toBe('Entrant not found at your school');
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

  describe('studentLogin', () => {
    it('sends POST to /api/students/login with credentials', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            token: 'jwt-token',
            user: { id: 'user-1', email: 'student@school.com', role: 'student' },
          }),
      });

      const result = await studentLogin({ email: 'student@school.com', password: 'secret123' });

      expect(result.token).toBe('jwt-token');
      expect(result.user.role).toBe('student');
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:5000/api/students/login',
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'student@school.com', password: 'secret123' }),
        })
      );
    });

    it('throws ApiError with the backend message on invalid credentials', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: 'Invalid email or password' }),
      });

      try {
        await studentLogin({ email: 'student@school.com', password: 'wrong' });
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect(err.status).toBe(401);
        expect(err.message).toBe('Invalid email or password');
      }
    });
  });

  describe('setStudentPassword', () => {
    it('sends POST to /api/students/set-password with the invitation token', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            token: 'jwt-token',
            user: { id: 'user-1', email: 'student@school.com', role: 'student' },
          }),
      });

      const result = await setStudentPassword({ token: 'invite-token', password: 'newpass123' });

      expect(result.token).toBe('jwt-token');
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:5000/api/students/set-password',
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: 'invite-token', password: 'newpass123' }),
        })
      );
    });

    it('throws ApiError when the invitation token is invalid or expired', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: 'This invitation link is invalid or has expired' }),
      });

      try {
        await setStudentPassword({ token: 'bad-token', password: 'newpass123' });
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err.status).toBe(400);
        expect(err.message).toMatch(/invalid or has expired/i);
      }
    });
  });

  describe('fetchMySittings', () => {
    it('sends GET to /api/students/me/sittings with Bearer token', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve([{ id: 'sitting-1', round: { name: 'Round 1' } }]),
      });

      const result = await fetchMySittings('test-token');

      expect(result[0].id).toBe('sitting-1');
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:5000/api/students/me/sittings',
        expect.objectContaining({
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-token' },
        })
      );
    });
  });

  describe('fetchMyResults', () => {
    it('sends GET to /api/students/me/results with Bearer token', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve([{ id: 'result-1', score: 85 }]),
      });

      const result = await fetchMyResults('test-token');

      expect(result[0].score).toBe(85);
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:5000/api/students/me/results',
        expect.objectContaining({
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-token' },
        })
      );
    });
  });

  describe('fetchMyResult', () => {
    it('sends GET to /api/students/me/results/:id with Bearer token', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            id: 'result-1',
            score: 80,
            round: { id: 'round-1', name: 'Round 1' },
            questions: [
              { questionId: 'q1', correctAnswer: 'A', studentAnswer: 'A', isCorrect: true },
            ],
          }),
      });

      const result = await fetchMyResult('result-1', 'test-token');

      expect(result.score).toBe(80);
      expect(result.questions[0].isCorrect).toBe(true);
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:5000/api/students/me/results/result-1',
        expect.objectContaining({
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-token' },
        })
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

  describe('fetchMyRounds', () => {
    it('sends GET to /api/students/me/rounds with Bearer token', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve([{ round: { id: 'round-1' }, sitting: null }]),
      });

      const result = await fetchMyRounds('test-token');

      expect(result[0].round.id).toBe('round-1');
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:5000/api/students/me/rounds',
        expect.objectContaining({
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-token' },
        })
      );
    });
  });

  describe('fetchSchoolDashboard', () => {
    it('sends GET to /api/schools/:id/dashboard with Bearer token', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ school: { id: 'school-1' }, entrantCount: 3 }),
      });

      const result = await fetchSchoolDashboard('school-1', 'test-token');

      expect(result.entrantCount).toBe(3);
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:5000/api/schools/school-1/dashboard',
        expect.objectContaining({
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-token' },
        })
      );
    });
  });

  describe('fetchStandings', () => {
    it('sends GET to /api/rounds/:id/standings without a token', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve([{ rank: 1, entrantName: 'Alice', totalScore: 90 }]),
      });

      const result = await fetchStandings('round-1');

      expect(result[0].entrantName).toBe('Alice');
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:5000/api/rounds/round-1/standings',
        expect.objectContaining({
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });
  });

  describe('getSchoolStandings', () => {
    it('sends GET to /api/rounds/:id/standings/schools without a token', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve([{ rank: 1, schoolName: 'Testville High', totalScore: 250 }]),
      });

      const result = await getSchoolStandings('round-1');

      expect(result[0].schoolName).toBe('Testville High');
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:5000/api/rounds/round-1/standings/schools',
        expect.objectContaining({
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });
  });

  describe('fetchNotificationRules', () => {
    it('sends GET to /api/rounds/:id/notifications without a token', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve([{ triggerType: 'before-open', enabled: true }]),
      });

      const result = await fetchNotificationRules('round-1');

      expect(result[0].triggerType).toBe('before-open');
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:5000/api/rounds/round-1/notifications',
        expect.objectContaining({
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });
  });

  describe('updateNotificationRule', () => {
    it('sends PUT to /api/rounds/:id/notifications/:triggerType with Bearer token and JSON body', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ id: 'rule-1', triggerType: 'before-close', enabled: false }),
      });

      const result = await updateNotificationRule(
        'round-1',
        'before-close',
        { enabled: false },
        'test-token'
      );

      expect(result.enabled).toBe(false);
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:5000/api/rounds/round-1/notifications/before-close',
        expect.objectContaining({
          method: 'PUT',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-token' },
          body: JSON.stringify({ enabled: false }),
        })
      );
    });
  });

  describe('testNotificationTrigger', () => {
    it('sends POST to /api/rounds/:id/notifications/test with Bearer token and triggerType body', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ dryRun: true, recipients: [{ email: 'a@b.co' }] }),
      });

      const result = await testNotificationTrigger('round-1', 'results-released', 'test-token');

      expect(result.dryRun).toBe(true);
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:5000/api/rounds/round-1/notifications/test',
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-token' },
          body: JSON.stringify({ triggerType: 'results-released' }),
        })
      );
    });
  });

  describe('assignRemarkRequest', () => {
    it('sends PATCH to /api/remark/:id/assign with an empty body to self-assign', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({ id: 'remark-1', status: 'assigned', assignedToId: 'organiser-1' }),
      });

      const result = await assignRemarkRequest('remark-1', {}, 'test-token');

      expect(result.status).toBe('assigned');
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:5000/api/remark/remark-1/assign',
        expect.objectContaining({
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-token' },
          body: JSON.stringify({}),
        })
      );
    });

    it('passes assignedToId through so an appeal can be routed to another reviewer', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({ id: 'remark-1', status: 'assigned', assignedToId: 'organiser-2' }),
      });

      const result = await assignRemarkRequest(
        'remark-1',
        { assignedToId: 'organiser-2' },
        'test-token'
      );

      expect(result.assignedToId).toBe('organiser-2');
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:5000/api/remark/remark-1/assign',
        expect.objectContaining({
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-token' },
          body: JSON.stringify({ assignedToId: 'organiser-2' }),
        })
      );
    });
  });
});
