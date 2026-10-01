import StudentSidebar from '@/components/StudentSidebar';
import '@/app/auth.css';

// Persistent shell for the student dashboard and result pages — the sidebar
// stays mounted so navigating between them only swaps the main content.
// The sit (test-taking) page sits outside this group and stays full-screen.
export default function StudentLayout({ children }) {
  return (
    <div style={{ minHeight: '100vh', background: '#f8f7fc' }}>
      <StudentSidebar />
      <main
        style={{
          marginLeft: '240px',
          width: 'calc(100% - 15rem)',
          maxWidth: '1120px',
          padding: '54px clamp(24px, 4vw, 58px) 80px',
        }}
      >
        {children}
      </main>
    </div>
  );
}
