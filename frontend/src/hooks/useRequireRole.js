'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { fetchCurrentUser, dashboardPathForRole } from '@/lib/api';

export function useRequireRole(requiredRole) {
  const router = useRouter();
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!isLoaded) return;
    let cancelled = false;

    async function check() {
      if (!isSignedIn) {
        router.replace('/login');
        return;
      }
      const token = await getToken();
      const fetchedUser = await fetchCurrentUser(token);
      if (cancelled) return;

      if (!fetchedUser) {
        router.replace('/auth/check');
        return;
      }

      if (fetchedUser.role !== requiredRole) {
        router.replace(dashboardPathForRole(fetchedUser.role));
        return;
      }

      setUser(fetchedUser);
      setChecking(false);
    }

    check();

    return () => {
      cancelled = true;
    };
  }, [requiredRole, isLoaded, isSignedIn, getToken, router]);

  return { user, checking };
}
