---
sidebar_label: sprint4_minutes
---
# Sprint 4 Daily Standup Minutes

**Period:** 30 September 2026 – 10 October 2026  
**Team:** Olympiad Portal Development Team

---

## Meeting 1 — 30 September 2026

### Zandile — Activity Feed, Email Branding, Seeding, Load Testing, QA & Documentation

**Previous work:**  
Ran Sprint 4 planning with the team on 29 September: selected the six standout features, distributed the four roles, and formalised the user-story backlog (US-1.1 to US-4.6) with acceptance criteria in Taiga.

**Today:**  
Start US-4.1, the real-time organiser activity feed. Design settled on Server-Sent Events rather than WebSockets — the feed is one-directional and SSE avoids new connection infrastructure. The main design problem is that `EventSource` cannot send an `Authorization` header, so planning a query-token promotion middleware ahead of the Clerk auth chain.

**Blockers:**  
None.

**Next steps:**  
Build the in-memory event bus and the SSE stream route, then wire broadcasts into the scheduler, submissions, marking and access-decision routes.

---

### Mlungisi — Responsive Layout, Accessibility, Dark Mode & Onboarding Tour

**Previous work:**  
Took the UX-polish role at planning: responsive layout, accessibility, dark mode and the onboarding tour.

**Today:**  
Begin the responsive audit at 320, 768 and 1024 px across the organiser, educator and student pages, recording every layout break — sidebars, tables, grids — as a checklist to drive the implementation pass.

**Blockers:**  
None.

**Next steps:**  
Finish the audit, prioritise fixes by page usage, and start the mobile layout implementation.

---

### Kutloano — Question Bank, Variants & Analytics Dashboards

**Previous work:**  
Took the question bank and analytics role at planning.

**Today:**  
Review the schema to decide where `QuestionBank` and `Question` models should sit relative to `Paper` and `Round`, since per-entrant variants must feed the existing sitting and submission chain. Draft the model and migration plan.

**Blockers:**  
Needs team agreement that variant selection happens at sitting start rather than registration, so late registrants still receive a paper.

**Next steps:**  
Present the schema design for sign-off, then implement the question-bank CRUD routes.

---

### Ronie — Duplicate Detection, Anti-Cheating & Account Hardening

**Previous work:**  
Took the detection and account-hardening role at planning.

**Today:**  
Review the entrant registration flow for duplicate signals (name, date of birth, school) and audit the existing account-deletion endpoints — they predate the Clerk migration and already remove the Clerk user, so the story is the UI and confirmation flow. Draft the duplicate-detection rules.

**Blockers:**  
Needs a team decision on which anti-cheating signals are realistic in a 12-day sprint.

**Next steps:**  
Implement duplicate detection on registration and import; design the sitting-level signals.

---

## Meeting 2 — 2 October 2026

### Zandile — Activity Feed, Email Branding, Seeding, Load Testing, QA & Documentation

