'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import ThemeToggle from '@/components/ThemeToggle';

const AUTHED_PREFIXES = ['/student', '/educator', '/organiser', '/archive', '/auth', '/set-password', '/rounds'];

export default function SiteHeader() {
  const pathname = usePathname();

  // The landing and auth pages render their own headers; the dashboards have
  // their own shell topbars. Only show the global header on truly public pages.
  if (
    pathname === '/' ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/register') ||
    AUTHED_PREFIXES.some((p) => pathname.startsWith(p))
  )
    return null;

  return (
    <header className="bg-lavender-deep">
      <nav className="mx-auto flex max-w-3xl items-center justify-between px-8 py-4">
        <Link
          href="/"
          className="flex items-center gap-2 font-display text-lg font-semibold text-white"
        >
          <img
            src="/tree-mark-white.png"
            alt=""
            className="h-6 w-6 object-contain"
            aria-hidden="true"
          />
          Olympiad Portal
        </Link>
        <ThemeToggle className="theme-toggle-on-dark" />
      </nav>
    </header>
  );
}
