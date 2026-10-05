'use client';

import { useUser } from '@clerk/nextjs';
import EducatorSidebar from '@/components/EducatorSidebar';
import AppShell from '@/components/AppShell';
import { TourHost } from '@/components/OnboardingTour';
import { EDUCATOR_TOUR } from '@/lib/tour';
import '@/app/auth.css';

// Persistent shell for every /educator/* page — the sidebar stays mounted so
// navigating between olympiads, the archive, the school dashboard and round
// details only swaps the main content instead of re-rendering the whole page.
// On phones/tablets the sidebar collapses into a hamburger-toggled drawer.
// New educators get a short guided tour on their first visit (#317).
export default function EducatorLayout({ children }) {
  const { user } = useUser();
  return (
    <TourHost tour={EDUCATOR_TOUR} userId={user?.id}>
      <AppShell
        section="Educator overview"
        renderSidebar={({ open, onClose }) => <EducatorSidebar open={open} onClose={onClose} />}
      >
        {children}
      </AppShell>
    </TourHost>
  );
}
