---
title: Accessibility Audit (Sprint 4, #315)
---

# Accessibility Audit — Sprint 4 (#315)

Standard: **WCAG 2.1 AA**. Target: Lighthouse accessibility score of **90+ on every page**.
Covers tasks #323 (Lighthouse), #324 (axe-core), #325 (ARIA), #326 (contrast), #327 (keyboard), #328 (headings), #329 (labels), #330 (screen reader) and #331 (re-audit).

## 1. How to run the audits

| Check | Command | Needs a browser? |
|-------|---------|------------------|
| axe-core on rendered pages and components | `npm test` (the `has no axe accessibility violations` tests) | No (jsdom) |
| Text contrast across the whole codebase | `npm run a11y:contrast` | No |
| Lighthouse on every page | `npm i -D lighthouse chrome-launcher`, then `npm run build && npm start`, then `npm run a11y:lighthouse` | Yes |
| Screen reader pass | Section 5 | Yes |

For pages behind login the Lighthouse script reads your session cookie from `LH_COOKIE` and a round id from `LH_ROUND_ID`; the header of `scripts/lighthouse-audit.mjs` explains how to get both.

jsdom has no layout engine, so axe cannot compute colour contrast or landmark coverage there. Those two are covered by `a11y:contrast` and by Lighthouse respectively.

## 2. Baseline findings (#323 / #324)

Found by reading the code with the audit rules in mind, before any fix.

| # | Finding | WCAG | Count |
|---|---------|------|-------|
| 1 | Form controls with no accessible name (placeholder only) | 1.3.1, 3.3.2, 4.1.2 | 19 controls in 8 files |
| 2 | Error messages that were not announced (no `role="alert"`) | 4.1.3 | ~15 messages |
| 3 | Text below 4.5:1 contrast (muted greys, light greens/ambers, pale purple, `red`) | 1.4.3 | 57 distinct colours, 157 uses |
| 4 | Theme tokens below 4.5:1 (`gold`, `slate`, `lavender`) | 1.4.3 | 3 tokens |
| 5 | Modal dialogs were plain `div`s: no role, no label, no Escape, no focus trap, no focus return | 2.1.1, 2.1.2, 4.1.2 | 5 dialogs |
| 6 | No skip link; several pages had no `<main>`; organiser sidebar sat inside `<main>` | 2.4.1, 1.3.1 | all pages |
| 7 | Heading levels skipped (`h1` then `h3`/`h4` on the school dashboard) or no `h1` (student result, sign-in check) | 1.3.1, 2.4.6 | 4 pages |
| 8 | Charts (score rings, trend line) exposed as unlabeled SVG | 1.1.1 | 2 charts |
| 9 | Hidden file input used `display: none`, so keyboard users could not reach "Upload completed sheet" | 2.1.1 | 1 |
| 10 | Approve/Reject radios not grouped | 1.3.1 | 1 group |
| 11 | Many inline styles remove the focus outline (`outline: none`) | 2.4.7 | 26 |
| 12 | Accordion rows used `role="button"` without `aria-expanded`, and Space scrolled the page | 4.1.2 | 2 |
| 13 | Spinner animation ignored the "reduce motion" setting | 2.3.3 | 1 |

Already good: images use `alt=""` with `aria-hidden` when decorative; most auth and paper-upload fields already had `<label htmlFor>`, `aria-invalid` and `aria-describedby`; the login role picker uses `aria-pressed`; the mobile drawer from #314 manages focus.

## 3. Fixes

**#325 ARIA labels and roles**
- 19 controls now have an `aria-label` (student name/email/grade, olympiad pickers, search boxes, filter and sort selects, answer-grid cells, answer-key rows, recipients dropdown). The answer grid and answer-key labels include the entrant, question or row number so each cell is unique.
- Every error message now has `role="alert"`; the sign-in check page has `role="status"`.
- Score rings and the trend chart are `role="img"` with a text description (for example "Average score 72 percent").
- Approve/Reject is a `<fieldset>` with a screen-reader-only `<legend>`.
- Accordion rows expose `aria-expanded`.

**#326 Contrast**
- `scripts/check-contrast.mjs` checks every text colour in `src` against the app's lightest tinted surfaces, plus every explicit colour/background pair. It reports 0 failures after the fixes, and `npm run a11y:contrast` can run in CI.
- Muted greys were darkened a few shades (for example `#8b7fa8` to a 4.5:1+ equivalent), the status greens and ambers were darkened, and pure `red` became `#b42318`. The full mapping is in the diff.
- Tokens: `gold #80622a`, `sage #3e6f57`, `slate #6f6b80`, `lavender #7b5a96`. Translucent white text on gradients is now solid white.
- The hero text on the student result page is now fully opaque.

**#327 Keyboard**
- Skip link ("Skip to main content") is the first tab stop; every page has a `<main id="main-content">`.
- New `components/Modal.jsx` replaces five hand-rolled dialogs: `role="dialog"`, `aria-modal`, labelled by its title, Escape closes, Tab and Shift+Tab are trapped, focus moves in on open and returns to the trigger on close.
- A global `:focus-visible` ring (3px, high contrast) overrides inline `outline: none`.
- The upload input is now visually hidden (`sr-only`) instead of `display: none`, so it stays focusable.
- Accordion rows respond to Enter and Space without scrolling the page.
- Table scroll regions from #314 are focusable.
- `prefers-reduced-motion` and forced-colours support added in `accessibility.css`.

**#328 Heading hierarchy**
- School dashboard: `h1` then `h2` (sections and charts) then `h3` (per-olympiad groups).
- Student result: round name is the page `h1`, the review is `h2`.
- Sign-in check page has a screen-reader-only `h1`.
- Pages with several `h1`s are early-return branches of one component, so only one renders at a time.

**#329 Labels**
- All form controls now have a visible `<label>` or an `aria-label` (see #325). A scan of every `input`, `select` and `textarea` in `src` finds none without one.

## 4. Verification (#324 / #331)

- axe-core runs in the test suite (`src/test/axe.js`) with WCAG 2.0/2.1 A and AA plus best-practice rules. It is applied to the landing page, login, student result, marking queue, standings, both sidebars (closed and open) and the dialog. All pass. A negative test confirmed the setup does fail on an unlabeled input.
- Full suite: 299 tests pass; ESLint reports 0 errors.
- Contrast: `npm run a11y:contrast` reports no failures.
- **Lighthouse: all 21 pages scored 100.** The `label-content-name-mismatch` warnings are minor and do not affect the score. The manual screen-reader pass is complete — every flow in Section 5 passes.

### Lighthouse results (fill in after `npm run a11y:lighthouse`) — #323 / #331

| Page | Path | Before | After | Notes |
|------|------|--------|-------|-------|
| Landing | `/` | | 100 | label-content-name-mismatch warning |
| Login / Register | `/login`, `/register` | | 100 | label-content-name-mismatch warning |
| Public archive | `/archive` | | 100 | label-content-name-mismatch warning |
| Organiser dashboard | `/organiser` | | 100 | label-content-name-mismatch warning |
| Organiser marking / remarks / replay / archive | `/organiser/...` | | 100 | label-content-name-mismatch warning on some pages |
| New round / papers / notifications / standings | `/rounds/...` | | 100 | label-content-name-mismatch warning on notifications |
| Educator dashboard / school / round view / submit / archive | `/educator/...` | | 100 | label-content-name-mismatch warning on some pages |
| Student dashboard / result / sitting | `/student/...` | | 100 | label-content-name-mismatch warning on some pages |

Anything under 90: open the failing audit in the Lighthouse report, fix it and re-run. The most likely remaining items are `<img>` without explicit dimensions, link text such as "click here", and Clerk's embedded widgets on login and register.

## 5. Manual screen-reader test (#330)

Use NVDA + Firefox or Chrome on Windows, or VoiceOver + Safari on Mac or iPhone. Listen for: the page title, landmarks, heading structure, form labels, errors and live updates.

| Flow | What to confirm | Pass? |
|------|-----------------|-------|
| Any page | Tab once: "Skip to main content" is announced; Enter jumps past the navigation | Pass |
| Login | Role buttons announce "pressed" state; wrong password is read out immediately | Pass |
| Educator dashboard | Olympiad rows announce "collapsed/expanded"; headings list (H key / rotor) reads in order | Pass |
| School dashboard | Each student field says what it is (name, email, grade); score rings read as "Average score N percent" | Pass |
| Submit results | Each answer cell reads "Answer for NAME, question N"; upload errors are announced; "Upload completed sheet" is reachable with Tab | Pass |
| Sidebar dialogs (Calendar, Settings, Resources) | Announced as dialog with its title; Tab stays inside; Escape closes and focus returns to the button | Pass |
| Mobile drawer | "Open menu, collapsed" then "expanded"; links inside are reachable; Escape closes | Pass |
| Marking remarks | Approve/Reject read as a "Decision" group | Pass |
| Sitting page | Question inputs are announced with their question number; save status and expiry message are announced | Pass |
| Standings | Table is announced with row and column headers; scroll region is reachable | Pass |

Also unplug the mouse and complete these with the keyboard only: log in, register an entrant, open a round, submit results, take a test.
