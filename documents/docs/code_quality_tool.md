## Version Control
 
### Code quality tooling
 
Both `backend/` and `frontend/` use **ESLint** (for catching problems) and **Prettier** (for consistent formatting):
 
- **Backend**: ESLint configured for Node/CommonJS via `backend/eslint.config.mjs`, with `backend/generated/` (auto-generated Prisma client code) excluded from linting.
- **Frontend**: ESLint configured via `eslint-config-next` (Next.js's built-in config) in `frontend/eslint.config.mjs`.
- Both configs include `eslint-config-prettier` so ESLint's style rules don't conflict with Prettier's formatting.
- Both have matching `.prettierrc` settings (single quotes, semicolons, 100-character line width).
Run locally:
 
```bash
# from backend/ or frontend/
npm run lint      # check for issues
npm run format    # auto-format with Prettier
```
 
### Pre-commit enforcement
 
We use **Husky** and **lint-staged**, configured at the repo root, to automatically lint and format staged files before every commit:
 
- `.husky/pre-commit` runs `npx lint-staged` on every `git commit`.
- `.lintstagedrc.js` at the repo root maps staged files in `backend/**/*.js` and `frontend/**/*.js` to their respective ESLint config and Prettier config, so each folder is linted with the right rules.
- If linting fails, the commit is blocked until the issues are fixed (or auto-fixed by `--fix`/`--write`).
### Continuous integration
 
A Gitea Actions workflow (`.gitea/workflows/lint.yml`, named "Lint and Test") runs ESLint against both `backend/` and `frontend/` on every push and on pull requests targeting `main`. The same workflow also runs both Vitest test suites, so lint or test failures both block a PR.
 
> **Status**: runs automatically
 
### Commit conventions
 
Commits follow **Conventional Commits** (`feat:`, `fix:`, `chore:`, `docs:`, etc.) so history stays readable and change type is clear at a glance.
 
### Branching
 
Branches are named by type and short description, tied to their issue where possible, e.g. `feature/scheduler-cron-12`, `fix/paper-model`.
 
### Still to complete
 
- [ ] Enable branch protection on `main` in Gitea (require PRs, require status checks once CI has a runner)
- [ ] Confirm all team members have commits under their own accounts