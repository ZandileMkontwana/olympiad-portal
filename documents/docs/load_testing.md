---
sidebar_position: 8
---

# Load Testing: Results & Methodology


## Purpose

Show that the fixes for race conditions at round boundaries (#191, #192, #194, #195) hold when many users act at the same moment, against a real database rather than mocked unit tests. Two moments matter most:

- **Round open:** many students start a sitting at the same instant.
- **Round close:** many submissions arrive around the close time.

## Tool and scenarios

The tests are custom Node scripts in `backend/loadtest/`. They call the real Express routes in-process through `supertest` and use a fake auth middleware in place of Clerk. Prisma is **not** mocked: every request writes to the database configured in `DATABASE_URL`. Test data is prefixed `LOADTEST-` and deleted at the end of a successful run.

| Script | Scenario | Expected |
|---|---|---|
| `round-open-sittings.js` | 1. N entrants start a sitting **before** the round opens | Every request rejected with 403 |
| | 2. N entrants (one each) start a sitting right after open | Every request returns 200 |
| | 3. One entrant sends 20 simultaneous "start" requests (double-click) | Exactly one `Sitting` row exists |
| | 4. Consistency check | Every `Sitting` has a matching `RoundEntrant` |
| `round-boundary-submissions.js` | 1. N entrants submit at once before close | Every request returns 201 |
| | 2. 20 requests share one `idempotencyKey` | Exactly one `Submission` row exists |
| | 3. N submissions after the round has closed | Every request rejected with 403 |
| | 4. Consistency check | No `Submission` without a `Result` or `MarkingTask` |

## How to run

From `backend/`:

```bash
npm run loadtest:sittings -- --concurrency=50
npm run loadtest:submissions -- --concurrency=50
```

`--concurrency` sets N (default 50). The scripts write to whatever database `DATABASE_URL` points to, so run them against a development database, never production, and tell the team first when using the shared database. If a run crashes during setup, `LOADTEST-` rows can be left behind and need to be removed manually.

## Environment

| Item | Value |
|---|---|
| Database | Shared Supabase PostgreSQL, transaction pooler (port 6543), region eu-west-2 |
| Connection string flags | `pgbouncer=true`, `connection_limit=5`, Prisma default `pool_timeout` (10 s) |
| Software | Prisma 5.22.0, Node.js 24 |
| Test machine | Developer laptop over the public internet. **Not** run from the deployed Render service |

Timings therefore include network latency between the laptop and the database and are not representative of the deployed backend.

## Results

| Run | Script / concurrency | Outcome |
|---|---|---|
| A | Sittings, 5 (no `connection_limit`) | Crashed in setup: `prepared statement "s5" does not exist` (Postgres error 26000) from Prisma on the pooler |
| B | Sittings, 5 (`connection_limit=5`) | **All 4 scenarios passed.** Scenario 1: 5 × 403. Scenario 2: 5 × 200 in 5.7 s. Scenario 3: exactly one `Sitting`. Scenario 4: no orphans |
| C | Sittings, 50 (`connection_limit=5`) | Scenario 1: 40 × 403 and 10 × 500. Scenario 2: 20 × 200 and 30 × 500, completed in 27.6 s. Scenarios 3 and 4 **passed** |
| D | Submissions, 50 (`connection_limit=5`) | Crashed in setup (pool timeout while creating test entrants). **No scenarios ran** |

The submissions script produced no results at scale. Its scenarios have not been verified under load.

## Observations

1. **Data stayed correct.** In every run that reached them, the double-click test produced exactly one `Sitting`, and no `Sitting` was left without its `RoundEntrant`, even while other requests were failing.
2. **All request failures at concurrency 50 were connection-pool exhaustion**, not logic errors. The errors were Prisma `P2024` (timed out fetching a connection from the pool, limit 5, timeout 10 s) and `P2028` (unable to start a transaction in time). The 10 failures in scenario 1 were plain `round.findUnique` calls that never obtained a connection. They were not evidence of a round-state bug.
3. **Failed requests returned a generic `500`**, which gives a user no hint to retry. This was addressed under #202 (below).
4. **Connection settings matter.** Without `connection_limit`, concurrent Prisma queries through the Supabase transaction pooler crashed with the prepared-statement error (Run A). This is a known interaction between Prisma and Supabase's pooler. The deployed backend's `DATABASE_URL` needs the same flags.
5. **Latency is a likely contributing factor** to the slow completion times (network round trips from the test machine). This was not measured separately.

## Fix applied (#202)

Pool exhaustion (`P2024`, `P2028`) now returns `503 Service Unavailable` with a `Retry-After: 2` header and a JSON body marked `retryable: true`, instead of `500`. This is handled in `backend/src/lib/dbErrors.js` and applied in the sitting and submission routes and the global error handler. The transactions are rolled back on failure, and the affected requests are safe to retry: sitting start is an upsert and submissions carry an `idempotencyKey`. Unit tests are in `backend/src/lib/dbErrors.test.js`.

The routes already used longer transaction wait and timeout values (`backend/src/lib/transactionOptions.js`).

## Not yet verified

- Behaviour under load **after** the #202 fix. The load tests have not been re-run.
- Any run from the deployed Render service.
- The submissions scenarios at any meaningful concurrency.
- Whether a larger `connection_limit` or `pool_timeout` raises the concurrency at which requests start failing.