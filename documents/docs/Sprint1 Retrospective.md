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