'use client';

import { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Accessible modal dialog.
 *
 * - role="dialog" + aria-modal + aria-labelledby (the visible title)
 * - Escape closes it; clicking the backdrop closes it
 * - Tab / Shift+Tab are trapped inside the dialog
 * - Focus moves into the dialog on open and returns to the trigger on close
 * - Page scroll is locked while open
 */
export default function Modal({ title, onClose, children }) {
  const titleId = useId();
  const dialogRef = useRef(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const dialog = dialogRef.current;
    dialog?.querySelector(FOCUSABLE)?.focus();

    // Prevent scroll by intercepting wheel, touchmove, and scroll events.
    // This approach doesn't change any layout properties, so the sidebar
    // won't jump.
    const preventScroll = (e) => {
      // Allow scroll inside the modal panel itself.
      if (dialog && dialog.contains(e.target)) return;
      e.preventDefault();
    };
    const preventScrollKey = (e) => {
      const scrollKeys = ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '];
      if (scrollKeys.includes(e.key) && !dialog?.contains(e.target)) {
        e.preventDefault();
      }
    };

    // Use passive: false so preventDefault works.
    document.addEventListener('wheel', preventScroll, { passive: false });
    document.addEventListener('touchmove', preventScroll, { passive: false });
    document.addEventListener('keydown', preventScrollKey);

    // Also lock body overflow as a fallback.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !dialog) return;
      const items = [...dialog.querySelectorAll(FOCUSABLE)];
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('wheel', preventScroll);
      document.removeEventListener('touchmove', preventScroll);
      document.removeEventListener('keydown', preventScrollKey);
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        ref={dialogRef}
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close dialog">
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
