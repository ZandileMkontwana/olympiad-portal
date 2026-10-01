'use client';

import EducatorSidebar from '@/components/EducatorSidebar';
import '@/app/auth.css';

// Persistent shell for every /educator/* page — the sidebar stays mounted so
// navigating between olympiads, the archive, the school dashboard and round
// details only swaps the main content instead of re-rendering the whole page.
export default function EducatorLayout({ children }) {
  return (
    <div className="app-shell">
      <EducatorSidebar />
      <div className="page-shell">
        <header className="topbar">
          <div className="breadcrumbs">
            <span>Workspace</span>
            <strong>Educator overview</strong>
          </div>
          <div className="top-actions">
            <div className="avatar">AM</div>
          </div>
        </header>
        <main className="dashboard">
          {children}
        </main>
      </div>
    </div>
  );
}
