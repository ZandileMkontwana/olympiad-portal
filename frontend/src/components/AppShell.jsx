'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';

export const SIDEBAR_ID = 'app-sidebar';

/**
 * Shared shell for the educator and student areas: sidebar + topbar + content.
 *
 * On narrow screens (<= 860px, see responsive.css) the sidebar becomes an
 * off-canvas drawer. This component owns the open/closed state, the hamburger
 * button, the scrim, Escape-to-close, scroll locking and focus handling.
 *
 * Props:
 *  - renderSidebar: ({ open, onClose }) => ReactNode
 *  - section: label shown in the topbar breadcrumb
 *  - initials: avatar initials shown in the topbar
 */
export default function AppShell({ renderSidebar, section, initials = 'AM', children }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menuButtonRef = useRef(null);
  const wasOpen = useRef(false);

  const close = useCallback(() => setOpen(false), []);

  // Close the drawer whenever the route changes. (state adjusted during render, not in an effect)
  const [lastPathname, setLastPathname] = useState(pathname);
  if (lastPathname !== pathname) {
    setLastPathname(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) {
      // Hand focus back to the hamburger button after the drawer closes.
      if (wasOpen.current) menuButtonRef.current?.focus();
      wasOpen.current = false;
      return undefined;
    }
    wasOpen.current = true;

    // Move focus into the drawer so keyboard users land on the navigation.
    const sidebar = document.getElementById(SIDEBAR_ID);
    sidebar?.querySelector('a, button')?.focus();

    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);

    // Don't let the page behind the drawer scroll.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  return (
    <div className="app-shell">
      {renderSidebar({ open, onClose: close })}
      {open && (
        <button
          type="button"
          className="scrim"
          aria-label="Close menu"
          tabIndex={-1}
          onClick={close}
        />
      )}
      <div className="page-shell">
        <header className="topbar">
          <div className="topbar-left">
            <button
              ref={menuButtonRef}
              type="button"
              className="icon-button menu-button"
              aria-label="Open menu"
              aria-expanded={open}
              aria-controls={SIDEBAR_ID}
              onClick={() => setOpen(true)}
            >
              <Menu aria-hidden="true" />
            </button>
            <div className="breadcrumbs">
              <span>Workspace</span>
              <strong>{section}</strong>
            </div>
          </div>
          <div className="top-actions">
            <div className="avatar" aria-hidden="true">
              {initials}
            </div>
          </div>
        </header>
        <main id="main-content" tabIndex={-1} className="dashboard">
          {children}
        </main>
      </div>
    </div>
  );
}
