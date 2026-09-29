'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const PUBLIC_PATHS = ['/', '/login', '/register'];

export default function SiteHeader() {
  const pathname = usePathname();
  const isPublicPage = PUBLIC_PATHS.includes(pathname);

  // The landing and auth pages render their own headers — don't stack a second one.
  // With Clerk's path-based routing, also hide on sub-routes like /login/factor-one.
  if (
    pathname === '/' ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/register')
  )
    return null;

  const headerClass = 'bg-lavender-deep';

  return (
    <header className={headerClass}>
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

        {isPublicPage ? (
          <div className="flex items-center gap-6 text-sm">
            <Link href="/register" className="nav-link-light text-white/70">
              Register
            </Link>
            <Link href="/login" className="nav-link-light font-medium text-white">
              Log in
            </Link>
          </div>
        ) : null}
      </nav>
    </header>
  );
}
