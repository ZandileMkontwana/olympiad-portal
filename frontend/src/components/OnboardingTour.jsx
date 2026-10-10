'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { usePathname, useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import {
  clearReplayRequest,
  getTourState,
  isReplayRequested,
  requestReplay,
  saveTourState,
  shouldAutoStartTour,
} from '@/lib/tour';

const TourContext = createContext({ startTour: () => {}, active: false });

/** Replay the tour from anywhere inside a <TourHost> (for example Settings). */
export function useTour() {
  return useContext(TourContext);
}

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';
const SPOTLIGHT_PADDING = 8;
const CARD_GAP = 14;
const VIEWPORT_MARGIN = 12;
const AUTOSTART_WAIT_MS = 2000;
const AUTOSTART_POLL_MS = 120;

/** The element for a step, only if a user could actually see it. */
function findVisibleTarget(selector) {
  if (!selector) return null;
  const el = document.querySelector(selector);
  if (!el) return null;
  const style = window.getComputedStyle(el);
  if (style.visibility === 'hidden' || style.display === 'none') return null;
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return null;
  // Off-canvas, for example a sidebar link while the mobile drawer is closed.
  if (rect.right <= 0 || rect.left >= window.innerWidth) return null;
  return el;
}

/**
 * Owns the tour: decides when it starts, remembers whether the user finished
 * or dismissed it, and renders the overlay.
 *
 * Props:
 *  - tour: { role, home, steps }   (see EDUCATOR_TOUR / ORGANISER_TOUR)
 *  - userId: the signed-in user's id; the tour never auto-starts without one
 */
export function TourHost({ tour, userId, children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [active, setActive] = useState(false);
  const [index, setIndex] = useState(0);
  const openerRef = useRef(null);

  const begin = useCallback(() => {
    clearReplayRequest();
    openerRef.current = document.activeElement;
    setIndex(0);
    setActive(true);
  }, []);

  // Wait until the first highlighted element has rendered (the dashboards load
  // their data asynchronously), but never longer than AUTOSTART_WAIT_MS.
  const beginWhenReady = useCallback(() => {
    const first = tour.steps[0]?.target;
    const startedAt = Date.now();
    let timer;
    const check = () => {
      if (findVisibleTarget(first) || Date.now() - startedAt > AUTOSTART_WAIT_MS) {
        begin();
      } else {
        timer = setTimeout(check, AUTOSTART_POLL_MS);
      }
    };
    timer = setTimeout(check, 0);
    return () => clearTimeout(timer);
  }, [tour, begin]);

  // Automatic start: first visit of a new user, on the role's home page.
  useEffect(() => {
    if (active || pathname !== tour.home || !shouldAutoStartTour(tour.role, userId))
      return undefined;
    return beginWhenReady();
  }, [active, pathname, tour, userId, beginWhenReady]);

  // A replay requested from another page continues once we are on the home page.
  // The request lives in sessionStorage because some areas remount their shell
  // (and this component) on every route change.
  useEffect(() => {
    if (active || pathname !== tour.home || !isReplayRequested(tour.role)) return undefined;
    return beginWhenReady();
  }, [active, pathname, tour, beginWhenReady]);

  const startTour = useCallback(() => {
    if (pathname === tour.home) {
      begin();
    } else {
      requestReplay(tour.role);
      router.push(tour.home);
    }
  }, [pathname, tour, begin, router]);

  const close = useCallback(
    (status) => {
      saveTourState(tour.role, userId, status);
      setActive(false);
      const opener = openerRef.current;
      if (opener instanceof HTMLElement && document.contains(opener)) opener.focus();
    },
    [tour, userId]
  );

  const value = useMemo(() => ({ startTour, active }), [startTour, active]);

  return (
    <TourContext.Provider value={value}>
      {children}
      {active &&
        createPortal(
          <TourOverlay
            steps={tour.steps}
            index={index}
            onBack={() => setIndex((i) => Math.max(0, i - 1))}
            onNext={() => setIndex((i) => Math.min(tour.steps.length - 1, i + 1))}
            onSkip={() => close('dismissed')}
            onFinish={() => close('completed')}
          />,
          document.body
        )}
    </TourContext.Provider>
  );
}

/** Position the card next to the highlighted rectangle, kept inside the viewport. */
function placeCard(rect, card) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const below = rect.bottom + CARD_GAP;
  const above = rect.top - CARD_GAP - card.height;
  let top;
  if (below + card.height <= vh - VIEWPORT_MARGIN) top = below;
  else if (above >= VIEWPORT_MARGIN) top = above;
  else top = Math.max(VIEWPORT_MARGIN, vh - card.height - VIEWPORT_MARGIN);

  let left = rect.left;
  // Tall targets such as the sidebar: put the card beside it instead.
  if (rect.height > vh * 0.5 || (top === VIEWPORT_MARGIN && rect.width < vw * 0.4)) {
    const right = rect.right + CARD_GAP;
    if (right + card.width <= vw - VIEWPORT_MARGIN) {
      left = right;
      top = Math.min(Math.max(rect.top, VIEWPORT_MARGIN), vh - card.height - VIEWPORT_MARGIN);
    }
  }
  left = Math.min(Math.max(left, VIEWPORT_MARGIN), vw - card.width - VIEWPORT_MARGIN);
  return { top, left };
}

