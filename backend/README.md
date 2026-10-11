---
sidebar_position: 1
---
![Backend Coverage](https://img.shields.io/badge/backend%20coverage-86.3%25-green)
![Tests](https://img.shields.io/badge/tests-636%20passing-brightgreen)

**Live API (Render):** <https://olympiad-portal-backend.onrender.com> — e.g. <https://olympiad-portal-backend.onrender.com/api/olympiads>

# Getting Started — Backend

## Prerequisites
- **Node.js 20 (LTS)** — newer versions (22+) have caused compatibility issues with our dependencies. Use [nvm-windows](https://github.com/coreybutler/nvm-windows) to manage versions if needed:
```
  nvm install 20
  nvm use 20
```
- Access to the shared Supabase Postgres database (ask a teammate for the connection string — use the **Connection Pooler** string, as the direct connection is IPv6-only)

## Setup

**1. Clone the repo and move into the backend folder**
```
git clone https://sdp.ms.wits.ac.za/codecrafters/Olympiad-Portal.git
cd Olympiad-Portal/backend
```

**2. Install dependencies**
```
npm i
```

**3. Set up your environment variables**
Create a `.env` file in `backend/` (never commit this — it's gitignored). The easiest option is to ask a teammate for the shared `.env`; otherwise these three are required just to start the server (`lib/supabase.js` builds its Storage client at boot — without them the server crashes with `supabaseUrl is required`):
```
DATABASE_URL="<shared Supabase connection string>"
SUPABASE_URL="<Supabase project URL, e.g. https://xxxx.supabase.co>"
SUPABASE_SERVICE_ROLE_KEY="<from the Supabase dashboard>"
```
Add the rest as you need each feature:

| Variable | Used for |
|---|---|
| `CLERK_SECRET_KEY` / `CLERK_PUBLISHABLE_KEY` | educator/organiser login (Clerk) |
| `JWT_SECRET` | student accounts and invitation links |
| `SENDGRID_API_KEY` / `SENDGRID_FROM_EMAIL` | notification emails |
| `SUPABASE_BUCKET_NAME` | paper upload bucket (Supabase Storage) |
| `FRONTEND_URL` | links inside emails + backend CORS allowlist |
| `DISABLE_SCHEDULER` | `true` keeps the round scheduler off (recommended locally) |

**4. Generate the Prisma client**
```
npx prisma generate
```

**5. Run the server**
```
node src/index.js
```
You should see:
```
Backend running on :5000
Round scheduler started — ticking every 30s
```
(or `Round scheduler disabled by DISABLE_SCHEDULER` if you set that variable — recommended for local work, see Common issues)

## Verifying it works
Test an endpoint:
```powershell
Invoke-RestMethod -Uri http://localhost:5000/api/olympiads
```
Should return an array (empty or with existing data) — see the [API Reference](./api-reference) for the full list of endpoints.

## Making schema changes
If you need to modify the database schema (`backend/prisma/schema.prisma`):
```
npx prisma migrate dev --name <describe_your_change>
npx prisma generate
```

## Common issues
- **`Can't reach database server`** — usually campus Wi-Fi blocking the connection port. Try a mobile hotspot.
- **`spawn prisma-client ENOENT` or similar Prisma errors** — make sure you're on Prisma 5.x (`npm ls prisma`), not 7.x; the project isn't compatible with Prisma 7's config format yet.
- **Server won't pick up code changes** — Node doesn't hot-reload; stop the server (Ctrl+C) and restart with `node src/index.js` after any edit.
- **Prisma `P2024` errors / APIs suddenly returning 500s** — on a freshly seeded database the scheduler's notification emails can exhaust the shared Supabase pooler's small connection limit. Set `DISABLE_SCHEDULER=true` in `backend/.env` for local work; the deployed backend keeps the scheduler enabled.

## Project structure
```
backend/
├── prisma/
│   └── schema.prisma        # database models
├── src/
│   ├── index.js             # app entry point (Express, CORS, Clerk middleware)
│   ├── scheduler.js         # round lifecycle scheduler (30s tick)
│   ├── middleware/
│   │   ├── auth.js          # Clerk session + role guards
│   │   └── apiKeyAuth.js    # external API-key auth
│   ├── lib/                 # prisma.js (client), email.js (SendGrid),
│   │                        # supabase.js (file storage), activityBus.js (SSE),
│   │                        # certificates, difficulty, timezone, …
│   └── routes/              # route modules mounted under /api
│       ├── rounds.js        # olympiads, rounds, entrants
│       ├── questions.js     # question bank and variants
│       ├── papers.js        # paper upload/download (Supabase Storage)
│       ├── sittings.js      # online sittings and automarking
│       ├── submissions.js   # result submissions and receipts
│       ├── marking.js       # marking and moderation
│       └── remark.js        # remark/appeal workflow
```

…plus `auth`, `studentAuth`, `students`, `schools`, `certificates`, `analytics`, `activity`, `apiKeys`, `external` and `olympiadOrganisers`.

## Documentation

Full project documentation is deployed at <https://zandilemkontwana.github.io/olympiad-portal/>.

## Database
Uses PostgreSQL (hosted on Supabase) via Prisma. Run migrations with:
npx prisma migrate dev

## Scheduler
The round lifecycle scheduler runs automatically on server start, ticking every 30s to transition round states based on openTime/closeTime.

## API Endpoints
All routes are mounted under `/api` — the full endpoint list lives in the [API Reference](https://zandilemkontwana.github.io/olympiad-portal/docs/api-reference).