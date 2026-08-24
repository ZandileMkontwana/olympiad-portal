# Sprint 1 Retrospective 

## Zandile (Round Lifecycle & Data Core)

## What went well

- **Core requirement delivered and verified live.** The round lifecycle scheduler — the piece the brief calls "the hardest part of the portal" — was built, deployed, and confirmed working end-to-end: a round genuinely transitions `scheduled → open → closed` with zero manual intervention.
- **Full data model built and evolved cleanly.** All 9 tables designed and migrated, then extended twice more (`memoAnswers` for automarking, `RoundEntrant` for round registration) as real requirements surfaced from teammates — without needing to redesign the core structure.
- **Backend successfully deployed to production** (Railway), with a working public URL other teammates could build against.
- **Documentation kept current, not bolted on at the end** — round lifecycle, database schema (with ERD), git methodology, and tech stack pages were all written and updated as the schema itself changed.
- **Found and fixed a genuine tooling bug** in the team's lint-staged/ESLint pipeline that was blocking commits for anyone touching frontend files — tracked through four separate false leads (OneDrive interference, shell built-ins, npm's `--prefix` flag, PowerShell encoding) to the actual root cause.

## What was harder than expected

- **Environment setup consumed a disproportionate amount of early time** — Node version incompatibility, Prisma major-version mismatch, and a project folder living inside OneDrive sync all caused compounding, hard-to-diagnose failures before any real feature work could start.
- **Merge conflicts required real care, not just automated resolution.** A schema conflict resolved carelessly would have left a duplicate `RoundEntrant` model in production — caught only by manually re-reading the merged file rather than trusting the merge to be correct by default.
- **Infrastructure decisions had to be corrected mid-flight** — Firebase was initially planned for the database but conflicted with a course rule; a Railway deploy accidentally targeted the database service instead of a new one.

## What I'd do differently

- **Move the project out of a cloud-synced folder (OneDrive) from day one** — it was very likely the underlying cause of multiple unrelated-looking failures throughout the sprint.
- **Confirm CI runner availability before writing the CI workflow** — the pipeline was built before discovering Gitea Actions had no runners configured, meaning it couldn't actually run until resolved externally.
- **Establish the "always regenerate the lockfile" habit earlier** — missing dependencies after merges (cors, multer) happened more than once due to package.json changes landing without an updated lockfile.

## Carried into next sprint

- Confirm the CI runner situation is resolved (or documented as a known limitation) and wire status checks into branch protection
- Backfill the API reference doc with any newly added routes from teammates
- Investigate the ES module vs CommonJS mismatch that just surfaced in the backend

## Ronie Hokwana (Organiser Console: round setup, paper upload, dashboard + accessibility/responsiveness pass)

## What went well

- **Delivered my full ticket set for the sprint: #23, #24, #25, #26, #27, #46, #47, #48.** Round/olympiad creation (#23) and the dashboard (#24) were both wired to real endpoints (`POST /rounds`, `POST /olympiads`, `GET /rounds/:id`, `GET /olympiads/:id/rounds`) rather than mocks. Validation and loading/error states (#26/#27) weren't left as separate follow-up work — they were folded directly into each screen as it was built, so every page shipped with proper handling from day one instead of needing a second pass later.

- **Paper upload UI (#25) shipped and merged early**, tested end-to-end and wired to the real `POST /api/rounds/:id/papers` endpoint rather than mocked data, unblocking downstream testing for the team.

- **Full auth-facing frontend delivered and verified end-to-end.** Landing page (#46), registration (#47), and login (#48) were all built, styled, and — after the mid-sprint Clerk migration — re-verified working live: sign-up, profile completion, and login-to-dashboard redirect all confirmed working against the real backend, not just in isolation.

- **Built a coherent design system from scratch** — a consistent lavender/gold/Fraunces "exam paper" visual language applied across landing, register, login, and the shared nav header, including a custom-derived brand mark (redrawn from a reference logo, stripped of third-party branding) used consistently at multiple scales.

- **Adapted the entire auth frontend to a mid-sprint architecture change.** When the backend migrated from custom JWT/bcrypt auth to Clerk, rebuilt login/register around Clerk's `SignIn`/`SignUp` components, wired the `complete-profile` follow-up call for name/school collection, and fixed the resulting role-based redirect logic — none of which existed in the original plan.

- **Found and diagnosed several real, non-obvious bugs** rather than just working around them: a duplicate `name` field in the Prisma schema causing 500s, an `.env`-var naming mismatch (`NEXT_PUBLIC_API_URL` vs `NEXT_PUBLIC_API_BASE_URL`) that was silently breaking API calls across the app, a broken `.gitignore` that had `package.json` accidentally excluded from version control, and a broken logout flow on both dashboards left over from the pre-Clerk auth system.

## What was harder than expected

- **Local environment drift caused repeated false starts.** More than once, a bug I was debugging turned out to be stale local code — a branch that hadn't actually picked up a teammate's fix despite an apparently successful `git pull` — rather than a real defect, costing real time before the actual state was confirmed.

- **The Clerk migration landed mid-sprint with no advance notice**, meaning auth pages built and tested against the old system had to be substantially reworked, and the new integration (session tokens, protected routes, the `complete-profile` handshake) had to be pieced together by reading backend route code directly rather than from any shared spec.

- **Cross-teammate inconsistencies surfaced late** — an env var named two different ways across files, and duplicate `/rounds`-style pages built independently by two people using different design systems — neither of which was visible until actually integrating and testing the full flow.

## What I'd do differently

- **Confirm a branch/pull is actually current before debugging** — checking `git log` against the specific commit a fix landed in would have caught the "stale local code" issue immediately instead of after several rounds of guessing.

- **Push for a shared `.env.example` file earlier** — the env var naming split existed for weeks before it actually broke something; a committed example file would have surfaced the inconsistency on day one.

- **Ask for a heads-up before major architecture changes land** (e.g. the Clerk migration) so in-progress frontend work can be paused rather than needing significant rework after the fact.

## Carried into next sprint

- **#28 — run the accessibility/responsiveness pass (Lighthouse/axe)** across all console pages. This was blocked on the auth pages settling, and stayed blocked longer than expected once the Clerk migration reset that work partway through — now that login/register are stable again, this is next.

- Confirm the `/rounds` vs `/round_view`/`/rounds_list` duplication with Person 4 is fully resolved, not just individually deprioritized

- Follow up on standardizing the API base URL env var name across the whole frontend