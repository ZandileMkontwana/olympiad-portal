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

## Current coverage (as of Sprint 3 close)

**Backend** — 22 test files, 501 tests, all passing
| Metric | Coverage |
|---|---|
| Statements | 89.33% |
| Branches | 78.06% |
| Functions | 95.36% |
| Lines | 89.94% |

Every backend route file is covered — the scheduler (including all four notification jobs), auth middleware, the email library, certificates generation, timezone utilities, qualification logic, and all 14 route files (rounds, sittings, submissions, marking, remark, entrants, schools, students, studentAuth, papers, auth, certificates, olympiadOrganisers, audit log). `index.js` (the app entry point) and some branch logic in `authorization.js` are the main gaps.

**Frontend** — 18 test files, 249 tests, all passing
| Metric | Coverage |
|---|---|
| Statements | 96% |
| Branches | 87.62% |
| Functions | 100% |
| Lines | 98.35% |

Covers the full API client (all exported functions including Sprint 3 additions: marking queue, remark/appeals, co-organisers, audit log, replay, results management, standings), the student session library, all auth-related React hooks (`useAuthRedirect`, `useRequireRole`, `useStudentAuth`), and component tests for the student sitting page, student dashboard and results review, the student registration page, the educator school dashboard, round view with appeals, the marking page, the standings page, and the set-password page.

Both suites enforce coverage thresholds in their `vitest.config.mjs` (80% lines/functions/statements, 75% branches) — a build fails if coverage drops below them.

## What's tested
- Round and olympiad CRUD logic
- The round lifecycle scheduler's state transitions and all four notification jobs (before-open, before-close, results-released, missing-submission), including deduplication via `NotificationLog`
- Auth middleware (Clerk session verification, role checks, student JWT verification)
- Educator/student profile completion and account deletion
- Paper upload/download/archive endpoints (Supabase Storage)
- Submission creation, including automarking against `memoAnswers`, idempotency, and receipt email sending
- Online sittings end-to-end: start, resume, autosave, expiry enforcement, submission with automarking, and concurrent duplicate handling (P2002 idempotency race)
- School dashboard aggregation and student self-service endpoints
- Standings (entrant- and school-ranked), notification rules CRUD, and PDF certificate generation
- Marking workflow: queue listing, task assignment, score recording with partial-credit breakdown, and moderation
- Remark/appeal workflow: request creation, queue listing with filters, reviewer assignment, and review with atomic score update + qualification re-evaluation
- Co-organiser management: add, list, and remove co-organisers with creator protection
- Results release/unrelease and round state transitions
- Audit log and round replay timeline
- Student session storage (localStorage get/set/clear with validation)
- Student auth hook (session check, redirect, signOut, getToken, unmount safety)
- Frontend auth redirect hooks, the full API client (all exported functions), and page components (sitting, student dashboard/results, registration, school dashboard, standings, round view with appeals, marking page, set-password)

## Test policy

- Every backend endpoint ships with tests in a matching `*.test.js` file next to the route — new endpoints are expected to add tests in the same PR.
- Both suites run automatically on every push and PR via the Gitea Actions "Lint and Test" workflow (`.gitea/workflows/lint.yml`), alongside the lint jobs; `npm test` at the repo root runs both suites locally.
- After pulling schema changes, run `npx prisma generate` in `backend/` before testing — a stale generated client is the most common cause of local test failures.
- File parallelism is disabled in the frontend `vitest.config.mjs` (`fileParallelism: false`) — parallel jsdom workers fail to start reliably on slow, OneDrive-synced filesystems, and the suite is small enough that sequential runs cost nothing.