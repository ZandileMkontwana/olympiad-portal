'use client';

// Shared educator sidebar — rendered once by the /educator layout so it stays
// mounted while educators move between the olympiads board, school dashboard,
// archive, round detail and submission pages (only the main content swaps).
// The shell owns the collapsed state; the sidebar collapses to an icon rail.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useClerk, useUser } from '@clerk/nextjs';

function initials(name) {
  return (name || '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');
}

const LINKS = [
  {
    href: '/educator',
    icon: '🏆',
    label: 'Olympiads',
    // Round detail + result submission belong to the Olympiads section too.
    match: (p) =>
      p === '/educator' || p.startsWith('/educator/round_view') || p.startsWith('/educator/submit'),
  },
  {
    href: '/educator/school',
    icon: '🏫',
    label: 'School Dashboard',
    match: (p) => p.startsWith('/educator/school'),
  },
  {
    href: '/educator/archive',
    icon: '📂',
    label: 'Archive',
    match: (p) => p.startsWith('/educator/archive'),
  },
];

export default function EducatorSidebar({ collapsed = false, onToggle }) {
  const pathname = usePathname() || '';
  const { user: clerkUser } = useUser();
  const { signOut } = useClerk();

  const name = clerkUser?.fullName || clerkUser?.primaryEmailAddress?.emailAddress || '';

  async function handleLogout() {
    if (!window.confirm('Are you sure you want to log out?')) return;
    await signOut({ redirectUrl: '/login' });
  }

  return (
    <aside
      style={{
        width: collapsed ? '72px' : '240px',
        flexShrink: 0,
        height: '100vh',
        background: 'white',
        borderRight: '1px solid rgba(139,92,246,0.1)',
        padding: collapsed ? '24px 10px' : '24px 18px',
        display: 'flex',
        flexDirection: 'column',
        position: 'fixed',
        top: 0,
        left: 0,
        overflowX: 'hidden',
        overflowY: 'auto',
        zIndex: 10,
        transition: 'width 0.2s ease, padding 0.2s ease',
        whiteSpace: 'nowrap',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: collapsed ? 'column' : 'row',
          alignItems: 'center',
          gap: '10px',
          padding: collapsed ? '0 0 24px' : '0 6px 24px',
        }}
      >
        <div
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #8b5cf6, #6d3fd1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontWeight: 800,
            flexShrink: 0,
          }}
        >
          O
        </div>
        {!collapsed && (
          <div>
            <p style={{ margin: 0, fontWeight: 700, fontSize: '0.9em', color: '#2d2640' }}>
              Olympiad Portal
            </p>
            <p style={{ margin: 0, fontSize: '0.7em', color: '#a89fc9' }}>Educator</p>
          </div>
        )}
        {onToggle && (
          <button
            type="button"
            onClick={onToggle}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!collapsed}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            style={{
              marginLeft: collapsed ? 0 : 'auto',
              border: '1px solid rgba(139,92,246,0.25)',
              background: 'transparent',
              borderRadius: '8px',
              padding: '4px 9px',
              cursor: 'pointer',
              fontSize: '0.85em',
              color: '#6b6480',
              lineHeight: 1,
              flexShrink: 0,
            }}
          >
            {collapsed ? '»' : '«'}
          </button>
        )}
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
        {LINKS.map((l) => {
          const active = l.match(pathname);
          return (
            <Link
              key={l.label}
              href={l.href}
              title={l.label}
              aria-current={active ? 'page' : undefined}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: collapsed ? 'center' : 'flex-start',
                gap: collapsed ? 0 : '12px',
                padding: collapsed ? '11px 0' : '11px 14px',
                borderRadius: '10px',
                textDecoration: 'none',
                fontSize: '0.88em',
                fontWeight: 600,
                color: active ? '#6d3fd1' : '#6b6480',
                background: active ? 'rgba(139,92,246,0.1)' : 'transparent',
              }}
            >
              <span style={{ fontSize: '1.1em' }}>{l.icon}</span>
              {!collapsed && l.label}
            </Link>
          );
        })}
      </nav>

      {clerkUser ? (
        collapsed ? (
          <div
            style={{
              borderTop: '1px solid rgba(139,92,246,0.1)',
              paddingTop: '16px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <div
              title={name}
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #c4b5fd, #8b5cf6)',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '0.8em',
                flexShrink: 0,
              }}
            >
              {initials(name)}
            </div>
            <button
              type="button"
              onClick={handleLogout}
              aria-label="Log out"
              title="Log out"
              style={{
                border: 'none',
                background: 'none',
                padding: '2px 4px',
                cursor: 'pointer',
                fontSize: '0.9em',
                color: '#e0615f',
                fontWeight: 700,
                lineHeight: 1,
              }}
            >
              ⏻
            </button>
          </div>
        ) : (
          <div
            style={{
              borderTop: '1px solid rgba(139,92,246,0.1)',
              paddingTop: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #c4b5fd, #8b5cf6)',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '0.8em',
                flexShrink: 0,
              }}
            >
              {initials(name)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p
                style={{
                  margin: 0,
                  fontSize: '0.8em',
                  fontWeight: 600,
                  color: '#2d2640',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {name}
              </p>
              <button
                type="button"
                onClick={handleLogout}
                style={{
                  border: 'none',
                  background: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  fontSize: '0.75em',
                  color: '#e0615f',
                  fontWeight: 600,
                }}
              >
                Log out
              </button>
            </div>
          </div>
        )
      ) : (
        !collapsed && (
          <p style={{ margin: 0, fontSize: '0.75em', color: '#a89fc9' }}>Loading account…</p>
        )
      )}
    </aside>
  );
}
