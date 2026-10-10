# Changelog

All notable changes to the Olympiad Portal are documented in this file.

## [Sprint 4] — 2026-10-10

### Added

- **Real-time activity feed (US-4.1)** — Server-Sent Events stream for the organiser dashboard: an in-memory event bus with a 50-event history buffer ([`activityBus.js`](backend/src/lib/activityBus.js)), `GET /api/activity/stream` with catch-up history and heartbeat frames ([`activity.js`](backend/src/routes/activity.js)), and a pre-Clerk middleware promoting `?token=` to a Bearer header so `EventSource` requests pass the standard auth chain. Broadcasts wired into the scheduler (round transitions), submissions, sittings, marking and access decisions; live feed component with Connecting/Live/Reconnecting status and newest-first history.
- **Question bank and per-entrant variants** — `Question` and `QuestionVariant` models with CRUD routes ([`questions.js`](backend/src/routes/questions.js)) and an organiser question-management UI per paper. Variants are assigned to entrants deterministically at sitting start via a hash of entrant + question IDs ([`variantAssignment.js`](backend/src/lib/variantAssignment.js)), stored on the sitting, and never exposed with memo answers to students.
- **Question difficulty tracking** — `Question.difficulty` stores the success rate (marks earned / marks possible, variant-aware), recalculated automatically when a round closes and when results are released ([`difficulty.js`](backend/src/lib/difficulty.js)); surfaced in the organiser questions API and UI with a difficulty badge.
- **Analytics dashboards** — `GET /api/analytics/rounds/:roundId` (organiser) and `GET /api/analytics/rounds/:roundId/schools/:schoolId` (own-school educator) with participation, score distribution and per-question metrics ([`analytics.js`](backend/src/routes/analytics.js)); chart components (participation, score distribution, question performance) on the organiser closed-round page and the educator round view.
- **Branded transactional emails (US-4.2)** — all six sends render a shared branded HTML layout with a named "Olympiad Portal" sender and CTA buttons ([`emailTemplates.js`](backend/src/lib/emailTemplates.js)); timestamps render in SAST regardless of server clock.
- **Production demo data seeding (US-4.3)** — [`seed-production.js`](backend/prisma/seed-production.js) populates six schools, educators, students, two olympiads with rounds across all states, submissions with bell-curve scores, results, marking tasks and audit logs; idempotent on re-run.
- **Responsive layout** — all pages verified and fixed at 320/768/1024 px, including collapsible sidebars and mobile organiser layout.
- **Accessibility compliance** — WCAG 2.1 AA across the portal; Lighthouse accessibility 100 on all 21 pages, in light and dark mode.
- **Dark mode** — CSS-variable palette with a real toggle (`aria-pressed`), persisted preference with cross-tab sync, `prefers-color-scheme` default, and theme-aware logo/charts.
- **First-user onboarding tour** — guided tour for first-time educators and organisers, dismissed-state persisted.
- **External API with API keys** — public results endpoints gated by API keys with a self-service key management flow ([`external.js`](backend/src/routes/external.js), [`apiKeys.js`](backend/src/routes/apiKeys.js)).

### Changed

- **Variant-aware sittings and automarking** — a sitting stores its assigned variant choices; the student sees only the assigned variants (memos and rubrics stripped), and submission automarking prefers the assigned variant's memo answer over the base question's.
- **Production backend repointed** — the frontend now calls the Blueprint-managed Render service `olympiad-portal-backend.onrender.com` after the retired `olympiad-portal` service began failing; the deployed bundle was verified chunk-by-chunk.
- **Documentation refreshed** — load-testing results (Sprint 4 re-run and the first full-size deployed run), QA sweep report, and testing coverage numbers brought current.

### Fixed

