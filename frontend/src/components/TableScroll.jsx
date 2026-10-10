/**
 * Wraps a wide <table> so it scrolls horizontally inside its own box instead
 * of pushing the whole page sideways on narrow screens.
 *
 * The wrapper is a focusable, labelled region so keyboard and screen-reader
 * users can scroll it too (WCAG 2.1.1 / axe "scrollable-region-focusable").
 */
export default function TableScroll({ label, className = '', children }) {
  return (
    <div
      className={`table-scroll${className ? ` ${className}` : ''}`}
      role="region"
      aria-label={label}
      tabIndex={0}
    >
      {children}
    </div>
  );
}
