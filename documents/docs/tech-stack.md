---
sidebar_position: 4
---

# Tech Stack

## Frontend
**Next.js (React), plain JavaScript**

Used for the organiser console and educator portal. Chosen for role-based routing across both interfaces in one app, and server-side rendering for pages where fresh data matters (round countdowns, live state). Per the course's framework rule, Next.js is used for frontend only — it does not also serve as the backend.

## Backend
**Express (Node.js), plain JavaScript**

Kept as a genuinely separate application from the frontend, satisfying the non-monolithic frontend/backend requirement. Chosen to stay in one language (JavaScript) across the whole stack, and because Node's event-loop concurrency model suits the round open/close load spikes the brief specifically calls out as the hardest requirement. All API routes are hand-written, satisfying the Hand-Written API requirement.

## Database
**PostgreSQL, hosted on Supabase**

Chosen because the data model is inherently relational (Olympiad → Round → School → Entrant → Submission → Result, linked by foreign keys), and Postgres gives transaction and constraint guarantees (e.g. a unique constraint preventing duplicate round registrations) that the concurrency requirements depend on. Supabase was chosen for its generous free tier (500MB database, no time limit) and consolidated infrastructure — both our PostgreSQL database and file storage live in the same Supabase project, simplifying configuration and team access.

## ORM
**Prisma**

Schema-first modelling, type-safe generated client, and built-in migrations — chosen for low setup friction and to keep the whole team working from one schema file as the single source of truth.

## Scheduler
**node-cron**

Powers the round lifecycle — ticks every 30 seconds, comparing the current time (in UTC) against each round's `openTime`/`closeTime` to transition state automatically. Chosen for simplicity: no separate job queue infrastructure needed at this scale, and it's easy to demo and reason about.

## Authentication
**Clerk**

Chosen for robust session management with built-in support for multi-factor authentication, social logins, and secure token-based sessions. Clerk handles user registration, login, and session management, providing JWT tokens that our backend validates for API authorization. This replaces our initial bcrypt + JWT implementation with a more production-ready solution that handles edge cases like token refresh, session invalidation, and security best practices without custom implementation.

## File storage
**Supabase Storage**

Used for storing paper and memo PDF files, kept separate from the primary database — Postgres stores only file URLs (`fileUrl`, `memoUrl` on the `Paper` table), never file bytes directly. Chosen over Cloudflare R2 after discovering R2 requires a card on file for account verification even on the free tier; Supabase Storage's free tier (1GB storage, 2GB egress/month) needs no card and comfortably covers our scale of test papers and memos.

Access goes through our own Express upload/download endpoints, which call Supabase's SDK internally — the frontend never talks to Supabase directly. This keeps file storage compliant with the course's Hand-Written API requirement, the same principle applied to how the frontend accesses the database.

## External API integration
**SendGrid (email)**

Sends round reminders (opening-soon, closing-soon, results-released) and submission receipt emails, triggered from the round scheduler and submission endpoints. Chosen for its generous free tier (100 emails/day) and simple Node SDK. Alongside Clerk (authentication) and Supabase Storage (file storage), it satisfies the course's requirement to integrate with relevant external API services — see the [API Reference](./api-reference.md#external-api-integrations) for the full list.

## Version control
**Gitea**, with **Conventional Commits** and a **feature-branch + pull request** workflow, enforced via branch protection requiring review and (once configured) passing CI checks.
Please check [code_quality_tool](./code_quality_tool.md) document for details about the Code quality tool used.

## CI/CD
**Gitea Actions** — see [Git Methodology](./git-methodology) for details on our merge and versioning process.

## Documentation
**Docusaurus**, deployed via **Netlify**, publicly accessible with no login required.

## Deployment
- **Backend:** Render — <https://olympiad-portal.onrender.com> (moved from Railway when its trial ended; Render was chosen because the round-lifecycle scheduler needs a long-running process, which serverless platforms don't provide)
- **Frontend:** Vercel — <https://frontend-two-ruby-25.vercel.app>
- **Docs:** Netlify — <https://olympiad-portal-docs.netlify.app>