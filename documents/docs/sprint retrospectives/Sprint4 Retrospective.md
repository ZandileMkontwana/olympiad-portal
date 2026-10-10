---
sidebar_label: Sprint4 Retrospective
---
# Sprint Retrospective – Zandile

## What Went Well

Five of my six stories shipped end-to-end this sprint, and they built on each other better than I expected. The **real-time activity feed (US-4.1, PR #135)** came together quickly once the design decision was made — Server-Sent Events instead of WebSockets, with a query-token promotion middleware solving the `EventSource` authentication problem cleanly. The **branded email templates (US-4.2, PR #136)** reused the builders the notification system already had, so the dry-run previews inherited the branding for free. The **production data seeding (US-4.3, PR #134)** landed early enough that the whole team could test and demo against realistic data for the rest of the sprint.

The **load-test re-run (US-4.4, PR #138)** was the most valuable story of the sprint. Hardening the boundary scripts and re-running them at concurrency 50 surfaced a real production bug no unit test had caught: `requireRole` swallowed database pool exhaustion and returned a hard 500 instead of the #202 `503 + Retry-After` contract. Fixing it made the auth layer consistent with the routes, and the full backend suite stayed green.

The **QA sweep (US-4.5)** validated the whole team's sprint, not just my own work: 54 test files / 905 tests passing with coverage thresholds met, lint clean, a 16-probe production API UAT behaving to contract, the deployed student journey completing 31 requests with zero errors and exactly-once guarantees intact, and a browser pass over the production frontend — with no product defects found.

Two production issues were caught that would otherwise have shipped silently. First, a pre-existing CORS regression on `main`: two route-scoped `cors()` registrations overwrote the global credentialed CORS with a wildcard, which browsers reject — I found it while browser-testing the activity feed and removed it. Second, the **two-Render-services confusion**: the production Vercel bundle was still calling the retired Render service, so deploys to the healthy service never reached users. I repointed production to the Blueprint-managed service, redeployed, verified the new host at the bundle level, and then ran the first full-size deployed load test — 565 requests, zero errors.

Finally, cutting each story on its own branch from `main` kept the PRs small and reviewable, and the sprint ran without a single merge conflict on my side.

## What Could Be Improved

The deployed leg of the load-test re-run was **blocked for days by the two-service confusion**. I was diagnosing Render 500s as a database or configuration problem before checking the simple thing — which hostname the live bundle actually calls. That check should have been the first step on day one of the re-run.

The **Supabase pooler incident** mid-sprint degraded the network path and forced re-runs, and some numbers from that window had to be discarded as unrepresentative. Environment health should be probed and recorded before treating any load-test numbers as evidence.

**QA account ownership** was not sorted out at sprint start: the educator and organiser Clerk accounts sit behind new-device email verification with no QA-owned inbox, so those sign-ins could not be completed during the sweep and remain manual items for the account owners.

The **dependency advisories** — including a critical `next` RCE — were only surfaced because the QA sweep happened to run `npm audit`. A scheduled audit belongs mid-sprint, not only at QA time.

**US-4.6, the documentation update, is the one story still open at retrospective time.** The features page, roadmap and API reference lagged behind shipped features for most of the sprint, which squeezed the documentation work into the final days. Writing the documentation incrementally with each story would have avoided the end-of-sprint crunch.

## What We Learned

**A green deploy does not mean production is fixed.** The deployment pipeline reported success while the live bundle still called a broken host. Verifying what the shipped bundle actually contains — not just that the build succeeded — is now part of my deployment checklist.

**Browser API constraints shape architecture.** `EventSource` cannot send an `Authorization` header, and that single constraint drove the query-token design for the whole activity feed. Checking client-side constraints before designing the backend contract saves rework.

**Load tests that fail are the valuable ones.** The `requireRole` bug only appeared under real pool exhaustion — every mocked unit test passed. The combination of in-process boundary tests against the real database and full HTTP runs against the deployment is what gave the results credibility.

**Production-scale QA catches what local testing cannot.** Orphaned-row verification after the student journey, bundle-level host verification, and CORS preflight checks against the real origin are cheap checks that found real issues — and when they found nothing, they became evidence.

## Action Items Going Forward

- Schedule the dependency-update task as a Gitea issue, prioritising `next` and `proxy-addr`
- Complete one manual organiser and educator sign-in each to clear the Clerk new-device verification gates
- Add "verify the bundle-level API host" to the deployment checklist after every production repoint
- Put `npm audit` on the mid-sprint calendar rather than leaving it to the QA sweep
- Write documentation incrementally with each story instead of as a closing pass
- Keep the activity-bus broadcast pattern documented as the reference for any future event source

## Overall Reflection

This sprint delivered the standout infrastructure features and then closed the loop by validating them at production scale. The sequence — feed, emails, seed, load tests, QA sweep — meant each story made the next one verifiable: the seeded data fed the load tests, the load tests validated the deployed backend, and the QA sweep tied all of it together with evidence.

The most valuable outcome was not any single feature but the confidence the closing verification provides: the deployed stack now has a documented, reproducible, zero-error student journey, exactly-once guarantees verified from the database up, and a QA record showing 905 passing tests and no product defects. The open items — the documentation update, the dependency upgrades and the manual Clerk sign-ins — are recorded and owned rather than forgotten.

The deepest lesson of the sprint is that **verification is a feature of its own**: the CORS regression and the two-service confusion were both invisible to the build pipeline, and only deliberate, production-facing checks caught them.

---

# Sprint Retrospective – Kutloano

## What Went Well

The **schema-first approach paid off**. Designing the question bank against the existing sitting and submission chain before writing code meant the `QuestionBank`, `Question` and variant models slotted in without disrupting the concurrency guarantees the portal already has.

**Per-entrant variant assignment** landed with a determinism guarantee — the same entrant always receives the same variant — which removes any ambiguity when a submission is remarked or appealed. That single design decision simplified everything downstream.

**Difficulty scoring and weighted automarking** extended the existing MCQ marking rather than replacing it, and the **analytics dashboards** (organiser and educator) were grounded in the seeded production data from US-4.3, so the charts demo realistic distributions from day one.

The suite stayed green throughout, and the full question-bank cluster merged mid-sprint (PR #149, 7 October) — leaving the final days for verification against production data rather than review firefighting.

## What Could Be Improved

The question bank touches the **concurrency-sensitive sitting route**, and the integration checkpoint with the sitting-route owner was handled informally rather than as a defined sub-task — exactly the gap the Sprint 3 retrospective flagged for cross-layer stories. It worked this time, but it should not rely on luck.

The **test ripple from weighted automarking was larger than expected** — changing how scores are computed touches marking, submission and result fixtures across many files. The fixture updates should have been batched once instead of file-by-file.

The branch needed a **mid-flight merge from `main`** because other sprint work (the UX polish pass and the documentation merges) landed underneath it, and the sitting-route integration then required a dedicated test-alignment pass for stale frontend mocks. Pulling `main` in more frequently would have reduced that rework.

## What We Learned

**Deterministic variant selection is worth designing for.** Seeding the selection per entrant makes variants stable across retries and remarking without storing extra state.

**Analytics is only as good as the data beneath it.** Building on the seeded production data made the dashboards demoable immediately — the cross-role dependency was worth coordinating.

**Shared-chain features need enforced integration checkpoints.** The sitting and submission routes are the most contested code in the system; any story touching them should carry an explicit integration sub-task.

## Action Items Going Forward

- Monitor variant-aware automarking results as real sittings accumulate, watching for scoring anomalies
- Add an integration-checkpoint sub-task to any story that touches the sitting/submission chain
- Batch shared test-fixture updates when changing marking behaviour
- Split large PRs by layer (endpoints first, UI second) so review starts earlier

## Overall Reflection

The sprint took the question bank from a whiteboard idea to a working feature set — bank management, variants, difficulty scoring and two analytics dashboards — integrated into the sitting chain without breaking the exactly-once guarantees Sprint 3 built, and merged with sprint days to spare. The work validates the planning decision to pair the analytics dashboard with the question bank: they share the same data model, and building them together avoided a second schema pass.

The main lesson carried forward is process rather than technical: the integration checkpoint discipline the team agreed on after Sprint 3 needs to be structural, not optional, for any story that touches shared routes.

---

# Sprint Retrospective – Mlungisi

## What Went Well

All four of my stories shipped and merged: the **responsive layout (#314)**, **accessibility compliance (#315)**, **dark mode (#316)** and the **onboarding tour (#317)**, followed by a **UX polish pass (#144)** that cleaned up what the feature merges left behind.

The **audit-first approach** worked exactly as intended. Conducting the responsive audit at 320/768/1024 px before writing any fixes, and the accessibility audit before remediation, meant implementation was driven by a checklist of real issues rather than guesswork. The accessibility work closed with **Lighthouse scoring 100 on all 21 pages**, and the dark-mode audit repeated that in forced dark mode.

**Dark mode via CSS variables** proved to be the right foundation: the toggle carries `aria-pressed` state, the preference persists and syncs across open tabs, and `prefers-color-scheme` supplies the default. Because everything runs on variables, the onboarding tour styling could reuse them and work in both themes with no extra effort.

The contrast work had a bonus effect: **fixing dark-mode contrast also fixed light-mode issues** — the score colours (green/amber/red/grey) now clear 4.5:1 in both themes, where the old light-mode values did not.

## What Could Be Improved

The **UX polish pass existed because issues surfaced only after the feature merges** — duplicate sidebars, non-functional search and notifications, and a theme-init script error. A polish checkpoint between feature merges would have caught these closer to the source.

The **Lighthouse toolchain constraint** was discovered late: the optional Lighthouse script requires Node >= 22 while the project and CI run Node 20, so it can only run locally. The accessibility audit records this, but it should have been checked before the audit was planned.

One **dark-mode regression was found during the visual check** — a button pairing white text with the brand violet — and fixed by keeping the saturated brand colour shared across themes and darkening on hover with `color-mix` instead of switching to the pale tint.

## What We Learned

**Dark mode touches every inline-styled component.** The only sustainable approach is variables as the sole colour source; any hardcoded colour becomes a dark-mode bug waiting to happen.

**Theme work and accessibility overlap heavily.** The theme toggle needed to be a real button with `aria-pressed` and a 44px touch target to satisfy both stories at once — treating them as one effort was more efficient than two passes.

**Cross-tab consistency is cheap with storage events.** Listening for storage changes keeps the theme coherent across open tabs with a few lines of code.

**Visual checks in both themes catch what automated audits miss.** The button-contrast regression passed automated checks but failed the eyeball; the visual checklist in the dark-mode document came directly from that.

## Action Items Going Forward

- Keep colour tokens variable-only — no new hardcoded colours in components
- Run the visual checklist in both themes for any future UI work
- Align the Lighthouse toolchain with the project's Node version so audits can run in CI
- Add a polish checkpoint between feature merges rather than one pass at the end
- Verify the onboarding tour with a genuinely fresh account, since a completed tour is invisible to testing

## Overall Reflection

This sprint was about polish as a feature in its own right — responsive, accessible, themeable, and self-explanatory for first-time users. The audit-first approach meant every fix traced to a recorded issue, and the closing evidence (Lighthouse 100 across all 21 pages in both themes, screen-reader checks, the responsive audit tables) is exactly the kind the rubric rewards.

The deepest lesson: **polish work compounds**. The CSS-variable foundation built for dark mode made the onboarding tour and the contrast fixes easier, and the accessibility work improved the light theme for everyone. Investing in foundations rather than patching per-page is what made four stories plus a polish pass achievable in one sprint.

---

# Sprint Retrospective – Ronie

## What Went Well

All five stories in my role landed: **duplicate-entrant detection**, **anti-cheating signals**, the **account-deletion UI**, the **503 retry**, and **session persistence**.

The **detection features were designed to be non-destructive**. Duplicates are flagged for review rather than blocking registration, and anti-cheating signals — focus loss, implausibly rapid answering, concurrent sessions — are recorded against the sitting for an organiser to judge. Nothing auto-punishes a student on a heuristic.

The **account-deletion UI** was built on the audited existing endpoints rather than new ones; since the Clerk migration, deletion already removes the Clerk user, so the story was the UI and confirmation flow — a small, safe win.

The **503 retry aligned with work happening in the same sprint**: the load-test re-run was validating the #202 `503 + Retry-After` contract under real pool exhaustion at the same time as I was implementing the client-side retry that honours it. The client and the contract were tested against the same behaviour.

**Session persistence** composed with the existing architecture rather than fighting it — the auth guard and the entrant picker were already decoupled, so persisting the student session across refresh and reconnect was a contained change.

## What Could Be Improved

The **anti-cheating signal thresholds needed team debate mid-build**. Which signals were realistic in a 12-day sprint should have been scoped at planning; instead the scope conversation happened during implementation, which cost time. The shipped thresholds are sensible defaults pending real sitting data.

**Detection features are hard to demo without data** — they only shine with the seeded production data, which made US-4.3 a real dependency for my testing. It landed early, but the dependency should have been made explicit at planning.

Like the question-bank work, **the final PRs opened at sprint close**, leaving review margin thinner than it should be.

## What We Learned

**Client retries must be bounded and must honour `Retry-After` exactly.** An unbounded retry amplifies an incident; a bounded one makes transient pool exhaustion invisible. The retry budget staying configurable is the right call.

**Detection features live or die on their false-positive rate.** A duplicate flag or a cheating signal that fires on honest students destroys trust faster than no detection at all — hence flag-for-review rather than automated action.

**Session persistence interacts subtly with sign-in redirect flows.** The earlier redirect-race fix was a warning: any change to where the session lives has to be tested against the redirect paths, not just the happy path.

## Action Items Going Forward

- Tune the signal thresholds once real sitting data accumulates, and keep them configurable
- Monitor duplicate-flag and signal false positives during the demo period
- Scope heuristic feature lists at planning, not mid-implementation
- Make cross-role data dependencies explicit user-story prerequisites at planning

## Overall Reflection

The role took the portal's trust model seriously: detection that flags rather than punishes, deletion that is deliberate and confirmed, retries that respect the server's signals, and sessions that survive the real world of refreshes and reconnects. None of it is glamorous, but all of it is what makes the portal feel safe to schools and entrants.

The best outcome of the sprint was the accidental coordination with the load-test re-run: the #202 contract was specified, server-side, load-tested, and client-honoured within the same two weeks. That is the tightest a client-server contract has ever been closed on this project, and it shows what parallel stories that reference the same issue number can do.
