# Olympiad Portal — Frontend

Next.js (App Router) frontend for the Olympiad Portal. Educators manage their school and students, organisers run olympiads, marking and remarks, and students sit rounds online.

## Live deployments

| Component | URL |
|---|---|
| Frontend (Vercel) | <https://olympiad-portal-iota.vercel.app> |
| Backend API (Render) | <https://olympiad-portal-backend.onrender.com> |
| Documentation (GitHub Pages) | <https://zandilemkontwana.github.io/olympiad-portal/> |

## Local development

The frontend expects the backend API on <http://localhost:5000> — start that first (see [`../backend/README.md`](../backend/README.md)).

1. Install dependencies:
   ```
   npm i
   ```
2. Create a `.env.local` file in `frontend/` (gitignored) with your Clerk keys:
   ```
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=<from the Clerk dashboard>
   CLERK_SECRET_KEY=<from the Clerk dashboard>
   ```
   Optionally set `NEXT_PUBLIC_API_BASE_URL` — it defaults to `http://localhost:5000`, which is what you want locally.
3. Run the dev server:
   ```
   npm run dev
   ```
4. Open <http://localhost:3000>.

## Tests

```
cd frontend
npx vitest run
```

Note: the frontend vitest config sets `fileParallelism: false` because parallel jsdom workers are unreliable on slow/OneDrive-synced filesystems — run tests as-is, without extra parallelism flags.
