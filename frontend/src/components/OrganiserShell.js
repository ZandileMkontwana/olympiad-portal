'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import '@/app/auth.css';
import {
  Archive as ArchiveIcon,
  Bell,
  ChevronRight,
  ClipboardCheck,
  Copy,
  History,
  LayoutDashboard,
  MessageSquareQuote,
  Menu,
  MoreHorizontal,
  Settings2,
  X,
} from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';
import Modal from '@/components/Modal';
import { TourHost, useTour } from '@/components/OnboardingTour';
import { ORGANISER_TOUR } from '@/lib/tour';
import { buildActivityStreamUrl, deleteAccount } from '@/lib/api';
import { useAuth } from '@clerk/nextjs';

const NAV_ITEMS = [
  { href: '/organiser', label: 'Dashboard', icon: LayoutDashboard, key: 'dashboard' },
  { href: '/organiser/marking', label: 'Marking', icon: ClipboardCheck, key: 'marking' },
  { href: '/organiser/remarks', label: 'Remarks', icon: MessageSquareQuote, key: 'remarks' },
  { href: '/organiser/duplicates', label: 'Duplicates', icon: Copy, key: 'duplicates' },
  { href: '/organiser/replay', label: 'Replay', icon: History, key: 'replay' },
  { href: '/organiser/archive', label: 'Archive', icon: ArchiveIcon, key: 'archive' },
];

/**
 * Shared sidebar + topbar layout for all /organiser/* routes.
 *
 * Props:
 *  - activeNav: which nav item to highlight ('dashboard' | 'marking' | 'remarks' | 'replay' | 'archive')
 *  - breadcrumb: string shown as the current page in the topbar breadcrumb
 *  - user: { name, email, role } — used for the profile block and avatar initials
 *  - children: page content rendered inside <div className="organiser-main">
 */
export default function OrganiserShell(props) {
  // New organisers get a short guided tour on their first visit (#317).
  return (
    <TourHost tour={ORGANISER_TOUR} userId={props.user?.id ?? props.user?.email}>
      <OrganiserShellLayout {...props} />
    </TourHost>
  );
}

