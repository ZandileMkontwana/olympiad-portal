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

<<<<<<< HEAD

## Kutloano 

## Sprint Goal

Deliver the Basic-tier round lifecycle end to end:an educator can view the round, download the paper while open and submit results automatically marked, with a receipt, and blocked once the round closes. Alongside this, stand up login/role-based dashboards for organisers and educators.

## What Went Well

- Round lifecycle (open/closed state, cron scheduler) worked correctly with no rework needed
- Automarking and the submission receipt work end to end, meeting the actual acceptance criteria, not just "looks like it works"
- Once a bug's root cause was actually found, the fix was usually small  one function, one line, one missing flag
- Core backend design decisions (round state as single source of truth, idempotency keys, separating Submission from Result) held up well under testing

## What Went Bad

- Edits repeatedly didn't land correctly — code pasted alongside old code instead of replacing it, or landing in the wrong file entirely (auth.js had orphaned code outside any function, papers.js briefly contained React frontend code, app/educator/page.js was found completely empty)
- The auth migration (Bearer token → httpOnly cookie) touched more files than expected, and credentials: "include" got missed on different fetch calls multiple separate times, each surfacing as its own "Not authenticated" bug
- cors()/cookieParser() were registered after the routers in app.js, so they silently never ran
- Routing drifted as pages moved folders (round_view/submit relocating under educator/), breaking links across multiple pages each time, with no clear single source of truth for the real path
- Two competing implementations existed briefly more than once — a duplicate lib/auth.js alongside the team's existing lib/api.js, and two different submission-table designs before scope was clarified
- The educator dashboard had the wrong role guard (organiser instead of educator); the organiser dashboard had no guard at all for a while
Docs site got deployed to Netlify when the task specifically named Cloudflare Pages

## What I'd Do Differently

- View a file's actual current contents before pasting a fix into it, instead of assuming its state — most of this sprint's time went to re-discovering what a file already contained, not solving hard problems
- Before changing a cross-cutting mechanism (like auth), search for every call site that needs updating and list them up front, rather than fixing each broken spot as a surprise one at a time
- Lock in route paths early and treat them as fixed once other pages start linking to them, instead of restructuring folders after links already depend on them
- Extend the team's existing shared client (lib/api.js) rather than creating a second, competing one
- Confirm the exact deploy target (Cloudflare vs. Netlify) against the task wording before deploying, not after

## Carried Into Next Sprint


- Add .env.example files to frontend/ and backend/ so a missing variable like JWT_SECRET can't fail silently again
- Result.releasedAt still isn't wired to anything — scores are visible immediately on scoring, not gated to "when the round closes" as the brief requires
- No school-facing "view your results" page exists yet, even once release-gating is added
- Non-multiple-choice marking (manual marker queue, partial credit) is entirely unbuilt — currently a submission without a memo answer key just has no Result created, with nothing to catch it later
- Entrant registration is currently a one-step "create + register" action with no reusable roster — a student registered for Round 1 can't currently carry into Round 2 as the same record
=======
## Mlungisi (Papers, Submissions & Marking)

### What went well

- Delivered the full backend scope I owned: paper upload/download, submissions
  with idempotency handling, MCQ automarking, receipt emails via SendGrid,
  and the full authentication system (including a mid-sprint migration from
  our own JWT-based auth to Clerk per the client's requirement).
- Caught and fixed several real bugs before they caused bigger problems -
  a duplicate schema.prisma model that would have broken everyone's local
  setup, a broken seed script after the auth migration, and a silent typo
  (`module.export` instead of `module.exports`) that caused a confusing
  runtime crash.
- Got comfortable with the full git branch/PR/merge-conflict workflow -
  resolved several real conflicts in shared files (schema.prisma,
  package.json) without losing work or breaking main.

### What was challenging

- Coordinating schema changes with a teammate in real time - we hit the
  same file (schema.prisma) independently multiple times, which caused
  duplicate definitions and blocked everyone until resolved. Better
  upfront communication before touching shared schema would have avoided
  this.
- The Clerk migration was bigger than expected - it touched almost every
  file I'd built for auth, and testing it properly required the frontend
  integration to exist first, which meant a period of backend work I
  couldn't fully verify on my own.
- Windows-specific tooling friction (file locks during `prisma generate`
  while the server was running, PowerShell's handling of quotes and
  special characters in curl commands) cost real time that had nothing
  to do with the actual feature work.

### What I'd do differently

- Run `npx prisma generate` as a required check before opening any PR
  that touches schema.prisma, to catch duplicate/broken definitions
  before they reach main.
- Raise significant architecture changes (like the Clerk migration) with
  the team as a proper discussion before starting, rather than mid-flight -
  worked out fine this time, but was more improvised than ideal.
- Keep scratch/test files out of the working directory more consistently
  rather than relying on remembering not to `git add` them each time.

### What I learned

- How JWT-based authentication actually works under the hood (signing,
  verifying, hashing with bcrypt) before also learning what a managed
  auth provider like Clerk abstracts away, which gave me a much better
  understanding of why that abstraction is valuable.
- Real experience resolving git merge conflicts under time pressure,
  including in generated/lockfile-adjacent files where the right move
  is often to regenerate rather than hand-edit.
- The importance of testing auth-protected endpoints through the actual
  intended flow (browser + real session) rather than assuming a
  simplified test (like a copied cookie in curl) will behave identically.

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
>>>>>>> 5033af2bcbe982b73802730e8a68a97e04f27ec6
