'use client';

import { useState } from 'react';
import Modal from '@/components/Modal';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useStudentAuth } from '@/hooks/useStudentAuth';
import {
  LayoutDashboard,
  ClipboardCheck,
  Trophy,
  BookOpen,
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
    href: '/student',
    icon: LayoutDashboard,
    label: 'Dashboard',
    match: (p) => p === '/student' || p.startsWith('/student/result'),
  },
  {
    href: '/student#tests',
    icon: ClipboardCheck,
    label: 'My tests',
    match: (p) => p === '/student',
  },
  { href: '/student#results', icon: Trophy, label: 'Results', match: () => false },
];

export default function StudentSidebar({ open = false, onClose } = {}) {
  const pathname = usePathname() || '';
  const { user, checking, signOut } = useStudentAuth();
  const [showCalendar, setShowCalendar] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showResources, setShowResources] = useState(false);

  async function handleLogout() {
    if (!window.confirm('Log out of the Olympiad Portal?')) return;
    await signOut({ redirectUrl: '/login' });
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
          {WORKSPACE_LINKS.map(({ href, icon: Icon, label, match }) => {
            const active = match(pathname);
            return (
              <Link
                key={label}
                href={href}
                className={`nav-item${active ? ' nav-selected' : ''}`}
                aria-current={active ? 'page' : undefined}
                onClick={onClose}
              >
                <Icon /> <span>{label}</span>
              </Link>
            );
          })}
          <button
            className="nav-item"
            onClick={() => {
              onClose?.();
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
              onClose?.();
              setShowCalendar(true);
            }}
          >
            <CalendarDays />
            <span>Calendar</span>
          </button>
          <button
            className="nav-item"
            onClick={() => {
              onClose?.();
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
                    fontSize: '9px',
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
    </>
  );
}
