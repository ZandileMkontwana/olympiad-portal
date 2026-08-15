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
**PostgreSQL, hosted on Railway**

Chosen because the data model is inherently relational (Olympiad → Round → School → Entrant → Submission → Result, linked by foreign keys), and Postgres gives transaction and constraint guarantees (e.g. a unique constraint preventing duplicate round registrations) that the concurrency requirements depend on. Railway was chosen for zero-setup hosting with a shared connection string the whole team can point at.

## ORM
**Prisma**

Schema-first modelling, type-safe generated client, and built-in migrations — chosen for low setup friction and to keep the whole team working from one schema file as the single source of truth.

## Scheduler
**node-cron**

Powers the round lifecycle — ticks every 30 seconds, comparing the current time (in UTC) against each round's `openTime`/`closeTime` to transition state automatically. Chosen for simplicity: no separate job queue infrastructure needed at this scale, and it's easy to demo and reason about.

## Authentication
**Passport.js**

Established, well-documented library rather than a custom-built auth system, satisfying the course's Authentication & Security requirement (sign up, sign in, password reset, account deletion via a proven library, not hand-rolled).

## File storage
**[Cloudflare R2 / AWS S3 — update once confirmed]**

Used for storing paper and memo PDFs, kept separate from the database — Postgres is not used to store file bytes directly, only file URLs referencing storage.

## External API integration
**[SendGrid / Twilio — update once confirmed]**

Used for round reminders and submission receipts, satisfying the course's requirement to integrate with a relevant external API service.

## Version control
**Gitea (self-hosted)**, with **Conventional Commits** and a **feature-branch + pull request** workflow, enforced via branch protection requiring review and (once configured) passing CI checks.

## CI/CD
**Gitea Actions** — see [Git Methodology](./git-methodology) for details on our merge and versioning process.

## Documentation
**Docusaurus**, deployed via **Netlify**, publicly accessible with no login required.

## Deployment
- **Backend:** Railway
- **Frontend:** [Vercel — update once confirmed]
- **Docs:** Netlify