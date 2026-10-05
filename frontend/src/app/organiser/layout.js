'use client';

import { usePathname } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import OrganiserShell from '@/components/OrganiserShell';
import '@/app/auth.css';

const ROUTE_MAP = {
  '/organiser': { activeNav: 'dashboard', breadcrumb: 'Overview' },
  '/organiser/marking': { activeNav: 'marking', breadcrumb: 'Marking Queue' },
  '/organiser/remarks': { activeNav: 'remarks', breadcrumb: 'Appeals' },
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
  const { user } = useUser();
  const pathname = usePathname();
  const organiserUser = {
    name: user?.fullName || user?.firstName || user?.emailAddresses?.[0]?.emailAddress || '',
    email: user?.emailAddresses?.[0]?.emailAddress || '',
    role: 'organiser',
    id: user?.id,
  };
  const initials = initialsFrom(organiserUser.name);
  const route = ROUTE_MAP[pathname] || { activeNav: 'dashboard', breadcrumb: 'Overview' };

  return (
    <OrganiserShell activeNav={route.activeNav} breadcrumb={route.breadcrumb} user={{ ...organiserUser, name: organiserUser.name || initials }}>
      {children}
    </OrganiserShell>
  );
}
