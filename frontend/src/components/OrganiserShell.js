'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
  Bell,
  CalendarDays,
  ChevronRight,
  ClipboardCheck,
  History,
  LayoutDashboard,
  MessageSquareQuote,
  MoreHorizontal,
  Search,
} from 'lucide-react';

const ClerkSignOutButton = dynamic(
  () => import('@clerk/nextjs').then((mod) => mod.SignOutButton),
  { ssr: false }
);

const NAV_ITEMS = [
  { href: '/organiser', label: 'Dashboard', icon: LayoutDashboard, key: 'dashboard' },
  { href: '/organiser/marking', label: 'Marking', icon: ClipboardCheck, key: 'marking' },
  { href: '/organiser/remarks', label: 'Remarks', icon: MessageSquareQuote, key: 'remarks' },
  { href: '/organiser/replay', label: 'Replay', icon: History, key: 'replay' },
];

/**
 * Shared sidebar + topbar layout for all /organiser/* routes.
 *
 * Props:
 *  - activeNav: which nav item to highlight ('dashboard' | 'marking' | 'remarks' | 'replay')
 *  - breadcrumb: string shown as the current page in the topbar breadcrumb
 *  - user: { name, email, role } — used for the profile block and avatar initials
 *  - children: page content rendered inside <div className="organiser-main">
 */
export default function OrganiserShell({ activeNav, breadcrumb, user, children }) {
  const initials = initialsFrom(user?.name || user?.email || '?');

  return (
    <main className="organiser-shell">
      <aside className="organiser-sidebar">
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
        <nav className="organiser-nav" aria-label="Organiser navigation">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeNav === item.key;
            return (
              <Link key={item.key} href={item.href} className={isActive ? 'is-active' : ''}>
                <Icon size={17} /> {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="organiser-sidebar-bottom">
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

      <section className="organiser-content">
        <header className="organiser-topbar">
          <div className="organiser-breadcrumb">
            <span>Workspace</span>
            <ChevronRight size={14} />
            <strong>{breadcrumb || 'Overview'}</strong>
          </div>
          <div className="organiser-actions">
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

        <div className="organiser-main">{children}</div>
      </section>
    </main>
  );
}

function initialsFrom(name) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}
