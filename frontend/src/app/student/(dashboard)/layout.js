import StudentSidebar from '@/components/StudentSidebar';

// Persistent shell for the student dashboard and result pages — the sidebar
// stays mounted so navigating between them only swaps the main content.
// The sit (test-taking) page sits outside this group and stays full-screen.
export default function StudentLayout({ children }) {
  return (
    <div className="min-h-screen bg-canvas">
      <StudentSidebar />
      <main className="relative ml-60 w-[calc(100%-15rem)] max-w-6xl px-8 py-10">{children}</main>
    </div>
  );
}
