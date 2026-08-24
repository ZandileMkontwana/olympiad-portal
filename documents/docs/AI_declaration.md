## AI Declaration

AI assistance (Claude, Anthropic — Claude Sonnet 5, accessed via Claude.ai) was used throughout this project's development in the following ways:

- **Backend development:** guidance on Express route implementation, Prisma schema design, and the round lifecycle scheduler logic
- **Debugging:** troubleshooting environment and tooling issues, including Prisma version incompatibilities, Node version conflicts, Railway deployment configuration, and a lint-staged/ESLint pipeline failure
- **Documentation:** plan for documentation and setting up docusaurus
- **Planning:** structuring task breakdowns and sprint planning discussions


- **Frontend development:** guidance on building and wiring Next.js pages and components, including the round lifecycle view, the paper upload form (with answer-key input), the MCQ submission table (with spreadsheet import/export), the educator and organiser dashboards, and cookie-based authentication with role-restricted route guards
- **Debugging:**Help on fixing missing/misconfigured environment variables, Next.js App Router routing mismatches (dynamic vs. flat routes), CORS and cookie-credential configuration between frontend and backend, and file-content errors introduced during iterative editing
- **Feature design:** identifying gaps between implemented UI and user-story acceptance criteria (e.g. receipt confirmation, closed-round messaging), and proposing fixes



All code was reviewed, tested, and verified by the author before being committed. All architectural and design decisions (data model structure, API design, technology choices) were made by the team; AI assistance was used to explain and troubleshoot those decisions, not to originate project requirements or scope.