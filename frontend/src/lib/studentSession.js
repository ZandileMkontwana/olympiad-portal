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
