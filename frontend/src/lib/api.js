// Shared API client for the organiser console.

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000';

// Retry policy for transient failures (network errors and 5xx responses).
// 4xx client errors are never retried — they indicate a permanent problem
// (bad request, auth failure, etc.) that retrying won't fix.
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 500;

export class ApiError extends Error {
  constructor(message, status, attempts = 1) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.attempts = attempts;
  }
}

/**
 * Shared JSON request helper — handles network failures, non-JSON error
 * bodies, and non-2xx responses the same way everywhere they're called.
 * Retries up to MAX_RETRIES times on transient failures (network errors
 * and 5xx responses) with exponential backoff.
 */
async function requestJson(path, options = {}) {
  let lastError;
  let attempts = 0;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    attempts = attempt + 1;
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
      // Network-level failure (DNS, connection refused, etc.)
      const isLastAttempt = attempt >= MAX_RETRIES - 1;
      const message = isLastAttempt
        ? 'The server is currently busy. Please try again in a few moments.'
        : 'Could not reach the server. Is the backend running on :5000?';
      lastError = new ApiError(message, 0, attempts);
      if (!isLastAttempt) {
        await delay(RETRY_BASE_DELAY_MS * Math.pow(2, attempt));
        continue;
      }
      throw lastError;
    }

    let data = null;
    try {
      data = await response.json();
    } catch {
      // Response wasn't JSON — fall through to response.ok check below.
    }

    if (!response.ok) {
      const isServerBusy = response.status >= 500 && attempt >= MAX_RETRIES - 1;
      const message = isServerBusy
        ? 'The server is currently busy. Please try again in a few moments.'
        : (data && data.error) || `Request failed with status ${response.status}`;
      lastError = new ApiError(message, response.status, attempts);

      // Retry on 5xx server errors — they're often transient (restarts,
      // overloaded instances, bad gateway from a reverse proxy).
      if (response.status >= 500 && attempt < MAX_RETRIES - 1) {
        await delay(retryDelay(response, attempt));
        continue;
      }

      throw lastError;
    }

    return data;
  }

  // Should be unreachable — every path either returns or throws inside the loop.
  throw lastError;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Returns the delay before the next retry attempt. If the server sent a
 * Retry-After header (RFC 7231 §7.1.3), that value is used — capped at
 * 30 seconds so a misbehaving server can't stall the client forever.
 * Otherwise falls back to exponential backoff.
 */
function retryDelay(response, attempt) {
  const MAX_DELAY_MS = 30_000;
  const retryAfterMs = parseRetryAfter(response.headers?.get?.('Retry-After'));
  if (retryAfterMs != null) {
    return Math.min(retryAfterMs, MAX_DELAY_MS);
  }
  return RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
}

/**
 * Parses a Retry-After header value into milliseconds. Supports both
 * formats from the spec: delay-seconds (e.g. "5") and HTTP-date
 * (e.g. "Fri, 31 Dec 1999 23:59:59 GMT"). Returns null if the header
 * is absent or unparseable.
 */
export function parseRetryAfter(value) {
  if (value == null) return null;

  // Plain integer = seconds to wait
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.round(seconds * 1000);
  }

  // HTTP-date format — Date.parse returns NaN on invalid input
  const dateMs = Date.parse(value);
  if (!Number.isNaN(dateMs)) {
    const delayMs = dateMs - Date.now();
    return delayMs >= 0 ? delayMs : 0;
  }

  return null;
}

/**
 * Lists olympiads with their rounds. Organisers only see the olympiads they
 * created, so their token must be attached; when an educator's Clerk token is
 * provided the backend also returns their school's access state and the
 * entrant count per school. Anonymous callers may call it without a token.
 * Wired to GET /api/olympiads (backend/src/routes/rounds.js).
 *
 * @param {string} [token] - Clerk JWT for the Authorization header
 */
export function listOlympiads(token) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  return requestJson('/api/olympiads', { headers });
}

/**
 * Creates an olympiad owned by the signed-in organiser.
 *
 * @param {{name: string, timezone: string, description?: string, grades?: string, startDate?: string, endDate?: string}} payload
 * @param {string} token - Clerk JWT for the Authorization header
 */
