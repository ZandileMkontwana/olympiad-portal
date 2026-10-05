'use client';

import { useState } from 'react';
import Modal from '@/components/Modal';
import { useTour } from '@/components/OnboardingTour';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useClerk, useUser } from '@clerk/nextjs';
import {
  LayoutDashboard,
  Trophy,
  Users,
  FileText,
  CalendarDays,
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
  const { user: clerkUser } = useUser();
  const { signOut } = useClerk();
  const { startTour } = useTour();
  const [showCalendar, setShowCalendar] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

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
              onClose?.();
              setShowCalendar(true);
            }}
            title={collapsed ? 'Calendar' : undefined}
          >
            <CalendarDays />
            {!collapsed && <span>Calendar</span>}
          </button>
          <button
            className="nav-item"
            onClick={() => {
              onClose?.();
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
                      fontSize: '9px',
                      fontWeight: 600,
                    }}
                  >
                    Log out
                  </button>
                </span>
              </div>
              <MoreHorizontal className="profile-more" />
            </div>
          </>
        )}
      </aside>

      {showCalendar && (
        <Modal title="Calendar" onClose={() => setShowCalendar(false)}>
          <p className="modal-intro">Your upcoming deadlines and events will appear here.</p>
          <div className="modal-empty">
            <CalendarDays size={48} aria-hidden="true" />
            <p>No upcoming events</p>
          </div>
        </Modal>
      )}

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
    </>
  );
}
