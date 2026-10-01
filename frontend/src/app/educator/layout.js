'use client';

import { useState } from 'react';
import EducatorSidebar from '@/components/EducatorSidebar';
import '@/app/auth.css';

// Persistent shell for every /educator/* page — the sidebar stays mounted so
// navigating between olympiads, the archive, the school dashboard and round
// details only swaps the main content instead of re-rendering the whole page.
// The background matches the organiser shell (#f8f7fc) so the portal feels
// like one consistent app.
export default function EducatorLayout({ children }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div style={{ minHeight: '100vh', background: '#f8f7fc' }}>
      <EducatorSidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      <main
        style={{
          marginLeft: collapsed ? '72px' : '240px',
          padding: '54px clamp(24px, 4vw, 58px) 80px',
          maxWidth: '1120px',
          transition: 'margin-left 0.2s ease',
        }}
      >
        {children}
      </main>
    </div>
  );
}
