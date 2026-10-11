'use client';

import { useSyncExternalStore } from 'react';
import StudentSidebar from '@/components/StudentSidebar';
import AppShell from '@/components/AppShell';
import { getStudentSession } from '@/lib/studentSession';
import '@/app/auth.css';

function initialsFrom(name) {
  if (!name) return '';
  const parts = String(name).trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return parts[0].slice(0, 2).toUpperCase();
}

function getInitialsSnapshot() {
  const session = getStudentSession();
  return session?.user ? initialsFrom(session.user.name || session.user.email || '') : '';
}

// Server always returns empty — client reads localStorage after hydration.
function getEmptySnapshot() {
  return '';
}

// No-op subscribe — we don't need to re-render on storage changes.
function subscribe() {
  return () => {};
}

export default function StudentLayout({ children }) {
  const initials = useSyncExternalStore(subscribe, getInitialsSnapshot, getEmptySnapshot);
  return (
    <AppShell
      section="Student overview"
      initials={initials}
      renderSidebar={({ open, onClose }) => <StudentSidebar open={open} onClose={onClose} />}
    >
      {children}
    </AppShell>
  );
}
