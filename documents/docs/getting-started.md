---
sidebar_position: 1
---

# Getting Started — Backend

## Prerequisites
- **Node.js 20 (LTS)** — newer versions (22+) have caused compatibility issues with our dependencies. Use [nvm-windows](https://github.com/coreybutler/nvm-windows) to manage versions if needed:
```
  nvm install 20
  nvm use 20
```
- Access to the shared Railway Postgres database (ask a teammate for the connection string)

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
DATABASE_URL="<ask a teammate for the shared Railway connection string>"
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