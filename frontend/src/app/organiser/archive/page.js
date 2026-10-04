'use client';

import { useRequireRole } from '@/hooks/useRequireRole';
import OrganiserShell from '@/components/OrganiserShell';
import ArchiveBrowser from '@/components/ArchiveBrowser';

export default function OrganiserArchivePage() {
  const { user, checking } = useRequireRole('organiser');

  if (checking) {
    return (
      <main id="main-content" tabIndex={-1} className="organiser-shell">
        <p style={{ padding: '48px', fontSize: '14px', color: '#6d667c' }}>Loading...</p>
      </main>
    );
  }

  return (
    <OrganiserShell activeNav="archive" breadcrumb="Archive" user={user}>
      <ArchiveBrowser />
    </OrganiserShell>
  );
}
