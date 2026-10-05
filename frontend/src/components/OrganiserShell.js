'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';
import '@/app/auth.css';
import {
  Archive as ArchiveIcon,
  Bell,
  CalendarDays,
  ChevronRight,
  ClipboardCheck,
  History,
  LayoutDashboard,
  MessageSquareQuote,
  Menu,
  MoreHorizontal,
  Search,
  Settings2,
  X,
} from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';
import Modal from '@/components/Modal';
import { TourHost, useTour } from '@/components/OnboardingTour';
import { ORGANISER_TOUR } from '@/lib/tour';

const ClerkSignOutButton = dynamic(() => import('@clerk/nextjs').then((mod) => mod.SignOutButton), {
  ssr: false,
});

const NAV_ITEMS = [
  { href: '/organiser', label: 'Dashboard', icon: LayoutDashboard, key: 'dashboard' },
  { href: '/organiser/marking', label: 'Marking', icon: ClipboardCheck, key: 'marking' },
  { href: '/organiser/remarks', label: 'Remarks', icon: MessageSquareQuote, key: 'remarks' },
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
  const [showSettings, setShowSettings] = useState(false);
  const initials = initialsFrom(user?.name || user?.email || '?');
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menuButtonRef = useRef(null);
  const wasOpen = useRef(false);
  const close = useCallback(() => setOpen(false), []);

  // Close the mobile drawer whenever the route changes. (state adjusted during render, not in an effect)
  const [lastPathname, setLastPathname] = useState(pathname);
  if (lastPathname !== pathname) {
    setLastPathname(pathname);
    setOpen(false);
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
        <Link href="/" className="organiser-brand">
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
            onClick={() => {
              close();
              setShowSettings(true);
            }}
          >
            <Settings2 size={14} aria-hidden="true" /> Settings
          </button>
          {ClerkSignOutButton && (
            <ClerkSignOutButton redirectUrl="/login">
              <button type="button" className="organiser-logout">
                Sign out
              </button>
            </ClerkSignOutButton>
          )}
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
            <button className="icon-button" aria-label="Search" type="button">
              <Search size={18} />
            </button>
            <button className="icon-button" aria-label="Notifications" type="button">
              <Bell size={18} />
              <i />
            </button>
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
          </div>
        </Modal>
      )}
    </div>
  );
}

function initialsFrom(name) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}