function OrganiserShellLayout({ activeNav, breadcrumb, user, children }) {
  const { startTour } = useTour();
  const { getToken, signOut } = useAuth();
  const [showSettings, setShowSettings] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [signingOut, setSigningOut] = useState(false);
  const deleteButtonRef = useRef(null);
  const deleteDialogRef = useRef(null);
  const deleteDialogWasOpen = useRef(false);
  const settingsButtonRef = useRef(null);
  const initials = initialsFrom(user?.name || user?.email || '?');
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const menuButtonRef = useRef(null);
  const wasOpen = useRef(false);
  const close = useCallback(() => setOpen(false), []);

  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef(null);
  const [notifications, setNotifications] = useState([]);

  // Connect to the activity SSE stream for the notifications dropdown.
  useEffect(() => {
    if (!notifOpen) return undefined;
    let es;
    (async () => {
      const token = await getToken();
      if (!token) return;
      es = new EventSource(buildActivityStreamUrl(token));
      es.addEventListener('history', (e) => {
        try {
          setNotifications(JSON.parse(e.data).slice(0, 8));
        } catch {}
      });
      es.addEventListener('message', (e) => {
        try {
          const item = JSON.parse(e.data);
          setNotifications((prev) => [item, ...prev].slice(0, 8));
        } catch {}
      });
    })();
    return () => {
      if (es) es.close();
    };
  }, [notifOpen, getToken]);

  // Close dropdown on click outside or Escape.
  useEffect(() => {
    if (!notifOpen) return undefined;
    const onClick = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setNotifOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [notifOpen]);

  // Close the mobile drawer whenever the route changes. (state adjusted during render, not in an effect)
  const [lastPathname, setLastPathname] = useState(pathname);
  if (lastPathname !== pathname) {
    setLastPathname(pathname);
    setOpen(false);
    setNotifOpen(false);
  }

  useEffect(() => {
    if (!open) {
      if (wasOpen.current) menuButtonRef.current?.focus();
      wasOpen.current = false;
      return undefined;
    }
    wasOpen.current = true;
    document.getElementById('organiser-sidebar')?.querySelector('a, button')?.focus();

    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  // Focus the dialog when it opens; return focus to trigger on close.
  // Also prevent scroll by intercepting wheel/touchmove events.
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
      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.removeEventListener('wheel', preventScroll);
        document.removeEventListener('touchmove', preventScroll);
        document.removeEventListener('keydown', preventScrollKey);
        document.body.style.overflow = previousOverflow;
      };
    } else if (deleteDialogWasOpen.current) {
      deleteDialogWasOpen.current = false;
      // Settings was closed before the delete dialog opened, so return
      // focus to the Settings button in the sidebar.
      settingsButtonRef.current?.focus();
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
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('wheel', preventScroll);
      document.removeEventListener('touchmove', preventScroll);
      document.removeEventListener('keydown', preventScrollKey);
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [showSignOutConfirm, signingOut]);

  async function handleDeleteAccount() {
    setDeleting(true);
    setDeleteError('');
    try {
      const token = await getToken();
      await deleteAccount(token);
      // Account deleted — redirect to login
      router.replace('/login?deleted=1');
    } catch (err) {
      setDeleteError(err.message || 'Could not delete your account. Please try again.');
      setDeleting(false);
    }
  }

  return (
    <div className="organiser-shell">
      <aside
        id="organiser-sidebar"
        aria-label="Sidebar"
        className={`organiser-sidebar${open ? ' is-open' : ''}`}
      >
        <button
          type="button"
          className="icon-button organiser-sidebar-close"
          onClick={close}
          aria-label="Close menu"
        >
          <X size={20} aria-hidden="true" />
        </button>
        <Link href="/organiser" className="organiser-brand">
          <span className="organiser-brand-mark">
            <svg width="30" height="30" viewBox="0 0 40 40" fill="none" aria-hidden="true">
              <circle cx="20" cy="20" r="18" stroke="#6c4fd8" strokeWidth="2.5" fill="none" />
              <path
                d="M20 8 C20 8 12 16 12 22 C12 26.4 15.6 30 20 30 C24.4 30 28 26.4 28 22 C28 16 20 8 20 8Z"
                fill="#6c4fd8"
                opacity="0.18"
              />
              <path
                d="M20 12 L20 26 M16 18 L20 12 L24 18"
                stroke="#6c4fd8"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </svg>
          </span>
          <span>
            <strong>Olympiad</strong>
            <small>Portal</small>
          </span>
        </Link>

        <p className="organiser-nav-label">Workspace</p>
        <nav className="organiser-nav" aria-label="Organiser navigation" data-tour="organiser-nav">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeNav === item.key;
            return (
              <Link
                key={item.key}
                href={item.href}
                className={isActive ? 'is-active' : ''}
                aria-current={isActive ? 'page' : undefined}
                onClick={close}
              >
                <Icon size={17} /> {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="organiser-sidebar-bottom">
          <button
            type="button"
            className="organiser-logout organiser-settings"
            ref={settingsButtonRef}
            onClick={() => {
              setShowSettings(true);
            }}
          >
            <Settings2 size={14} aria-hidden="true" /> Settings
          </button>
          <button
            type="button"
            className="organiser-logout"
            disabled={signingOut}
            onClick={() => setShowSignOutConfirm(true)}
          >
            Sign out
          </button>
          <div className="organiser-profile">
            <span className="profile-avatar">{initials}</span>
            <span>
              <strong>{user?.name || user?.email || 'Organiser'}</strong>
              <small>{user?.role || 'Organiser'}</small>
            </span>
            <MoreHorizontal size={16} />
          </div>
        </div>
      </aside>

      {open && (
        <button
          type="button"
          className="organiser-scrim"
          aria-label="Close menu"
          tabIndex={-1}
          onClick={close}
        />
      )}

      <section className="organiser-content">
        <header className="organiser-topbar">
          <div className="organiser-breadcrumb">
            <button
              ref={menuButtonRef}
              type="button"
              className="icon-button organiser-menu-button"
              aria-label="Open menu"
              aria-expanded={open}
              aria-controls="organiser-sidebar"
              onClick={() => setOpen(true)}
            >
              <Menu size={22} aria-hidden="true" />
            </button>
            <span>Workspace</span>
            <ChevronRight size={14} />
            <strong>{breadcrumb || 'Overview'}</strong>
          </div>
          <div className="organiser-actions">
            <ThemeToggle />
            <div className="organiser-dropdown-wrap" ref={notifRef}>
              <button
                className="icon-button"
                aria-label="Notifications"
                aria-expanded={notifOpen}
                type="button"
                onClick={() => setNotifOpen((v) => !v)}
              >
                <Bell size={18} />
                {notifications.length > 0 && <i />}
              </button>
              {notifOpen && (
                <div
                  className="organiser-dropdown organiser-notif-dropdown"
                  role="region"
                  aria-label="Notifications"
                >
                  <h4 className="organiser-dropdown-heading">Recent activity</h4>
                  {notifications.length === 0 && (
                    <p className="organiser-search-empty">No recent activity</p>
                  )}
                  {notifications.map((n, i) => (
                    <div key={`${n.type}-${n.ts}-${i}`} className="organiser-notif-item">
                      <span className="organiser-notif-type">{formatNotifType(n.type)}</span>
                      <span className="organiser-notif-detail">{n.detail || n.type}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <span className="top-avatar">{initials}</span>
          </div>
        </header>

        <main id="main-content" tabIndex={-1} className="organiser-main">
          {children}
        </main>
      </section>

      {showSettings && (
        <Modal title="Settings" onClose={() => setShowSettings(false)}>
          <div className="modal-stack">
            <section className="modal-card" aria-labelledby="settings-profile">
              <h3 id="settings-profile">Profile</h3>
              <p>Name: {user?.name || 'N/A'}</p>
              <p>Email: {user?.email || 'N/A'}</p>
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
                ref={deleteButtonRef}
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

      {/* Delete account confirmation dialog */}
      {showDeleteDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div
            ref={deleteDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="organiser-delete-heading"
            tabIndex={-1}
            className="mx-4 w-full max-w-md rounded-xl p-6 shadow-xl"
            style={{ background: 'var(--c-bg-ffffff, #fff)' }}
          >
            <h2 id="organiser-delete-heading" className="font-display text-xl font-semibold" style={{ color: 'var(--ink, #241f38)' }}>Delete your account?</h2>
            <p className="mt-3 text-sm" style={{ color: 'var(--ink-soft, #6c628c)' }}>
              This will permanently delete your account and all associated data. This cannot be undone.
            </p>
            <p className="mt-2 text-sm" style={{ color: 'var(--ink-soft, #6c628c)' }}>
              If you own any olympiads, you must transfer ownership to another organiser first.
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
                {deleting ? 'Deleting...' : 'Delete my account'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sign out confirmation dialog */}
      {showSignOutConfirm && !signingOut && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="organiser-signout-heading"
            tabIndex={-1}
            className="mx-4 w-full max-w-sm rounded-xl p-6 shadow-xl"
            style={{ background: 'var(--c-bg-ffffff, #fff)' }}
          >
            <h2 id="organiser-signout-heading" className="font-display text-xl font-semibold" style={{ color: 'var(--ink, #241f38)' }}>Sign out?</h2>
            <p className="mt-3 text-sm" style={{ color: 'var(--ink-soft, #6c628c)' }}>
              Are you sure you want to sign out of your organiser account?
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
    </div>
  );
}

function initialsFrom(name) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function formatNotifType(type) {
  if (!type) return 'Activity';
  return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
