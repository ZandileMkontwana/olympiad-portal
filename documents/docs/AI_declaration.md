## AI Declaration

AI assistance (Claude, Anthropic — Claude Sonnet 5, accessed via Claude.ai) was used throughout this project's development in the following ways:

- **Backend development:** guidance on Express route implementation, Prisma schema design, and the round lifecycle scheduler logic
- **Debugging:** troubleshooting environment and tooling issues, including Prisma version incompatibilities, Node version conflicts, Railway deployment configuration, and a lint-staged/ESLint pipeline failure
- **Documentation:** plan for documentation and setting up docusaurus
- **Planning:** structuring task breakdowns and sprint planning discussions

All code was reviewed, tested, and verified by the author before being committed. All architectural and design decisions (data model structure, API design, technology choices) were made by the team; AI assistance was used to explain and troubleshoot those decisions, not to originate project requirements or scope.

## AI Declaration — Roni

AI assistance (Claude, Anthropic — Claude Sonnet 5, accessed via Claude.ai) was used throughout this sprint's frontend and design work in the following ways:

- **Frontend development:** guidance on building and structuring Next.js App Router pages and components (landing page, registration, login, shared navigation header), Tailwind styling within the project's existing design token system, and integrating the `@clerk/nextjs` SDK (provider setup, middleware, `SignIn`/`SignUp` components, session-token-authenticated API calls) after the team's mid-sprint migration to Clerk.
- **Design system work:** developing a consistent visual language (color, typography, a custom-derived brand mark) applied across the app's public-facing pages, based on direction and feedback given throughout.
- **Debugging:** diagnosing and resolving a range of environment and integration issues, including a duplicate schema field causing backend 500 errors, a project-wide environment variable naming mismatch, a misconfigured `.gitignore` that was excluding `package.json` from version control, stray build artifacts being tracked by git, and several stale-local-branch situations that were initially mistaken for code bugs.
- **Git workflow support:** step-by-step guidance resolving merge conflicts across multiple files, and reviewing repository state (via provided project exports) to confirm what had and hadn't actually landed on shared branches before further debugging.

All code was reviewed, tested in-browser, and verified against the live backend by the author before being committed. All product and design decisions (page content, visual direction, which fields to collect, how features should behave) were made by the author; AI assistance was used to implement, explain, and troubleshoot those decisions, not to originate them.


## AI Declaration — Kutloano

AI assistance (Claude, Anthropic — Claude Sonnet 5, accessed via Claude.ai) was used throughout this sprint's full-stack work in the following ways:

* Frontend development: guidance on building and wiring Next.js App Router pages, including the round view page, the paper upload form (with a manually-entered answer-key section), the MCQ submission table (spreadsheet import/export, live score preview, bulk submission, toast notifications, and a persistent receipt), and the organiser/educator dashboards.
* Backend new Express endpoints (round entrants, single-round lookup, submission history), and building a cookie-based authentication system (`requireAuth`/`requireRole` middleware, login/register/logout/me routes) before the team's mid-sprint migration to Clerk.
* Authentication migration support: guidance installing and wiring `@clerk/nextjs` middleware after the team's decision to adopt Clerk, and migrating backend file storage to Supabase after the team moved off local disk storage.
* Debugging: extensive troubleshooting across both frontend and backend, including missing/misconfigured environment variables (`JWT_SECRET`, `.env` typos), Prisma/Windows file-lock errors, CORS and cookie-credential misconfiguration, Next.js routing mismatches between dynamic and flat routes, and files whose content didn't match what was expected after edits.
* Dependency and security review: identifying a known unpatched vulnerability in the `xlsx` package and outlining mitigation options.
* Planning: structuring a sprint retrospective and a categorized issue list for the team's tracker.

All code was reviewed, tested, and verified against the live backend by the author before being committed. All architectural and design decisions (data model structure, API design, technology and library choices, including the Clerk and Supabase migrations) were made by the team; AI assistance was used to implement, explain, and troubleshoot those decisions, not to originate them.