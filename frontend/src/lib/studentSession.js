// Student session storage — students authenticate with email + password
// against our backend (not Clerk), so their JWT + profile live in
// localStorage instead of a Clerk session.

const STORAGE_KEY = 'studentSession';

/**
 * Reads the stored student session, if any.
 * @returns {{ token: string, user: object } | null}
 */
export function getStudentSession() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    if (!session || !session.token || !session.user) return null;
    return session;
  } catch {
    return null;
  }
}

/**
 * Persists the student session returned by /api/students/login or
 * /api/students/set-password.
 */
export function setStudentSession(session) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

/**
 * Signs the student out by discarding the stored session.
 */
export function clearStudentSession() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(STORAGE_KEY);
}

/**
 * Parses a JWT and returns the payload (decoded from base64).
 * Returns null if the token is malformed.
 * @param {string} token
 * @returns {object|null}
 */
export function parseJwtPayload(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1];
    // JWT uses base64url encoding (no padding, - instead of +, _ instead of /)
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(base64);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/**
 * Returns the number of milliseconds until the JWT expires, or 0 if it's
 * already expired or unparseable.
 * @param {string} token
 * @returns {number}
 */
export function getTokenExpiryMs(token) {
  const payload = parseJwtPayload(token);
  if (!payload || !payload.exp) return 0;
  const expiryMs = payload.exp * 1000; // JWT exp is in seconds
  return Math.max(0, expiryMs - Date.now());
}

/**
 * Returns true if the JWT will expire within the given threshold (in ms).
 * @param {string} token
 * @param {number} thresholdMs
 * @returns {boolean}
 */
export function isTokenExpiringSoon(token, thresholdMs) {
  const expiryMs = getTokenExpiryMs(token);
  return expiryMs > 0 && expiryMs < thresholdMs;
}
