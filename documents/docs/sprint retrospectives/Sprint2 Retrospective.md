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

## Ronie  (Standings, Certificates & Notification Rules — C1-C5)
 
## What went well
 
- **Delivered the full C1-C5 epic set: #124-#142**, spanning individual and per-school standings, PDF certificate generation, configurable notification rules, and a dry-run preview for those rules — five distinct features, each shipped with a working backend route, frontend page/component, and a real passing test suite.
- **#125 ("merge online and paper results") turned out to already be solved by the data model** — rather than building unnecessary merge logic, traced the actual `Submission`/`Result` schema and confirmed both online sittings and paper-based entries converge on the same table, so the standings query needed no special-casing. Verified this directly against a real test entrant's data rather than assuming.
- **Caught and fixed a genuine route-collision bug before it shipped.** Two separately-built certificate routes (one pasted into `rounds.js`, one in a proper standalone `certificates.js`) both matched the same path, with Express silently routing every request to the broken one — which called a function name (`generateCertificatePdf`) that didn't even exist in the shared lib file at the time. Found by tracing the actual router mount order in `index.js`, not by guessing.
- **Caught a deeper, non-obvious functional gap in the certificate flow.** `certificates.js` correctly gated downloads on `round.state === 'released'`, but nothing anywhere in the codebase ever set a round to that state — the scheduler only ever produced `scheduled`/`open`/`closed`. Existing tests passed because they mocked the `'released'` state directly, masking that no real code path could ever reach it. Fixed by adding the state transition to `POST /rounds/:id/release-results` (and the reverse on `unrelease-results`), with test coverage that actually asserts the transition happens rather than just checking the response body.
- **Worked independently and in parallel effectively** — built the dry-run route, its frontend "Test Rules" button, and its full test suite (#140-#142) unprompted while other work was in progress, including a thoughtful architectural choice to export reusable building blocks from `scheduler.js` (`getRecipientsForRound`, `isTriggerEnabled`, the include shapes) rather than duplicating scheduler logic in the route.
- **Reused real email templates for the notification dry-run preview**, refactoring `email.js` to separate template-building from sending, so the "Test Rules" preview shows organisers the actual email content rather than just a recipient list.
## What was harder than expected
 
- **Two genuinely separate bugs hid behind passing tests.** Both the certificate route collision and the unreachable `'released'` state were invisible from the test suite alone — the tests were well-written and passed correctly, but neither one exercised the real integration path (actual router mount order; an actual state-transition trail through the scheduler). Confirming correctness required reading the running system's wiring, not just running `npm test`.
- **A `qualifyingThreshold` column referenced during an earlier database drift incident turned out not to exist at all** once checked directly against the schema — a good reminder not to assume something is real just because it was mentioned once, even by tooling output.
## What I'd do differently
 
- **Check for route collisions explicitly whenever two people might plausibly build the same endpoint independently** — a quick `grep` across all route files for a given path would have caught the certificate duplication immediately, rather than discovering it while reviewing.
- **Treat "the test mocks this state" as a prompt to verify the state is reachable in production code**, not just that the test's assertions are internally consistent.
## Carried into next sprint
 
- Confirm with the team whether `recipientRole: 'organiser'` on a `NotificationRule` should ever actually route email to organisers — the current implementation stores the value but has no code path to resolve "which organiser owns this round," since that relationship doesn't exist in the schema yet.
- Consider surfacing the "already notified" dry-run flag more prominently in the notifications config UI, since it's currently only visible via the API response.
# Sprint Retrospective



## Kutloano (Paper Remarks and Marking)


## What Went Well

* We successfully implemented the marking queue and remark request functionality across the frontend and backend.
* The remark flow was developed end-to-end, including submitting a remark request, storing the request, and displaying remark-related information to the educator.
* Backend tests were consistently used to verify the new functionality. The remark-related tests and the wider backend test suite passed successfully.
* Database migrations were successfully created and applied for the new remark and qualifying-threshold functionality.
* The team was able to integrate changes from different branches while continuing development without losing existing functionality.
* We identified and fixed issues during development through local testing before deployment.
* The team communicated effectively when identifying bugs and clarifying how features such as remarks and marking should work.

## What Could Be Improved

* Some requirements were not completely clear before implementation. For example, the requirement that the organiser must be able to identify a student by their student number during the remark process should have been clarified earlier.
* Some documentation contained incorrect MDX/Markdown syntax, which caused the Docusaurus deployment build to fail.
* There were instances where changes from different features affected existing functionality, requiring additional testing after merges.
* Some bugs were discovered relatively late because certain edge cases were not included in the initial tests.
* The frontend and backend were sometimes developed separately before confirming that the API response contained all the information required by the frontend.
* More frequent integration testing would have helped identify deployment and merge-related problems earlier.

## Action Items

* Ensure that remark requests display the student's student number to the organiser.
* Review API responses before implementing frontend features to ensure all required student and submission information is available.
* Add tests for important edge cases, especially duplicate remark requests and multiple students associated with the same educator.
* Run the complete test suite after merging major feature branches.
* Validate Docusaurus documentation locally before pushing changes that trigger deployment.
* Clarify feature requirements with the team before implementation, especially where different user roles have different responsibilities.
