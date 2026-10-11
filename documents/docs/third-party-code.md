---
sidebar_label: third-party-code
sidebar_position: 11
---

# Third-Party Code and Services

This page documents every third-party dependency and external service used in the Olympiad Portal, what it is used for, and where it appears in the codebase.

## External Services

### Supabase — PostgreSQL Database

**SDK:** `@supabase/supabase-js` (Storage only; database access goes through Prisma)

Supabase hosts the PostgreSQL database and provides object storage for paper/memo PDFs.

- **Database** — all application data lives in Supabase Postgres. The backend connects via Prisma using the connection pooler URL (`DATABASE_URL`) for application queries and a direct URL (`DIRECT_URL`) for migrations. The pooler uses transaction mode to share the session budget across concurrent requests.
- **Storage** — paper and memo PDFs are uploaded to a Supabase Storage bucket (`SUPABASE_BUCKET_NAME`). Files are held in memory via `multer.memoryStorage()` and uploaded as buffers. Only public URLs are stored in the database (`Paper.fileUrl`, `Paper.memoUrl`).

**Where used:** `backend/src/lib/prisma.js`, `backend/src/lib/storage.js`, `backend/src/routes/papers.js`

### Clerk — Authentication

**SDKs:** `@clerk/express` (backend), `@clerk/nextjs` (frontend)

Clerk handles authentication for organisers and educators — sign-up, sign-in, session management, and 2FA. Student authentication uses a separate JWT system (see below).

- **Backend** — `clerkMiddleware()` is registered globally in `index.js` to validate session tokens. `requireAuth()` guards protected endpoints and extracts `clerkUserId` from the session. `clerkClient.users.getUser()` fetches email during profile completion. `clerkClient.users.deleteUser()` removes the Clerk account on account deletion.
- **Frontend** — `<ClerkProvider>` wraps the Next.js app. `auth()`, `currentUser()`, and `<SignIn>` / `<SignUp>` components handle the educator/organiser auth flow.

**Where used:** `backend/src/middleware/auth.js`, `backend/src/routes/auth.js`, `frontend/src/app/layout.js`, `frontend/src/middleware.js`

### SendGrid — Email Notifications

**SDK:** `@sendgrid/mail`

Transactional emails are sent via SendGrid's API. All email functions live in `backend/src/lib/email.js` and log results to the `NotificationLog` table. Failures are caught and logged but never block the calling operation.

| Function | Trigger | Recipient |
|---|---|---|
| `sendSubmissionReceipt` | Educator submits results | Submitting educator |
| `sendRoundOpeningNotification` | Scheduler detects round about to open | Educators with registered entrants |
| `sendRoundClosingNotification` | Scheduler detects round about to close | Educators with registered entrants |
| `sendResultsReleasedNotification` | Scheduler detects results newly released | Educators with registered entrants |
| `sendMissingSubmissionNotification` | Scheduler detects closed round with no submission | Educators with unsubmitted entrants |

**Where used:** `backend/src/lib/email.js`, `backend/src/scheduler.js`, `backend/src/routes/submissions.js`

### Render — Backend Hosting

The Express backend is deployed as a long-running web service on Render. A long-running host is required because the round lifecycle scheduler (`node-cron`) ticks every 30 seconds in-process.

**URL:** `https://olympiad-portal-backend.onrender.com`

### Vercel — Frontend Hosting

The Next.js frontend is deployed on Vercel, which provides automatic builds from the Git repository and edge-optimized serving.

**URL:** Configured per-deployment; see the README for the current URL.

### Netlify — Documentation Hosting

The Docusaurus documentation site is deployed to Netlify on every push to `main`.

**URL:** `https://olympiad-portal-docs.netlify.app`

### Gitea — Version Control and CI/CD

The repository is hosted on Gitea, with Gitea Actions providing CI (lint + test on every push and PR). Branch protection requires review before merge.

---

## Backend Dependencies

### Production

| Package | Version | Purpose |
|---|---|---|
| `@clerk/express` | ^2.1.61 | Clerk authentication middleware for Express |
| `@prisma/client` | ^5.22.0 | Type-safe database client generated from the Prisma schema |
| `@sendgrid/mail` | ^8.1.6 | SendGrid email API client |
| `@supabase/supabase-js` | ^2.109.0 | Supabase Storage SDK for file uploads |
| `bcrypt` | ^6.0.0 | Password hashing for student accounts (claim-code auth) |
| `cookie-parser` | ^1.4.7 | Parses cookies from incoming requests |
| `cors` | ^2.8.6 | Cross-origin resource sharing middleware |
| `dotenv` | ^17.4.2 | Loads environment variables from `.env` files |
| `express` | ^5.2.1 | Web framework for the backend API |
| `jsonwebtoken` | ^9.0.3 | JWT token generation and verification for student auth |
| `multer` | ^2.2.0 | Multipart form-data handling for file uploads (uses `memoryStorage`) |
| `node-cron` | ^4.6.0 | In-process cron scheduler for round lifecycle automation |
| `passport` | ^0.7.0 | Authentication middleware framework |
| `passport-local` | ^1.0.0 | Local username/password strategy for student login |
| `pdfkit` | ^0.20.2 | PDF generation for certificates |
| `ws` | ^8.21.3 | WebSocket library (used for real-time features) |

