import StudentSidebar from '@/components/StudentSidebar';
import '@/app/auth.css';

// Persistent shell for the student dashboard and result pages — the sidebar
// stays mounted so navigating between them only swaps the main content.
// The sit (test-taking) page sits outside this group and stays full-screen.
export default function StudentLayout({ children }) {
  return (
    <div className="app-shell">
      <StudentSidebar />
      <div className="page-shell">
        <header className="topbar">
          <div className="breadcrumbs">
            <span>Workspace</span>
            <strong>Student overview</strong>
          </div>
          <div className="top-actions">
            <div className="avatar">AM</div>
          </div>
        </header>
        <main className="dashboard">{children}</main>
      </div>
    </div>
  );
}
