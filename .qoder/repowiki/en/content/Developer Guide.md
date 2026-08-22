# Developer Guide

<cite>
**Referenced Files in This Document**
- [README.md](file://README.md)
- [package.json](file://package.json)
- [.lintstagedrc.js](file://.lintstagedrc.js)
- [scripts/lint-frontend.js](file://scripts/lint-frontend.js)
- [backend/package.json](file://backend/package.json)
- [backend/eslint.config.mjs](file://backend/eslint.config.mjs)
- [backend/.prettierrc](file://backend/.prettierrc)
- [backend/vitest.config.mjs](file://backend/vitest.config.mjs)
- [backend/README.md](file://backend/README.md)
- [backend/src/test-setup.js](file://backend/src/test-setup.js)
- [backend/prisma/seed.js](file://backend/prisma/seed.js)
- [backend/.gitignore](file://backend/.gitignore)
- [frontend/package.json](file://frontend/package.json)
- [frontend/eslint.config.mjs](file://frontend/eslint.config.mjs)
- [frontend/.prettierrc](file://frontend/.prettierrc)
- [frontend/vitest.config.mjs](file://frontend/vitest.config.mjs)
- [frontend/src/test/setup.js](file://frontend/src/test/setup.js)
- [frontend/.gitignore](file://frontend/.gitignore)
- [documents/docs/git-methodology.md](file://documents/docs/git-methodology.md)
- [documents/docs/code_quality_tool.md](file://documents/docs/code_quality_tool.md)
</cite>

## Update Summary
**Changes Made**
- Updated ESLint configuration sections to reflect new modern ESLint setup with config files
- Enhanced testing infrastructure documentation with comprehensive Vitest configuration details
- Added detailed coverage of test setup files and environment configuration
- Updated .gitignore documentation to include workspace-specific ignore patterns
- Expanded Prisma seed data formatting guidelines
- Added extensive testing examples and patterns from actual test suites

## Table of Contents
1. [Introduction](#introduction)
2. [Project Structure](#project-structure)
3. [Core Components](#core-components)
4. [Architecture Overview](#architecture-overview)
5. [Detailed Component Analysis](#detailed-component-analysis)
6. [Dependency Analysis](#dependency-analysis)
7. [Performance Considerations](#performance-considerations)
8. [Troubleshooting Guide](#troubleshooting-guide)
9. [Conclusion](#conclusion)
10. [Appendices](#appendices)

## Introduction
This Developer Guide provides a comprehensive, contributor-focused overview of the Olympiad Portal development workflow. It covers code style guidelines, Git branching and contribution procedures, code quality tooling (ESLint, Prettier, Husky), debugging techniques, logging strategies, testing practices, documentation standards, and performance tips. The goal is to help contributors work efficiently and consistently across the monorepo's backend, frontend, and documentation components.

The project includes:
- A Node.js/Express backend with Prisma and a scheduler for round lifecycle management
- A Next.js frontend
- Shared configuration for linting, formatting, and testing
- Documentation site powered by Docusaurus

**Section sources**
- [README.md:1-1](file://README.md#L1-L1)
- [backend/README.md:1-12](file://backend/README.md#L1-L12)

## Project Structure
The repository is organized as a monorepo with clear separation between backend, frontend, shared assets, scripts, and documentation.

- Root
  - Package scripts orchestrate tests across backend and frontend
  - Linting and formatting are enforced via Husky and lint-staged
- Backend
  - Express server, routes, middleware, Prisma schema/migrations, seed, scheduler
  - Modern ESLint configuration with separate configs for different file types; Vitest for unit/integration tests
- Frontend
  - Next.js application with React hooks, API client, and tests
  - Modern ESLint based on Next.js config; Prettier for formatting; Vitest for tests with jsdom environment
- Documents
  - Docusaurus-based docs including methodology and code quality guides
- Scripts
  - Helper script to run frontend lint/format during pre-commit

```mermaid
graph TB
A["Root package.json<br/>Scripts & Dev Dependencies"] --> B["Backend (Express + Prisma)"]
A --> C["Frontend (Next.js)"]
A --> D["Docs (Docusaurus)"]
A --> E["Scripts (lint-frontend.js)"]
A --> F[".lintstagedrc.js<br/>Husky integration"]
B --> G["backend/eslint.config.mjs<br/>Modern ESLint Config"]
B --> H["backend/.prettierrc"]
B --> I["backend/vitest.config.mjs<br/>Node Environment"]
C --> J["frontend/eslint.config.mjs<br/>Next.js Config"]
C --> K["frontend/.prettierrc"]
C --> L["frontend/vitest.config.mjs<br/>jsdom Environment"]
```

**Diagram sources**
- [package.json:6-12](file://package.json#L6-L12)
- [.lintstagedrc.js:1-13](file://.lintstagedrc.js#L1-L13)
- [backend/eslint.config.mjs:1-19](file://backend/eslint.config.mjs#L1-L19)
- [backend/.prettierrc:1-6](file://backend/.prettierrc#L1-L6)
- [backend/vitest.config.mjs:1-23](file://backend/vitest.config.mjs#L1-L23)
- [frontend/eslint.config.mjs:1-17](file://frontend/eslint.config.mjs#L1-L17)
- [frontend/.prettierrc:1-6](file://frontend/.prettierrc#L1-L6)
- [frontend/vitest.config.mjs:1-31](file://frontend/vitest.config.mjs#L1-L31)

**Section sources**
- [package.json:1-23](file://package.json#L1-L23)
- [.lintstagedrc.js:1-13](file://.lintstagedrc.js#L1-L13)
- [scripts/lint-frontend.js:1-9](file://scripts/lint-frontend.js#L1-L9)

## Core Components
This section summarizes the core development tools and workflows that every contributor should know.

- Code Style and Formatting
  - **Updated**: Modern ESLint configuration using `eslint/config` with separate configs for different file types
  - Backend uses Node-focused config with globals and CommonJS support where needed
  - Frontend uses Next.js recommended rules with global ignores for build artifacts
  - Prettier settings are consistent across backend and frontend (single quotes, semicolons, trailing commas, 100-char width)
- Pre-commit Hooks
  - Husky triggers lint-staged on commit
  - lint-staged runs ESLint and Prettier on staged files per workspace
- Testing
  - **Enhanced**: Comprehensive Vitest configuration for both backend and frontend with coverage thresholds
  - Backend: Node environment with explicit include patterns and setup file
  - Frontend: jsdom environment with React plugin and alias resolution
  - Test discovery patterns and setup files are explicitly defined
- Scripts
  - Root-level scripts run tests across backend and frontend
  - Workspace-level scripts provide lint, format, test, and start commands

**Section sources**
- [backend/eslint.config.mjs:1-19](file://backend/eslint.config.mjs#L1-L19)
- [frontend/eslint.config.mjs:1-17](file://frontend/eslint.config.mjs#L1-L17)
- [backend/.prettierrc:1-6](file://backend/.prettierrc#L1-L6)
- [frontend/.prettierrc:1-6](file://frontend/.prettierrc#L1-L6)
- [.lintstagedrc.js:1-13](file://.lintstagedrc.js#L1-L13)
- [backend/vitest.config.mjs:1-23](file://backend/vitest.config.mjs#L1-L23)
- [frontend/vitest.config.mjs:1-31](file://frontend/vitest.config.mjs#L1-L31)
- [package.json:6-12](file://package.json#L6-L12)
- [backend/package.json:6-14](file://backend/package.json#L6-L14)
- [frontend/package.json:5-14](file://frontend/package.json#L5-L14)

## Architecture Overview
At a high level, contributors will interact with three main layers:
- Backend services (Express routes, middleware, Prisma data layer, scheduler)
- Frontend UI (Next.js pages, hooks, API client)
- Tooling and CI (ESLint, Prettier, Husky, lint-staged, Vitest)

```mermaid
graph TB
subgraph "Developer Workflow"
Dev["Developer"] --> Commit["git commit"]
Commit --> Husky["Husky pre-commit hook"]
Husky --> LintStaged["lint-staged"]
LintStaged --> ESLintB["ESLint (backend)"]
LintStaged --> ESLintF["ESLint (frontend)"]
LintStaged --> PrettierB["Prettier (backend)"]
LintStaged --> PrettierF["Prettier (frontend)"]
end
subgraph "Codebases"
BE["Backend (Express + Prisma)"]
FE["Frontend (Next.js)"]
end
ESLintB --> BE
ESLintF --> FE
PrettierB --> BE
PrettierF --> FE
```

**Diagram sources**
- [.lintstagedrc.js:1-13](file://.lintstagedrc.js#L1-L13)
- [backend/eslint.config.mjs:1-19](file://backend/eslint.config.mjs#L1-L19)
- [frontend/eslint.config.mjs:1-17](file://frontend/eslint.config.mjs#L1-L17)
- [backend/.prettierrc:1-6](file://backend/.prettierrc#L1-L6)
- [frontend/.prettierrc:1-6](file://frontend/.prettierrc#L1-L6)

## Detailed Component Analysis

### Development Workflow and Contribution Procedures
- Branching Strategy
  - Create one branch per task or feature from main
  - Use descriptive names tied to tickets when possible
- Commit Conventions
  - Follow Conventional Commits for clarity and automation-friendly history
- Merging
  - Merge via Pull Requests after CI passes and at least one approval
- Versioning
  - Tag releases at sprint boundaries using MAJOR.MINOR.PATCH and maintain a CHANGELOG

```mermaid
flowchart TD
Start(["Start Task"]) --> Branch["Create feature/fix branch from main"]
Branch --> Develop["Implement changes"]
Develop --> Test["Run tests locally"]
Test --> LintCheck{"Lint/format pass?"}
LintCheck --> |No| FixStyle["Fix lint/style issues"]
FixStyle --> LintCheck
LintCheck --> |Yes| Commit["Commit with Conventional Commits"]
Commit --> PR["Open Pull Request"]
PR --> CI["CI checks (lint/tests)"]
CI --> Review["Code review"]
Review --> Approve{"Approved?"}
Approve --> |No| Iterate["Address feedback"]
Iterate --> PR
Approve --> |Yes| Merge["Merge to main"]
Merge --> End(["Done"])
```

**Section sources**
- [documents/docs/git-methodology.md:1-37](file://documents/docs/git-methodology.md#L1-L37)

### Code Quality Tools Setup (ESLint, Prettier, Husky)
- **Updated**: Modern ESLint Configuration
  - Backend uses `eslint/config` with separate configurations for different file types
  - Frontend uses Next.js recommended rules with global ignores for build artifacts
  - Both workspaces extend with Prettier to avoid conflicts
- Prettier
  - Consistent settings across backend and frontend
- Husky and lint-staged
  - Pre-commit hook runs lint-staged which applies ESLint and Prettier to staged files per workspace
  - A helper script ensures frontend files are linted and formatted correctly during staging

```mermaid
sequenceDiagram
participant Dev as "Developer"
participant Husky as "Husky"
participant LS as "lint-staged"
participant BE as "Backend ESLint/Prettier"
participant FE as "Frontend ESLint/Prettier"
Dev->>Husky : git commit
Husky->>LS : Run lint-staged
LS->>BE : Lint/format backend files
LS->>FE : Lint/format frontend files
BE-->>LS : Result
FE-->>LS : Result
LS-->>Husky : Success/Failure
Husky-->>Dev : Allow or block commit
```

**Diagram sources**
- [.lintstagedrc.js:1-13](file://.lintstagedrc.js#L1-L13)
- [scripts/lint-frontend.js:1-9](file://scripts/lint-frontend.js#L1-L9)
- [backend/eslint.config.mjs:1-19](file://backend/eslint.config.mjs#L1-L19)
- [frontend/eslint.config.mjs:1-17](file://frontend/eslint.config.mjs#L1-L17)
- [backend/.prettierrc:1-6](file://backend/.prettierrc#L1-L6)
- [frontend/.prettierrc:1-6](file://frontend/.prettierrc#L1-L6)

**Section sources**
- [documents/docs/code_quality_tool.md:1-43](file://documents/docs/code_quality_tool.md#L1-L43)
- [.lintstagedrc.js:1-13](file://.lintstagedrc.js#L1-L13)
- [scripts/lint-frontend.js:1-9](file://scripts/lint-frontend.js#L1-L9)
- [backend/eslint.config.mjs:1-19](file://backend/eslint.config.mjs#L1-L19)
- [frontend/eslint.config.mjs:1-17](file://frontend/eslint.config.mjs#L1-L17)
- [backend/.prettierrc:1-6](file://backend/.prettierrc#L1-L6)
- [frontend/.prettierrc:1-6](file://frontend/.prettierrc#L1-L6)

### Testing Strategy and Coverage
- **Enhanced**: Comprehensive Testing Infrastructure
  - **Backend Testing**:
    - Vitest configured for Node environment with explicit include patterns and setup file
    - Coverage thresholds set for lines (80%), functions (80%), branches (75%), statements (80%)
    - Test setup file configures environment variables for database and authentication
  - **Frontend Testing**:
    - Vitest configured for jsdom environment with React plugin
    - Coverage targets specific directories (lib, hooks) and excludes tests and test setup
    - Alias resolution configured for imports using `@` prefix
  - **Test Examples**:
    - Backend: Comprehensive auth route tests with mocking for JWT, bcrypt, and Prisma
    - Frontend: API client tests covering network requests, error handling, and file uploads
- Running Tests
  - Use workspace scripts to run tests and generate coverage reports
  - Root scripts can run tests across both workspaces

```mermaid
flowchart TD
TStart(["Run Tests"]) --> Choose["Choose workspace"]
Choose --> |Backend| BEConf["Load backend vitest.config.mjs"]
Choose --> |Frontend| FEConf["Load frontend vitest.config.mjs"]
BEConf --> BEDev["Discover *.test.js under src/"]
FEConf --> FEDev["Discover *.test.{js,jsx} under src/"]
BEDev --> BERun["Execute tests with Node env"]
FEDev --> FERun["Execute tests with jsdom env"]
BERun --> BCov["Generate coverage report"]
FERun --> FCov["Generate coverage report"]
BCov --> TEnd(["Review results"])
FCov --> TEnd
```

**Diagram sources**
- [backend/vitest.config.mjs:1-23](file://backend/vitest.config.mjs#L1-L23)
- [frontend/vitest.config.mjs:1-31](file://frontend/vitest.config.mjs#L1-L31)

**Section sources**
- [backend/vitest.config.mjs:1-23](file://backend/vitest.config.mjs#L1-L23)
- [frontend/vitest.config.mjs:1-31](file://frontend/vitest.config.mjs#L1-L31)
- [backend/package.json:6-14](file://backend/package.json#L6-L14)
- [frontend/package.json:5-14](file://frontend/package.json#L5-L14)
- [package.json:6-12](file://package.json#L6-L12)

### Debugging Techniques and Logging Strategies
- Backend
  - Use standard console logging for local development; consider structured logs for production
  - Leverage Prisma query logging in development to inspect database interactions
  - Inspect request/response cycles in route handlers and middleware
  - **Updated**: Use test setup file to configure environment variables for debugging
- Frontend
  - Use browser developer tools to inspect network requests and state
  - Add targeted logs around async flows and error paths
  - **Enhanced**: Configure aliases for easier import debugging
- General Tips
  - Keep logs concise and contextual; avoid sensitive data in logs
  - Use environment variables to toggle verbose logging in dev vs prod

### Writing Documentation
- Update or add pages under the documentation site directory
- Follow existing structure and conventions for consistency
- Ensure links and references are valid before submitting changes

### Adding Tests
- Place tests adjacent to source files with .test.js suffix
- Use Vitest APIs for assertions and mocking as appropriate
- Maintain coverage thresholds and ensure new code meets them
- **Enhanced**: Follow established patterns from existing test suites:
  - Mock external dependencies (JWT, bcrypt, Prisma)
  - Set up proper test environment variables
  - Use beforeEach/afterEach for cleanup
  - Test both success and error scenarios

**Section sources**
- [backend/vitest.config.mjs:1-23](file://backend/vitest.config.mjs#L1-L23)
- [frontend/vitest.config.mjs:1-31](file://frontend/vitest.config.mjs#L1-L31)
- [backend/src/test-setup.js:1-6](file://backend/src/test-setup.js#L1-L6)
- [frontend/src/test/setup.js:1-2](file://frontend/src/test/setup.js#L1-L2)

### Performing Code Reviews
- Ensure all CI checks pass (lint, tests)
- Verify adherence to coding standards and architecture principles
- Validate test coverage and correctness of edge cases
- Provide constructive feedback focused on clarity, maintainability, and performance

### Prisma Seed Data and Database Setup
- **Enhanced**: Improved Prisma seed data formatting
  - Organized seed script with proper error handling and connection management
  - Secure password hashing with bcrypt
  - Duplicate entry prevention with existence checks
  - Clear console output for user creation status
- Database migrations follow semantic versioning
- Seed data includes default organizer account with secure credentials

**Section sources**
- [backend/prisma/seed.js:1-35](file://backend/prisma/seed.js#L1-L35)

## Dependency Analysis
This section highlights how development dependencies and scripts coordinate across the monorepo.

```mermaid
graph LR
Root["Root package.json"] --> Scripts["Test scripts"]
Root --> Husky["Husky setup"]
Husky --> LintStaged[".lintstagedrc.js"]
LintStaged --> BE["Backend ESLint/Prettier"]
LintStaged --> FE["Frontend ESLint/Prettier"]
Scripts --> BE
Scripts --> FE
```

**Diagram sources**
- [package.json:6-12](file://package.json#L6-L12)
- [.lintstagedrc.js:1-13](file://.lintstagedrc.js#L1-L13)

**Section sources**
- [package.json:16-21](file://package.json#L16-L21)
- [backend/package.json:33-44](file://backend/package.json#L33-L44)
- [frontend/package.json:21-34](file://frontend/package.json#L21-34](file://frontend/package.json#L21-L34)
- [.lintstagedrc.js:1-13](file://.lintstagedrc.js#L1-L13)

## Performance Considerations
- Linting and Formatting
  - Rely on pre-commit hooks to catch issues early; keep rule sets minimal and relevant
  - **Updated**: Modern ESLint configuration improves performance with selective file processing
- Testing
  - Use selective test runs for faster iteration; leverage watch mode during development
  - Focus coverage on critical paths (e.g., lib and hooks in frontend)
  - **Enhanced**: Optimize test execution with proper environment setup
- Database
  - Use Prisma query logging in development to identify slow queries
  - Apply proper indexing and pagination in backend endpoints
  - **Improved**: Efficient seed data generation with duplicate checking
- Frontend
  - Avoid unnecessary re-renders; memoize expensive computations
  - Defer heavy operations off the main thread when possible
  - **Enhanced**: Optimized test environment with jsdom and React plugin

## Troubleshooting Guide
- Pre-commit Hook Failures
  - If commits are blocked, run the corresponding lint/format commands locally to fix issues
  - For frontend-specific issues, use the helper script invoked by lint-staged
- Linting Errors
  - Backend: Run the workspace lint command to auto-fix where possible
  - Frontend: Run the workspace lint command to apply fixes
  - **Updated**: Check modern ESLint configuration files for syntax errors
- Test Failures
  - Run tests in watch mode to iterate quickly
  - Check coverage thresholds if tests are failing due to insufficient coverage
  - **Enhanced**: Verify test setup files have correct environment variables
- Environment Issues
  - Ensure required environment variables are set for backend services (database, email, etc.)
  - Confirm Prisma client generation is up-to-date after schema changes
  - **Updated**: Check enhanced .gitignore files for proper exclusions
- **New**: Testing Infrastructure Issues
  - Verify Vitest configuration files are properly set up
  - Check that test setup files are loading correctly
  - Ensure mock implementations are properly configured

**Section sources**
- [.lintstagedrc.js:1-13](file://.lintstagedrc.js#L1-L13)
- [scripts/lint-frontend.js:1-9](file://scripts/lint-frontend.js#L1-L9)
- [backend/package.json:6-14](file://backend/package.json#L6-L14)
- [frontend/package.json:5-14](file://frontend/package.json#L5-L14)
- [backend/vitest.config.mjs:1-23](file://backend/vitest.config.mjs#L1-L23)
- [frontend/vitest.config.mjs:1-31](file://frontend/vitest.config.mjs#L1-L31)
- [backend/.gitignore:1-5](file://backend/.gitignore#L1-L5)
- [frontend/.gitignore:1-42](file://frontend/.gitignore#L1-L42)

## Conclusion
By following the outlined development workflow, code style guidelines, and tooling setup, contributors can maintain a consistent, high-quality codebase. Embrace pre-commit hooks, write meaningful tests, and document changes thoroughly. Adhering to these practices ensures smooth collaboration and reliable delivery of features for the Olympiad Portal.

## Appendices

### Quick Commands Reference
- Backend
  - Run tests: workspace test script
  - Generate coverage: workspace test:coverage script
  - Lint: workspace lint script
  - Format: workspace format script
- Frontend
  - Run tests: workspace test script
  - Generate coverage: workspace test:coverage script
  - Lint: workspace lint script
  - Format: workspace format script
- Monorepo
  - Run all tests: root test script
  - Generate all coverage: root test:coverage script

### Testing Patterns and Examples
- **Backend Testing Patterns**:
  - Mock external dependencies using Vitest's vi.mock()
  - Set up Express app with middleware for route testing
  - Use supertest for HTTP request testing
  - Properly handle database connections and transactions
- **Frontend Testing Patterns**:
  - Mock fetch API for network requests
  - Use React Testing Library for component testing
  - Test error handling and edge cases
  - Verify proper URL construction and headers

**Section sources**
- [backend/package.json:6-14](file://backend/package.json#L6-L14)
- [frontend/package.json:5-14](file://frontend/package.json#L5-L14)
- [package.json:6-12](file://package.json#L6-L12)
- [backend/src/route/auth.test.js:1-283](file://backend/src/routes/auth.test.js#L1-L283)
- [frontend/src/lib/api.test.js:1-337](file://frontend/src/lib/api.test.js#L1-L337)