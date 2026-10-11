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

    // Prevent scroll by intercepting wheel and touchmove events.
    // When the pointer is inside the modal panel we only allow the
    // wheel if the panel itself is scrollable AND not already at its
    // scroll limit — otherwise the event would chain to the page
    // behind the backdrop.
    const preventScroll = (e) => {
      if (dialog && dialog.contains(e.target)) {
        // Panel is internally scrollable — check limits.
        const isScrollable = dialog.scrollHeight > dialog.clientHeight;
        if (!isScrollable) {
          e.preventDefault();
          return;
        }
        const delta = e.deltaY;
        const atTop = dialog.scrollTop <= 0;
        const atBottom = dialog.scrollTop + dialog.clientHeight >= dialog.scrollHeight;
        if ((delta < 0 && atTop) || (delta > 0 && atBottom)) {
          e.preventDefault();
        }
        return;
      }
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
