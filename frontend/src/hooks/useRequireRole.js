'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchCurrentUser, dashboardPathForRole } from '@/lib/api';

export function useRequireRole(requiredRole) {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;

    fetchCurrentUser().then((fetchedUser) => {
      if (cancelled) return;

      if (!fetchedUser) {
        router.replace('/login');
        return;
      }

      if (fetchedUser.role !== requiredRole) {
        router.replace(dashboardPathForRole(fetchedUser.role));
        return;
      }

      setUser(fetchedUser);
      setChecking(false);
    });

    return () => {
      cancelled = true;
    };
  }, [requiredRole, router]);

  return { user, checking };
}
