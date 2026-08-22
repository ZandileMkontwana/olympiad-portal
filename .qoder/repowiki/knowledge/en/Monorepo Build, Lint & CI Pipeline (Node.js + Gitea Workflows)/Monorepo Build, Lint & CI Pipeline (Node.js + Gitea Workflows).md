---
kind: build_system
name: Monorepo Build, Lint & CI Pipeline (Node.js + Gitea Workflows)
category: build_system
scope:
    - '**'
source_files:
    - package.json
    - backend/package.json
    - frontend/package.json
    - documents/package.json
    - .gitea/workflows/lint.yml
    - .gitea/workflows/deploy-docs.yml
    - .husky/pre-commit
    - .lintstagedrc.js
    - scripts/lint-frontend.js
---

## System Overview

This is a Node.js monorepo composed of three packages — `backend` (Express/Prisma API), `frontend` (Next.js App Router), and `documents` (Docusaurus site) — with no top-level package manager workspace. Each subproject manages its own dependencies via an individual `package.json`, and the root only orchestrates shared tooling.

There are **no Dockerfiles, Makefiles, or cross-compilation steps** in this repository. The build system is purely npm scripts plus Gitea-hosted GitHub Actions workflows.

## Build & Test Scripts

- **Root `package.json`** defines umbrella scripts that invoke each subproject's test runner:
  - `npm test` runs `vitest run` sequentially in `backend/` then `frontend/`.
  - `npm run test:coverage` does the same with `--coverage`.
  - `npm run prepare` installs Husky so pre-commit hooks are available after `npm install` at the repo root.
- **Backend (`backend/package.json`)**: `start` launches `node src/index.js`; `postinstall` runs `prisma generate` to regenerate the Prisma client; `test` / `test:coverage` / `test:watch` wrap Vitest; `lint` and `format` delegate to ESLint and Prettier.
- **Frontend (`frontend/package.json`)**: standard Next.js lifecycle (`dev`, `build`, `start`) plus Vitest-based `test` / `test:coverage` / `test:watch`, ESLint and Prettier scripts.
- **Documents (`documents/package.json`)**: Docusaurus CLI commands (`start`, `build`, `deploy`, `serve`, etc.) and declares `engines.node >= 20.0`.

## CI Pipelines (`.gitea/workflows/`)

Two workflow files live under `.gitea/workflows/` (Gitea Actions):

1. **`lint.yml`** — triggers on every push to any branch and on pull requests targeting `main`. It spins up two parallel jobs (`lint-backend`, `lint-frontend`), each running on `ubuntu-latest` with Node 20, installing deps via `npm ci`, and executing ESLint against the respective subproject.
2. **`deploy-docs.yml`** — triggers only on pushes to `main`. It installs `documents/` dependencies, runs `docusaurus build`, then deploys the generated `build/` directory to Netlify using `netlify deploy --prod` with secrets `NETLIFY_AUTH_TOKEN` and `NETLIFY_SITE_ID`.

No CI job builds or tests the backend or frontend beyond linting; there is no end-to-end test pipeline, no artifact upload, and no backend deployment step in the repository.

## Pre-commit Hooks

- **Husky** is installed at the root and configured via `.husky/pre-commit`, which simply runs `npx lint-staged`.
- **`lint-staged`** (root `.lintstagedrc.js`) applies different rules per subproject:
  - Files matching `backend/**/*.js` are passed through ESLint (`eslint.config.mjs`) and Prettier (`backend/.prettierrc`).
  - Files matching `frontend/**/*.js` are delegated to `scripts/lint-frontend.js`, which resolves staged file paths relative to `frontend/` and runs both ESLint (`--fix`) and Prettier (`--write`) inside the `frontend/` directory.
- A helper script `scripts/lint-frontend.js` exists solely to translate absolute staged paths back into relative paths for the frontend's ESLint config.

## Versioning & Artifacts

- Each package declares its own version string in its `package.json` (`backend`: `1.0.0`, `frontend`: `0.1.0`, `documents`: `0.0.0`). There is no shared version bump script or lockstep release process.
- The only published artifacts are the Docusaurus static site built into `documents/build/`, deployed to Netlify by CI.
- Backend and frontend codebases have no packaging step (no `npm publish`, no Docker image, no binary). Deployment outside of docs is not represented in this repository.

## Constraints Observed

- All CI jobs pin Node.js to version **20** (via `setup-node@v4` with `node-version: 20`); the docs package additionally enforces `>=20.0` in `engines.node`.
- Dependency installation in CI uses `npm ci` (lockfile-driven, reproducible installs).
- Prisma client generation is enforced as a `postinstall` hook in the backend, so the generated client must exist before the server starts.
- Linting is the only quality gate enforced in CI; testing is gated only by local pre-commit hooks and manual invocation.