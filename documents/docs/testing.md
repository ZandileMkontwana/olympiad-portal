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

**Backend** — 13 test files, 283 tests, all passing
| Metric | Coverage |
|---|---|
| Statements | 97.96% |
| Branches | 93.10% |
| Functions | 97.97% |
| Lines | 98.47% |

Nearly every backend module — the scheduler (including all four notification jobs), auth middleware, the email library, certificates generation, and all route files — sits at or near 100% statement coverage. `index.js` (the app entry point) and parts of `auth.js`'s branch logic are the main gaps, largely around startup/edge-case branches that are harder to exercise in isolation.

**Frontend** — 9 test files, 129 tests, all passing
| Metric | Coverage |
|---|---|
| Statements | 90.32% |
| Branches | 87.23% |
| Functions | 82.92% |
| Lines | 91.37% |

Covers the API client library (including the standings, school standings, and notification-rule endpoints), the auth-related React hooks (`useAuthRedirect`, `useRequireRole`), and component tests for the student sitting page, student dashboard and results review, the student registration page, and the educator school dashboard.

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
- Standings (entrant- and school-ranked), notification rules CRUD, and PDF certificate generation
- Frontend auth redirect hooks, the API client, and page components (sitting, student dashboard/results, registration, school dashboard, standings)

## Test policy

- Every backend endpoint ships with tests in a matching `*.test.js` file next to the route — new endpoints are expected to add tests in the same PR.
- Tests run automatically on every push and PR via the Gitea Actions lint workflow; `npm test` at the repo root runs both suites locally.
- After pulling schema changes, run `npx prisma generate` in `backend/` before testing — a stale generated client is the most common cause of local test failures.
- File parallelism is disabled in the frontend `vitest.config.mjs` (`fileParallelism: false`) — parallel jsdom workers fail to start reliably on slow, OneDrive-synced filesystems, and the suite is small enough that sequential runs cost nothing.