# API Reference — Papers, Submissions & Auth

## Authentication

All protected endpoints require a JWT in the `Authorization` header:

Get a token via `POST /api/auth/register` or `POST /api/auth/login`.

### POST /api/auth/register

Creates a new user account. Role is always `educator` — organiser accounts are created via a seed script, not self-registration.

**Body:**

```json
{ "email": "string", "password": "string" }
```

**Response (201):**

```json
{
  "user": { "id": "string", "email": "string", "role": "educator" },
  "token": "string"
}
```

**Errors:** `400` missing fields, `409` email already exists.

### POST /api/auth/login

**Body:**

```json
{ "email": "string", "password": "string" }
```

**Response (200):** same shape as register.
**Errors:** `401` invalid email or password (generic message, doesn't reveal which was wrong).

### POST /api/auth/reset-password

Requires auth. Changes the logged-in user's password.

**Body:**

```json
{ "currentPassword": "string", "newPassword": "string" }
```

**Response (200):** `{ "message": "Password updated successfully" }`
**Errors:** `401` current password incorrect.

### DELETE /api/auth/account

Requires auth. Permanently deletes the logged-in user's own account.

**Response (200):** `{ "message": "Account deleted successfully" }`

---

## Papers

### POST /api/rounds/:id/papers

Requires auth, role `organiser`. Uploads a paper and memo for a round.

**Body:** `multipart/form-data`

- `paper` (file, required)
- `memo` (file, required)
- `memoAnswers` (JSON string, optional) — e.g. `{"1":"B","2":"D"}`, enables automarking for MCQ papers

**Response (201):**

```json
{
  "id": "string",
  "roundId": "string",
  "fileUrl": "string",
  "memoUrl": "string",
  "memoAnswers": { "1": "B", "2": "D" },
  "uploadedAt": "ISO date"
}
```

**Errors:** `400` missing files or invalid memoAnswers JSON, `401`/`403` auth, `500` DB error (e.g. round already has a paper — one paper per round).

### GET /api/rounds/:id/papers

No auth required. Returns the paper for a round, gated on round state.

Downloadable when round `state` is `open` or `released`. Blocked when `scheduled` or `closed`.

**Response (200):** same shape as upload response.
**Errors:** `404` round or paper not found, `403` round not in a downloadable state.

---

## Submissions

### POST /api/rounds/:id/submissions

Requires auth, role `educator`. Submits an entrant's answers for an open round.

**Body:**

```json
{
  "entrantId": "string",
  "answers": { "1": "B", "2": "D" },
  "idempotencyKey": "string (client-generated, unique per submission attempt)"
}
```

**Response (201):**

```json
{
  "submission": {
    "id": "string",
    "roundId": "string",
    "entrantId": "string",
    "answers": {},
    "submittedAt": "ISO date"
  },
  "result": { "id": "string", "score": 66.67, "releasedAt": null }
}
```

`result` is `null` if the round's paper has no `memoAnswers` (not MCQ / not automarkable).

`releasedAt` stays `null` until the round closes — scores are marked immediately but only released to schools at close, per spec.

**Idempotency:** retrying the same `idempotencyKey` returns the original submission/result with `200` instead of creating a duplicate.

**Errors:** `400` missing fields, `403` round not open, `404` round not found.

---

## Notes

- All timestamps are ISO 8601 strings.
- File uploads are stored on local disk under `/uploads` (planned migration to Cloudflare R2 for deployment).
- A submission email receipt is sent to the submitting educator's email on successful submission (via SendGrid). Failures are logged but don't affect the submission response.
