'use client';

import { useState } from 'react';
import Modal from '@/components/Modal';
import { useTour } from '@/components/OnboardingTour';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth, useClerk, useUser } from '@clerk/nextjs';
import { deleteAccount } from '@/lib/api';
import {
  LayoutDashboard,
  Trophy,
  Users,
  FileText,
  Settings2,
  CircleHelp,
  ArrowRight,
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
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

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

  const name = clerkUser.fullName || clerkUser.primaryEmailAddress?.emailAddress || 'Educator';
  const userInitials = initials(name);

  async function handleLogout() {
    if (!window.confirm('Are you sure you want to log out?')) return;
    await signOut({ redirectUrl: '/login' });
  }

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
                  {' · '}
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteError('');
                      setShowDeleteDialog(true);
                    }}
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
                    Delete account
                  </button>
                </span>
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
              <p>Email: {clerkUser?.primaryEmailAddress?.emailAddress || 'N/A'}</p>
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
          </div>
        </Modal>
      )}

      {/* Delete account confirmation dialog */}
      {showDeleteDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 className="font-display text-xl font-semibold text-ink">Delete your account?</h2>
            <p className="mt-3 text-sm text-ink-soft">
              This will permanently delete your account and all associated data. This cannot be undone.
            </p>
            {deleteError && (
              <p role="alert" className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700">
                {deleteError}
              </p>
            )}
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                onClick={() => {
                  setShowDeleteDialog(false);
                  setDeleteError('');
                }}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                onClick={handleDeleteAccount}
                disabled={deleting}
              >
                {deleting ? 'Deleting…' : 'Delete my account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
