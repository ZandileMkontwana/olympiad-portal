'use client';

import { useEffect, useState } from 'react';
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

export default function StudentLayout({ children }) {
  // Start with empty initials so server and client render match.
  // Then read localStorage after mount to populate the avatar.
  const [initials, setInitials] = useState('');
  useEffect(() => {
    const session = getStudentSession();
    setInitials(
      session?.user ? initialsFrom(session.user.name || session.user.email || '') : ''
    );
  }, []);
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
