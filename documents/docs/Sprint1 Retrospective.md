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
