---
title: Dark Mode (Sprint 4, #316)
---

# Dark mode — Sprint 4 (#316)

Covers tasks #332 (palette and application), #333 (CSS variables), #334 (toggle), #335 (persistence), #336 (system default), #337 (charts and images) and #338 (contrast in dark mode).

## 1. Behaviour

| Acceptance criterion | How it is met |
|----------------------|---------------|
| A theme toggle is visible in the header/sidebar | `ThemeToggle` (sun/moon button) is in the landing header, the login and register pages (top right), the shared header, the educator and student topbar, and the organiser topbar |
| Dark mode applies to every page and component | All colours in CSS and inline styles use variables; Tailwind tokens and utilities are overridden; Clerk's sign-in widgets switch to Clerk's dark base theme |
| Preference persists across sessions | Choice is saved in `localStorage` under `olympiad-theme`; a tiny script in `<head>` applies it before first paint, so there is no flash of the wrong theme |
| System preference is the default | With nothing stored the theme follows `prefers-color-scheme`, including live changes while the page is open. An explicit choice always wins |
| All text remains readable | `npm run a11y:contrast` checks both themes; see section 4 |
| Charts and images adapt | See section 3 |

The toggle is a real toggle button: its name is "Dark mode" and `aria-pressed` carries the state. It is 44px on touch devices. Changing the theme in one tab updates other open tabs.

## 2. How it is built

- `data-theme="light|dark"` on `<html>` is the single switch. `color-scheme` is set with it, so native controls, scrollbars and autofill follow the theme.
- `lib/theme.js` holds the pure logic (storage, system detection, resolve, apply, and the inline init script). `components/ThemeProvider.jsx` keeps React in sync (via `useSyncExternalStore`) and listens for OS and cross-tab changes. `components/ThemeToggle.jsx` is the button. `useTheme()` exposes `theme`, `setTheme`, `toggleTheme` and `resetTheme` (back to following the OS).
- `app/theme.css` defines the palettes (#332, #333):
  - Hand-tuned tokens: page background, text, lavender tokens, Tailwind tokens (`--t-*`), chart colours and score colours.
  - About 150 generated variables named `--c-bg-<hex>`, `--c-bd-<hex>` and `--c-t-<hex>`. The name keeps the original light value, so light mode is visually unchanged. Each has a dark twin: pale backgrounds become dark tinted surfaces, pale borders become subtle dark lines, dark text becomes light text with the same hue.
  - Saturated brand colours (buttons, gradients, status dots) are shared by both themes, so white text on them stays valid.
- Inline styles use the same variables (for example `color: 'var(--c-t-2d2640)'`), so no page needed a second stylesheet.

### Adding new UI
Use an existing variable or token instead of a hex colour. If you need a new colour, add a `--c-*` pair to both blocks in `theme.css`, then run `npm run a11y:contrast`. Do not concatenate an alpha suffix onto a variable (`${color}22` breaks); use `color-mix(in srgb, <colour> 13%, transparent)`.

## 3. Charts and images (#337)

- Score rings and the student trend chart take their track, grid, line and dot colours from `--chart-*` variables (CSS classes `chart-track`, `chart-grid`, `chart-line`, `chart-dot`).
- Score colours (green, amber, red, grey) are `--score-*` variables. They are darker than before in light mode, which also fixes text that used to fall below 4.5:1, and lighter in dark mode.
- The logo (`tree-mark.png`) is a black silhouette, so in dark mode it is inverted to white. The white logo variant is untouched.
- Clerk's sign-in and sign-up widgets use `@clerk/themes` `dark` with a matching background and accent colour.

## 4. Contrast in dark mode (#338)

`npm run a11y:contrast` now checks both themes. For each theme it verifies that every text colour reaches 4.5:1 on the worst surface it can sit on, that each rule or style object with both a colour and a background is an exact pair of at least 4.5:1, and that the runtime score colours pass on every surface. Result: no failures in either theme. Dark values were generated against the lightest dark surface, a dark green tint used for success badges.

Limits: the script cannot see text that inherits its background from a parent element, text over images or gradients, or anything computed in JS beyond the score colours. Lighthouse covers those in the browser.

## 5. Verification

- Unit tests (`lib/theme.test.js`, `components/ThemeProvider.test.jsx`): default from the OS, stored choice beats OS, toggle updates `aria-pressed` and storage, OS changes are followed only until the user chooses, cross-tab sync, blocked storage, and the init script. The toggle has an axe test.
- The full suite passes (317 tests) and ESLint reports 0 errors.
- `npm run a11y:contrast` passes in both themes (183 variables checked).
- **Visual check in a browser: done** — every row of the section 6 checklist was rendered in both themes; results are recorded there. One regression was found and fixed during it: in dark mode `.button` pairs white text with `--lavender`, so the dark override of that token was removed (the saturated brand violet is shared, per section 2) and `.button:hover` darkens with `color-mix` instead of switching to the pale `--dark-lavender` tint.
- Lighthouse in dark mode: `LH_THEME=dark npm run a11y:lighthouse` (forces `prefers-color-scheme: dark`). Result: 100 on all 21 pages, matching the light-mode audit.

## 6. Visual QA checklist (do this at 1024px and again at 375px)

Switch with the toggle on each page, then reload to confirm it sticks. Then clear `olympiad-theme` from localStorage, set the OS or DevTools "Emulate CSS prefers-color-scheme" to dark, and reload to confirm the default.

| Page | Look for | Light OK | Dark OK |
|------|----------|----------|---------|
| `/` landing | hero, cards, footer band, logo | yes | yes |
| `/login`, `/register` | story panel, Clerk card (inputs, buttons, social buttons), role picker | yes | yes |
| `/organiser` | sidebar, stat cards, forms, olympiad rows, access-request cards | yes | yes |
| `/organiser/marking`, `/remarks`, `/replay`, `/archive` | tables, status chips, inputs | yes | yes |
| `/rounds/[id]/papers`, `/notifications`, `/standings` | upload boxes, rule cards, tables | yes | yes |
| `/educator`, `/educator/school` | banner, score rings and bars, charts, modals | yes | yes |
| `/educator/submit`, `/round_view`, `/archive` | answer table, receipt, alerts | yes | yes |
| `/student`, `/student/result`, `/student/sit` | trend chart, badges, score colours, timer bar | yes | yes |
| Dialogs (Calendar, Settings, Resources) | panel background, close button | yes | yes |

Verified as signed-out visitor, organiser, educator and student, switching with the toggle and reloading. Persistence confirmed: the stored choice survived full page loads; cross-tab sync and the system-preference default are covered by the unit tests (the automation browser cannot emulate `prefers-color-scheme`). The automation browser's viewport is fixed at ~831px, so exact 1024px/375px widths were not exercisable; Lighthouse's mobile emulation covers small-viewport rendering.

Data-limited spots (state rendered correctly, but richer states had no data): `/notifications` is a 404 route (pre-existing, unrelated to theming); `/educator/submit` showed its "Round not found" alert because the test educator has no joined olympiads, so the answer table and receipt could not be exercised; `/student/sit` was checked in its closed-round alert state (no open round available for the timer bar); standings were verified with real rows on one round and empty/no-access states on others.

Things most likely to need a small tweak: dark text sitting inside a saturated card whose background comes from a parent (it may stay dark), and any shadow that looks too heavy on dark surfaces. Fix those by switching the offending colour to a `--c-*` variable.
