'use client';

import { useState, useRef, useEffect } from 'react';
import Modal from '@/components/Modal';
import { useTour } from '@/components/OnboardingTour';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth, useClerk, useUser } from '@clerk/nextjs';
import { deleteAccount, fetchCurrentUser } from '@/lib/api';
import {
  LayoutDashboard,
  Trophy,
  Users,
  FileText,
  Settings2,
  GraduationCap,
  MoreHorizontal,
  X,
} from 'lucide-react';

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
    href: '/educator',
    icon: Trophy,
    label: 'Olympiads',
    match: (p) =>
      p === '/educator' || p.startsWith('/educator/round_view') || p.startsWith('/educator/submit'),
  },
  {
    href: '/educator/school',
    icon: Users,
    label: 'School Dashboard',
    tour: 'educator-nav-school',
    match: (p) => p.startsWith('/educator/school'),
  },
  {
    href: '/educator/archive',
    icon: FileText,
    label: 'Archive',
    match: (p) => p.startsWith('/educator/archive'),
  },
];

export default function EducatorSidebar({ collapsed = false, onToggle, open = false, onClose }) {
  const pathname = usePathname() || '';
  const router = useRouter();
  const { user: clerkUser } = useUser();
  const { signOut } = useClerk();
  const { getToken } = useAuth();
  const { startTour } = useTour();
  const [showSettings, setShowSettings] = useState(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const deleteDialogRef = useRef(null);
  const deleteDialogWasOpen = useRef(false);

  // Fetch the database User record so the sidebar shows the real name
  // instead of whatever the Clerk profile has.
  const [dbUser, setDbUser] = useState(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await getToken();
      const fetched = await fetchCurrentUser(token);
      if (!cancelled) setDbUser(fetched);
    })();
    return () => { cancelled = true; };
  }, [getToken]);

  // Focus the dialog when it opens.
  useEffect(() => {
    if (showDeleteDialog) {
      deleteDialogWasOpen.current = true;
      requestAnimationFrame(() => {
        deleteDialogRef.current?.focus();
      });
      // Lock scroll while delete dialog is open.
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

  if (!clerkUser) {
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
        <div
          style={{
            padding: '20px',
            textAlign: 'center',
            color: 'var(--c-t-706391)',
            fontSize: '13px',
          }}
        >
          Loading account...
        </div>
      </aside>
    );
  }

  // Prefer the database name; fall back to Clerk while loading.
  const name = dbUser?.name || clerkUser.fullName || clerkUser.primaryEmailAddress?.emailAddress || 'Educator';
  const email = dbUser?.email || clerkUser.primaryEmailAddress?.emailAddress || '';
  const userInitials = initials(name);

  async function handleDeleteAccount() {
    setDeleting(true);
    setDeleteError('');
    try {
      const token = await getToken();
      await deleteAccount(token);
      router.replace('/login?deleted=1');
    } catch (err) {
      setDeleteError(err.message || 'Could not delete your account. Please try again.');
      setDeleting(false);
    }
  }

  return (
    <>
      <aside
        id="app-sidebar"
        className={`sidebar${open ? ' sidebar-open' : ''}`}
        style={collapsed ? { width: '60px' } : undefined}
      >
        <div className="sidebar-top">
          <div className="brand">
            <div className="brand-mark">
              <GraduationCap />
            </div>
            {!collapsed && (
              <div>
                <strong>Olympiad</strong>
                <span>PORTAL</span>
              </div>
            )}
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
          {onToggle && (
            <button
              onClick={onToggle}
              aria-expanded={!collapsed}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px',
                color: 'var(--c-t-706391)',
              }}
            >
              {collapsed ? '→' : '←'}
            </button>
          )}
        </div>
        <nav className="side-nav" aria-label="Main navigation">
          {!collapsed && <p className="nav-label">Workspace</p>}
          {WORKSPACE_LINKS.map(({ href, icon: Icon, label, match, tour }) => {
            const active = match(pathname);
            return (
              <Link
                key={label}
                href={href}
                className={`nav-item${active ? ' nav-selected' : ''}`}
                aria-current={active ? 'page' : undefined}
                title={collapsed ? label : undefined}
                data-tour={tour}
                onClick={onClose}
              >
                <Icon /> {!collapsed && <span>{label}</span>}
              </Link>
            );
          })}
          {!collapsed && <p className="nav-label nav-label-spaced">Manage</p>}
          <button
            className="nav-item"
            onClick={() => {
              setShowSettings(true);
            }}
            title={collapsed ? 'Settings' : undefined}
          >
            <Settings2 />
            {!collapsed && <span>Settings</span>}
          </button>
        </nav>
        {!collapsed && (
          <>
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
          </>
        )}
      </aside>

      {showSettings && (
        <Modal title="Settings" onClose={() => setShowSettings(false)}>
          <div className="modal-stack">
            <section className="modal-card" aria-labelledby="settings-profile">
              <h3 id="settings-profile">Profile</h3>
              <p>Name: {name}</p>
              <p>Email: {email || 'N/A'}</p>
            </section>
            <section className="modal-card" aria-labelledby="settings-prefs">
              <h3 id="settings-prefs">Preferences</h3>
              <p>Notification settings and preferences will be available here.</p>
            </section>
            <section className="modal-card" aria-labelledby="settings-tour">
              <h3 id="settings-tour">Onboarding</h3>
              <p>Take the short guided tour of the portal again.</p>
              <button
                type="button"
                className="modal-action"
                onClick={() => {
                  setShowSettings(false);
                  startTour();
                }}
              >
                Replay tour
              </button>
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

      {/* Sign out confirmation dialog */}
      {showSignOutConfirm && !signingOut && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="educator-signout-heading"
            tabIndex={-1}
            className="mx-4 w-full max-w-sm rounded-xl p-6 shadow-xl"
            style={{ background: 'var(--c-bg-ffffff, #fff)' }}
          >
            <h2 id="educator-signout-heading" className="font-display text-xl font-semibold" style={{ color: 'var(--ink, #241f38)' }}>Sign out?</h2>
            <p className="mt-3 text-sm" style={{ color: 'var(--ink-soft, #6c628c)' }}>
              Are you sure you want to sign out?
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
            aria-labelledby="educator-delete-heading"
            tabIndex={-1}
            className="mx-4 w-full max-w-md rounded-xl p-6 shadow-xl"
            style={{ background: 'var(--c-bg-ffffff, #fff)' }}
          >
            <h2 id="educator-delete-heading" className="font-display text-xl font-semibold" style={{ color: 'var(--ink, #241f38)' }}>Delete your account?</h2>
            <p className="mt-3 text-sm" style={{ color: 'var(--ink-soft, #6c628c)' }}>
              This will permanently delete your account and all associated data. This cannot be undone.
            </p>
            {deleteError && (
              <p role="alert" className="mt-3 rounded-md p-3 text-sm" style={{ background: '#fef2f2', color: '#b91c1c' }}>
                {deleteError}
              </p>
            )}
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                className="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
                onClick={() => {
                  setShowDeleteDialog(false);
                  setDeleteError('');
                }}
                disabled={deleting}
                style={{ color: 'var(--ink-soft, #6c628c)' }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                onClick={handleDeleteAccount}
                disabled={deleting}
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
