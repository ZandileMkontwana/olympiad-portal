---
sidebar_label: load-testing
sidebar_position: 6
---

# Load Testing

The brief calls out the round open/close load spikes as the hardest requirement: many students log in and start sitting within a short window, then a burst of submissions lands as the round closes. This page documents how the backend was load-tested against exactly those patterns, what the measured results were, and what the tests surfaced.

## Purpose

Show that the fixes for race conditions at round boundaries (#191, #192, #194, #195) hold when many users act at the same moment, against a real database rather than mocked unit tests. Two moments matter most:

- **Round open:** many students start a sitting at the same instant.
- **Round close:** many submissions arrive around the close time.

## Main Harness

### Tool

`backend/load-test.js` — a zero-dependency Node script (built-in `fetch` only, no k6/artillery installs). It is deliberately part of the repo so anyone can reproduce a run against a local backend or the deployed one.

Every run:

1. **Seeds its own fixtures via Prisma** — a dedicated `Load Test Olympiad`, an open round with a 5-question memo answer key, a `Load Test School`, and _N_ student accounts with a known password (so logins can be scripted without browser sessions).
2. **Resets the previous run's artifacts** — the round's sittings/submissions/results/registrations are deleted first, so each run starts and verifies from the same baseline.
3. **Runs four phases** with a configurable concurrency pool:

| Scenario | Simulates | Endpoint(s) |
|---|---|---|
| `warmup` | JIT/connection warm-up (excluded from analysis) | `GET /api/rounds` × 5 |
| `public_reads` | Landing/dashboard polling, unauthenticated | `GET /api/rounds`, `GET /api/rounds/:id` |
| `student_login` | Login storm when a round opens | `POST /api/students/login` |
| `start_sitting` | Students opening the paper | `POST /api/rounds/:id/sittings` |
| `autosave` | Periodic answer autosave while sitting | `PATCH /api/sittings/:id/answers` |
| `submit` | The close-time submission spike | `POST /api/sittings/:id/submit` |
| `submit_duplicate` | Retried/duplicated submit requests racing the first one | same, ×2 extra per sitting |

4. **Verifies exactly-once semantics from the database**: every student has a sitting, every sitting completed, exactly **one** submission per sitting (no duplicated `idempotencyKey`s), and every submission was automarked at the expected score.
5. **Reports per-scenario throughput and latency** (nearest-rank p50/p95/p99) and writes the raw numbers to `load-test-results.json` (gitignored).

Measured per request: wall-clock latency, status code, and success/error; per scenario: request count, duration, req/s, avg, p50, p95, p99, max. A run **fails** (non-zero exit) on any error response or verification failure — which is how the concurrency bug below was caught.

### Running it

```bash
cd backend
node src/index.js          # server must be running first
npm run load-test          # defaults: 20 students, concurrency 10, 400 reads
node load-test.js --students=20 --concurrency=10 --reads=400 --autosaves=3
```

Against the deployed backend (fixtures are seeded into the same Supabase database the deployment uses):

```bash
node load-test.js --base-url=https://olympiad-portal.onrender.com --students=10 --concurrency=5
node load-test.js --cleanup   # remove the load-test round and its data
```

This runs outside CI on purpose — it needs a live server and database, which the test workflow doesn't provision.

## Concurrent Boundary Tests

Two additional scripts target the specific concurrency boundaries identified during Sprint 3. Unlike the main harness above (which exercises the full flow end-to-end against a running server), these run in-process via `supertest` against the real routes and real database — but with a fake auth middleware standing in for Clerk. This isolates the database-level concurrency without needing a deployed backend.

| Script | Scenario | Expected |
|---|---|---|
| `loadtest/round-open-sittings.js` | 1. N entrants start a sitting **before** the round opens | Every request rejected with 403 |
| | 2. N entrants (one each) start a sitting right after open | Every request returns 200 |
| | 3. One entrant sends 20 simultaneous "start" requests (double-click) | Exactly one `Sitting` row exists |
| | 4. Consistency check | Every `Sitting` has a matching `RoundEntrant` |
| `loadtest/round-boundary-submissions.js` | 1. N entrants submit at once before close | Every request returns 201 |
| | 2. 20 requests share one `idempotencyKey` | Exactly one `Submission` row exists |
| | 3. N submissions after the round has closed | Every request rejected with 403 |
| | 4. Consistency check | No `Submission` without a `Result` or `MarkingTask` |

Both default to 50 concurrent entrants and accept `--concurrency=N` to adjust. Each creates its own `LOADTEST-`-prefixed data and cleans up after itself.

### Running boundary tests

```bash
cd backend
npm run loadtest:sittings -- --concurrency=50
npm run loadtest:submissions -- --concurrency=50
```

`--concurrency` sets N (default 50). The scripts write to whatever database `DATABASE_URL` points to, so run them against a development database, never production, and tell the team first when using the shared database. If a run crashes during setup, `LOADTEST-` rows can be left behind and need to be removed manually.

## Environment

| Item | Value |
|---|---|
| Database | Shared Supabase PostgreSQL, transaction pooler (port 6543), region eu-west-2 |
| Connection string flags | `pgbouncer=true`, `connection_limit=5`, Prisma default `pool_timeout` (10 s) |
| Software | Prisma 5.22.0, Node.js 22–24 |
| Test machine | Developer laptop over the public internet. **Not** run from the deployed Render service |

Timings therefore include network latency between the laptop and the database and are not representative of the deployed backend.

## Results

### Main harness — Local dev backend (27 September 2026)

Environment: Windows dev machine, Node v22.23.2, 8 CPUs; Express on `localhost:5000`; Supabase Postgres via the session pooler (`connection_limit` capped). Config: **20 students, concurrency 10, 400 reads, 3 autosaves/student** — 565 requests total, 0 errors.

| Scenario | Requests | OK | Errors | Duration (s) | Req/s | Avg (ms) | p50 | p95 | p99 | Max |
|---|---|---|---|---|---|---|---|---|---|---|
| warmup | 5 | 5 | 0 | 2.0 | 2.5 | 493 | 385 | 774 | 774 | 774 |
| public_reads | 400 | 400 | 0 | 23.7 | 16.9 | 593 | 591 | 861 | 1 447 | 2 218 |
| student_login | 20 | 20 | 0 | 9.6 | 2.1 | 1 615 | 1 718 | 1 984 | 2 365 | 2 365 |
| start_sitting | 20 | 20 | 0 | 7.7 | 2.6 | 5 259 | 4 473 | 7 404 | 7 828 | 7 828 |
| autosave | 60 | 60 | 0 | 4.4 | 13.6 | 916 | 817 | 1 529 | 1 647 | 1 647 |
| submit | 20 | 20 | 0 | 24.4 | 0.8 | 4 168 | 3 924 | 6 157 | 6 460 | 6 460 |
| submit_duplicate | 40 | 40 | 0 | 25.8 | 1.6 | 5 116 | 5 156 | 6 478 | 6 879 | 6 879 |

Status codes: `submit` 19×201 + 1×200, `submit_duplicate` 1×201 + 39×200 — i.e. exactly 20 winners (one submission per sitting) and every duplicate returned the winner's submission with a 200 instead of failing.

Exactly-once verification: **all checks PASS** — 20/20 sittings, 20/20 completed, 20 submissions with 0 duplicated idempotency keys, 20/20 automarked at the expected 40%.

### Main harness — Deployed backend (same day, smoke run)

Environment: Render (`https://olympiad-portal.onrender.com`), same Supabase database. Config: **10 students, concurrency 5, 200 reads, 3 autosaves** — 275 requests.

| Scenario | Requests | OK | Errors | Req/s | Avg (ms) | p95 | p99 |
|---|---|---|---|---|---|---|---|
| public_reads | 200 | 200 | 0 | 22.1 | 230 | 254 | 462 |
| student_login | 10 | 10 | 0 | 2.1 | 2 002 | 2 570 | 2 570 |
| start_sitting | 10 | 10 | 0 | 3.6 | 1 446 | 2 359 | 2 359 |
| autosave | 30 | 30 | 0 | 17.1 | 338 | 408 | 525 |
| submit + submit_duplicate | 30 | 17 | 13 | — | 442 | 549 | 550 |

Exactly-once verification: **all checks PASS** (10 submissions, 0 duplicated keys) — but 13 of 30 submit attempts returned **500** instead of the idempotent 200. That was the pre-fix behavior of `main` at capture time; the fix has since been merged and deployed to Render (see Findings), so this error no longer occurs on the live backend.

Latency differences between the two environments are expected: the deployed instance reaches Supabase from a datacenter with a much shorter network path than a home connection, which is why deployed latencies are lower than local ones for the same code.

### Boundary tests — Shared Supabase database

| Run | Script / concurrency | Outcome |
|---|---|---|
| A | Sittings, 5 (no `connection_limit`) | Crashed in setup: `prepared statement "s5" does not exist` (Postgres error 26000) from Prisma on the pooler |
| B | Sittings, 5 (`connection_limit=5`) | **All 4 scenarios passed.** Scenario 1: 5 × 403. Scenario 2: 5 × 200 in 5.7 s. Scenario 3: exactly one `Sitting`. Scenario 4: no orphans |
| C | Sittings, 50 (`connection_limit=5`) | Scenario 1: 40 × 403 and 10 × 500. Scenario 2: 20 × 200 and 30 × 500, completed in 27.6 s. Scenarios 3 and 4 **passed** |
| D | Submissions, 50 (`connection_limit=5`) | Crashed in setup (pool timeout while creating test entrants). **No scenarios ran** |

The submissions script produced no results at scale. Its scenarios have not been verified under load.

## Findings

1. **Concurrent duplicate submits produced 500s (found and fixed).** Under the submit storm, several requests can slip past the `completedAt` check before the first one finishes; the unique `idempotencyKey` correctly rejects the losers, but the route didn't catch Prisma's `P2002` and returned a 500. The database was never corrupted (exactly-once held in every run), but callers saw errors where the documented idempotent retry should return the existing submission. The fix mirrors the handling already used by `POST /rounds/:id/submissions`: on a `P2002` for `idempotencyKey`, return the winner's submission with a 200 and stamp `completedAt` with a status-guarded `updateMany`. Three regression tests cover the race, the no-existing-submission fallback, and non-idempotency unique violations. Post-fix re-run: 0 errors, 20×201 + 40×200.
2. **Logins are CPU-bound.** bcrypt verification dominates `POST /students/login` (~1.6–2.0 s average under load in both environments) and runs on the single Node event loop; at this scale it stayed comfortably stable, but a much larger login storm would be the first thing to queue.
3. **Supabase session-pooler limits need respect.** The project previously hit `EMAXCONNSESSION` (max 15 clients) with Prisma's default pool size; `DATABASE_URL` now carries a `connection_limit` cap, and the harness releases its own Prisma connections during the load phase so the whole session budget belongs to the backend under test. Keep load-test concurrency ≤ 10 unless the pooler setting changes.
4. **Data stayed correct in boundary tests.** In every run that reached them, the double-click test produced exactly one `Sitting`, and no `Sitting` was left without its `RoundEntrant`, even while other requests were failing.
5. **All request failures at concurrency 50 were connection-pool exhaustion**, not logic errors. The errors were Prisma `P2024` (timed out fetching a connection from the pool, limit 5, timeout 10 s) and `P2028` (unable to start a transaction in time). The 10 failures in scenario 1 were plain `round.findUnique` calls that never obtained a connection. They were not evidence of a round-state bug.
6. **Pool exhaustion now returns 503 (#202).** Pool exhaustion (`P2024`, `P2028`) now returns `503 Service Unavailable` with a `Retry-After: 2` header and a JSON body marked `retryable: true`, instead of `500`. This is handled in `backend/src/lib/dbErrors.js` and applied in the sitting and submission routes and the global error handler. The transactions are rolled back on failure, and the affected requests are safe to retry: sitting start is an upsert and submissions carry an `idempotencyKey`. Unit tests are in `backend/src/lib/dbErrors.test.js`. The routes already used longer transaction wait and timeout values (`backend/src/lib/transactionOptions.js`).

## Limitations

- Absolute latencies include Supabase network time; treat the numbers as relative indicators, not server CPU benchmarks.
- API-level only — no browser rendering or static-asset load.
- The deployed smoke run used small counts and was captured before the idempotency fix shipped to Render. The fix is now live; a full-size re-run against the deployment would confirm production-scale behaviour. Render's free tier also spins down when idle — the first request after a cold start is slow (the warmup phase exists to absorb that).
- Every run reuses (and resets) the same dedicated load-test round; it never touches real olympiad data.
- Behaviour under load **after** the #202 fix has not been re-run.
- The submissions boundary scenarios have not been verified at any meaningful concurrency.
- Whether a larger `connection_limit` or `pool_timeout` raises the concurrency at which requests start failing has not been tested.
