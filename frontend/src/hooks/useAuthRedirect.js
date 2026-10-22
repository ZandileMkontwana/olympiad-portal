'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { fetchCurrentUser, dashboardPathForRole } from '@/lib/api';

// If already logged in, bounce away to the correct dashboard instead of
// showing the landing/login page again.
export function useRedirectIfAuthenticated() {
  const router = useRouter();
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!isLoaded) return;
    let cancelled = false;

    async function check() {
      if (!isSignedIn) {
        setChecking(false);
        return;
      }
      const token = await getToken();
      const user = await fetchCurrentUser(token);
      if (cancelled) return;
      if (user) {
        router.replace(dashboardPathForRole(user.role));
      } else {
        router.replace('/auth/check');
      }
    }

    check();

    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, getToken, router]);

  return checking; // true while we're still finding out — render nothing/a spinner until false
}
