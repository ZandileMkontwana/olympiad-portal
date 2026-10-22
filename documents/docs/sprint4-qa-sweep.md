---
sidebar_label: Sprint 4 QA sweep
sidebar_position: 8
---

# Sprint 4 QA Sweep (US-4.5)

The full-system QA sweep for Sprint 4: both automated suites with coverage, the CI-equivalent lint run, a production API UAT, an end-to-end student journey on the deployed stack, and a browser pass over the production frontend. Executed 6 October 2026 against the deployed production stack.

## Environment

| Component | Value |
|---|---|
| Frontend (production) | `https://olympiad-portal-iota.vercel.app` (Vercel) |
| Backend (production) | `https://olympiad-portal-backend.onrender.com` (Render) |
| Database | Shared Supabase (production pooler) |
| Local runner | Windows, Node 20.20.2, npm 10.8.2 (matches the CI Node 20 toolchain) |

## 1. Automated suites

Run with the same commands the CI "Lint and Test" workflow uses (`npx vitest run` per folder; coverage via `npm run test:coverage` from the repo root).

| Suite | Test files | Tests | Statements | Branches | Functions | Lines |
|---|---|---|---|---|---|---|
| Backend | 26 | 550/550 passing | 85.73% | 75.95% | 89.86% | 86.11% |
| Frontend | 28 | 355/355 passing | 94.82% | 87.4% | 100% | 98.24% |

Both suites meet their configured thresholds (80% statements/functions/lines, 75% branches). Total: **54 test files, 905 tests, all passing**.

Environment note: the first local frontend run failed to collect 10 suites because the local `node_modules` was stale — `vitest-axe` and `@clerk/themes` were declared in `package.json` and `package-lock.json` but absent from the local install. `npm install` (109 packages added) resolved it and the re-run was fully green. CI installs from the lockfile with `npm ci`, so this was a local-environment issue only, not a repository defect.

## 2. Lint (CI-equivalent)

- Backend: `npx eslint --config eslint.config.mjs .` — clean, 0 problems.
- Frontend: `npx eslint .` — 0 errors, 7 warnings (4 `react-hooks/exhaustive-deps`, 3 `@next/next/no-img-element`). Exit code 0, so the CI lint job passes.

## 3. Production API UAT

Probed against the deployed backend with and without credentials.

| Check | Endpoint | Expected | Actual |
|---|---|---|---|
| Public round detail | `GET /api/rounds/:id` | 200 with payload | 200 (769 bytes) |
| Standings (unauthenticated) | `GET /api/rounds/:id/standings` | 401 — educator/organiser scoped by design | 401 |
| School standings (unauthenticated) | `GET /api/rounds/:id/standings/schools` | 401 | 401 |
| Replay (unauthenticated) | `GET /api/rounds/:id/replay` | 401 | 401 |
| Marking queue | `GET /api/marking/queue` | 401 | 401 |
| Access requests | `GET /api/olympiads/access-requests` | 401 | 401 |
| Activity feed (SSE) | `GET /api/activity/stream` | 401 unauthenticated, 401 bad token, 403 authenticated non-organiser | 401 / 401 / 403 |
| External API | `GET /api/external/rounds/:id/results` without key | 401 | 401 |
| Student login | `POST /api/students/login` | 200 with token | 200 |
| Student self-service | `GET /students/me/sittings`, `/students/me/rounds`, `/students/me/results` | 200 with own data | 200 / 200 / 200 |
| Student self-service (unauthenticated) | `GET /students/me/sittings` | 401 | 401 |
| CORS preflight | `OPTIONS /api/rounds` from the Vercel origin | 204 with echoed origin and credentials | 204, `Access-Control-Allow-Origin` echoed, `Access-Control-Allow-Credentials: true` |

## 4. Deployed student journey

The load-test harness run as a single-student functional journey against production (login, start a sitting, autosave, submit, duplicate-submit retry).

