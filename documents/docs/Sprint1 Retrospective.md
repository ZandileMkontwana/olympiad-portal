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
- Resolve the Cloudflare Pages vs. Netlify mismatch on the docs site deployment task
- Result.releasedAt still isn't wired to anything — scores are visible immediately on scoring, not gated to "when the round closes" as the brief requires
- No school-facing "view your results" page exists yet, even once release-gating is added
- Non-multiple-choice marking (manual marker queue, partial credit) is entirely unbuilt — currently a submission without a memo answer key just has no Result created, with nothing to catch it later
- Entrant registration is currently a one-step "create + register" action with no reusable roster — a student registered for Round 1 can't currently carry into Round 2 as the same record