'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";

const PUBLIC_PATHS = ["/", "/login", "/register"];

export default function SiteHeader() {
  const pathname = usePathname();
  const isPublicPage = PUBLIC_PATHS.includes(pathname);

  const headerClass = isPublicPage
    ? "bg-lavender-deep"
    : "border-b border-lavender/20 bg-surface";

  return (
    <header className={headerClass}>
      <nav className="mx-auto flex max-w-3xl items-center justify-between px-8 py-4">
        <Link
          href="/"
          className={`flex items-center gap-2 font-display text-lg font-semibold ${
            isPublicPage ? "text-white" : "text-ink"
          }`}
        >
          <img
            src={isPublicPage ? "/tree-mark-white.png" : "/tree-mark.png"}
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
            <Link href="/organiser" className="nav-link text-ink-soft">
              Rounds
            </Link>
            
          </div>
        )}
      </nav>

    </header>
  );
}