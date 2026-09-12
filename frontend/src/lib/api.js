// Shared API client for the organiser console.

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000';

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/**
 * Shared JSON request helper — handles network failures, non-JSON error
 * bodies, and non-2xx responses the same way everywhere they're called.
 */
async function requestJson(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
  } catch (networkError) {
    throw new ApiError('Could not reach the server. Is the backend running on :5000?', 0);
  }

  let data = null;
  try {
    data = await response.json();
  } catch {
    // Response wasn't JSON — fall through to response.ok check below.
  }

  if (!response.ok) {
    const message = (data && data.error) || `Request failed with status ${response.status}`;
    throw new ApiError(message, response.status);
  }

  return data;
}

export function listOlympiads() {
  return requestJson('/api/olympiads');
}

export function createOlympiad({ name, timezone }) {
  return requestJson('/api/olympiads', {
    method: 'POST',
    body: JSON.stringify({ name, timezone }),
  });
}

export function createRound({ olympiadId, name, openTime, closeTime }) {
  return requestJson('/api/rounds', {
    method: 'POST',
    body: JSON.stringify({ olympiadId, name, openTime, closeTime }),
  });
}

export function listOlympiadRounds(olympiadId) {
  return requestJson(`/api/olympiads/${olympiadId}/rounds`);
}

export function listRounds() {
  return requestJson('/api/rounds');
}

/**
 * Fetches all papers from closed or released rounds.
 * Wired to GET /api/papers/archive (backend/src/routes/papers.js).
 *
 * @returns {Promise<Array<{
 *   id: string,
 *   roundId: string,
 *   roundName: string,
 *   olympiadName: string,
 *   closeTime: string,
 *   fileUrl: string,
 *   memoUrl: string|null,
 *   uploadedAt: string,
 * }>>}
 */
export function fetchArchivedPapers() {
  return requestJson('/api/papers/archive');
}

/**
 * Lists every school registered on the platform (id + name only).
 * Wired to GET /api/schools (backend/src/routes/schools.js).
 * Used by the student registration form so students pick their school
 * from a list instead of guessing the exact spelling their educator used.
 *
 * @returns {Promise<Array<{id: string, name: string}>>}
 */
export function listSchools() {
  return requestJson('/api/schools');
}

/**
 * Fetches the entrants registered for a round.
 * Wired to GET /api/rounds/:id/entrants (backend/src/routes/rounds.js).
 *
 * @param {string} roundId
 * @returns {Promise<Array<{id: string, name: string, grade: string, schoolId: string}>>}
 */
export function fetchRoundEntrants(roundId) {
  return requestJson(`/api/rounds/${roundId}/entrants`);
}

/**
 * Lists the students (entrants) registered at the signed-in educator's school.
 * Wired to GET /api/entrants (backend/src/routes/entrants.js).
 *
 * @param {string} token - Clerk JWT for the Authorization header
 * @returns {Promise<Array<{id: string, name: string, grade: string, schoolId: string}>>}
 */
export function listSchoolEntrants(token) {
  return requestJson('/api/entrants', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

/**
 * Adds a student (entrant) to the signed-in educator's school.
 * Wired to POST /api/entrants (backend/src/routes/entrants.js).
 *
 * @param {{name: string, grade: string}} entrant
 * @param {string} token - Clerk JWT for the Authorization header
 * @returns {Promise<{id: string, name: string, grade: string, schoolId: string}>}
 */
export function createEntrant({ name, grade }, token) {
  return requestJson('/api/entrants', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name, grade }),
  });
}

/**
 * Registers one of the educator's own students to sit a round.
 * Wired to POST /api/rounds/:id/entrants (backend/src/routes/rounds.js).
 * Only accepted while the round is scheduled or open.
 *
 * @param {string} roundId
 * @param {string} entrantId
 * @param {string} token - Clerk JWT for the Authorization header
 * @returns {Promise<{id: string, roundId: string, entrantId: string, registeredAt: string}>}
 */