**Previous work:**  
US-4.1 activity feed merged (PR #135): in-memory event bus with a 50-event history buffer, the SSE stream route, query-token auth, and the live organiser panel. While browser-testing it, found a pre-existing CORS regression on `main` — two route-scoped `cors()` registrations overwrote the global credentialed CORS with a wildcard — and removed them in the same PR. Also merged US-4.3 production data seeding (PR #134): six schools, eighteen educators, seventy-two students, two olympiads with six rounds across released/open/scheduled states.

**Today:**  
Start US-4.2 branded email templates on a fresh branch cut from `main`.

**Blockers:**  
None.

**Next steps:**  
Build the shared brand layout module, rewire all six transactional emails through it, and keep the existing test assertions passing unchanged.

---

### Mlungisi — Responsive Layout, Accessibility, Dark Mode & Onboarding Tour

**Previous work:**  
Completed the responsive audit; every page catalogued at the three breakpoints with fixes prioritised.

**Today:**  
Implement the mobile layout: collapsible sidebars, fluid grids, and table handling on the responsive branch.

**Blockers:**  
Some organiser pages use fixed-width layouts that need restructuring rather than patching.

**Next steps:**  
Finish the implementation and open the PR, then start the accessibility pass (skip link, labels, contrast, keyboard navigation).

---

### Kutloano — Question Bank, Variants & Analytics Dashboards

**Previous work:**  
Team agreement secured on the open design question — variant selection happens at sitting start, so late registrants still receive a paper.

**Today:**  
Finalise the schema design — `Question` and `QuestionVariant` with their relationships to `Round` — and dry-run the variant-selection algorithm against the existing sitting flow before cutting the migration.

**Blockers:**  
None. Implementation starts once the QA-critical merges (activity feed, seeding) are stable on `main`.

**Next steps:**  
Cut the Prisma migration and build the question-bank CRUD routes with tests.

---

### Ronie — Duplicate Detection, Anti-Cheating & Account Hardening

**Previous work:**  
Duplicate-detection rules drafted: match on name and date of birth within a school, plus exact email matches across schools.

**Today:**  
Implement the duplicate check on entrant registration — flag suspects rather than blocking them — and start the account-deletion UI with a typed-confirmation dialog.

**Blockers:**  
Open question on how flagged duplicates surface to educators (inline banner versus a review queue).

**Next steps:**  
Finish registration detection; wire flagged entrants into the educator school view.

---

## Meeting 3 — 5 October 2026

### Zandile — Activity Feed, Email Branding, Seeding, Load Testing, QA & Documentation

**Previous work:**  
US-4.2 branded emails merged (PR #136): all six transactional sends render the branded layout with a named sender, and a follow-up pinned email timestamps to SAST so Render's UTC clock no longer shifts them by two hours. Started US-4.4, the load-test re-run: hardened both boundary scripts (batched fixture creation, pre-run sweeps, production error handler mounted), and found a real bug — `requireRole` swallowed pool exhaustion and returned a hard 500 instead of the #202 503 + `Retry-After` contract. Fixed and merged with the hardened harness (PR #138); both boundary scripts now pass all scenarios at concurrency 50.

**Today:**  
Re-run the main harness full-size locally and verify exactly-once semantics.

**Blockers:**  
The deployed run is still blocked: the Render service returns fast 500s on every database-touching endpoint while the same code and database serve 200s locally. Needs the Render dashboard (logs and `DATABASE_URL`) to diagnose.

**Next steps:**  
Close the local leg of US-4.4, then chase the deployed leg once Render is understood.

---

### Mlungisi — Responsive Layout, Accessibility, Dark Mode & Onboarding Tour

**Previous work:**  
Responsive layout merged (PR #137, #314) and accessibility compliance merged (PR #139, #315) — WCAG 2.1 AA fixes across all pages with Lighthouse scoring 100 on every audited page.

**Today:**  
Land dark mode (#316): CSS-variable palette, the toggle with `aria-pressed`, persisted preference with cross-tab sync, and the system default — final review and merge. The onboarding tour (#317) follows immediately after.

**Blockers:**  
None.

**Next steps:**  
Start the UX polish pass once the tour lands — duplicate sidebars, non-functional search and notifications, and the theme-init script all need attention.

---

### Kutloano — Question Bank, Variants & Analytics Dashboards

**Previous work:**  
Schema design finalised: `Question` and `QuestionVariant` models with their `Round` relationships, reviewed against the sitting route's concurrency guarantees.

**Today:**  
Cut the Prisma migration and implement the question and variant management system — CRUD routes, per-entrant variant assignment with deterministic selection, and difficulty tracking.

**Blockers:**  
Sitting creation is concurrency-sensitive (exactly-once guarantees), so the variant wiring is being made carefully against the existing race tests.

**Next steps:**  
Difficulty scoring with weighted automarking and the analytics/charting system, then open the PR.

---

### Ronie — Duplicate Detection, Anti-Cheating & Account Hardening

**Previous work:**  
Duplicate detection live on registration; account-deletion UI in progress with the confirmation flow.

**Today:**  
Implement sitting-level anti-cheating signals — focus loss, implausibly rapid answering, and concurrent sessions — recorded against the sitting for organiser review rather than auto-punitive action.

**Blockers:**  
Signal thresholds need calibrating to avoid false positives; will use the seeded production data to tune them.

**Next steps:**  
Build the organiser-facing signal view, then move to the 503 retry and session-persistence stories.

---

## Meeting 4 — 7 October 2026

### Zandile — Activity Feed, Email Branding, Seeding, Load Testing, QA & Documentation

**Previous work:**  
US-4.4 fully closed. Diagnosed the Render 500s as a two-service mixup: the live Vercel bundle still called the retired Render service. Repointed production to the Blueprint-managed service, redeployed, and verified the new host is baked into the bundle. After warming the free tier (27 s cold start), the first full-size deployed load run completed: 565 requests, zero errors, all four exactly-once checks passing, cleanup verified with zero orphaned rows. Then executed US-4.5, the full QA sweep, on 6 October: both suites at 54 files / 905 tests passing with coverage thresholds met, CI-equivalent lint clean, a 16-probe production API UAT to contract, the deployed student journey (31 requests, zero errors, exactly-once), and a browser pass — no product defects found. Dependency advisories logged for follow-up. The QA sweep write-up and the deployed load-test re-run documents merged to `main` that evening (PRs #146 and #145).

**Today:**  
Start US-4.6, the documentation update — Sprint 4 sections for the features page, the roadmap's delivered list, the changelog and the API reference — and schedule the dependency-update task, prioritising the `next` RCE fix.

**Blockers:**  
Educator and organiser Clerk sign-ins sit behind new-device email verification with no QA-owned inbox — the account owners need to complete one manual sign-in each.

**Next steps:**  
Work through US-4.6 as the remaining feature PRs land, so the documentation reflects the full sprint.

---

### Mlungisi — Responsive Layout, Accessibility, Dark Mode & Onboarding Tour

**Previous work:**  
Dark mode merged (PR #140, #316) and the onboarding tour merged (PR #143, #317). The UX polish pass also merged (PR #144): duplicate sidebars removed, search and notifications made functional, theme init moved to `next/script`, and the organiser mobile layout fixed.

**Today:**  
Verify dark mode across every page in both themes — Lighthouse re-run in forced dark mode scored 100 on all 21 pages — and confirm the onboarding tour resets correctly for fresh accounts.

**Blockers:**  
None.

**Next steps:**  
Write the four feature documents (responsive audit, accessibility audit, dark mode, onboarding tour) and prepare the demo walkthrough.

---

### Kutloano — Question Bank, Variants & Analytics Dashboards

**Previous work:**  
The full cluster implemented in one burst yesterday: question and variant management, difficulty tracking, weighted automarking and the analytics/charting system — with the analytics-loading bugs (#276, #281) fixed overnight and the first test pass (#280) landed.

**Today:**  
Final alignment of the suite to the variant-aware sitting route — stale frontend mocks were the last failures — then land the PR. Merged this afternoon as PR #149.

**Blockers:**  
None.

**Next steps:**  
Verify the merged feature against the seeded production data and support the documentation update for the new endpoints and schema models.

---

### Ronie — Duplicate Detection, Anti-Cheating & Account Hardening

**Previous work:**  
Anti-cheating signals recorded against sittings; the organiser signal view is underway.

**Today:**  
Implement the client-side 503 retry in the API client: retry on `Retry-After` per the #202 contract with a bounded attempt budget, so transient pool exhaustion is invisible to users.

**Blockers:**  
None.

**Next steps:**  
Session persistence — keeping student sessions alive across refresh and reconnect — then final integration tests across the five stories.

---

## Meeting 5 — 9 October 2026

### Zandile — Activity Feed, Email Branding, Seeding, Load Testing, QA & Documentation

**Previous work:**  
QA sweep documentation merged (PR #146) with the environment, all five sections and the verdict recorded; the dependency advisories and the manual organiser sign-in are logged as open items.

**Today:**  
US-4.6, the documentation update — broadened after PR #149 (question bank, variants, difficulty scoring, analytics) merged on 7 October: Sprint 4 sections for the features page, the roadmap's delivered list, the question, analytics and SSE endpoints in the API reference, the new schema models, and the changelog — alongside the sprint planning, minutes and retrospective documents.

**Blockers:**  
None — the QA-window documentation PRs are merged, so `main` is the current base.

**Next steps:**  
Complete US-4.6, verify the docs site builds, and prepare the Milestone 4 demo script.

---

### Mlungisi — Responsive Layout, Accessibility, Dark Mode & Onboarding Tour

**Previous work:**  
All four feature documents drafted: the responsive audit, the accessibility audit with Lighthouse and screen-reader results, dark mode, and the onboarding tour.

**Today:**  
Final cross-device and cross-browser verification of the responsive layout, and a last dark-mode contrast sweep against the audit checklist.

**Blockers:**  
None.

**Next steps:**  
Close out the four stories, confirm all documentation pages build, and support the demo walkthrough.

---

### Kutloano — Question Bank, Variants & Analytics Dashboards

**Previous work:**  
The question-bank cluster merged on 7 October (PR #149): question bank management, per-entrant variants, difficulty scoring and the analytics dashboards with their chart components.

**Today:**  
Verify the variant-aware sitting flow end-to-end on the deployed stack — variant assignment at sitting start and weighted automarking on submit — and check the analytics dashboards against the seeded production data.

**Blockers:**  
None.

**Next steps:**  
Demo-path verification and retrospective input.

---

### Ronie — Duplicate Detection, Anti-Cheating & Account Hardening

**Previous work:**  
503 retry implemented in the API client with a bounded retry budget; session persistence done — student sessions survive refresh and reconnect behind the existing auth guard.

**Today:**  
Final integration testing across the five stories, including the account-deletion flow end-to-end against Clerk.

**Blockers:**  
None.

**Next steps:**  
Open the remaining PRs and record known limitations (signal thresholds are defaults pending real sitting data) for the documentation.

---

## Meeting 6 — 10 October 2026

### Zandile — Activity Feed, Email Branding, Seeding, Load Testing, QA & Documentation

**Previous work:**  
US-4.6 documentation update completed: Sprint 4 sections across the features page, roadmap, API reference and changelog, plus the sprint planning, minutes and retrospective documents; the docs build verified.

**Today:**  
Final sprint close-out: reconcile the sprint board against delivered work, walk the demo script against production, and facilitate the retrospective.

**Blockers:**  
None. The dependency upgrades are deliberately deferred past the milestone and recorded as issues.

**Next steps:**  
Run the retrospective and prepare the milestone submission.

---

### Mlungisi — Responsive Layout, Accessibility, Dark Mode & Onboarding Tour

**Previous work:**  
All four stories closed and merged: responsive layout (#314), accessibility compliance (#315), dark mode (#316) and the onboarding tour (#317), plus the UX polish pass (#144). Lighthouse holds 100 on all 21 pages in both themes.

**Today:**  
Demo-readiness check: the mobile walkthrough, the theme toggle, and the first-run tour with a fresh account.

**Blockers:**  
None.

**Next steps:**  
Support the milestone demo and contribute to the retrospective.

---

### Kutloano — Question Bank, Variants & Analytics Dashboards

**Previous work:**  
Question bank merged (PR #149) and verified: variants assign deterministically at sitting start, weighted automarking holds, and the analytics charts render against production data.

**Today:**  
Final demo walkthrough of the question-bank and analytics flows, confirming no regressions in the sitting chain from the variant integration.

**Blockers:**  
None.

**Next steps:**  
Provide retrospective input and demo support.

---

### Ronie — Duplicate Detection, Anti-Cheating & Account Hardening

**Previous work:**  
Duplicate detection, anti-cheating signals, the account-deletion UI, the 503 retry and session persistence all complete, with PRs opened for the remaining stories.

**Today:**  
Final regression pass on the sign-in and session flows, and a demo script for the detection features using the seeded data.

**Blockers:**  
None.

**Next steps:**  
Provide retrospective input and hand any remaining nits to Gitea issues.
