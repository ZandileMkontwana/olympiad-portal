---
sidebar_position: 6
---

# Load Testing

The brief calls out the round open/close load spikes as the hardest requirement: many students log in and start sitting within a short window, then a burst of submissions lands as the round closes. This page documents how the backend was load-tested against exactly those patterns, what the measured results were, and what the tests surfaced.

## Methodology

### Harness

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

## Results

### Local dev backend — 27 September 2026

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

### Deployed backend — same day, smoke run

Environment: Render (`https://olympiad-portal.onrender.com`), same Supabase database. Config: **10 students, concurrency 5, 200 reads, 3 autosaves** — 275 requests.

| Scenario | Requests | OK | Errors | Req/s | Avg (ms) | p95 | p99 |
|---|---|---|---|---|---|---|---|
| public_reads | 200 | 200 | 0 | 22.1 | 230 | 254 | 462 |
| student_login | 10 | 10 | 0 | 2.1 | 2 002 | 2 570 | 2 570 |
| start_sitting | 10 | 10 | 0 | 3.6 | 1 446 | 2 359 | 2 359 |
| autosave | 30 | 30 | 0 | 17.1 | 338 | 408 | 525 |
| submit + submit_duplicate | 30 | 17 | 13 | — | 442 | 549 | 550 |

Exactly-once verification: **all checks PASS** (10 submissions, 0 duplicated keys) — but 13 of 30 submit attempts returned **500** instead of the idempotent 200. That is the pre-fix behavior of `main` at capture time; it is exactly the bug the harness was built to catch, and it is fixed on this branch (see Findings).

Latency differences between the two environments are expected: the deployed instance reaches Supabase from a datacenter with a much shorter network path than a home connection, which is why deployed latencies are lower than local ones for the same code.

## Findings

1. **Concurrent duplicate submits produced 500s (found and fixed).** Under the submit storm, several requests can slip past the `completedAt` check before the first one finishes; the unique `idempotencyKey` correctly rejects the losers, but the route didn't catch Prisma's `P2002` and returned a 500. The database was never corrupted (exactly-once held in every run), but callers saw errors where the documented idempotent retry should return the existing submission. The fix mirrors the handling already used by `POST /rounds/:id/submissions`: on a `P2002` for `idempotencyKey`, return the winner's submission with a 200 and stamp `completedAt` with a status-guarded `updateMany`. Three regression tests cover the race, the no-existing-submission fallback, and non-idempotency unique violations. Post-fix re-run: 0 errors, 20×201 + 40×200.
2. **Logins are CPU-bound.** bcrypt verification dominates `POST /students/login` (~1.6–2.0 s average under load in both environments) and runs on the single Node event loop; at this scale it stayed comfortably stable, but a much larger login storm would be the first thing to queue.
3. **Supabase session-pooler limits need respect.** The project previously hit `EMAXCONNSESSION` (max 15 clients) with Prisma's default pool size; `DATABASE_URL` now carries a `connection_limit` cap, and the harness releases its own Prisma connections during the load phase so the whole session budget belongs to the backend under test. Keep load-test concurrency ≤ 10 unless the pooler setting changes.

## Limitations

- Absolute latencies include Supabase network time; treat the numbers as relative indicators, not server CPU benchmarks.
- API-level only — no browser rendering or static-asset load.
- The deployed smoke run uses small counts; re-run the full-size configuration against the deployment after this branch ships to get production-scale numbers. Render's free tier also spins down when idle — the first request after a cold start is slow (the warmup phase exists to absorb that).
- Every run reuses (and resets) the same dedicated load-test round; it never touches real olympiad data.
