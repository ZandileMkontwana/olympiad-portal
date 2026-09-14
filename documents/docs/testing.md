---
sidebar_position: 7
---

# Testing & Code Coverage

## Framework
[Vitest](https://vitest.dev/), with the built-in V8 coverage provider — chosen for its speed and native ESM support across both the backend and frontend.

## Running tests
```
npm run test:coverage
```
This runs the full backend and frontend suites with coverage enabled, from the repo root.

## Current coverage (as of Sprint 2 close)

**Backend** — 12 test files, 211 tests, all passing
| Metric | Coverage |
|---|---|
| Statements | 98.22% |
| Branches | 96.51% |
| Functions | 96.92% |
| Lines | 98.18% |

Nearly every backend module — the scheduler (including all four notification jobs), auth middleware, the email library, and all route files — sits at or near 100% statement coverage. `index.js` (the app entry point) and parts of `auth.js`'s branch logic are the main gaps, largely around startup/edge-case branches that are harder to exercise in isolation.

**Frontend** — 8 test files, 108 tests, all passing
| Metric | Coverage |
|---|---|
| Statements | 90.51% |
| Branches | 87.23% |
| Functions | 81.81% |
| Lines | 91.66% |

Covers the API client library, the auth-related React hooks (`useAuthRedirect`, `useRequireRole`), and component tests for the student sitting page, student dashboard and results review, the student registration page, and the educator school dashboard.

Both suites enforce coverage thresholds in their `vitest.config.mjs` (80% lines/functions/statements, 75% branches) — a build fails if coverage drops below them.

## What's tested
- Round and olympiad CRUD logic
- The round lifecycle scheduler's state transitions and all four notification jobs (before-open, before-close, results-released, missing-submission), including deduplication via `NotificationLog`
- Auth middleware (Clerk session verification, role checks)
- Educator/student profile completion and account deletion
- Paper upload/download/archive endpoints (Supabase Storage)
- Submission creation, including automarking against `memoAnswers`, idempotency, and receipt email sending
- Online sittings end-to-end: start, resume, autosave, expiry enforcement, and submission with automarking
- School dashboard aggregation and student self-service endpoints
- Frontend auth redirect hooks, the API client, and page components (sitting, student dashboard/results, registration, school dashboard)

## Test policy

- Every backend endpoint ships with tests in a matching `*.test.js` file next to the route — new endpoints are expected to add tests in the same PR.
- Tests run automatically on every push and PR via the Gitea Actions lint workflow; `npm test` at the repo root runs both suites locally.
- After pulling schema changes, run `npx prisma generate` in `backend/` before testing — a stale generated client is the most common cause of local test failures.
- File parallelism is disabled in the frontend `vitest.config.mjs` (`fileParallelism: false`) — parallel jsdom workers fail to start reliably on slow, OneDrive-synced filesystems, and the suite is small enough that sequential runs cost nothing.