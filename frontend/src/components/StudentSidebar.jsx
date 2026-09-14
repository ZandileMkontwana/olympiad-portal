'use client';

// Shared student sidebar — rendered once by the student (dashboard) layout so
// it stays mounted while students move between their dashboard and result
// pages. The sit page is deliberately outside that layout: test-taking is a
// focused, full-screen flow.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useStudentAuth } from '@/hooks/useStudentAuth';

function initials(name) {
  return (name || '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');
}

const LINKS = [
  {
    href: '/student',
    icon: '🏠',
    label: 'Dashboard',
    // Result pages live under /student/result but belong to the dashboard too.
    match: (p) => p === '/student' || p.startsWith('/student/result'),
  },
];

export default function StudentSidebar() {
  const pathname = usePathname() || '';
  const { user, checking, signOut } = useStudentAuth();

  async function handleLogout() {
    if (!window.confirm('Log out of the Olympiad Portal?')) return;
    await signOut({ redirectUrl: '/login' });
  }

  return (
    <aside className="fixed left-0 top-0 flex h-screen w-60 flex-shrink-0 flex-col border-r border-lavender/15 bg-surface px-4 py-6">
      <div className="flex items-center gap-2.5 px-2 pb-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-lavender to-lavender-deep font-display text-lg font-bold text-white">
          O
        </div>
        <div>
          <p className="font-display text-sm font-semibold text-ink">Olympiad Portal</p>
          <p className="text-xs text-ink-soft">Student</p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {LINKS.map((l) => {
          const active = l.match(pathname);
          return (
            <Link
              key={l.label}
              href={l.href}
              aria-current={active ? 'page' : undefined}
              className={`flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-left text-sm font-semibold transition-colors ${
                active ? 'bg-lavender/10 text-lavender-deep' : 'text-ink-soft hover:bg-lavender/5'
              }`}
            >
              <span className="text-base">{l.icon}</span>
              {l.label}
            </Link>
          );
        })}
      </nav>

      {user ? (
        <div className="flex items-center gap-2.5 border-t border-lavender/15 pt-4">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-lavender to-lavender-deep text-xs font-bold text-white">
            {initials(user.name || user.email)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink">{user.name || user.email}</p>
            <button
              onClick={handleLogout}
              className="text-xs font-semibold text-red-500 hover:underline"
            >
              Log out
            </button>
          </div>
        </div>
      ) : (
        <div className="border-t border-lavender/15 pt-4">
          <p className="text-xs text-ink-soft">{checking ? 'Loading account…' : 'Not signed in'}</p>
        </div>
      )}
    </aside>
  );
}
