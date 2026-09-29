'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { fetchCurrentUser, dashboardPathForRole } from '@/lib/api';

// Redirects authenticated Clerk users (educator/organiser) to their dashboard
// when they land on the home page after sign-in.
export default function AuthRedirect() {
  const router = useRouter();
  const { isLoaded, isSignedIn, getToken } = useAuth();

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;

    async function check() {
      const token = await getToken();
      const user = await fetchCurrentUser(token);
      if (cancelled) return;
      if (user) {
        router.replace(dashboardPathForRole(user.role));
      }
    }

    check();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, getToken, router]);

  return null;
}
