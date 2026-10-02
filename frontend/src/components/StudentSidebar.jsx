'use client';

import { useState } from 'react';
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
  { href: '/student', icon: LayoutDashboard, label: 'Dashboard', match: (p) => p === '/student' || p.startsWith('/student/result') },
  { href: '/student#tests', icon: ClipboardCheck, label: 'My tests', match: (p) => p === '/student' },
  { href: '/student#results', icon: Trophy, label: 'Results', match: () => false },
];

export default function StudentSidebar() {
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

  if (!user) {
    return (
      <aside className="sidebar">
        <div className="sidebar-top">
          <div className="brand">
            <div className="brand-mark"><GraduationCap /></div>
            <div><strong>Olympiad</strong><span>PORTAL</span></div>
          </div>
        </div>
        <div style={{ padding: '20px', textAlign: 'center', color: '#8b7fa8', fontSize: '13px' }}>
          Not signed in
        </div>
      </aside>
    );
  }

  const name = user.name || user.email || 'Student';
  const userInitials = initials(name);

  return (
    <>
      <aside className="sidebar">
        <div className="sidebar-top">
          <div className="brand">
            <div className="brand-mark"><GraduationCap /></div>
            <div><strong>Olympiad</strong><span>PORTAL</span></div>
          </div>
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
              >
                <Icon /> <span>{label}</span>
              </Link>
            );
          })}
          <button className="nav-item" onClick={() => setShowResources(true)}><BookOpen /><span>Resources</span></button>
          <p className="nav-label nav-label-spaced">Manage</p>
          <button className="nav-item" onClick={() => setShowCalendar(true)}><CalendarDays /><span>Calendar</span></button>
          <button className="nav-item" onClick={() => setShowSettings(true)}><Settings2 /><span>Settings</span></button>
        </nav>
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
              {checking ? 'Loading...' : (
                <button
                  onClick={handleLogout}
                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#e0615f', fontSize: '9px', fontWeight: 600 }}
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
                <p style={{ margin: '4px 0 0', color: '#667085', fontSize: '13px' }}>Email: {user?.email || 'N/A'}</p>
              </div>
              <div style={{ padding: '16px', background: '#f7f8fc', borderRadius: '8px' }}>
                <h3 style={{ margin: '0 0 8px', fontSize: '14px', color: '#172554' }}>Preferences</h3>
                <p style={{ margin: 0, color: '#667085', fontSize: '13px' }}>Notification settings and preferences will be available here.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {showResources && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setShowResources(false)}>
          <div style={{ background: 'white', borderRadius: '12px', padding: '24px', maxWidth: '500px', width: '90%', maxHeight: '80vh', overflow: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ margin: 0, fontSize: '18px', color: '#172554' }}>Resources</h2>
              <button onClick={() => setShowResources(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}><X size={20} /></button>
            </div>
            <p style={{ color: '#667085', fontSize: '14px', marginBottom: '16px' }}>Study materials and resources will be available here.</p>
            <div style={{ padding: '32px', textAlign: 'center', background: '#f7f8fc', borderRadius: '8px' }}>
              <BookOpen size={48} style={{ color: '#6546d8', marginBottom: '12px' }} />
              <p style={{ color: '#667085', fontSize: '14px', margin: 0 }}>No resources available yet</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
