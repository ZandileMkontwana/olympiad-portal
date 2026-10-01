'use client';

import { useState } from 'react';
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
    match: (p) => p.startsWith('/educator/school'),
  },
  {
    href: '/educator/archive',
    icon: FileText,
    label: 'Archive',
    match: (p) => p.startsWith('/educator/archive'),
  },
];

export default function EducatorSidebar({ collapsed = false, onToggle }) {
  const pathname = usePathname() || '';
  const { user: clerkUser } = useUser();
  const { signOut } = useClerk();
  const [showCalendar, setShowCalendar] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  if (!clerkUser) {
    return (
      <aside className="sidebar">
        <div className="sidebar-top">
          <div className="brand">
            <div className="brand-mark"><GraduationCap /></div>
            <div><strong>Olympiad</strong><span>PORTAL</span></div>
          </div>
        </div>
        <div style={{ padding: '20px', textAlign: 'center', color: '#8b7fa8', fontSize: '13px' }}>
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
      <aside className="sidebar" style={collapsed ? { width: '60px' } : undefined}>
        <div className="sidebar-top">
          <div className="brand">
            <div className="brand-mark"><GraduationCap /></div>
            {!collapsed && <div><strong>Olympiad</strong><span>PORTAL</span></div>}
          </div>
          {onToggle && (
            <button
              onClick={onToggle}
              aria-expanded={!collapsed}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#8b7fa8' }}
            >
              {collapsed ? '→' : '←'}
            </button>
          )}
        </div>
        <nav className="side-nav" aria-label="Main navigation">
          {!collapsed && <p className="nav-label">Workspace</p>}
          {WORKSPACE_LINKS.map(({ href, icon: Icon, label, match }) => {
            const active = match(pathname);
            return (
              <Link
                key={label}
                href={href}
                className={`nav-item${active ? ' nav-selected' : ''}`}
                aria-current={active ? 'page' : undefined}
                title={collapsed ? label : undefined}
              >
                <Icon /> {!collapsed && <span>{label}</span>}
              </Link>
            );
          })}
          {!collapsed && <p className="nav-label nav-label-spaced">Manage</p>}
          <button className="nav-item" onClick={() => setShowCalendar(true)} title={collapsed ? 'Calendar' : undefined}><CalendarDays />{!collapsed && <span>Calendar</span>}</button>
          <button className="nav-item" onClick={() => setShowSettings(true)} title={collapsed ? 'Settings' : undefined}><Settings2 />{!collapsed && <span>Settings</span>}</button>
        </nav>
        {!collapsed && (
          <>
            <div className="sidebar-help">
              <div className="help-icon"><CircleHelp /></div>
              <div><strong>Need a hand?</strong><span>Visit the help centre</span></div>
              <ArrowRight />
            </div>
            <div className="sidebar-profile">
              <div className="avatar">{userInitials}</div>
              <div>
                <strong>{name}</strong>
                <span>
                  <button
                    onClick={handleLogout}
                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#e0615f', fontSize: '9px', fontWeight: 600 }}
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
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setShowCalendar(false)}>
          <div style={{ background: 'white', borderRadius: '12px', padding: '24px', maxWidth: '500px', width: '90%', maxHeight: '80vh', overflow: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ margin: 0, fontSize: '18px', color: '#172554' }}>Calendar</h2>
              <button onClick={() => setShowCalendar(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}><X size={20} /></button>
            </div>
            <p style={{ color: '#667085', fontSize: '14px', marginBottom: '16px' }}>Your upcoming deadlines and events will appear here.</p>
            <div style={{ padding: '32px', textAlign: 'center', background: '#f7f8fc', borderRadius: '8px' }}>
              <CalendarDays size={48} style={{ color: '#6546d8', marginBottom: '12px' }} />
              <p style={{ color: '#667085', fontSize: '14px', margin: 0 }}>No upcoming events</p>
            </div>
          </div>
        </div>
      )}

      {showSettings && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setShowSettings(false)}>
          <div style={{ background: 'white', borderRadius: '12px', padding: '24px', maxWidth: '500px', width: '90%', maxHeight: '80vh', overflow: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ margin: 0, fontSize: '18px', color: '#172554' }}>Settings</h2>
              <button onClick={() => setShowSettings(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}><X size={20} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ padding: '16px', background: '#f7f8fc', borderRadius: '8px' }}>
                <h3 style={{ margin: '0 0 8px', fontSize: '14px', color: '#172554' }}>Profile</h3>
                <p style={{ margin: 0, color: '#667085', fontSize: '13px' }}>Name: {name}</p>
                <p style={{ margin: '4px 0 0', color: '#667085', fontSize: '13px' }}>Email: {clerkUser?.primaryEmailAddress?.emailAddress || 'N/A'}</p>
              </div>
              <div style={{ padding: '16px', background: '#f7f8fc', borderRadius: '8px' }}>
                <h3 style={{ margin: '0 0 8px', fontSize: '14px', color: '#172554' }}>Preferences</h3>
                <p style={{ margin: 0, color: '#667085', fontSize: '13px' }}>Notification settings and preferences will be available here.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