export function registerRoundEntrant(roundId, entrantId, token) {
  return requestJson(`/api/rounds/${roundId}/entrants`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ entrantId }),
  });
}

/**
 * Starts (or resumes) an online sitting for an entrant in an open round.
 * Wired to POST /api/rounds/:id/sittings (backend/src/routes/sittings.js).
 * The response includes the paper URL and question IDs, but never the
 * memo answer key.
 *
 * @param {string} roundId
 * @param {string} entrantId
 * @param {string} token - Clerk JWT for the Authorization header
 * @returns {Promise<{
 *   sitting: { id: string, entrantId: string, roundId: string, answers: object|null, startedAt: string, expiresAt: string, completedAt: string|null },
 *   round: { id: string, name: string, closeTime: string },
 *   paper: { fileUrl: string, questions: string[] },
 * }>}
 */
export function createSitting(roundId, entrantId, token) {
  return requestJson(`/api/rounds/${roundId}/sittings`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ entrantId }),
  });
}

/**
 * Auto-saves answers for an in-progress sitting (Story A3).
 * Wired to PATCH /api/sittings/:id/answers (backend/src/routes/sittings.js).
 * The backend merges these answers into whatever is already stored.
 *
 * @param {string} sittingId
 * @param {Record<string, string>} answers
 * @param {string} token - Clerk JWT for the Authorization header
 */
export function saveSittingAnswers(sittingId, answers, token) {
  return requestJson(`/api/sittings/${sittingId}/answers`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ answers }),
  });
}

/**
 * Submits a completed sitting for marking (Story A5).
 * Wired to POST /api/sittings/:id/submit (backend/src/routes/sittings.js).
 * The backend converts the sitting's stored answers into a Submission
 * (automarked when the paper has a memo answer key) and completes the
 * sitting. Retrying after a lost response returns the existing submission.
 *
 * @param {string} sittingId
 * @param {string} token - Clerk JWT for the Authorization header
 * @returns {Promise<{submission: object, result: object|null}>}
 */
export function submitSitting(sittingId, token) {
  return requestJson(`/api/sittings/${sittingId}/submit`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}
/**
 * Fetches a single round by id.
 * Wired to GET /api/rounds/:id (backend/src/routes/rounds.js).
 *
 * @param {string} roundId
 * @returns {Promise<import('../../../shared/types').Round>}
 */
export function getRound(roundId) {
  return requestJson(`/api/rounds/${roundId}`);
}
export async function uploadPaper(roundId, { paperFile, memoFile, memoAnswers }, token) {
  const formData = new FormData();
  formData.append('paper', paperFile);
  if (memoFile) {
    formData.append('memo', memoFile);
  }
  if (memoAnswers && Object.keys(memoAnswers).length > 0) {
    formData.append('memoAnswers', JSON.stringify(memoAnswers));
  }

  const headers = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(`${API_BASE_URL}/api/rounds/${roundId}/papers`, {
      method: 'POST',
      credentials: 'include',
      headers,
      body: formData,
    });
  } catch (networkError) {
    throw new ApiError('Could not reach the server. Is the backend running on :5000?', 0);
  }

  let data = null;
  try {
    data = await response.json();
  } catch {
    // Response wasn't JSON — fall through to response.ok check below.
  }

  if (!response.ok) {
    const message = (data && data.error) || `Upload failed with status ${response.status}`;
    throw new ApiError(message, response.status);
  }

  return data;
}

export async function fetchCurrentUser(token) {
  if (!token) return null;
  try {
    const data = await requestJson('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    return data.user;
  } catch {
    return null;
  }
}

export function dashboardPathForRole(role) {
  if (role === 'organiser') return '/organiser'; // TODO: confirm real path
  if (role === 'educator') return '/educator';
  if (role === 'student') return '/student';
  return '/login';
}
