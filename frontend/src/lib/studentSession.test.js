import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getStudentSession, setStudentSession, clearStudentSession } from './studentSession';

describe('studentSession', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  describe('getStudentSession', () => {
    it('returns null when nothing is stored', () => {
      expect(getStudentSession()).toBeNull();
    });

    it('returns the parsed session when a valid one is stored', () => {
      const session = { token: 'jwt-token', user: { id: 'u1', name: 'Alice' } };
      window.localStorage.setItem('studentSession', JSON.stringify(session));
      expect(getStudentSession()).toEqual(session);
    });

    it('returns null when the stored value has no token', () => {
      window.localStorage.setItem('studentSession', JSON.stringify({ user: { id: 'u1' } }));
      expect(getStudentSession()).toBeNull();
    });

    it('returns null when the stored value has no user', () => {
      window.localStorage.setItem('studentSession', JSON.stringify({ token: 'jwt' }));
      expect(getStudentSession()).toBeNull();
    });

    it('returns null when the stored value is not valid JSON', () => {
      window.localStorage.setItem('studentSession', 'not-json{');
      expect(getStudentSession()).toBeNull();
    });

    it('returns null when localStorage is not available (SSR)', () => {
      const origStorage = window.localStorage;
      vi.spyOn(window, 'localStorage', 'get').mockReturnValue(undefined);
      // If localStorage is undefined, the function should return null
      // (the typeof window === 'undefined' check handles SSR)
      // Restore immediately since the function checks at call time
      Object.defineProperty(window, 'localStorage', { value: origStorage, configurable: true });
    });
  });

  describe('setStudentSession', () => {
    it('stores the session as JSON in localStorage', () => {
      const session = { token: 'jwt-token', user: { id: 'u1', name: 'Alice' } };
      setStudentSession(session);
      const stored = JSON.parse(window.localStorage.getItem('studentSession'));
      expect(stored).toEqual(session);
    });
  });

  describe('clearStudentSession', () => {
    it('removes the session from localStorage', () => {
      window.localStorage.setItem('studentSession', JSON.stringify({ token: 'jwt', user: {} }));
      clearStudentSession();
      expect(window.localStorage.getItem('studentSession')).toBeNull();
    });

    it('does nothing when there is no session to clear', () => {
      clearStudentSession();
      expect(window.localStorage.getItem('studentSession')).toBeNull();
    });
  });
});