### Development

| Package | Version | Purpose |
|---|---|---|
| `@vitest/coverage-v8` | ^4.1.11 | V8 code coverage provider for Vitest |
| `eslint` | ^9.39.5 | JavaScript linter |
| `eslint-config-prettier` | ^10.1.8 | Disables ESLint rules that conflict with Prettier |
| `eslint-plugin-import` | ^2.32.0 | ESLint rules for import/export syntax |
| `prettier` | ^3.9.6 | Code formatter |
| `prisma` | ^5.22.0 | Prisma CLI for schema management and migrations |
| `supertest` | ^7.2.2 | HTTP integration testing (asserts on Express routes) |
| `vitest` | ^4.1.11 | Test runner (Vite-native) |

---

## Frontend Dependencies

### Production

| Package | Version | Purpose |
|---|---|---|
| `@clerk/nextjs` | ^7.8.2 | Clerk integration for Next.js (providers, components, hooks) |
| `next` | 16.3.0 | React framework with App Router, SSR, and API routes |
| `react` | 19.2.8 | UI component library |
| `react-dom` | 19.2.8 | React DOM renderer |
| `xlsx` | ^0.18.5 | Excel file export for data downloads |

### Development

| Package | Version | Purpose |
|---|---|---|
| `@tailwindcss/postcss` | ^4 | Tailwind CSS PostCSS plugin |
| `@testing-library/dom` | ^10.4.1 | DOM testing utilities |
| `@testing-library/jest-dom` | ^6.9.1 | Custom Jest/Vitest matchers for DOM assertions |
| `@testing-library/react` | ^16.3.2 | React component testing utilities |
| `@testing-library/user-event` | ^14.6.7 | User interaction simulation for tests |
| `@vitejs/plugin-react` | ^6.1.0 | Vite plugin for React fast refresh |
| `@vitest/coverage-v8` | ^4.1.11 | V8 code coverage provider for Vitest |
| `eslint` | ^9 | JavaScript linter |
| `eslint-config-next` | 16.3.0 | Next.js ESLint configuration |
| `eslint-config-prettier` | ^10.1.8 | Disables ESLint rules that conflict with Prettier |
| `jsdom` | ^29.1.1 | DOM simulation for frontend tests (Vitest environment) |
| `prettier` | ^3.9.6 | Code formatter |
| `tailwindcss` | ^4 | Utility-first CSS framework |
| `vitest` | ^4.1.11 | Test runner (Vite-native) |

---

## Documentation Site Dependencies

| Package | Purpose |
|---|---|
| `@docusaurus/core` | Static site generator for documentation |
| `@docusaurus/preset-classic` | Default theme with docs, blog, and pages |
| `netlify-cli` | CLI for deploying the built site to Netlify |

---

## Student Authentication (Custom)

Unlike organiser/educator auth (handled by Clerk), student authentication is implemented in-house using established security libraries:

- **Password hashing** — `bcrypt` hashes claim-code passwords before storing them.
- **Token issuance** — `jsonwebtoken` generates JWTs on successful student login (`POST /api/students/login`).
- **Session storage** — the frontend stores the JWT and student user object in `localStorage` via `frontend/src/lib/studentSession.js`.
- **Middleware** — `passport` with the `passport-local` strategy validates student credentials on login.
- **Password reset** — students can self-service reset their password via `POST /api/students/forgot-password` (sends a time-limited reset link) and `POST /api/students/reset-password` (consumes the token and sets a new password). The flow uses the same `crypto.randomBytes` token generation and `invitationToken`/`invitationExpiresAt` fields as the educator-initiated invitation, with the same 48-hour expiry.

This separation exists because students authenticate with claim codes rather than email/password, and the existing Clerk flow is designed for educator/organiser accounts. The student flow uses well-established libraries (bcrypt, JWT, passport) following standard security practices — bcrypt for password storage, JWT for stateless session tokens with expiry, and crypto.randomBytes for reset token generation.

---

## Infrastructure Summary

| Concern | Service | Tier |
|---|---|---|
| Database | Supabase PostgreSQL | Free (500 MB) |
| File storage | Supabase Storage | Free (1 GB) |
| Backend hosting | Render | Free (spins down when idle) |
| Frontend hosting | Vercel | Free |
| Documentation hosting | Netlify | Free |
| Version control + CI | Gitea + Gitea Actions | Self-hosted |
| Authentication (educators/organisers) | Clerk | Free tier |
| Email | SendGrid | Free (100 emails/day) |
