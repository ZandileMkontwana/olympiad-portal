---
sidebar_position: 1
---
![Backend Coverage](https://img.shields.io/badge/backend%20coverage-89.3%25-brightgreen)
![Frontend Coverage](https://img.shields.io/badge/frontend%20coverage-96%25-brightgreen)
![Tests](https://img.shields.io/badge/tests-750%20passing-brightgreen)

## Live deployments

| Component | URL |
|---|---|
| Backend API (Render) | <https://olympiad-portal-backend.onrender.com> |
| Frontend (Vercel) | <https://olympiad-portal-7fs5sexu9-zandile-mkontwanas-projects.vercel.app/> |
| Documentation (Netlify) | <https://olympiad-portal-docs.netlify.app> |

## Code Coverage

| Metric | Backend | Frontend |
|--------|---------|----------|
| Statements | 89.33% | 96% |
| Branches | 78.06% | 87.62% |
| Functions | 95.36% | 100% |
| Lines | 89.94% | 98.35% |

Run coverage locally:
```bash
# Backend
cd backend && npx vitest run --coverage

# Frontend
cd frontend && npx vitest run --coverage
```

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
Create a `.env` file in `backend/` (never commit this — it's gitignored):
```
DATABASE_URL="<ask a teammate for the shared Supabase connection string>"
```

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

## Project structure
```
backend/
├── prisma/
│   └── schema.prisma       # database models
├── src/
│   ├── index.js            # app entry point
│   ├── lib/
│   │   └── prisma.js       # shared Prisma client
│   ├── scheduler.js        # round lifecycle scheduler
│   ├── middleware/
│   │   └── auth.js         # auth guards
│   └── routes/
│       ├── rounds.js       # olympiad/round/entrant endpoints
│       ├── papers.js       # paper upload/download
│       ├── submissions.js  # result submissions
│       └── auth.js         # register/login/etc.
```

## Documentation

Full project documentation (getting started, API reference, database schema, sprint records) is deployed at <https://olympiad-portal-docs.netlify.app> and lives in [`documents/docs/`](./documents/docs/).

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Getting Started - Frontend

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.js`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
