import EducatorSidebar from '@/components/EducatorSidebar';

// Persistent shell for every /educator/* page — the sidebar stays mounted so
// navigating between rounds, the school dashboard and round details only
// swaps the main content instead of re-rendering the whole page.
export default function EducatorLayout({ children }) {
  return (
    <div style={{ minHeight: '100vh', background: '#faf9fc' }}>
      <EducatorSidebar />
      <main style={{ marginLeft: '240px', padding: '32px 40px 60px', maxWidth: '1500px' }}>
        {children}
      </main>
    </div>
  );
}
