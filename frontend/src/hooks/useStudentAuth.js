'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  getStudentSession,
  setStudentSession,
  clearStudentSession,
  isTokenExpiringSoon,
} from '@/lib/studentSession';
import { refreshSessionToken } from '@/lib/api';

// Refresh the token when it's within 1 day of expiry (token has 7-day TTL).
const REFRESH_THRESHOLD_MS = 24 * 60 * 60 * 1000;
// Check every hour if the token needs refreshing.
const REFRESH_CHECK_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Auth hook for student pages. Students sign in with email + password
 * (JWT session in localStorage — no Clerk), so this mirrors the pieces
 * student pages previously pulled from Clerk's useAuth/useClerk:
 *   { user, checking, getToken, signOut }
 *
 * Redirects to /login when there is no session. `getToken` returns the
 * stored JWT for the Authorization header. `signOut` clears the session
 * (with an optional redirectUrl for parity with Clerk's signOut).
 *
 * Proactively refreshes the token before it expires so students don't get
 * logged out mid-sitting.
 */
export function useStudentAuth() {
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;

    // Read the stored session after mount (client-only, so SSR and the first
    // client render match). The await defers the state updates to a callback
    // — same shape as useRequireRole's async check.
    async function check() {
      const stored = await Promise.resolve(getStudentSession());
      if (cancelled) return;
      setSession(stored);
      setChecking(false);
      if (!stored) {
        router.replace('/login');
      }
    }

    check();

    return () => {
      cancelled = true;
    };
  }, [router]);

  // Proactive token refresh: check periodically if the token is expiring soon,
  // and refresh it before it expires. This prevents students from getting
  // logged out mid-sitting.
  useEffect(() => {
    if (!session?.token) return;

    async function refreshIfNeeded() {
      if (!session?.token) return;
      if (!isTokenExpiringSoon(session.token, REFRESH_THRESHOLD_MS)) return;

      try {
        const { token, user } = await refreshSessionToken(session.token);
        const updated = { token, user };
        setStudentSession(updated);
        setSession(updated);
      } catch (err) {
        // If refresh fails (e.g., token already expired), clear the session
        // and redirect to login. The student will need to re-authenticate.
        console.error('Token refresh failed:', err);
        clearStudentSession();
        setSession(null);
        router.replace('/login?expired=1');
      }
    }

    // Check immediately on mount
    refreshIfNeeded();

    // Then check periodically
    const interval = setInterval(refreshIfNeeded, REFRESH_CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [session?.token, router]);

  const getToken = useCallback(() => Promise.resolve(session ? session.token : null), [session]);

  const signOut = useCallback(
    async ({ redirectUrl } = {}) => {
      clearStudentSession();
      setSession(null);
      router.replace(redirectUrl || '/login');
    },
    [router]
  );

  return {
    user: session ? session.user : null,
    checking,
    getToken,
    signOut,
  };
}
