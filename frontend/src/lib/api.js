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
  return '/login';
}
