---
kind: error_handling
name: Express Route-Level try/catch + Frontend ApiError Class
category: error_handling
scope:
    - '**'
source_files:
    - backend/src/middleware/auth.js
    - backend/src/routes/rounds.js
    - backend/src/routes/auth.js
    - backend/src/routes/papers.js
    - backend/src/routes/submissions.js
    - backend/src/index.js
    - frontend/src/lib/api.js
    - frontend/src/hooks/useAuthRedirect.js
    - frontend/src/hooks/useRequireRole.js
---

## Overview

The Olympiad Portal Monorepo uses a simple, route-scoped error handling strategy with no centralized Express error middleware. Errors are handled inline in each route handler and surfaced to the frontend as JSON responses with an `error` field. The Next.js frontend wraps all HTTP calls through a shared client that throws a typed `ApiError` for non-2xx responses.

## Backend (Express)

### Pattern per route handler
Every async route handler in `backend/src/routes/*.js` follows the same shape:

1. **Input validation** returns early with `res.status(400).json({ error: '...' })` when required fields are missing or values are invalid (e.g. `rounds.js`, `auth.js`, `submissions.js`).
2. **Business-rule failures** return explicit status codes — `404` for not found (`rounds.js`, `papers.js`, `auth.js`), `403` for forbidden state/role checks (`papers.js` round-state guard, `submissions.js` round-state guard, `middleware/auth.js` role check).
3. **Authentication/authorization errors** are handled by the `requireAuth` / `requireRole` middleware in `backend/src/middleware/auth.js`, which returns `401` for missing/expired JWT and `403` for insufficient role.
4. **Unexpected/internal errors** are caught via a `try { ... } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to ...' }) }` block around Prisma calls. There is no global `app.use((err, req, res, next) => {...})` error handler; every route is responsible for its own catch block.
5. **Domain-specific error mapping**: In `submissions.js`, a Prisma unique-constraint error with `code === 'P2002'` on the `idempotencyKey` target is treated as idempotent success — returning the existing submission with `200` instead of propagating the error.
6. **Logging**: All caught errors are logged via `console.error(err)` before responding. No structured logger is used.

### Key files
- `backend/src/middleware/auth.js` — centralizes authN/authZ error responses (`401`, `403`).
- `backend/src/routes/rounds.js`, `auth.js`, `papers.js`, `submissions.js` — all follow the same inline try/catch pattern.
- `backend/src/index.js` — mounts routers but defines **no** global error-handling middleware.

### Conventions observed
- Error bodies are consistently `{ error: '<human message>' }`.
- Validation errors use `400`; not-found uses `404`; forbidden/state violations use `403`; server errors use `500`.
- Success responses use `201` for created resources and `200` otherwise.
- No custom `Error` subclasses are thrown from the backend; plain exceptions bubble to the nearest `catch`.

## Frontend (Next.js)

### Centralized API client
`frontend/src/lib/api.js` defines a single `requestJson(path, options)` helper that:
- Wraps `fetch` in `try/catch` and throws `new ApiError('Could not reach the server...', 0)` on network failure.
- Attempts to parse the response body as JSON; if parsing fails it falls through to the `response.ok` check.
- For any non-2xx response, throws `new ApiError(data?.error || \`Request failed with status ${status}\`, status)`.

The `ApiError` class extends `Error` and carries both `message` and `status`, enabling callers to distinguish network errors (`status === 0`) from HTTP error responses.

A second copy of this logic exists inline in `uploadPaper` for multipart uploads, following the same pattern.

### Caller-side handling
- `fetchCurrentUser()` swallows all errors and returns `null`, so unauthenticated pages render without crashing.
- Other callers (e.g. page components calling `createRound`, `register`, `login`) rely on the `ApiError` being thrown; the current codebase does not show dedicated try/catch blocks at call sites in the provided files, meaning UI-level error presentation is expected to be handled where these functions are invoked.

### Role-based redirects
`frontend/src/hooks/useAuthRedirect.js` and `useRequireRole.js` treat a null user (i.e. a failed `/api/auth/me` call) as "not authenticated" and redirect to `/login`, using the same silent-error approach as `fetchCurrentUser`.

## Cross-cutting constraints

- **No global Express error middleware** — error handling is fully decentralized per route.
- **No custom domain error types on the backend** — errors are represented as HTTP status codes plus a string `error` message.
- **Frontend enforces a single error type** — all HTTP failures surface as `ApiError`, giving consumers a uniform way to branch on `instanceof ApiError` and inspect `.status`.
- **Idempotency is handled explicitly** in `submissions.js` by catching Prisma's `P2002` constraint violation and returning the existing record rather than surfacing it as an error.
- **Structured logging is absent** — `console.error` is the only logging mechanism for errors.