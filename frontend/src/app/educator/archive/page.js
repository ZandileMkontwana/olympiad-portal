'use client';

// Educator archive — same ArchiveBrowser as the standalone /archive page,
// but rendered inside the educator shell so the sidebar stays mounted and
// highlights "Archive" instead of "Olympiads".

import { useRequireRole } from '@/hooks/useRequireRole';
import ArchiveBrowser from '@/components/ArchiveBrowser';

export default function EducatorArchivePage() {
  const { checking } = useRequireRole('educator');

  if (checking) {
    return (
      <div
        style={{
          display: 'flex',
          minHeight: '60vh',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <p style={{ color: '#8b7fa8' }}>Loading...</p>
      </div>
    );
  }

  return <ArchiveBrowser />;
}
