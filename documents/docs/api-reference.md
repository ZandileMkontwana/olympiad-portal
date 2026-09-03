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

### GET /api/papers/archive

No auth required at the API level (the archive page itself requires sign-in). Returns the past-paper archive: every paper from rounds whose state is `closed` or `released`, most recently uploaded first.

**Response (200):**

```json
[
  {
    "id": "string",
    "roundId": "string",
    "roundName": "Round 1",
    "olympiadName": "string",
    "closeTime": "ISO date",
    "fileUrl": "string",
    "memoUrl": "string",
    "uploadedAt": "ISO date"
  }
]
```

Both `fileUrl` (paper) and `memoUrl` (memo) are direct download links.

**Errors:** `500` DB error.

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
## Rounds & Olympiads

### POST /api/olympiads
Creates a new olympiad.

**Body:**
```json
{
  "name": "Wits Maths Olympiad",
  "timezone": "Africa/Johannesburg"
}
```

**Response (201):**
```json
{
  "id": "8780fd67-e457-4ae5-9d27-ff7fa1ba6085",
  "name": "Wits Maths Olympiad",
  "timezone": "Africa/Johannesburg"
}
```

**Errors:** `400` if `name` or `timezone` is missing.

---

### GET /api/olympiads
Returns all olympiads.

**Response (200):**
```json
[
  {
    "id": "8780fd67-e457-4ae5-9d27-ff7fa1ba6085",
    "name": "Wits Maths Olympiad",
    "timezone": "Africa/Johannesburg"
  }
]
```

---

### POST /api/rounds
Creates a new round under an olympiad. `state` defaults to `"scheduled"` and is managed automatically by the scheduler from there.

**Body:**
```json
{
  "olympiadId": "8780fd67-e457-4ae5-9d27-ff7fa1ba6085",
  "name": "Round 1",
  "openTime": "2026-08-08T20:00:00Z",
  "closeTime": "2026-08-08T21:00:00Z"
}
```

**Response (201):**
```json
{
  "id": "854cb0b8-2852-461c-a982-3209a70273bb",
  "olympiadId": "8780fd67-e457-4ae5-9d27-ff7fa1ba6085",
  "name": "Round 1",
  "openTime": "2026-08-08T20:00:00.000Z",
  "closeTime": "2026-08-08T21:00:00.000Z",
  "state": "scheduled"
}
```

**Errors:** `400` if any required field is missing, or if `closeTime` is not after `openTime`.

**Note:** all times are UTC. The round scheduler ticks every 30 seconds and transitions `scheduled → open → closed` automatically based on these timestamps.

---

### GET /api/rounds
Returns all rounds across every olympiad.

**Response (200):** array of round objects, same shape as the `POST /api/rounds` response.

---

### GET /api/rounds/:id
Returns a single round by ID.

**Response (200):** a single round object.

**Errors:** `404` if no round matches the given ID.

---

### GET /api/olympiads/:id/rounds
Returns all rounds belonging to a specific olympiad, ordered by `openTime` ascending.

**Response (200):** array of round objects.

---

## Round Entrants

### POST /api/rounds/:id/entrants
Requires auth, role `educator`. Registers one of the educator's own entrants to sit a specific round — accepted while the round is `scheduled` or `open`.

**Body:**
```json
{
  "entrantId": "7ed46f5b-d100-471c-adc8-89a983114e7a"
}
```

**Response (201):**
```json
{
  "id": "e842f9a3-89ef-41a6-a459-944983bbc5a2",
  "roundId": "c9343aef-90d8-44e7-a5ac-faf8c3091cd3",
  "entrantId": "7ed46f5b-d100-471c-adc8-89a983114e7a",
  "registeredAt": "2026-08-15T..."
}
```

**Errors:** `400` if `entrantId` is missing. `403` if the round is no longer accepting registrations (`closed`/`released`) or the entrant belongs to a different school. `404` if the round or entrant does not exist. `409` if the entrant is already registered for this round.

---

### GET /api/rounds/:id/entrants
Returns all entrants registered for a specific round — this is what powers the "Submit Results" page, listing only entrants an educator can submit marks for.

**Response (200):**
```json
[
  {
    "id": "7ed46f5b-d100-471c-adc8-89a983114e7a",
    "schoolId": "b9d2ac33-eee5-4de4-9bd4-929d75551cee",
    "name": "Test Student",
    "grade": "10"
  }
]
```
---

## Entrants

### POST /api/entrants

Requires auth, role `educator`. Creates an entrant at the authenticated educator's school.

**Body:**
```json
{
  "name": "Test Student",
  "grade": "10"
}
```

**Response (201):**
```json
{
  "id": "7ed46f5b-d100-471c-adc8-89a983114e7a",
  "schoolId": "b9d2ac33-eee5-4de4-9bd4-929d75551cee",
  "name": "Test Student",
  "grade": "10"
}
```

**Errors:** `400` if `name` or `grade` is missing, `403` if the account has no educator profile.

---

### GET /api/entrants

Requires auth, role `educator`. Lists the entrants registered at the authenticated educator's school, ordered by name ascending.

**Response (200):** array of entrant objects, same shape as the `POST /api/entrants` response.

**Errors:** `403` if the account has no educator profile.

---

## Sittings

An online sitting is an entrant's test-taking session for a round — the online counterpart to sitting the paper physically.

### POST /api/rounds/:id/sittings

Requires auth. Starts an online sitting for an entrant in an open round. One sitting per entrant per round: if an in-progress sitting already exists it is returned instead (with its saved answers), so a reconnect resumes where the student left off.

**Body:**
```json
{
  "entrantId": "7ed46f5b-d100-471c-adc8-89a983114e7a"
}
```

**Response (201 for a new sitting, `200` when resuming):**
```json
{
  "sitting": {
    "id": "string",
    "entrantId": "string",
    "roundId": "string",
    "answers": { "1": "B" },
    "startedAt": "ISO date",
    "expiresAt": "ISO date",
    "completedAt": null
  },
  "round": { "id": "string", "name": "Round 1", "closeTime": "ISO date" },
  "paper": { "fileUrl": "string", "questions": ["1", "2", "3"] }
}
```

`expiresAt` mirrors the round's `closeTime` — the sitting ends when the round closes. Once past `expiresAt` the sitting can no longer be resumed or saved to. `questions` lists the question IDs taken from the paper's memo answer key (only the IDs, never the answers). `answers` carries the student's previously auto-saved answers when resuming.

**Errors:** `400` if `entrantId` is missing, `403` if the round is not `open`, the entrant is not registered for the round, the sitting was already completed, or the sitting has expired, `404` if the round or its paper does not exist.

---

### PATCH /api/sittings/:id/answers

Requires auth. Auto-save for an in-progress sitting: merges the given answers into whatever is already stored, so a refresh or disconnect never loses progress.

**Body:**
```json
{
  "answers": { "3": "A" }
}
```

**Response (200):** `{ "sitting": { ... } }` — the same `sitting` object as above, with the merged `answers`.

**Errors:** `400` if `answers` is missing or not an object, `403` if the sitting is already completed or has expired, `404` if no sitting matches the given ID.

---

## Notes

- All timestamps are ISO 8601 strings.
- File uploads are stored on local disk under `/uploads` (planned migration to Cloudflare R2 for deployment).
- A submission email receipt is sent to the submitting educator's email on successful submission (via SendGrid). Failures are logged but don't affect the submission response.