| Scenario | Requests | OK | Errors |
|---|---|---|---|
| Warmup | 5 | 5 | 0 |
| Public reads | 20 | 20 | 0 |
| Student login | 1 | 1 | 0 |
| Start sitting | 1 | 1 | 0 |
| Autosave | 1 | 1 | 0 |
| Submit (201) | 1 | 1 | 0 |
| Duplicate submit | 2 | 2 | 0 |

**31 requests, zero errors.** Exactly-once verification passed 4/4: every student holds a sitting, every sitting completed, exactly one submission per sitting (0 duplicated idempotency keys), and the submission automarked at the expected 40%.

Cleanup and database verification: all run artifacts removed, and a follow-up query found **0 orphaned rows** across results, marking tasks, submissions, sittings, round entrants, notification logs, audit logs, papers, rounds and olympiads. By design, the fixture school, its 20 load-test entrants and 20 load-test student accounts remain so future runs can reuse them.

## 5. Browser UAT (production frontend)

| Check | Result |
|---|---|
| Landing page renders (branding, hero, navigation, feature cards) | PASS |
| Theme toggle on landing and login pages (light and dark) | PASS |
| Login page: role picker (Student / Educator / Organiser) and the student form | PASS |
| Student sign-in redirects to the `/student` dashboard (sidebar, stats, rounds list, badges) | PASS |
| Sign-out (with confirmation) returns to `/login` | PASS |
| Educator Clerk sign-in | Partially verified — see below |
| Organiser Clerk sign-in | Not executed — see below |

Educator Clerk sign-in: the seeded educator credential passed validation and Clerk then presented its **new-device email-verification challenge** (a verification code sent to the account's inbox). This is expected account-security behaviour, not a defect; completing it requires inbox access and is outside the scope of automated QA. The Clerk widget, role routing and error handling were all exercised.

Organiser Clerk sign-in was not executed because it sits behind the same new-device verification gate, and no QA-owned inbox exists for the organiser accounts. Recommendation: the account owner performs one manual sign-in to complete device verification.

## 6. Findings

**Product defects: none.** No functional defect was found in the API contract, the deployed student journey or the browser pass, so no new Gitea issues were required from this sweep (per the bug-tracking policy, defects are filed as `bug` issues).

Dependency advisories (`npm audit --omit=dev`, production dependencies only):

| Package | Severity | Notes |
|---|---|---|
| Backend: axios | high | several advisories (prototype pollution gadgets, ReDoS, SSRF via redirect); fixable via `npm audit fix` |
| Backend: multer | high | several DoS advisories; fixable |
| Backend: proxy-addr | critical | IP spoofing via IPv4-mapped IPv6 trust subnet; fixable |
| Backend: qs | moderate | fixable |
| Frontend: next (16.0.0–16.3.5) | critical | RCE advisories; the fix (`next@16.4.0`) is outside the currently pinned range, so it needs a deliberate upgrade |
| Frontend: sharp | high | fixable |
| Frontend: source-map-js | high | fixable |
| Frontend: xlsx | high | prototype pollution + ReDoS; **no fix available on npm** (SheetJS publishes fixes outside the npm registry) |

Recommendation: schedule a dependency-update task and prioritise `next` and `proxy-addr`. These are advisories, not confirmed exploits in this configuration.

Other observations:

- The optional Lighthouse audit script (`npm run a11y:lighthouse`) requires Node >= 22 while the project toolchain (and CI) is Node 20; this only affects running that script locally.
- Local frontend test runs can intermittently hit a Vitest forks-worker timeout on OneDrive-synced filesystems; re-running the affected files resolves it. Already noted in Testing & Code Coverage.

## 7. Verdict

All automated gates pass (54 files / 905 tests, lint clean), the production API behaves to contract, the deployed student journey passes with zero errors and exactly-once guarantees, and the production frontend passes the browser pass for the public pages and the student flow. The open items are the dependency upgrades above and one manual organiser sign-in.
