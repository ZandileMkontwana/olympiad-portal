---
kind: configuration_system
name: Environment-based Configuration via dotenv and Prisma
category: configuration_system
scope:
    - '**'
source_files:
    - backend/.env
    - backend/src/index.js
    - backend/src/lib/prisma.js
    - backend/src/lib/email.js
    - backend/src/middleware/auth.js
    - backend/src/routes/auth.js
    - backend/prisma/schema.prisma
    - backend/src/test-setup.js
    - backend/vitest.config.mjs
    - frontend/src/lib/api.js
    - frontend/src/app/educator/round_view/page.js
    - frontend/src/app/educator/submit/page.js
    - frontend/next.config.mjs
---

## Overview

The Olympiad Portal Monorepo uses a minimal, environment-variable-driven configuration system with no centralized config loader. Each process reads its own `process.env` values directly at module load time, relying on Node.js's built-in environment loading.

## Backend (Express)

- **dotenv loading**: `backend/src/index.js` imports `'dotenv/config'` as a side effect before any other module is loaded, which loads `backend/.env` into `process.env`. This is the only place dotenv is invoked in the backend.
- **Runtime variables** are consumed inline where needed:
  - `PORT` — server port, defaults to `5000` (`backend/src/index.js`).
  - `DATABASE_URL` — PostgreSQL connection string consumed by Prisma via `datasource db { url = env("DATABASE_URL") }` in `backend/prisma/schema.prisma`; Prisma itself also reads it for migrations and client generation.
  - `JWT_SECRET` — read in `backend/src/middleware/auth.js` and `backend/src/routes/auth.js` for signing/verifying JWTs.
  - `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL` — read in `backend/src/lib/email.js` to configure SendGrid.
  - `NODE_ENV` — checked in `backend/src/routes/auth.js` to toggle production behavior.
- **No validation or schema**: there is no runtime validation of required env vars; missing values surface as `undefined` at usage sites (e.g., `jwt.verify(token, undefined)`).
- **Test configuration**: `backend/vitest.config.mjs` sets up Vitest with `setupFiles: ['./src/test-setup.js']`, which pre-loads `JWT_SECRET`, `SENDGRID_API_KEY`, and `SENDGRID_FROM_EMAIL` with hardcoded test values before any module under test is imported. Tests that need these vars set them individually (e.g., `auth.test.js`, `papers.test.js`, `submissions.test.js`).

## Frontend (Next.js)

- **Build-time env vars**: The Next.js app reads `NEXT_PUBLIC_API_BASE_URL` (in `frontend/src/lib/api.js`) and `NEXT_PUBLIC_API_URL` (in `frontend/src/app/educator/round_view/page.js` and `frontend/src/app/educator/submit/page.js`) to determine the backend API endpoint. These must be provided at build time because they are prefixed with `NEXT_PUBLIC_`, making them baked into the client bundle.
- **No `.env` file committed**: the frontend repo has no committed `.env`; values are expected to be supplied by the hosting platform (Vercel) or local overrides.
- **Default fallbacks**: `API_BASE_URL` falls back to `http://localhost:5000` when not set, enabling local development without explicit configuration.
- **Empty config**: `frontend/next.config.mjs` exports an empty `nextConfig`, so all runtime configuration flows exclusively through environment variables.

## Shared / Other

- **Prisma data layer**: `backend/src/lib/prisma.js` instantiates a single `PrismaClient()` singleton; the database URL comes entirely from `DATABASE_URL` (via Prisma's `env()` resolution). There is no per-environment Prisma config beyond the one `schema.prisma`.
- **No feature flags or config files**: the codebase contains no JSON/YAML/TOML config files, no config modules, and no feature-flag library. All toggles are either hard-coded booleans or driven by `process.env.NODE_ENV`.
- **Secrets management**: secrets (database URL, JWT secret, SendGrid key) live in plain text in `backend/.env` (which is gitignored) and must be injected by the deployment environment. There is no secret rotation, encryption, or external secret store integration.

## Conventions Observed

1. **Single source of truth per variable**: each `process.env.X` is read exactly once at module scope and assigned to a const (e.g., `const JWT_SECRET = process.env.JWT_SECRET;`), then reused — avoiding scattered `process.env` calls throughout handlers.
2. **Defaults at point of use**: optional settings like `PORT` provide inline defaults (`process.env.PORT || 5000`).
3. **Test isolation via setup file**: shared test env vars are centralized in `backend/src/test-setup.js` and loaded by Vitest before tests run, rather than duplicated across individual test files.
4. **Frontend env var naming**: public-facing URLs use the `NEXT_PUBLIC_*` prefix convention so Next.js exposes them to the browser bundle.
5. **No config validation**: the system does not validate presence or shape of required env vars at startup; failures occur lazily when the first request triggers the relevant code path.