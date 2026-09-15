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

export function createRound({ olympiadId, name, openTime, closeTime, qualifyingThreshold }) {
  return requestJson('/api/rounds', {
    method: 'POST',
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
 * @returns {Promise<Array<{id: string, name: string, grade: string, schoolId: string, email: string|null, accountStatus: 'active'|'invite_pending'|null}>>}
 */
export function listSchoolEntrants(token) {
  return requestJson('/api/entrants', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

/**
 * Registers a student at the signed-in educator's school: creates the
 * entrant record AND their student account, then emails them an
 * invitation to set a password.
 * Wired to POST /api/entrants (backend/src/routes/entrants.js).
 *
 * @param {{name: string, email: string, grade: string}} entrant
 * @param {string} token - Clerk JWT for the Authorization header
 * @returns {Promise<{id: string, name: string, grade: string, schoolId: string, email: string, accountStatus: string, invitationSent: boolean}>}
 */
export function createEntrant({ name, email, grade }, token) {
  return requestJson('/api/entrants', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name, email, grade }),
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

export function dashboardPathForRole(role) {
  if (role === 'organiser') return '/organiser'; // TODO: confirm real path
  if (role === 'educator') return '/educator';
  if (role === 'student') return '/student';
  return '/login';
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
export function fetchStandings(roundId) {
  return requestJson(`/api/rounds/${roundId}/standings`);
}

/**
 * Fetches ranked standings grouped by school for a round.
 * Wired to GET /api/rounds/:id/standings/schools (backend/src/routes/rounds.js).
 *
 * @param {string} roundId
 * @returns {Promise<Array<{
 *   rank: number,
 *   schoolId: string,
 *   schoolName: string,
 *   totalScore: number,
 *   entrantCount: number,
 * }>>}
 */
export function getSchoolStandings(roundId) {
  return requestJson(`/api/rounds/${roundId}/standings/schools`);
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
/* Dry-run preview of a notification trigger: returns who would be emailed
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
