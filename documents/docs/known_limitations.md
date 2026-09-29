---
sidebar_label: known_limitations
sidebar_position: 9
---

# Load Testing: Findings & Known Limitations

 Evidence and raw numbers are in [Load Testing: Results & Methodology](./load-testing.md)._

## Findings

1. **Correctness held under contention.** When one entrant sent 20 simultaneous "start test" requests, exactly one `Sitting` was created. No `Sitting` was left without its `RoundEntrant`. This was observed at both 5 and 50 concurrent entrants, including while other requests were failing.
2. **Capacity, not logic, was the limit.** At 50 simultaneous requests with `connection_limit=5`, only 20 of 50 sitting starts succeeded in the round-open burst. Every failure was connection-pool exhaustion (Prisma `P2024`/`P2028`), not a wrong round-state decision.
3. **Failures did not corrupt data.** Failed requests rolled back and left no partial rows.
4. **Pooler settings are required.** Through Supabase's transaction pooler, concurrent Prisma queries crashed until `pgbouncer=true` and `connection_limit` were set on `DATABASE_URL`.
5. **Fixed under #202.** Pool exhaustion now returns `503` with `Retry-After`, instead of a generic `500`.

## Known limitations

| # | Limitation | Why it matters | What would resolve it |
|---|---|---|---|
| 1 | **Safe concurrency is unknown for the deployed setup.** With `connection_limit=5`, 50 simultaneous starts exceeded capacity. The effect of the recommended `connection_limit=10` and `pool_timeout=30` has not been measured | If more students start at the same moment than the pool can serve, some get a "busy, retry" response | Compare expected cohort size with a load run against the deployed backend at increasing concurrency |
| 2 | **Load tests have not been re-run since the #202 fix** | The 503 handling is unit-tested but not verified under real load | Re-run both scripts and record the result in the results page |
| 3 | **Submission scenarios were never verified under load.** The submissions script crashed during setup at 50 concurrent entrants | Duplicate-key handling and post-close rejection are proven only by unit tests | Fix setup to create test entrants in one query, then run the script |
| 4 | **No run from the deployed environment.** Tests ran from a developer laptop to the shared database | Timings include laptop-to-database latency, and the Render service itself was never exercised | Run from the Render service or a machine in the database's region |
| 5 | **The frontend does not retry on 503.** A search of `frontend/src` found no handling of 503 or `Retry-After` | A student who gets a busy response must retry by hand | Add a short automatic retry to the API client for sitting start and submit |
| 6 | **Scheduler-driven transitions are not covered.** The scripts open and close the round directly instead of letting the scheduler do it | A slow or delayed scheduler tick at the boundary is untested | Add a test that runs the scheduler while requests arrive |
| 7 | **Authentication is faked.** The scripts replace Clerk with a stub | Real sign-in latency and Clerk rate limits are not part of the results | Include real authenticated sessions in a staging run |
| 8 | **Free-tier cold starts.** `render.yaml` uses `plan: free`, and Render's documentation states that free web services spin down after about 15 minutes without traffic and take roughly a minute to start again | The first requests at round open could hit a sleeping service | Use a paid instance, or send a request shortly before each round opens |
| 9 | **Crashed test runs can leave data behind.** A run that dies during setup skips its cleanup, so `LOADTEST-` rows remain in the shared database | Leftover rows clutter shared data | Delete them manually, or add cleanup by name prefix to the scripts |
| 10 | **The tests use the shared database.** Running them affects everyone using it at that moment | Teammates may see slow or failing requests during a run | Agree a time window first, or use a separate test database |

## Recommended follow-ups, in priority order

1. Confirm `DATABASE_URL` on Render includes `pgbouncer=true` and a `connection_limit`.
2. Decide the expected number of simultaneous students per round and compare it against limitation 1.
3. Add the retry on 503 in the frontend (limitation 5).
4. Fix the submissions test setup and run both scripts from the deployed environment (limitations 2 to 4).