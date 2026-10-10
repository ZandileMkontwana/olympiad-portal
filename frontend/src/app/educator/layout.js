'use client';

import { useUser } from '@clerk/nextjs';
import EducatorSidebar from '@/components/EducatorSidebar';
import AppShell from '@/components/AppShell';
import { TourHost } from '@/components/OnboardingTour';
import { EDUCATOR_TOUR } from '@/lib/tour';
import '@/app/auth.css';

function initialsFrom(name) {
  if (!name) return '';
  const parts = String(name).trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return parts[0].slice(0, 2).toUpperCase();
}

export default function EducatorLayout({ children }) {
  const { user } = useUser();
  const initials = initialsFrom(
    user?.fullName || user?.firstName || user?.emailAddresses?.[0]?.emailAddress || ''
  );
  return (
    <TourHost tour={EDUCATOR_TOUR} userId={user?.id}>
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
