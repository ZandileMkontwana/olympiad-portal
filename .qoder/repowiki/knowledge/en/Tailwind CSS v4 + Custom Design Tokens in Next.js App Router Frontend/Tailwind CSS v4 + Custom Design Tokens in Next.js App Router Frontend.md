---
kind: frontend_style
name: Tailwind CSS v4 + Custom Design Tokens in Next.js App Router Frontend
category: frontend_style
scope:
    - '**'
source_files:
    - frontend/package.json
    - frontend/postcss.config.mjs
    - frontend/src/app/globals.css
    - frontend/src/components/SiteHeader.js
    - documents/src/css/custom.css
    - documents/docusaurus.config.js
---

## What system/approach is used

The frontend styling system is built on **Tailwind CSS v4** integrated via the `@tailwindcss/postcss` plugin in a **Next.js App Router** application. The project uses Tailwind's new CSS-first configuration model: there is no `tailwind.config.js`; instead, design tokens and theme extensions are declared directly in `src/app/globals.css` using the `@theme inline` directive. The documentation site (`documents/`) is styled separately with **Docusaurus Classic preset** using its built-in **Infima** framework, overridden through `src/css/custom.css` CSS variables.

## Key files and packages

- `frontend/package.json` — declares `tailwindcss ^4`, `@tailwindcss/postcss ^4`, and Next.js 16 as the runtime.
- `frontend/postcss.config.mjs` — registers only `@tailwindcss/postcss` (no plugins like autoprefixer or purge).
- `frontend/src/app/globals.css` — single source of global styles: Tailwind import, CSS custom properties for colors/fonts, component-level utility classes, keyframe animations, and responsive breakpoints.
- `frontend/src/components/SiteHeader.js` — the only shared UI component; it composes Tailwind utility classes directly in JSX rather than importing CSS modules.
- `documents/src/css/custom.css` — Docusaurus Infema theme overrides (primary green palette, dark-mode variants, code-line highlight background).
- `documents/docusaurus.config.js` — wires `customCss` into the Classic preset and configures Prism syntax highlighting themes (`github` light, `dracula` dark).

## Architecture and conventions

### Design tokens
All visual identity lives in `globals.css` under two scopes:
- `:root` variables define base page colors (`--background`, `--foreground`, `--lavender`, `--dark-lavender`, `--light-lavender`, `--border-lavender`).
- `@theme inline { ... }` block exposes Tailwind theme tokens: semantic color names (`--color-paper`, `--color-surface`, `--color-ink`, `--color-ink-soft`, `--color-lavender`, `--color-lavender-deep`, `--color-gold`, `--color-sage`, `--color-slate`) and font families (`--font-display` → Fraunces, `--font-sans` → Inter, `--font-mono` → Plex Mono). These are consumed throughout the app via Tailwind utilities such as `bg-paper`, `text-ink`, `font-display`, etc.

### Component styling strategy
- Shared layout primitives are defined as plain CSS classes in `globals.css` (`.card`, `.button`, `.message`, `.status.upcoming|open|closed`, `.round-page`, `.round-header`, `.round-information`, `.certificate-card`, `.seal`, `.nav-link`, `.cta-band`, `.step-card`, `.scroll-cue`, `.watermark`).
- Page-specific or small one-off styles are applied as inline Tailwind utility class strings inside JSX components (e.g., `className="..."` composed from Tailwind classes), keeping reusable pieces centralized while allowing per-component composition.
- No CSS Modules or CSS-in-JS libraries are used in the frontend; the only module-scoped stylesheet found is `documents/src/components/HomepageFeatures/styles.module.css` (unused by the main app).

### Animations and motion
- Two keyframes are defined: `stamp-in` (scale + fade) and `fade-in` (translateY + fade), exposed via `.stamp-in` and `.fade-in-delayed` classes.
- A `prefers-reduced-motion: reduce` media query disables both animations for accessibility.

### Responsive strategy
- Mobile-first breakpoints are expressed with standard `@media (max-width: 600px)` rules in `globals.css` (e.g., collapsing `.round-information` grid to single column, stacking `.round-header`).
- Tailwind's built-in responsive prefixes are also used where appropriate within JSX class strings.

### Documentation site styling
- The docs site does not share the frontend's Tailwind theme. It uses Docusaurus' default Infima theme with a green primary palette overridden in `documents/src/css/custom.css` via `--ifm-color-*` variables.
- Dark mode is supported through `[data-theme='dark']` selectors that remap the same Infima variables to lighter greens.
- Syntax highlighting uses Prism themes configured in `docusaurus.config.js`: `prismThemes.github` for light mode and `prismThemes.dracula` for dark mode.

## Conventions and constraints

- **Single global stylesheet**: All global CSS lives in `src/app/globals.css`; component-local CSS is avoided in favor of Tailwind utilities or shared class names in that file.
- **Token-driven colors**: Hardcoded hex values are confined to the `:root` and `@theme inline` blocks. Components must reference colors through Tailwind utilities derived from those tokens (e.g., `bg-lavender`, `text-ink-soft`) rather than redeclaring colors inline.
- **Semantic class naming**: Reusable UI elements use descriptive BEM-like class names (`.card`, `.button`, `.status.*`, `.seal`, `.nav-link`) rather than purely functional Tailwind-only compositions, providing a stable surface for cross-component reuse.
- **Accessibility**: Animations respect `prefers-reduced-motion`; the docs site enables `respectPrefersColorScheme` so users' OS preferences are honored.
- **No third-party UI library**: The frontend does not import any component library (no shadcn, MUI, Chakra, etc.). Visual consistency is maintained entirely through the token layer in `globals.css` and Tailwind utilities.
- **Docs vs. app separation**: The documentation site intentionally keeps its own Infima-based theme; there is no attempt to unify the docs theme with the Next.js app theme.