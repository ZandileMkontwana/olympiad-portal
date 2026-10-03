---
title: Responsive Audit (Sprint 4, #314)
---

# Responsive Audit — Sprint 4 (#314)

Target widths: **320px** (small phone), **768px** (tablet portrait), **1024px** (small laptop).
This page covers task #318 (audit), #319 (fixes), #320 (hamburger), #321 (tables) and #322 (device testing).

## 1. Audit findings (#318)

The audit was done against the code in `frontend/src`. Items marked *needs visual confirmation* must be checked in DevTools (see section 4).

| # | Finding | Where | Impact |
|---|---------|-------|--------|
| 1 | No `viewport` export | `app/layout.js` | Mobile browsers may lay out at ~980px and shrink the page, so every other fix is moot |
| 2 | Educator and student sidebars had off-canvas CSS but nothing toggled it: no hamburger, no scrim, no state | `EducatorSidebar.jsx`, `StudentSidebar.jsx`, educator and student `layout.js` | Sidebar stayed pinned or unreachable below 760px |
| 3 | Organiser sidebar collapsed to a 66px icon rail instead of a hamburger menu | `OrganiserShell.js`, `auth.css` | Wastes 66px of a 320px screen; acceptance criteria require a hamburger |
| 4 | Drawer breakpoint was 760px, so at 768px (tablet) the sidebar still took ~222px | `globals.css` | Cramped content on tablets |
| 5 | Three-column analytics grid `1.3fr 1fr 1fr` with no fallback | `educator/school/page.js` | Illegible at 320px |
| 6 | `minmax(300px, 1fr)` grid is wider than a 320px content box | `educator/school/page.js` | Horizontal overflow at 320px |
| 7 | Hard-coded `1fr 1fr` form grids (create/edit olympiad) | `organiser/page.js` (4 places) | Cramped inputs at 320px |
| 8 | Badge grid fixed at two columns | `student/(dashboard)/page.js` | Tight at 320px |
| 9 | Tables with no scroll container: standings (x2), answer entry, receipt | `rounds/[id]/standings`, `educator/submit` | Page scrolls sideways |
| 10 | Fixed-width inputs (240px, 180px, 130px, 120px, 80px) | school, marking, remarks pages | Overflow risk in narrow rows |
| 11 | Touch targets under 44px (icon buttons, nav items, filters, small inputs) | global | Hard to tap |
| 12 | Input font size under 16px | global | iOS Safari zooms in on focus |
| 13 | Sitting page: timer scrolls out of view on long papers, small answer boxes | `student/sit/page.js` | Students lose sight of the clock |

Already fine: most flex rows in the school dashboard already use `flexWrap: 'wrap'`; the landing and auth pages already have 760px and 420px breakpoints; modals use `width: 90%`.

## 2. What was changed (#319, #320, #321)

- **Viewport**: `layout.js` exports `viewport` (`device-width`, `initialScale: 1`, `maximumScale: 5` so pinch-zoom still works).
- **New `app/responsive.css`**, loaded after `globals.css`. It holds the drawer rules (breakpoint 860px), the table scroll container, tap-target sizing for touch devices, the 16px input font on phones, and the sitting-page rules. It also adds `overflow-x: clip` on `html` and `body` as a safety net, and `max-width: 100%` on images and form controls.
- **Hamburger drawer (#320)**:
  - New `components/AppShell.jsx` is used by the educator and student layouts. It owns the open state, hamburger button (`aria-expanded`, `aria-controls`), scrim, Escape to close, close on route change, body scroll lock, and focus return.
  - `EducatorSidebar` and `StudentSidebar` accept `open` and `onClose`, add a close button, and close when a link is clicked.
  - `OrganiserShell` has the same behaviour built in. The old 66px icon rail was removed.
  - A closed drawer uses `visibility: hidden`, so keyboard and screen-reader users never tab into off-screen links.
- **Tables (#321)**: new `components/TableScroll.jsx` wraps tables in a labelled, keyboard-focusable scroll region. It is applied to both standings tables and both tables on the educator submit page. Scrolling was chosen over cards because it keeps real table semantics for screen readers.
- **Fixed widths**: the school dashboard grids use `repeat(auto-fit, minmax(min(100%, Npx), 1fr))`. The organiser and student grids use the same pattern. The marking row wraps.
- **Online sitting page**: the timer/progress/save bar is sticky on screens up to 760px; answer boxes are at least 52px tall and 64px wide with a 20px font; `autoCapitalize="characters"` and `autoComplete="off"` are set on the answer inputs.

## 3. Verification so far

- Vitest: all existing tests pass, plus new tests for `AppShell`, `OrganiserShell`, `TableScroll` and the sidebar drawer props.
- ESLint: 0 errors.
- Not yet verified: real rendering at 320 / 768 / 1024px. That is task #322 and needs a browser (section 4).

## 4. Device testing checklist (#322)

In Chrome DevTools use the device toolbar. Set responsive mode to **320 × 640**, **768 × 1024** and **1024 × 768**, then also try iPhone SE and iPad Mini presets. Repeat the real-device pass on at least one Android phone and one iPhone if available.

Paste this in the console on each page to list anything wider than the viewport. The list should be empty:

```js
[...document.querySelectorAll('body *')].filter(
  (el) => el.getBoundingClientRect().right > document.documentElement.clientWidth + 1
).map((el) => el.tagName + '.' + el.className)
```

For each page record Pass or Fail at each width:

| Page | 320 | 768 | 1024 | Notes |
|------|-----|-----|------|-------|
| `/` landing | | | | |
| `/login`, `/register`, `/set-password` | | | | |
| `/organiser` dashboard and create-olympiad form | | | | hamburger opens/closes, Escape works |
| `/organiser/marking`, `/organiser/remarks` | | | | |
| `/organiser/replay`, `/organiser/archive` | | | | |
| `/rounds/new`, `/rounds/[id]/papers`, `/rounds/[id]/notifications` | | | | |
| `/rounds/[id]/standings` (both tabs) | | | | table scrolls inside its box |
| `/educator` and `/educator/round_view` | | | | |
| `/educator/school` | | | | analytics grid collapses to one column |
| `/educator/submit` | | | | answer table and receipt scroll |
| `/educator/archive` | | | | |
| `/student` dashboard and `/student/result` | | | | |
| `/student/sit` | | | | timer stays visible, answers easy to tap, resume after reload |

Also check on every page: no horizontal page scroll, the hamburger opens and closes the drawer, buttons are comfortable to tap, and nothing is hidden behind the on-screen keyboard.
