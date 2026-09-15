'use client';

import { useState } from 'react';
import EducatorSidebar from '@/components/EducatorSidebar';

// Persistent shell for every /educator/* page — the sidebar stays mounted so
// navigating between olympiads, the archive, the school dashboard and round
// details only swaps the main content instead of re-rendering the whole page.
// The shell owns the sidebar's collapsed state; the background matches the
// landing page (--background) so the portal feels like one app.
export default function EducatorLayout({ children }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)' }}>
      <EducatorSidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      <main
        style={{
          marginLeft: collapsed ? '72px' : '240px',
          padding: '32px 40px 60px',
          maxWidth: '1500px',
          transition: 'margin-left 0.2s ease',
        }}
      >
        {children}
      </main>
    </div>
  );
}
