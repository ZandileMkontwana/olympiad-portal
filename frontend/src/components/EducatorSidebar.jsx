'use client';

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
    icon: LayoutDashboard,
    label: 'Overview',
    match: (p) => p === '/educator',
  },
  {
    href: '/educator',
    icon: Trophy,
    label: 'Olympiads',
    match: (p) =>
      p.startsWith('/educator/round_view') || p.startsWith('/educator/submit'),
  },
  {
    href: '/educator/school',
    icon: Users,
    label: 'Learners',
    match: (p) => p.startsWith('/educator/school'),
  },
  {
    href: '/educator/archive',
    icon: FileText,
    label: 'Submissions',
    match: (p) => p.startsWith('/educator/archive'),
  },
];

export default function EducatorSidebar() {
  const pathname = usePathname() || '';
  const { user: clerkUser } = useUser();
  const { signOut } = useClerk();

  const name = clerkUser?.fullName || clerkUser?.primaryEmailAddress?.emailAddress || 'Educator';
  const userInitials = initials(name);

  async function handleLogout() {
    if (!window.confirm('Are you sure you want to log out?')) return;
    await signOut({ redirectUrl: '/login' });
  }

  return (
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
            >
              <Icon /> <span>{label}</span>
            </Link>
          );
        })}
        <p className="nav-label nav-label-spaced">Manage</p>
        <button className="nav-item"><CalendarDays /><span>Calendar</span></button>
        <button className="nav-item"><Settings2 /><span>Settings</span></button>
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
    </aside>
  );
}
