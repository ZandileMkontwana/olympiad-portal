'use client';

import { useRequireRole } from '@/hooks/useRequireRole';
import ArchiveBrowser from '@/components/ArchiveBrowser';

export default function OrganiserArchivePage() {
  const { user, checking } = useRequireRole('organiser');

  if (checking) {
    return (
      <p style={{ padding: '48px', fontSize: '14px', color: 'var(--c-t-6d667c)' }}>Loading...</p>
    );
  }

  return <ArchiveBrowser />;
}
