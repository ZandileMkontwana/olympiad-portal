# Sprint 2 Retrospective

## Zandile (Paper Archive, Online Sitting A2/A3, Sitting Submission A5)

## What went well

- **Three stories delivered end-to-end across the full stack.** Paper archive (PR #71), online sitting A2/A3 (PR #72), and sitting submission A5 (feature/submit-sitting) were all taken from schema design through backend routes, frontend pages, tests, API documentation, and merged PRs — meeting the team's full Definition of Done, not just "code works locally."

- **Paper archive shipped early and cleanly.** The feature was the first Sprint 2 item to land (PR #71), merged without rework, and gave the team a concrete proof point that the sprint scope was achievable. The unauthenticated `GET /api/papers/archive` endpoint was flagged to the team as a deliberate design decision (real olympiads publish past papers publicly) rather than silently shipped.

- **Online sitting implementation was thorough and defensive.** The `Sitting` model was designed with a `@@unique([roundId, entrantId])` constraint to prevent duplicate sittings, and both backend endpoints (start/resume and autosave PATCH) were hardened with server-side expiry enforcement — closing a real gap where the code comment promised expired sittings "can no longer be resumed" but neither endpoint actually checked `expiresAt`. Without this fix, the only thing preventing post-deadline submissions was the frontend's disabled inputs.

- **Test suite was repaired alongside feature work.** The JWT-to-Clerk auth migration had left pre-existing tests broken (`submissions.test.js` and `rounds.test.js`), and rather than treating that as someone else's problem, I rewrote the failing suites to work with Clerk auth — bringing the full backend suite to 124/124 passing (later 132/132 after A5), with clean ESLint across both backend and frontend (46/46).

- **Caught and fixed a latent production bug.** While working in `submissions.js`, I discovered that `req.user.userId` was `undefined` under Clerk auth (a leftover from the JWT era) and fixed it to use `req.user` directly — this would have caused silent failures on receipt emails for any real submission.

- **A5 (sitting submission) closed the online-sitting loop.** `POST /api/sittings/:id/submit` with automarking and `idempotencyKey` handling means a student can now complete the full online journey: start a sitting, autosave answers, submit, and receive an automatically marked result — the entire A2→A5 chain is delivered.

## What was harder than expected

- **OneDrive sync caused severe, intermittent tooling failures** throughout the sprint — files appearing as syntax errors, edits silently not landing, and tool reliability issues that had nothing to do with actual feature work. Diagnosing whether a bug was real or just OneDrive interference became a recurring time sink.

- **The test suite repair was larger than anticipated.** Fixing the Clerk auth migration's test fallout meant rewriting entire test files rather than tweaking a few assertions — the old JWT-based mocking strategy was fundamentally incompatible with Clerk's `requireAuth` middleware, and the scope of that rework wasn't visible until actually running the suite.

- **Expiry enforcement in A2/A3 required careful reasoning about edge cases.** The extended-closeTime scenario (where a sitting's `expiresAt` falls after the round's close time) was a real correctness gap that took careful thought to close properly — both the start and autosave endpoints needed separate 403 checks with different trigger conditions.

- **A5 was blocked on A2/A3 being reviewed and merged**, which compressed the timeline for submission work into the final stretch of the sprint. The dependency chain (archive → sitting → submission) meant any delay in one story cascaded into the next.

## What I'd do differently

- **Move the project out of OneDrive** — this was carried over from Sprint 1's retrospective and remains the single highest-impact environment improvement. The sync interference caused more debugging dead-ends this sprint than any actual code problem.

- **Open A5's PR earlier, even as a draft**, rather than waiting for A2/A3 to merge first. The dependency was real, but a draft PR would have let review start sooner and reduced the end-of-sprint time crunch.

- **Run the full test suite as a pre-PR check every time**, not just before the final commit. The Clerk auth test breakage existed for a while before being discovered during A2 work — catching it earlier would have decoupled test repair from feature delivery.

## Carried into next sprint

- **D3 — Clerk-account ↔ Entrant linking** (Sprint 3 roadmap item). The current entrant-picker model (any signed-in user can sit as any registered entrant) is an accepted interim state, but D3 needs to land for student identity to be properly secured.
- **Unauthenticated `GET /api/papers/archive` endpoint** — flagged to the team as possibly deliberate but needs an explicit decision before production use.
- **Moderation queue and partial credit marking** — within Sprint 2 scope per the planning doc but not started; likely descoped to Sprint 3 by team decision.
- **Qualifying-threshold round advancement** — not started; same status as moderation queue.
