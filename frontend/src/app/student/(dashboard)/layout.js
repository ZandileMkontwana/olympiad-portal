'use client';

import StudentSidebar from '@/components/StudentSidebar';
import AppShell from '@/components/AppShell';
import '@/app/auth.css';

// Persistent shell for the student dashboard and result pages — the sidebar
// stays mounted so navigating between them only swaps the main content.
// The sit (test-taking) page sits outside this group and stays full-screen.
// On phones/tablets the sidebar collapses into a hamburger-toggled drawer.
export default function StudentLayout({ children }) {
  return (
    <AppShell
      section="Student overview"
      renderSidebar={({ open, onClose }) => <StudentSidebar open={open} onClose={onClose} />}
    >
      {children}
    </AppShell>
  );
}
