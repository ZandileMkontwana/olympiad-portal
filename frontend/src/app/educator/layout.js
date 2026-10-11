'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { useAuth } from '@clerk/nextjs';
import EducatorSidebar from '@/components/EducatorSidebar';
import AppShell from '@/components/AppShell';
import { TourHost } from '@/components/OnboardingTour';
import { EDUCATOR_TOUR } from '@/lib/tour';
import { fetchCurrentUser } from '@/lib/api';
import '@/app/auth.css';

function initialsFrom(name) {
  if (!name) return '';
  const parts = String(name).trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return parts[0].slice(0, 2).toUpperCase();
}

export default function EducatorLayout({ children }) {
  const { user: clerkUser } = useUser();
  const { getToken } = useAuth();

  // Fetch the database User record so the topbar initials match the real name.
  const [dbUser, setDbUser] = useState(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await getToken();
      const fetched = await fetchCurrentUser(token);
      if (!cancelled) setDbUser(fetched);
    })();
    return () => { cancelled = true; };
  }, [getToken]);

  const name = dbUser?.name || clerkUser?.fullName || clerkUser?.firstName || clerkUser?.emailAddresses?.[0]?.emailAddress || '';
  const initials = initialsFrom(name);

  return (
    <TourHost tour={EDUCATOR_TOUR} userId={clerkUser?.id}>
      <AppShell
        section="Educator overview"
        initials={initials}
        renderSidebar={({ open, onClose }) => <EducatorSidebar open={open} onClose={onClose} />}
      >
        {children}
      </AppShell>
    </TourHost>
  );
}