export function createOlympiad({ name, timezone, description, grades, startDate, endDate }, token) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  return requestJson('/api/olympiads', {
    method: 'POST',
    headers,
    body: JSON.stringify({ name, timezone, description, grades, startDate, endDate }),
  });
}

/**
 * Edits an olympiad's details and organiser-set info fields (description,
 * grades, run dates) shown to educators on the info card.
 * Wired to PUT /api/olympiads/:id (backend/src/routes/rounds.js).
 *
 * @param {string} olympiadId
 * @param {{name?: string, timezone?: string, description?: string, grades?: string, startDate?: string, endDate?: string}} data
 * @param {string} token - Clerk JWT for the Authorization header
 */
export function updateOlympiad(olympiadId, data, token) {
  return requestJson(`/api/olympiads/${olympiadId}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

/**
 * Asks the organiser to grant the signed-in educator's school access to an
 * olympiad. Re-requesting is allowed after a decline.
 * Wired to POST /api/olympiads/:id/request-access (backend/src/routes/rounds.js).
 *
 * @param {string} olympiadId
 * @param {string} token - Clerk JWT for the Authorization header
 * @returns {Promise<{status: string}>}
 */
export function requestOlympiadAccess(olympiadId, token) {
  return requestJson(`/api/olympiads/${olympiadId}/request-access`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}

/**
 * Lists pending school access requests for the organiser console.
 * Wired to GET /api/olympiads/access-requests (backend/src/routes/rounds.js).
 *
 * @param {string} token - Clerk JWT for the Authorization header
 * @returns {Promise<Array<{
 *   id: string,
 *   school: {id: string, name: string},
 *   olympiad: {id: string, name: string},
 *   requestedBy: {id: string, name: string, email: string}|null,
 *   requestedAt: string,
 * }>>}
 */
export function fetchAccessRequests(token) {
  return requestJson('/api/olympiads/access-requests', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

/**
 * Approves a pending school access request.
 * Wired to POST /api/olympiads/access-requests/:id/approve (backend/src/routes/rounds.js).
 *
 * @param {string} requestId
 * @param {string} token - Clerk JWT for the Authorization header
 * @returns {Promise<{id: string, status: string}>}
 */
export function approveAccessRequest(requestId, token) {
  return requestJson(`/api/olympiads/access-requests/${requestId}/approve`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}

/**
 * Declines a pending school access request.
 * Wired to POST /api/olympiads/access-requests/:id/decline (backend/src/routes/rounds.js).
 *
 * @param {string} requestId
 * @param {string} token - Clerk JWT for the Authorization header
 * @returns {Promise<{id: string, status: string}>}
 */
export function declineAccessRequest(requestId, token) {
  return requestJson(`/api/olympiads/access-requests/${requestId}/decline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}

/**
 * Creates a new round for an olympiad. Organisers only.
 *
 * @param {{olympiadId: string, name: string, openTime: string, closeTime: string, qualifyingThreshold?: number}} payload
 * @param {string} token - Clerk JWT for the Authorization header
 */
export function createRound({ olympiadId, name, openTime, closeTime, qualifyingThreshold }, token) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  return requestJson('/api/rounds', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      olympiadId,
      name,
      openTime,
      closeTime,
      qualifyingThreshold: qualifyingThreshold ?? null,
    }),
  });
}

export function listOlympiadRounds(olympiadId) {
  return requestJson(`/api/olympiads/${olympiadId}/rounds`);
}

export function listRounds() {
  return requestJson('/api/rounds');
}

/**
 * Fetches archived papers. Kept after removing the student self-registration
 * flow because the archive page still uses it.
 */
export function fetchArchivedPapers() {
  return requestJson('/api/papers/archive');
}

/**
 * Fetches the entrants registered for a round.
 * Wired to GET /api/rounds/:id/entrants (backend/src/routes/rounds.js).
 * Educators see only their school's entrants; organisers see all.
 *
 * @param {string} roundId
 * @param {string} [token] - Clerk JWT for the Authorization header
 * @returns {Promise<Array<{id: string, name: string, grade: string, schoolId: string}>>}
 */
export function fetchRoundEntrants(roundId, token) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  return requestJson(`/api/rounds/${roundId}/entrants`, { headers });
}

