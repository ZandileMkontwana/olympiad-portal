'use client';

import EducatorSidebar from '@/components/EducatorSidebar';
import AppShell from '@/components/AppShell';
import '@/app/auth.css';

// Persistent shell for every /educator/* page — the sidebar stays mounted so
// navigating between olympiads, the archive, the school dashboard and round
// details only swaps the main content instead of re-rendering the whole page.
// On phones/tablets the sidebar collapses into a hamburger-toggled drawer.
export default function EducatorLayout({ children }) {
  return (
    <AppShell
      section="Educator overview"
      renderSidebar={({ open, onClose }) => <EducatorSidebar open={open} onClose={onClose} />}
    >
      {children}
    </AppShell>
  );
}
