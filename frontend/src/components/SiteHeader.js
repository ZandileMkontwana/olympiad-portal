'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const PUBLIC_PATHS = ['/', '/login', '/register'];

export default function SiteHeader() {
  const pathname = usePathname();
  const isPublicPage = PUBLIC_PATHS.includes(pathname);

  // The landing page renders its own header — don't stack a second one.
  if (pathname === '/') return null;

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
        ) : (
          <div className="flex gap-4 text-sm">
            <Link href="/organiser" className="nav-link-light text-white/70">
              Olympiads
            </Link>
            <Link href="/archive" className="nav-link-light text-white/70">
              Archive
            </Link>
          </div>
        )}
      </nav>
    </header>
  );
}