export function TourOverlay({ steps, index, onBack, onNext, onSkip, onFinish }) {
  const step = steps[index];
  const isFirst = index === 0;
  const isLast = index === steps.length - 1;
  const titleId = useId();
  const bodyId = useId();
  const cardRef = useRef(null);
  // One measured layout: where the target is, whether to dock the card (phones)
  // and where the card goes. Until the first measurement the card is hidden so
  // it never flashes in the wrong place.
  const [layout, setLayout] = useState({ measured: false, rect: null, pos: null, docked: false });

  useEffect(() => {
    let frame = 0;
    const update = () => {
      const el = findVisibleTarget(step.target);
      const rect = el ? el.getBoundingClientRect() : null;
      const docked = window.innerWidth <= 600;
      let pos = null;
      if (rect && !docked && cardRef.current) {
        const box = cardRef.current.getBoundingClientRect();
        pos = placeCard(rect, { width: box.width, height: box.height });
      }
      setLayout({ measured: true, rect, pos, docked });
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    // Bring the target into view first; the scroll listener re-measures after.
    findVisibleTarget(step.target)?.scrollIntoView?.({ block: 'center', inline: 'nearest' });
    schedule();
    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', schedule, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('scroll', schedule, true);
    };
  }, [step]);

  // Each step: move focus to the card so screen readers read the new step.
  useEffect(() => {
    if (layout.measured) cardRef.current?.focus();
  }, [index, layout.measured]);

  // Escape skips; Tab stays inside the card.
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onSkip();
        return;
      }
      if (event.key !== 'Tab') return;
      const card = cardRef.current;
      if (!card) return;
      const items = [...card.querySelectorAll(FOCUSABLE)];
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const current = document.activeElement;
      if (event.shiftKey && (current === first || current === card)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && current === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onSkip]);

  const { measured, rect: targetRect, pos: cardPos, docked } = layout;
  const spotlightStyle = targetRect
    ? {
        top: targetRect.top - SPOTLIGHT_PADDING,
        left: targetRect.left - SPOTLIGHT_PADDING,
        width: targetRect.width + SPOTLIGHT_PADDING * 2,
        height: targetRect.height + SPOTLIGHT_PADDING * 2,
      }
    : null;

  let cardClass = 'tour-card';
  let cardStyle = measured ? undefined : { visibility: 'hidden' };
  if (docked) cardClass += ' tour-card-docked';
  else if (cardPos) cardStyle = { ...cardStyle, top: cardPos.top, left: cardPos.left };
  else cardClass += ' tour-card-centered';

  return (
    <div className="tour-root">
      {/* Blocks clicks on the page behind the tour. */}
      <div className={`tour-backdrop${measured && spotlightStyle ? '' : ' tour-backdrop-dim'}`} />
      {measured && spotlightStyle && (
        <div
          className="tour-spotlight"
          data-testid="tour-spotlight"
          style={spotlightStyle}
          aria-hidden="true"
        />
      )}
      <div
        ref={cardRef}
        className={cardClass}
        style={cardStyle}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        tabIndex={-1}
      >
        <button type="button" className="tour-close" onClick={onSkip} aria-label="Close tour">
          <X size={18} aria-hidden="true" />
        </button>
        <p className="tour-counter">
          Step {index + 1} of {steps.length}
        </p>
        <h2 id={titleId} className="tour-title">
          {step.title}
        </h2>
        <p id={bodyId} className="tour-body">
          {step.body}
        </p>
        <div className="tour-dots" aria-hidden="true">
          {steps.map((s, i) => (
            <span key={s.id} className={`tour-dot${i === index ? ' tour-dot-active' : ''}`} />
          ))}
        </div>
        <div className="tour-actions">
          <button type="button" className="tour-skip" onClick={onSkip}>
            Skip tour
          </button>
          <div className="tour-nav">
            {!isFirst && (
              <button type="button" className="tour-button tour-button-ghost" onClick={onBack}>
                Back
              </button>
            )}
            <button
              type="button"
              className="tour-button tour-button-primary"
              onClick={isLast ? onFinish : onNext}
            >
              {isLast ? 'Done' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export { getTourState };
