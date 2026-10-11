'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth, useUser } from '@clerk/nextjs';
import OrganiserShell from '@/components/OrganiserShell';
import { fetchCurrentUser } from '@/lib/api';
import '@/app/auth.css';

const ROUTE_MAP = {
  '/organiser': { activeNav: 'dashboard', breadcrumb: 'Overview' },
  '/organiser/marking': { activeNav: 'marking', breadcrumb: 'Marking Queue' },
  '/organiser/remarks': { activeNav: 'remarks', breadcrumb: 'Appeals' },
  '/organiser/duplicates': { activeNav: 'duplicates', breadcrumb: 'Duplicates' },
  '/organiser/replay': { activeNav: 'replay', breadcrumb: 'Replay' },
  '/organiser/archive': { activeNav: 'archive', breadcrumb: 'Archive' },
  '/organiser/rounds/new': { activeNav: 'dashboard', breadcrumb: 'New Round' },
};

function initialsFrom(name) {
  if (!name) return '';
  const parts = String(name).trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return parts[0].slice(0, 2).toUpperCase();
}

export default function OrganiserLayout({ children }) {
  const { user: clerkUser } = useUser();
  const { getToken } = useAuth();
  const pathname = usePathname();

  // Fetch the database User record so the sidebar shows the real name
  // (e.g. "Ronnie") instead of whatever the Clerk profile has.
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

  // Prefer the database name; fall back to Clerk while loading.
  const name = dbUser?.name || clerkUser?.fullName || clerkUser?.firstName || clerkUser?.emailAddresses?.[0]?.emailAddress || '';
  const email = dbUser?.email || clerkUser?.emailAddresses?.[0]?.emailAddress || '';

  const organiserUser = {
    name,
    email,
    role: dbUser?.role || 'organiser',
    id: clerkUser?.id,
  };
  const initials = initialsFrom(organiserUser.name);
  const route = ROUTE_MAP[pathname] || { activeNav: 'dashboard', breadcrumb: 'Overview' };

  return (
    <OrganiserShell
      activeNav={route.activeNav}
      breadcrumb={route.breadcrumb}
      user={{ ...organiserUser, name: organiserUser.name || initials }}
    >
      {children}
    </OrganiserShell>
  );
}