- **`requireRole` swallowed pool exhaustion** — the auth middleware returned a hard 500 "Authorization check failed" on Prisma `P2024`/`P2028`; it now maps busy errors to the #202 contract (`503` + `Retry-After`), matching the routes ([`auth.js`](backend/src/middleware/auth.js)). Found by the concurrency-50 load-test re-run.
- **Route-scoped wildcard CORS** — two leftover `app.use('/api/...', cors())` registrations overwrote the global credentialed CORS with `*`, which browsers reject; removed so the credentialed preflight contract holds on every route.
- **Load-test harness defects** — boundary-script setups now batch fixture creation (no more setup pool exhaustion), a pre-run sweep clears stale `LOADTEST-` rows, the bare test apps mount the production error handler, and `--cleanup` deletes notification/audit rows in FK order.
- **UX polish** — duplicate sidebars removed, search and notifications made functional, calendar button and modal added to the organiser shell, theme init moved to `next/script`.
- **Analytics loading bugs** (#276, #281) and stale frontend mocks after the sitting-route variant integration.

### Testing

- Backend: 636 tests across 31 files — all passing — 86.28% statements, 77.49% branches, 91.36% functions, 86.51% lines.
- Frontend: 400 tests across 32 files — all passing — 90.83% statements, 87.4% branches, 88.88% functions, 93.72% lines.
- Total: 1,036 tests passing, above both suites' coverage thresholds.
- Load tests: both boundary scripts pass all scenarios at concurrency 50; the main harness completed the first full-size deployed run — 565 requests, 0 errors, all exactly-once checks passing.
- QA sweep (6 October): 54 files / 905 tests at sweep time, production API UAT, deployed student journey and browser pass — no product defects.

## [Sprint 3] — 2026-09-29

### Added

- **Marking moderation queue** — organisers can assign manual marking tasks, moderators submit scores, and a moderation review endpoint validates score ranges ([`marking.js`](backend/src/routes/marking.js)).
- **Appeals and reviewer workflow** — educators can request remarking on marked submissions; organisers assign reviewers; approved appeals amend `Result.score` and re-trigger qualification/auto-advance in a single transaction ([`remark.js`](backend/src/routes/remark.js), [`appeal-workflow.md`](documents/docs/appeal-workflow.md)).
- **Co-organiser access** — `OlympiadOrganiser` join table with backfill from existing `organiserId`; add/list/remove organiser endpoints; membership-based access control replacing single-organiser checks across all olympiad-scoped routes ([`olympiadOrganisers.js`](backend/src/routes/olympiadOrganisers.js)).
- **Multi-olympiad timezone support** — `timezone` field on the `Olympiad` model; scheduler stores and compares in UTC; frontend renders times in the viewer's or olympiad's timezone.
- **Audit log and round replay** — `AuditLog` entries written by the scheduler for every automatic action (open, close, auto-advance, notifications); replay endpoint aggregates the log into a timeline for organiser-facing UI.
- **Qualifying-threshold round advancement** — entrants who meet the threshold are automatically registered for the next round via `advanceQualifiedEntrantsForRound` in [`qualification.js`](backend/src/lib/qualification.js).
- **Concurrent boundary load tests** — `loadtest/round-boundary-submissions.js` and `loadtest/round-open-sittings.js` exercise transaction-wrapped round-state re-checks under 50-way concurrency against a real database.
- **Standings endpoints** — `GET /api/rounds/:id/standings` and `GET /api/rounds/:id/standings/schools` for live-ranked entrant and per-school standings.
- **Results management** — `POST /api/rounds/:id/release-results` and `POST /api/rounds/:id/unrelease-results` for publishing/unpublishing round results.
- **Round entrants and replay** — `GET /api/rounds/:id/entrants` and `GET /api/rounds/:id/replay` for viewing registered entrants and the audit timeline.

### Changed

- **Authorisation rewrite** — all olympiad-scoped routes now check `OlympiadOrganiser` membership instead of comparing `organiserId` directly, enabling co-organiser access.
- **Idempotent submission handling** — `P2002` on `idempotencyKey` now returns the winner's submission with a 200 instead of a 500, with a status-guarded `updateMany` to stamp `completedAt`.
- **Sittings P2002 handling** — inner `$transaction` catch re-throws idempotency errors so the outer catch's `updateMany` (guarded sitting completion) can run.
- **Load testing documentation** — updated to note the idempotency fix has been deployed and added the concurrent boundary test scripts.

### Fixed

- **Concurrent duplicate submits** — under load, several requests could slip past the `completedAt` check before the first one finished; the unique `idempotencyKey` correctly rejected losers but the route returned a 500. Now returns the idempotent 200.
- **POST /api/rounds auth middleware** — the route was missing `requireRole('organiser')`, causing "You are not an organiser" errors for valid organisers after deployment.
- **Multi-olympiad data isolation** — audited all routes for olympiad-scoping gaps; added enforcement and authorisation checks to prevent cross-olympiad data leakage.

### Testing

- Backend: 501 tests across 22 files — 89.3% statements, 78.1% branches, 95.4% functions, 89.9% lines.
- Frontend: 249 tests across 18 files — 96% statements, 87.6% branches, 100% functions, 98.4% lines.
- Total: 750 tests passing.

## [Sprint 2] — 2026-09-15

### Added

- Online sitting: timed sessions, autosave, resume-on-disconnect, submission with automarking.
- Past-paper archive with upload/download.
- Configurable notifications (per-round rules, four trigger types, SendGrid delivery, exactly-once logging).
- Standings and per-school rankings.
- Certificate generation (on-demand PDFs).
- Student login (claim-code account/entrant linking) and student/school dashboards.
- Backend moved to Render; database moved to Supabase.
- CI: lint + test suites on every push and PR via Gitea Actions.

## [Sprint 1] — 2026-08-25

### Added

- Full database schema (Olympiad, Round, School, User, Educator, Entrant, Paper, Submission, Result, RoundEntrant).
- Round lifecycle scheduler — automatic `scheduled → open → closed` transitions.
- Organiser and Round/Olympiad API endpoints (create, read, list).
- Entrant registration per round (`RoundEntrant`).
- MCQ automarking data model (`memoAnswers`).
- Backend deployed to Railway; documentation deployed to Netlify.
- Frontend deployed on Vercel.
