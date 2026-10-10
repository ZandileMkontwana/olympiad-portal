'use client';

import { useState, useEffect } from 'react';
import Modal from '@/components/Modal';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useStudentAuth } from '@/hooks/useStudentAuth';
import {
  LayoutDashboard,
  ClipboardCheck,
  Trophy,
  BookOpen,
  Settings2,
  CircleHelp,
  ArrowRight,
  GraduationCap,
  MoreHorizontal,
  X,
} from 'lucide-react';
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

const WORKSPACE_LINKS = [
  {
    href: '/student',
    icon: LayoutDashboard,
    label: 'Dashboard',
    match: (p, hash) => (p === '/student' && !hash) || p.startsWith('/student/result'),
  },
  {
    href: '/student#tests',
    icon: ClipboardCheck,
    label: 'My tests',
    hash: 'tests',
    match: (p, hash) => p === '/student' && hash === 'tests',
  },
  {
    href: '/student#results',
    icon: Trophy,
    label: 'Results',
    hash: 'results',
    match: (p, hash) => p === '/student' && hash === 'results',
  },
];

export default function StudentSidebar({ open = false, onClose } = {}) {
  const pathname = usePathname() || '';
  const router = useRouter();
  const { user, checking, signOut, getToken } = useStudentAuth();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [hash, setHash] = useState(typeof window !== 'undefined' ? window.location.hash.slice(1) : '');
  const [showSettings, setShowSettings] = useState(false);
  const [showResources, setShowResources] = useState(false);

  useEffect(() => {
    function onHashChange() {
      setHash(window.location.hash.slice(1));
    }
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  function handleNavClick(e, linkHash) {
    if (!linkHash) return;
    e.preventDefault();
    const el = document.getElementById(linkHash);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      window.history.replaceState(null, '', `#${linkHash}`);
      setHash(linkHash);
    }
    onClose?.();
  }

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

  if (checking) {
    return (
      <aside className="sidebar">
        <div className="sidebar-top">
          <div className="brand">
            <div className="brand-mark">
              <GraduationCap />
            </div>
            <div>
              <strong>Olympiad</strong>
              <span>PORTAL</span>
            </div>
          </div>
        </div>
        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--c-t-706391)', fontSize: '13px' }}>
          Loading account...
        </div>
      </aside>
    );
  }

  if (!user) {
    return (
      <aside className="sidebar">
        <div className="sidebar-top">
          <div className="brand">
            <div className="brand-mark">
              <GraduationCap />
            </div>
            <div>
              <strong>Olympiad</strong>
              <span>PORTAL</span>
            </div>
          </div>
        </div>
        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--c-t-706391)', fontSize: '13px' }}>
          Not signed in
        </div>
      </aside>
    );
  }

  const name = user.name || user.email || 'Student';
  const userInitials = initials(name);

  return (
    <>
      <aside id="app-sidebar" className={`sidebar${open ? ' sidebar-open' : ''}`}>
        <div className="sidebar-top">
          <div className="brand">
            <div className="brand-mark">
              <GraduationCap />
            </div>
            <div>
              <strong>Olympiad</strong>
              <span>PORTAL</span>
            </div>
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
          {onClose && (
            <button
              type="button"
              className="icon-button mobile-close"
              onClick={onClose}
              aria-label="Close menu"
            >
              <X aria-hidden="true" />
            </button>
          )}
        </div>
        <nav className="side-nav" aria-label="Main navigation">
          <p className="nav-label">Workspace</p>
          {WORKSPACE_LINKS.map(({ href, icon: Icon, label, match, hash: linkHash }) => {
            const active = match(pathname, hash);
            return (
              <Link
                key={label}
                href={href}
                className={`nav-item${active ? ' nav-selected' : ''}`}
                aria-current={active ? 'page' : undefined}
                onClick={(e) => {
                  if (linkHash) {
                    handleNavClick(e, linkHash);
                  } else {
                    onClose?.();
                  }
                }}
              >
                <Icon /> <span>{label}</span>
              </Link>
            );
          })}
          <button
            className="nav-item"
            onClick={() => {
              setShowResources(true);
            }}
          >
            <BookOpen />
            <span>Resources</span>
          </button>
          <p className="nav-label nav-label-spaced">Manage</p>
          <button
            className="nav-item"
            onClick={() => {
              setShowSettings(true);
            }}
          >
            <Settings2 />
            <span>Settings</span>
          </button>
        </nav>
        <div className="sidebar-help">
          <div className="help-icon">
            <CircleHelp />
          </div>
          <div>
            <strong>Need a hand?</strong>
            <span>Visit the help centre</span>
          </div>
          <ArrowRight />
        </div>
        <div className="sidebar-profile">
          <div className="avatar">{userInitials}</div>
          <div>
            <strong>{name}</strong>
            <span>
              {checking ? (
                'Loading...'
              ) : (
                <button
                  onClick={handleLogout}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    color: 'var(--c-t-b42318)',
                    fontSize: '12px',
                    fontWeight: 600,
                  }}
                >
                  Log out
                </button>
              )}
            </span>
          </div>
          <MoreHorizontal className="profile-more" />
        </div>
      </aside>

      {showSettings && (
        <Modal title="Settings" onClose={() => setShowSettings(false)}>
          <div className="modal-stack">
            <section className="modal-card" aria-labelledby="settings-profile">
              <h3 id="settings-profile">Profile</h3>
              <p>Name: {name}</p>
              <p>Email: {user?.email || 'N/A'}</p>
            </section>
            <section className="modal-card" aria-labelledby="settings-prefs">
              <h3 id="settings-prefs">Preferences</h3>
              <p>Notification settings and preferences will be available here.</p>
            </section>
          </div>
        </Modal>
      )}

      {showResources && (
        <Modal title="Resources" onClose={() => setShowResources(false)}>
          <p className="modal-intro">Study materials and resources will be available here.</p>
          <div className="modal-empty">
            <BookOpen size={48} aria-hidden="true" />
            <p>No resources available yet</p>
          </div>
        </Modal>
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
    </>
  );
}
