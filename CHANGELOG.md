# Changelog

All notable changes to the Olympiad Portal are documented in this file.

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
