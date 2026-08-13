// Shared API client for the organiser console.
// Centralised here so #23 (round/olympiad form) and #24 (dashboard) can reuse
// the same base URL, error handling, and auth header pattern as this ticket.

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
// backend/src/routes/papers.js -> requireOrganiser().
function authHeaders() {
  return { 'x-user-role': 'organiser' };
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
    // fetch() itself throws on network failure (server down, CORS, offline)
    throw new ApiError(
      'Could not reach the server. Is the backend running on :5000?',
      0
    );
  }

  let data = null;
  try {
    data = await response.json();
  } catch {
    // Response wasn't JSON (e.g. a 500 HTML error page) — fall through,
    // we'll still report response.ok / response.status below.
  }

  if (!response.ok) {
    const message =
      (data && data.error) || `Upload failed with status ${response.status}`;
    throw new ApiError(message, response.status);
  }

  return data;
}