'use client';

import { useState, useRef, useEffect } from 'react';
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
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const deleteDialogRef = useRef(null);
  const deleteDialogWasOpen = useRef(false);
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

  // Lock scroll while delete dialog is open.
  useEffect(() => {
    if (showDeleteDialog) {
      deleteDialogWasOpen.current = true;
      requestAnimationFrame(() => {
        deleteDialogRef.current?.focus();
      });
      const preventScroll = (e) => {
        e.preventDefault();
      };
      const preventScrollKey = (e) => {
        const scrollKeys = ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '];
        if (scrollKeys.includes(e.key)) {
          e.preventDefault();
        }
      };
      document.addEventListener('wheel', preventScroll, { passive: false });
      document.addEventListener('touchmove', preventScroll, { passive: false });
      document.addEventListener('keydown', preventScrollKey);
      return () => {
        document.removeEventListener('wheel', preventScroll);
        document.removeEventListener('touchmove', preventScroll);
        document.removeEventListener('keydown', preventScrollKey);
      };
    } else if (deleteDialogWasOpen.current) {
      deleteDialogWasOpen.current = false;
    }
  }, [showDeleteDialog]);

  // Scroll lock + Escape for the sign out confirmation dialog.
  useEffect(() => {
    if (!showSignOutConfirm || signingOut) return;
    const preventScroll = (e) => {
      e.preventDefault();
    };
    const preventScrollKey = (e) => {
      const scrollKeys = ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '];
      if (scrollKeys.includes(e.key)) {
        e.preventDefault();
      }
    };
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        setShowSignOutConfirm(false);
      }
    };
    document.addEventListener('wheel', preventScroll, { passive: false });
    document.addEventListener('touchmove', preventScroll, { passive: false });
    document.addEventListener('keydown', preventScrollKey);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('wheel', preventScroll);
      document.removeEventListener('touchmove', preventScroll);
      document.removeEventListener('keydown', preventScrollKey);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [showSignOutConfirm, signingOut]);

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
        <button
          className="nav-item"
          disabled={signingOut}
          onClick={() => setShowSignOutConfirm(true)}
          style={{ margin: '0 8px' }}
        >
          <span style={{ color: 'var(--c-t-b42318)' }}>
            {signingOut ? 'Signing out\u2026' : 'Sign out'}
          </span>
        </button>
        <div className="sidebar-profile">
          <div className="avatar">{userInitials}</div>
          <div>
            <strong>{name}</strong>
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
            <section className="modal-card" aria-labelledby="settings-danger">
              <h3 id="settings-danger">Danger zone</h3>
              <p>Permanently delete your account and all associated data.</p>
              <button
                type="button"
                className="modal-action"
                onClick={() => {
                  setDeleteError('');
                  setShowSettings(false);
                  setShowDeleteDialog(true);
                }}
                style={{ background: '#dc2626' }}
              >
                Delete account
              </button>
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

      {/* Sign out confirmation dialog */}
      {showSignOutConfirm && !signingOut && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="student-signout-heading"
            tabIndex={-1}
            className="mx-4 w-full max-w-sm rounded-xl p-6 shadow-xl"
            style={{ background: 'var(--c-bg-ffffff, #fff)' }}
          >
            <h2 id="student-signout-heading" className="font-display text-xl font-semibold" style={{ color: 'var(--ink, #241f38)' }}>Sign out?</h2>
            <p className="mt-3 text-sm" style={{ color: 'var(--ink-soft, #6c628c)' }}>
              Are you sure you want to sign out of your student account?
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowSignOutConfirm(false)}
                className="rounded-lg px-4 py-2 text-sm font-medium"
                style={{ color: 'var(--ink-soft, #6c628c)' }}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setSigningOut(true);
                  await signOut({ redirectUrl: '/login' });
                }}
                className="rounded-lg px-4 py-2 text-sm font-medium text-white"
                style={{ background: 'var(--violet, #6c4fd8)' }}
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full-page signing out overlay */}
      {signingOut && (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white">
          <div className="auth-spinner" />
          <p className="mt-4 text-base font-medium text-ink">Signing out…</p>
        </div>
      )}

      {/* Delete account confirmation dialog */}
      {showDeleteDialog && (
        <div className="fixed inset-0 z-[1001] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div
            ref={deleteDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="student-delete-heading"
            tabIndex={-1}
            className="mx-4 w-full max-w-md rounded-xl p-6 shadow-xl"
            style={{ background: 'var(--c-bg-ffffff, #fff)' }}
          >
            <h2 id="student-delete-heading" className="font-display text-xl font-semibold" style={{ color: 'var(--ink, #241f38)' }}>Delete your account?</h2>
            <p className="mt-3 text-sm" style={{ color: 'var(--ink-soft, #6c628c)' }}>
              This will permanently delete your account and all your data, including your test
              history, results, and submissions. This cannot be undone.
            </p>
            {deleteError && (
              <div role="alert" className="mt-3 rounded-lg p-3 text-sm" style={{ background: '#fef2f2', color: '#b91c1c' }}>{deleteError}</div>
            )}
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowDeleteDialog(false);
                  setDeleteError('');
                }}
                disabled={deleting}
                className="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
                style={{ color: 'var(--ink-soft, #6c628c)' }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleting}
                className="rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                style={{ background: '#dc2626' }}
              >
                {deleting ? 'Deleting\u2026' : 'Delete my account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
