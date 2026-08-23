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

## Current coverage (as of Sprint 1)

**Backend** — 8 test files, 85 tests, all passing
| Metric | Coverage |
|---|---|
| Statements | 98.54% |
| Branches | 85.71% |
| Functions | 96.42% |
| Lines | 98.52% |

Nearly every backend module — the scheduler, auth middleware, and all route files — sits at 100% statement coverage. `index.js` (the app entry point) and parts of `auth.js`'s branch logic are the main gaps, largely around startup/edge-case branches that are harder to exercise in isolation.

**Frontend** — 3 test files, 32 tests, all passing
| Metric | Coverage |
|---|---|
| Statements | 98.76% |
| Branches | 93.93% |
| Functions | 100% |
| Lines | 100% |

Covers the API client library and the auth-related React hooks (`useAuthRedirect`, `useRequireRole`) that drive the role-based redirect logic.

## What's tested
- Round and olympiad CRUD logic
- The round lifecycle scheduler's state transitions
- Auth middleware (token verification, role checks)
- Paper upload/download endpoints
- Submission creation, including automarking against `memoAnswers` and receipt email sending
- Frontend auth redirect hooks and the API client