/**
 * Lists the students (entrants) registered at the signed-in educator's school.
 * Wired to GET /api/entrants (backend/src/routes/entrants.js).
 *
 * @param {string} token - Clerk JWT for the Authorization header
 * @returns {Promise<Array<{id: string, name: string, grade: string, schoolId: string, email: string|null, accountStatus: 'active'|'invite_pending'|null}>>}
 */
export function listSchoolEntrants(token) {
  return requestJson('/api/entrants', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

/**
 * Detects potential duplicate entrants within the educator's school.
 * Heuristic: same normalized name + same grade = likely duplicate.
 * Wired to GET /api/entrants/duplicates (backend/src/routes/entrants.js).
 *
 * @param {string} token - Clerk JWT for the Authorization header
 * @returns {Promise<{duplicates: Array<Array<{id: string, name: string, grade: string, email: string|null, createdAt: string}>>>}>}
 */
export function fetchDuplicates(token) {
  return requestJson('/api/entrants/duplicates', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

/**
 * Organiser-only: detects potential duplicate entrants across all schools.
 * Heuristic: same normalized name + same grade + same school = likely duplicate.
 * Wired to GET /api/entrants/duplicates/all (backend/src/routes/entrants.js).
 *
 * @param {string} token - Clerk JWT for the Authorization header
 * @returns {Promise<{duplicates: Array<Array<{id: string, name: string, grade: string, email: string|null, schoolName: string, createdAt: string}>>>}>}
 */
export function fetchAllDuplicates(token) {
  return requestJson('/api/entrants/duplicates/all', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

/**
 * Registers a student at the signed-in educator's school: creates the
 * entrant record AND their student account, then emails them an
 * invitation to set a password. The educator must select which olympiad
 * the student is being added under.
 * Wired to POST /api/entrants (backend/src/routes/entrants.js).
 *
 * @param {{name: string, email: string, grade: string, olympiadId: string}} entrant
 * @param {string} token - Clerk JWT for the Authorization header
 * @returns {Promise<{id: string, name: string, grade: string, schoolId: string, email: string, accountStatus: string, invitationSent: boolean}>}
 */
export function createEntrant({ name, email, grade, olympiadId }, token) {
  return requestJson('/api/entrants', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name, email, grade, olympiadId }),
  });
}

/**
 * Re-sends the set-password invitation for one of the educator's students.
 * Wired to POST /api/entrants/:id/resend-invite (backend/src/routes/entrants.js).
 * `email` is only needed for legacy students that have no account yet.
 *
 * @param {string} entrantId
 * @param {string} token - Clerk JWT for the Authorization header
 * @param {{email?: string}} [body]
 * @returns {Promise<{message: string, invitationSent: boolean}>}
 */
export function resendEntrantInvite(entrantId, token, body = {}) {
  return requestJson(`/api/entrants/${entrantId}/resend-invite`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
}

/**
 * Removes a student from the educator's school — deletes the entrant, their
 * account, and all their submissions/results. The page confirms first;
 * this cannot be undone.
 * Wired to DELETE /api/entrants/:id (backend/src/routes/entrants.js).
 *
 * @param {string} entrantId
 * @param {string} token - Clerk JWT for the Authorization header
 * @returns {Promise<{message: string}>}
 */
export function deleteEntrant(entrantId, token) {
  return requestJson(`/api/entrants/${entrantId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}

/**
 * Student email + password sign-in. Students are registered by their
 * educator and set their password via an emailed invitation link.
 * Wired to POST /api/students/login (backend/src/routes/studentAuth.js).
 *
 * @param {{email: string, password: string}} credentials
 * @returns {Promise<{token: string, user: {id: string, email: string, role: string, name: string, school: {id: string, name: string}|null, entrantId: string|null}}>}
 */
export function studentLogin({ email, password }) {
  return requestJson('/api/students/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

/**
 * Activates a student account from an emailed invitation token by setting
 * their chosen password. Returns a session so they're signed in immediately.
 * Wired to POST /api/students/set-password (backend/src/routes/studentAuth.js).
 *
 * @param {{token: string, password: string}} payload
 * @returns {Promise<{token: string, user: object}>}
 */
export function setStudentPassword({ token, password }) {
  return requestJson('/api/students/set-password', {
    method: 'POST',
    body: JSON.stringify({ token, password }),
  });
}

/**
 * Proactively refreshes the student's session token before it expires.
 * Requires a valid (non-expired) JWT. Returns a new token with a fresh 7-day TTL.
 * Wired to POST /api/students/refresh (backend/src/routes/studentAuth.js).
 *
 * @param {string} token - Current valid JWT
 * @returns {Promise<{token: string, user: object}>}
 */
export function refreshSessionToken(token) {
  return requestJson('/api/students/refresh', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}

/**
 * Permanently deletes the signed-in user's account and all their data.
 * This cannot be undone. The caller should clear local session state and
 * redirect to login after a successful response.
 * Wired to DELETE /api/auth/account (backend/src/routes/auth.js).
 *
 * @param {string} token - Auth token (student JWT or Clerk JWT)
 * @returns {Promise<{message: string}>}
 */
export function deleteAccount(token) {
  return requestJson('/api/auth/account', {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
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
 * Fire-and-forget save for use in beforeunload handlers. Uses fetch with
 * keepalive so the request survives page teardown. Returns nothing — the
 * browser may kill the request, but that's fine; it's best-effort.
 */
export function flushSittingAnswers(sittingId, answers, token) {
  if (!token) return;
  try {
    fetch(`${API_BASE_URL}/api/sittings/${sittingId}/answers`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ answers }),
      keepalive: true,
    });
  } catch {
    // Best-effort — swallow errors during page teardown.
  }
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
 * Releases all automarked results for a closed round so students can view them.
 * Wired to POST /api/rounds/:id/release-results (backend/src/routes/rounds.js).
 */
export function releaseResults(roundId, token) {
  return requestJson(`/api/rounds/${roundId}/release-results`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}

/**
 * Hides all released results for a round so students can no longer view them.
 * Wired to POST /api/rounds/:id/unrelease-results (backend/src/routes/rounds.js).
 */
export function unreleaseResults(roundId, token) {
  return requestJson(`/api/rounds/${roundId}/unrelease-results`, {
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

/**
 * Lists the signed-in student's own sittings, newest first.
 * Wired to GET /api/students/me/sittings (backend/src/routes/students.js).
 *
 * @param {string} token - Clerk JWT for the Authorization header
 * @returns {Promise<Array<{
 *   id: string,
 *   entrantId: string,
 *   roundId: string,
 *   answers: object|null,
 *   startedAt: string,
 *   expiresAt: string,
 *   completedAt: string|null,
 *   round: { id: string, name: string, state: string, closeTime: string },
 * }>>}
 */
export function fetchMySittings(token) {
  return requestJson('/api/students/me/sittings', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

/**
 * Lists the signed-in student's released results, newest first.
 * Wired to GET /api/students/me/results (backend/src/routes/students.js).
 * Unreleased marks are never included.
 *
 * @param {string} token - Clerk JWT for the Authorization header
 * @returns {Promise<Array<{
 *   id: string,
 *   score: number,
 *   releasedAt: string,
 *   submittedAt: string,
 *   round: { id: string, name: string },
 * }>>}
 */
export function fetchMyResults(token) {
  return requestJson('/api/students/me/results', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

/**
 * Lists open rounds the student is registered for via RoundEntrant,
 * with an optional sitting if they've already started the test.
 * Wired to GET /api/students/me/rounds (backend/src/routes/students.js).
 *
 * @param {string} token - Clerk JWT for the Authorization header
 * @returns {Promise<Array<{
 *   round: { id: string, name: string, state: string, closeTime: string },
 *   sitting: { id: string, completedAt: string|null, startedAt: string, expiresAt: string } | null,
 * }>>}
 */
export function fetchMyRounds(token) {
  return requestJson('/api/students/me/rounds', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

/**
 * Fetches one released result with a question-by-question review —
 * the student's answer next to the correct answer for every question.
 * Wired to GET /api/students/me/results/:resultId (backend/src/routes/students.js).
 *
 * @param {string} resultId
 * @param {string} token - Clerk JWT for the Authorization header
 * @returns {Promise<{
 *   id: string,
 *   score: number,
 *   submittedAt: string,
 *   releasedAt: string,
 *   round: { id: string, name: string },
 *   paperFileUrl: string|null,
 *   questions: Array<{questionId: string, correctAnswer: string, studentAnswer: string|null, isCorrect: boolean}>,
 * }>}
 */
export function fetchMyResult(resultId, token) {
  return requestJson(`/api/students/me/results/${resultId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

/**
 * Fetches the school dashboard (entrant stats, scores) for a given school.
 * Wired to GET /api/schools/:id/dashboard (backend/src/routes/schools.js).
 *
 * @param {string} schoolId
 * @param {string} token - Clerk JWT for the Authorization header
 * @returns {Promise<{
 *   school: { id: string, name: string },
 *   entrantCount: number,
 *   totalSubmissions: number,
 *   entrants: Array<{ id: string, name: string, grade: string, submissionCount: number, averageScore: number|null }>,
 * }>}
 */
export function fetchSchoolDashboard(schoolId, token) {
  return requestJson(`/api/schools/${schoolId}/dashboard`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

/**
 * Fetches per-round analytics for a school: participation rates,
 * average/highest scores, and submission counts per round.
 * Wired to GET /api/schools/:id/analytics (backend/src/routes/schools.js).
 *
 * @param {string} schoolId
 * @param {string} token - Clerk JWT for the Authorization header
 * @returns {Promise<{
 *   school: {id: string, name: string},
 *   totalEntrants: number,
 *   rounds: Array<{
 *     round: {id: string, name: string, olympiad: {id: string, name: string}},
 *     registeredCount: number,
 *     submissionCount: number,
 *     participationRate: number,
 *     averageScore: number|null,
 *     highestScore: number|null,
 *   }>,
 * }>}
 */
export function fetchSchoolAnalytics(schoolId, token) {
  return requestJson(`/api/schools/${schoolId}/analytics`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function dashboardPathForRole(role) {
  if (role === 'organiser') return '/organiser'; // TODO: confirm real path
  if (role === 'educator') return '/educator';
  if (role === 'student') return '/student';
  return '/login';
}

export function fetchStandings(roundId, token) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  return requestJson(`/api/rounds/${roundId}/standings`, { headers });
}

/**
 * Fetches ranked standings grouped by school for a round.
 * Wired to GET /api/rounds/:id/standings/schools (backend/src/routes/rounds.js).
 * Educators see only their own school; organisers see all.
 *
 * @param {string} roundId
 * @param {string} [token] - Clerk JWT for the Authorization header
 * @returns {Promise<Array<{
 *   rank: number,
 *   schoolId: string,
 *   schoolName: string,
 *   totalScore: number,
 *   entrantCount: number,
 * }>>}
 */
export function getSchoolStandings(roundId, token) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  return requestJson(`/api/rounds/${roundId}/standings/schools`, { headers });
}

/**
 * Fetches all 4 notification trigger types for a round, with their current
 * enabled/recipientRole state (defaults shown for any not yet configured).
 * Wired to GET /api/rounds/:id/notifications (backend/src/routes/rounds.js).
 * Requires organiser role.
 *
 * @param {string} roundId
 * @returns {Promise<Array<{id: string|null, roundId: string, triggerType: string, enabled: boolean, recipientRole: string}>>}
 */
export function fetchNotificationRules(roundId) {
  return requestJson(`/api/rounds/${roundId}/notifications`);
}

/**
 * Updates (or creates) the notification rule for a specific trigger type.
 * Wired to PUT /api/rounds/:id/notifications/:triggerType (backend/src/routes/rounds.js).
 * Requires organiser role.
 *
 * @param {string} roundId
 * @param {string} triggerType
 * @param {{enabled?: boolean, recipientRole?: string}} updates
 * @param {string} token - Clerk JWT for the Authorization header
 * @returns {Promise<{id: string, roundId: string, triggerType: string, enabled: boolean, recipientRole: string}>}
 */
export function updateNotificationRule(roundId, triggerType, updates, token) {
  return requestJson(`/api/rounds/${roundId}/notifications/${triggerType}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(updates),
  });
}

/**
 * Dry-run preview of a notification trigger: returns who would be emailed
 * and a rendered email preview, without sending anything.
 * Wired to POST /api/rounds/:id/notifications/test (backend/src/routes/rounds.js).
 * Requires organiser role.
 *
 * @param {string} roundId
 * @param {string} triggerType
 * @param {string} token - Clerk JWT for the Authorization header
 * @returns {Promise<{
 *   dryRun: boolean,
 *   round: object,
 *   triggerType: string,
 *   enabled: boolean,
 *   recipients: Array<{email: string, alreadyNotified: boolean, entrantId?: string, entrantName?: string}>,
 *   emailPreview: {subject: string, text: string}|null,
 * }>}
 */
export function testNotificationTrigger(roundId, triggerType, token) {
  return requestJson(`/api/rounds/${roundId}/notifications/test`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ triggerType }),
  });
}

/**
 * Lists marking tasks for organisers to work through.
 * Wired to GET /api/marking/queue (backend/src/routes/marking.js).
 *
 * @param {string} token - Clerk JWT for the Authorization header
 * @param {string} [status] - 'unassigned' (default), 'assigned', 'marked', 'moderated', or 'all'
 */
export function listMarkingQueue(token, status) {
  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  return requestJson(`/api/marking/queue${query}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

/**
 * Assigns a marking task to an organiser (defaults to the requester).
 * Wired to PATCH /api/marking/:id/assign (backend/src/routes/marking.js).
 *
 * @param {string} taskId
 * @param {string} token - Clerk JWT for the Authorization header
 * @param {string} [assignedToId] - defaults to the requester on the backend
 */
export function assignMarkingTask(taskId, token, assignedToId) {
  return requestJson(`/api/marking/${taskId}/assign`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(assignedToId ? { assignedToId } : {}),
  });
}

/**
 * Records a marker's score (with optional per-question breakdown) for a task.
 * Wired to PATCH /api/marking/:id (backend/src/routes/marking.js).
 *
 * @param {string} taskId
 * @param {{score: number, breakdown?: Record<string, number>}} data
 * @param {string} token - Clerk JWT for the Authorization header
 */
export function submitMarking(taskId, { score, breakdown }, token) {
  return requestJson(`/api/marking/${taskId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ score, breakdown }),
  });
}

/**
 * Records a moderator's reviewed score for an already-marked task.
 * Wired to PATCH /api/marking/:id/moderate (backend/src/routes/marking.js).
 *
 * @param {string} taskId
 * @param {number} moderatedScore
 * @param {string} token - Clerk JWT for the Authorization header
 */
export function moderateMarkingTask(taskId, moderatedScore, token) {
  return requestJson(`/api/marking/${taskId}/moderate`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ moderatedScore }),
  });
}

/**
 * Lists submissions for a round, with result and remark request info.
 * Wired to GET /api/rounds/:id/submissions (backend/src/routes/rounds.js).
 */
export function listRoundSubmissions(roundId) {
  return requestJson(`/api/rounds/${roundId}/submissions`);
}

/**
 * Requests a remark on a submission, explaining why in `reason`.
 * Wired to POST /api/submissions/:id/remark (backend/src/routes/submissions.js).
 *
 * @param {string} submissionId
 * @param {string} reason
 * @param {string} token - Clerk JWT for the Authorization header
 */
export function requestRemark(submissionId, reason, token) {
  return requestJson(`/api/submissions/${submissionId}/remark`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ reason }),
  });
}

/**
 * Lists remark requests visible to an organiser.
 * Wired to GET /api/remark/queue (backend/src/routes/remark.js).
 *
 * @param {string} token - Clerk JWT for the Authorization header
 * @param {{status?: string, assignedTo?: 'me'}} [options] - Queue filters. Passing
 *   assignedTo: 'me' returns only work assigned to the signed-in reviewer.
 */
export function listRemarkQueue(token, { status, assignedTo } = {}) {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (assignedTo) params.set('assignedTo', assignedTo);
  const query = params.size ? `?${params.toString()}` : '';

  return requestJson(`/api/remark/queue${query}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

/**
 * Routes a pending appeal to an organiser reviewer. Omitting assignedToId
 * assigns the signed-in organiser as the reviewer.
 * Wired to PATCH /api/remark/:id/assign (backend/src/routes/remark.js).
 *
 * @param {string} remarkRequestId
 * @param {{assignedToId?: string}} [data] - omit to self-assign on the backend
 * @param {string} token - Clerk JWT for the Authorization header
 */
export function assignRemarkRequest(remarkRequestId, { assignedToId } = {}, token) {
  return requestJson(`/api/remark/${remarkRequestId}/assign`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(assignedToId ? { assignedToId } : {}),
  });
}

/**
 * Approves or rejects a pending remark request. Approving requires newScore.
 * Wired to PATCH /api/remark/:id/review (backend/src/routes/remark.js).
 *
 * @param {string} remarkRequestId
 * @param {{status: 'approved'|'rejected', newScore?: number, reviewNotes?: string}} data
 * @param {string} token - Clerk JWT for the Authorization header
 */
export function reviewRemarkRequest(remarkRequestId, { status, newScore, reviewNotes }, token) {
  return requestJson(`/api/remark/${remarkRequestId}/review`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ status, newScore, reviewNotes }),
  });
}

/**
 * Lists the organisers (creator + co-organisers) for an olympiad.
 * Wired to GET /api/olympiads/:id/organisers (backend/src/routes/olympiadOrganisers.js).
 *
 * @param {string} olympiadId
 * @param {string} token - Clerk JWT for the Authorization header
 * @returns {Promise<Array<{
 *   id: string,
 *   organiserId: string,
 *   name: string,
 *   email: string,
 *   addedAt: string,
 *   isCreator: boolean,
 * }>>}
 */
export function listOlympiadOrganisers(olympiadId, token) {
  return requestJson(`/api/olympiads/${olympiadId}/organisers`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

/**
 * Adds an organiser to an olympiad. Only existing organisers may call this.
 * Wired to POST /api/olympiads/:id/organisers (backend/src/routes/olympiadOrganisers.js).
 *
 * @param {string} olympiadId
 * @param {string} organiserId - User.id of the organiser to add
 * @param {string} token - Clerk JWT for the Authorization header
 */
export function addOlympiadOrganiser(olympiadId, organiserId, token) {
  return requestJson(`/api/olympiads/${olympiadId}/organisers`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ organiserId }),
  });
}

/**
 * Removes a co-organiser from an olympiad. The creator cannot be removed.
 * Wired to DELETE /api/olympiads/:id/organisers/:organiserId.
 *
 * @param {string} olympiadId
 * @param {string} organiserId
 * @param {string} token - Clerk JWT for the Authorization header
 */
export function removeOlympiadOrganiser(olympiadId, organiserId, token) {
  return requestJson(`/api/olympiads/${olympiadId}/organisers/${organiserId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}

/**
 * Lists all users with role 'organiser' — used by the "Add organiser"
 * dropdown to pick a co-organiser.
 *
 * @param {string} token - Clerk JWT for the Authorization header
 */
export function listAllOrganisers(token) {
  return requestJson('/api/organisers', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

/**
 * Fetches the replay timeline for a round — the audit log entries
 * enriched with human-readable summaries, in chronological order.
 * Wired to GET /api/rounds/:id/replay (backend/src/routes/rounds.js).
 *
 * @param {string} roundId
 * @param {string} token - Clerk JWT for the Authorization header
 * @returns {Promise<{
 *   round: { id: string, name: string, olympiadName: string, state: string, openTime: string, closeTime: string },
 *   timeline: Array<{ id: string, action: string, timestamp: string, roundId: string, payload: object, summary: string }>,
 * }>}
 */
export function fetchRoundReplay(roundId, token) {
  return requestJson(`/api/rounds/${roundId}/replay`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

/**
 * Runs cheating signal detection algorithms for a round.
 * Returns flags sorted by severity (high → medium → low).
 * Wired to GET /api/rounds/:id/signals (backend/src/routes/signals.js).
 * Requires organiser role.
 *
 * @param {string} roundId
 * @param {string} token - Clerk JWT for the Authorization header
 * @returns {Promise<{
 *   round: { id: string },
 *   flags: Array<{
 *     type: string,
 *     severity: string,
 *     entrantIds: string[],
 *     entrants: Array<{id: string, name: string, grade: string}>,
 *     details: object,
 *   }>,
 * }>}
 */
export function fetchSignals(roundId, token) {
  return requestJson(`/api/rounds/${roundId}/signals`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}
