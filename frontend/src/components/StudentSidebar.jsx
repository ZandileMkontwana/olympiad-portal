'use client';

// Shared student sidebar — rendered once by the student (dashboard) layout so
// it stays mounted while students move between their dashboard and result
// pages. The sit page is deliberately outside that layout: test-taking is a
// focused, full-screen flow.

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useStudentAuth } from '@/hooks/useStudentAuth';
import { deleteAccount } from '@/lib/api';
import { clearStudentSession } from '@/lib/studentSession';

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
  const router = useRouter();
  const { user, checking, signOut, getToken } = useStudentAuth();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  async function handleLogout() {
    if (!window.confirm('Log out of the Olympiad Portal?')) return;
    await signOut({ redirectUrl: '/login' });
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    setDeleteError('');
    try {
      const token = await getToken();
      await deleteAccount(token);
      // Account deleted — clear local session and redirect to login
      clearStudentSession();
      router.replace('/login?deleted=1');
    } catch (err) {
      setDeleteError(err.message || 'Could not delete your account. Please try again.');
      setDeleting(false);
    }
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
            <div className="flex gap-3">
              <button
                onClick={handleLogout}
                className="text-xs font-semibold text-red-500 hover:underline"
              >
                Log out
              </button>
              <button
                onClick={() => setShowDeleteDialog(true)}
                className="text-xs font-semibold text-gray-400 hover:text-red-500 hover:underline"
              >
                Delete account
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="border-t border-lavender/15 pt-4">
          <p className="text-xs text-ink-soft">{checking ? 'Loading account…' : 'Not signed in'}</p>
        </div>
      )}

      {/* Delete account confirmation dialog */}
      {showDeleteDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 className="font-display text-xl font-semibold text-ink">Delete your account?</h2>
            <p className="mt-3 text-sm text-ink-soft">
              This will permanently delete your account and all your data, including your test
              history, results, and submissions. This cannot be undone.
            </p>
            {deleteError && (
              <div className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{deleteError}</div>
            )}
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowDeleteDialog(false);
                  setDeleteError('');
                }}
                disabled={deleting}
                className="rounded-lg px-4 py-2 text-sm font-medium text-ink-soft hover:bg-gray-100 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleting}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete my account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
