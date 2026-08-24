---
kind: dependency_management
name: npm-based Monorepo with Per-Workspace Lockfiles and Husky Pre-commit Linting
category: dependency_management
scope:
    - '**'
source_files:
    - package.json
    - backend/package.json
    - frontend/package.json
    - documents/package.json
    - backend/package-lock.json
    - frontend/package-lock.json
    - documents/package-lock.json
    - .husky/pre-commit
    - .lintstagedrc.js
    - shared/types.js
---

## Dependency Management Approach

This repository is a JavaScript/Node.js monorepo that uses **npm** as the package manager, organized as separate npm workspaces (one `package.json` per subproject: `backend`, `frontend`, `documents`, plus a root `package.json`). There is no top-level `package-lock.json` for workspace orchestration — each workspace maintains its own independent lockfile (`backend/package-lock.json`, `frontend/package-lock.json`, `documents/package-lock.json`), and there is no shared `node_modules` hoisting at the repo root beyond a small root manifest.

### Package Declaration Strategy

- **Backend** (`backend/package.json`): Declares runtime dependencies (`express`, `@prisma/client`, `bcrypt`, `jsonwebtoken`, `multer`, `node-cron`, `passport`, `@sendgrid/mail`, etc.) and dev dependencies (`vitest`, `eslint`, `prisma`, `supertest`). Uses ESM via `"type": "module"`. Includes a `postinstall` hook running `prisma generate` to regenerate the Prisma client on install. An explicit `allowScripts` field whitelists native scripts for `prisma@5.22.0` and `@prisma/engines@5.22.0`.
- **Frontend** (`frontend/package.json`): Declares pinned runtime deps (`next` `16.3.0`, `react` `19.2.8`, `react-dom` `19.2.8`, `xlsx`) and dev deps including Tailwind v4, Vitest, ESLint, Prettier. Marked `private: true`.
- **Documents** (`documents/package.json`): Docusaurus 3.10.2 stack with `react` `^19.0.0`, `react-dom` `^19.0.0`, and an `engines.node >= 20.0` constraint.
- **Root** (`package.json`): Minimal manifest declaring only dev tooling (`husky`, `lint-staged`, `eslint`, `prettier`) and scripts that delegate test execution into `backend` and `frontend` via `cd` + `npx vitest run`. The `prepare` script runs `husky` to set up pre-commit hooks.

### Versioning Conventions

- **Pinned exact versions** are used for framework/runtime packages where stability matters: `next` `16.3.0`, `react` `19.2.8`, `react-dom` `19.2.8`, `@docusaurus/core` `3.10.2`, `@docusaurus/preset-classic` `3.10.2`, `eslint-config-next` `16.3.0`.
- **Caret ranges (`^`)** are used for most other dependencies, allowing minor/patch updates within the specified major version.
- No private npm registry or `.npmrc` configuration was found; all packages resolve from the public `https://registry.npmjs.org/` (visible in lockfile `resolved` URLs).

### Lockfiles

Each workspace ships a `package-lock.json` (lockfileVersion 3) that pins every transitive dependency tree deterministically. These lockfiles are committed alongside their respective `package.json`, ensuring reproducible installs across environments.

### Shared Code Pattern

There is no shared npm package published between frontend and backend. Instead, type definitions are duplicated as JSDoc `@typedef`s in `shared/types.js` and referenced via relative imports in both `frontend/src/lib/api.js` and `backend/src/routes/*.js`. This avoids publishing a private package but means type drift must be managed manually.

### Pre-commit Enforcement

Dependency-related code quality is enforced through **Husky + lint-staged**:
- `.husky/pre-commit` runs `npx lint-staged`.
- `.lintstagedrc.js` maps file globs to per-workspace commands: backend JS files get ESLint (using `backend/eslint.config.mjs`) and Prettier formatting; frontend JS files are processed via `scripts/lint-frontend.js`.

### Build-time / Install-time Scripts

- Backend: `postinstall: prisma generate` ensures the generated Prisma Client is present after `npm install`.
- Frontend: standard Next.js scripts (`dev`, `build`, `start`).
- Documents: Docusaurus CLI scripts (`docusaurus start/build/deploy/swizzle/clear/serve`).

### Notable Constraints

- The backend explicitly allows native build scripts for Prisma via `allowScripts` in `package.json`, which is required because `@prisma/engines` contains native binaries.
- The documents workspace enforces Node.js `>=20.0` via the `engines` field.
- No vendoring strategy (no `vendor/` directory); all third-party code is fetched from npm during install.
- No global/shared `package-lock.json`; each workspace is independently versioned and locked.