// Shared API client for the organiser console.

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000';

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

// TODO: replace with a real auth token once real auth exists.
// The backend currently only checks this placeholder header — see
// backend/src/routes/papers.js -> requireOrganiser() and rounds.js.
function authHeaders() {
  return { 'x-user-role': 'organiser' };
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
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
        ...options.headers,
      },
    });
  } catch (networkError) {
    throw new ApiError(
      'Could not reach the server. Is the backend running on :5000?',
      0
    );
  }

  let data = null;
  try {
    data = await response.json();
  } catch {
    // Response wasn't JSON — fall through to response.ok check below.
  }

  if (!response.ok) {
    const message =
      (data && data.error) || `Request failed with status ${response.status}`;
    throw new ApiError(message, response.status);
  }

  return data;
}

/**
 * Creates an olympiad.
 * Wired to POST /api/olympiads (backend/src/routes/rounds.js).
 *
 * @param {{ name: string, timezone: string }} input
 * @returns {Promise<import('../../../shared/types').Olympiad>}
 */
export function createOlympiad({ name, timezone }) {
  return requestJson('/api/olympiads', {
    method: 'POST',
    body: JSON.stringify({ name, timezone }),
  });
}

/**
 * Creates a round under an olympiad.
 * Wired to POST /api/rounds (backend/src/routes/rounds.js).
 *
 * @param {{ olympiadId: string, name: string, openTime: string, closeTime: string }} input
 * @returns {Promise<import('../../../shared/types').Round>}
 */
export function createRound({ olympiadId, name, openTime, closeTime }) {
  return requestJson('/api/rounds', {
    method: 'POST',
    body: JSON.stringify({ olympiadId, name, openTime, closeTime }),
  });
}

/**
 * Lists rounds for a single olympiad.
 * Wired to GET /api/olympiads/:id/rounds (backend/src/routes/rounds.js).
 *
 * @param {string} olympiadId
 * @returns {Promise<import('../../../shared/types').Round[]>}
 */
export function listOlympiadRounds(olympiadId) {
  return requestJson(`/api/olympiads/${olympiadId}/rounds`);
}

/**
 * Uploads a paper (and optional memo) for a round.
 * Wired to POST /api/rounds/:id/papers (backend/src/routes/papers.js).
 *
 * @param {string} roundId
 * @param {{ paperFile: File, memoFile?: File | null }} files
 * @returns {Promise<import('../../../shared/types').Paper>}
 */
export async function uploadPaper(roundId, { paperFile, memoFile }) {
  const formData = new FormData();
  formData.append('paper', paperFile);
  if (memoFile) {
    formData.append('memo', memoFile);
  }

  let response;
  try {
    response = await fetch(`${API_BASE_URL}/api/rounds/${roundId}/papers`, {
      method: 'POST',
      headers: authHeaders(),
      body: formData,
    });
  } catch (networkError) {
    throw new ApiError(
      'Could not reach the server. Is the backend running on :5000?',
      0
    );
  }

  let data = null;
  try {
    data = await response.json();
  } catch {
    // Response wasn't JSON — fall through to response.ok check below.
  }

  if (!response.ok) {
    const message =
      (data && data.error) || `Upload failed with status ${response.status}`;
    throw new ApiError(message, response.status);
  }

  return data;
}