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
