'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getStudentSession, clearStudentSession } from '@/lib/studentSession';

/**
 * Auth hook for student pages. Students sign in with email + password
 * (JWT session in localStorage — no Clerk), so this mirrors the pieces
 * student pages previously pulled from Clerk's useAuth/useClerk:
 *   { user, checking, getToken, signOut }
 *
 * Redirects to /login when there is no session. `getToken` returns the
 * stored JWT for the Authorization header. `signOut` clears the session
 * (with an optional redirectUrl for parity with Clerk's signOut).
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
