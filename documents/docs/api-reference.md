# API Reference

All endpoints are mounted under the `/api` prefix.

**Production base URL:** `https://olympiad-portal.onrender.com` — e.g. `/api/olympiads`. For local development the backend runs at `http://localhost:5000`.

## Authentication

Authentication is handled by **Clerk** (`@clerk/express`). Protected endpoints require a valid Clerk session — the frontend uses Clerk's `<SignIn>` / `<SignUp>` components, and the backend validates the session via `requireAuth()` middleware or `clerkMiddleware()` globally.

There is no `POST /api/auth/login` or `POST /api/auth/register` endpoint. Registration and login are managed entirely through Clerk's hosted UI or embedded components on the frontend.

Organiser accounts are created via the seed script (`node prisma/seed.js`), not self-registration.



### POST /api/educators/complete-profile

Requires auth. Called once after a new educator signs up via Clerk — links the Clerk account to app-specific data (name, school) and creates the educator's database record.

**Body:**

```json
{ "name": "Jane Doe", "schoolName": "Parktown High" }
```

**Response (201):**

```json
{
  "user": {
    "id": "string",
    "email": "jane@school.com",
    "role": "educator",
    "name": "Jane Doe",
    "school": { "id": "string", "name": "Parktown High" }
  }
}
```

**Errors:** `400` missing fields or no email on Clerk account, `409` profile already completed.

### POST /api/students/complete-profile

Requires auth. Links a Clerk student account to an existing unclaimed `Entrant` record, matched by name + school (case-insensitive). The entrant record must already exist (created by an educator) and must not already be linked to another user.

**Body:**

```json
{ "name": "Alice Nkosi", "schoolName": "Parktown High" }
```

**Response (201):**

```json
{
  "user": {
    "id": "string",
    "email": "alice@student.com",
    "role": "student",
    "name": "Alice Nkosi",
    "school": { "id": "string", "name": "Parktown High" }
  }
}
```

**Errors:** `400` missing fields, `404` no matching school or unclaimed entrant found, `409` profile already completed.

### GET /api/auth/me

Requires auth. Returns the authenticated user's profile, including linked educator or student/entrant data.

**Response (200):**

```json
{
  "user": {
    "id": "string",
    "email": "jane@school.com",
    "role": "educator",
    "name": "Jane Doe",
    "school": { "id": "string", "name": "Parktown High" }
  }
}
```

`school` is `null` if the user has no linked educator or entrant record.

**Errors:** `404` user not found in app database.

### DELETE /api/auth/account

Requires auth. Permanently deletes the user's account from both the app database and Clerk.

**Response (200):** `{ "message": "Account deleted successfully" }`

**Errors:** `404` user not found.

---

## Papers

### POST /api/rounds/:id/papers

Requires auth, role `organiser`. Uploads a paper and memo PDF for a round. Files are stored in **Supabase Storage** (bucket configured via `SUPABASE_BUCKET_NAME` env var) — the file buffer is uploaded directly from memory (no local disk).

**Body:** `multipart/form-data`

- `paper` (file, required)
- `memo` (file, required)
- `memoAnswers` (JSON string, optional) — e.g. `{"1":"B","2":"D"}`, enables automarking for MCQ papers

**Response (201):**

```json
{
  "id": "string",
  "roundId": "string",
  "fileUrl": "string (Supabase public URL)",
  "memoUrl": "string (Supabase public URL)",
  "memoAnswers": { "1": "B", "2": "D" },
  "uploadedAt": "ISO date"
}
```

**Errors:** `400` missing files or invalid memoAnswers JSON, `401`/`403` auth or not organiser, `500` DB or Supabase upload error.

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

Both `fileUrl` (paper) and `memoUrl` (memo) are direct Supabase Storage download links.

**Errors:** `500` DB error.

---

## Submissions

### POST /api/rounds/:id/submissions

Requires auth, role `educator`. Submits an entrant's answers for an open round. A submission receipt email is sent to the educator via **SendGrid** on success (failures are logged but don't affect the response).

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

### GET /api/rounds/:id/submissions

Returns all submissions for a round with their results.

**Response (200):** array of submission objects (same shape as POST response, each including `result`).

**Errors:** `500` DB error.

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
  "id": "string",
  "name": "Wits Maths Olympiad",
  "timezone": "Africa/Johannesburg"
}
```

**Errors:** `400` if `name` or `timezone` is missing.

---

### GET /api/olympiads

Returns all olympiads, each including its nested rounds ordered by `openTime` ascending.

**Response (200):**
```json
[
  {
    "id": "string",
    "name": "Wits Maths Olympiad",
    "timezone": "Africa/Johannesburg",
    "rounds": [
      { "id": "string", "name": "Round 1", "state": "open", "openTime": "ISO date", "closeTime": "ISO date" }
    ]
  }
]
```

---

### POST /api/rounds

Creates a new round under an olympiad. `state` defaults to `"scheduled"` and is managed automatically by the scheduler.

**Body:**
```json
{
  "olympiadId": "string",
  "name": "Round 1",
  "openTime": "2026-08-08T20:00:00Z",
  "closeTime": "2026-08-08T21:00:00Z"
}
```

**Response (201):**
```json
{
  "id": "string",
  "olympiadId": "string",
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

Returns all rounds across every olympiad, ordered by `openTime` ascending. Each round includes its parent olympiad.

**Response (200):** array of round objects with nested `olympiad`.

---

### GET /api/rounds/:id

Returns a single round by ID.

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
  "entrantId": "string"
}
```

**Response (201):**
```json
{
  "id": "string",
  "roundId": "string",
  "entrantId": "string",
  "registeredAt": "ISO date"
}
```

**Errors:** `400` if `entrantId` is missing, `403` if the round is no longer accepting registrations (`closed`/`released`), the entrant belongs to a different school, or no educator profile exists, `404` if the round or entrant does not exist, `409` if the entrant is already registered for this round.

---

### GET /api/rounds/:id/entrants

Returns all entrants registered for a specific round — powers the "Submit Results" page, listing only entrants an educator can submit marks for.

**Response (200):**
```json
[
  {
    "id": "string",
    "schoolId": "string",
    "name": "Test Student",
    "grade": "10"
  }
]
```

---

## Entrants

### POST /api/entrants

Requires auth, role `educator`. Creates an entrant (student) at the authenticated educator's school.

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
  "id": "string",
  "schoolId": "string",
  "name": "Test Student",
  "grade": "10"
}
```

**Errors:** `400` if `name` or `grade` is missing, `403` if the account has no educator profile.

---

### GET /api/entrants

Requires auth, role `educator`. Lists the entrants at the authenticated educator's school, ordered by name ascending.

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
  "entrantId": "string"
}
```

**Response (201 for a new sitting, 200 when resuming):**
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

### POST /api/sittings/:id/submit

Requires auth. Submits the sitting for marking: the sitting's stored answers become a `Submission`, automarked immediately against the paper's memo answer key when one exists (same marking as the educator submission flow), and the sitting is marked `completedAt`.

The submission's `idempotencyKey` is derived from the sitting ID, so a retried request after a lost response returns the existing submission with `200` instead of creating a duplicate.

**Body:** none.

**Response (201, or 200 for an idempotent retry):**

```json
{
  "submission": {
    "id": "string",
    "roundId": "string",
    "entrantId": "string",
    "answers": { "1": "B" },
    "idempotencyKey": "sitting:string",
    "submittedAt": "ISO date",
    "result": {
      "id": "string",
      "submissionId": "string",
      "score": 66.67
    }
  },
  "result": { "id": "string", "submissionId": "string", "score": 66.67 }
}
```

`result` is `null` when the paper has no memo answer key (no automarking possible). The score is a percentage; the student-facing UI does not display it — results are released after marking.

**Errors:** `403` if the sitting is already completed (with no existing submission to return) or has expired, `404` if no sitting matches the given ID, `500` DB error.

---

## Schools

### GET /api/schools

No auth required. Returns a public list of all schools — used by the student registration dropdown.

**Response (200):**
```json
[
  { "id": "string", "name": "Parktown High" }
]
```

---

### GET /api/schools/:id/entrants

Requires auth. Lists all entrants at the specified school. Organisers can view any school; educators can only view their own.

**Response (200):**
```json
[
  { "id": "string", "name": "Alice Nkosi", "grade": "10", "schoolId": "string" }
]
```

**Errors:** `403` not authorized to view this school.

---

### GET /api/schools/:id/dashboard

Requires auth. Returns aggregated dashboard statistics for a school: entrant count, total submissions, and per-entrant average scores. Organisers can view any school; educators can only view their own.

**Response (200):**
```json
{
  "school": { "id": "string", "name": "Parktown High" },
  "entrantCount": 25,
  "totalSubmissions": 40,
  "entrants": [
    {
      "id": "string",
      "name": "Alice Nkosi",
      "grade": "10",
      "submissionCount": 3,
      "averageScore": 72.5
    }
  ]
}
```

**Errors:** `403` not authorized, `404` school not found.

---

## Student

### GET /api/students/me/sittings

Requires auth, role `student`. Lists the authenticated student's own sittings with round names and states, newest first.

**Response (200):**
```json
[
  {
    "id": "string",
    "entrantId": "string",
    "roundId": "string",
    "answers": { "1": "B" },
    "startedAt": "ISO date",
    "expiresAt": "ISO date",
    "completedAt": null,
    "round": { "id": "string", "name": "Round 1", "state": "open", "closeTime": "ISO date" }
  }
]
```

**Errors:** `404` no entrant record linked to this account.

---

### GET /api/students/me/results

Requires auth, role `student`. Lists the student's own released results — only results with a non-null `releasedAt` are returned, so unreleased marks stay hidden.

**Response (200):**
```json
[
  {
    "id": "string",
    "score": 66.67,
    "releasedAt": "ISO date",
    "submittedAt": "ISO date",
    "round": { "id": "string", "name": "Round 1" }
  }
]
```

**Errors:** `404` no entrant record linked to this account.

---

### GET /api/students/me/results/:resultId

Requires auth, role `student`. Full review of one released result: the student's answer next to the correct answer for every question.

**Response (200):**
```json
{
  "id": "string",
  "score": 66.67,
  "submittedAt": "ISO date",
  "releasedAt": "ISO date",
  "round": { "id": "string", "name": "Round 1" },
  "paperFileUrl": "string",
  "questions": [
    {
      "questionId": "1",
      "correctAnswer": "B",
      "studentAnswer": "B",
      "isCorrect": true
    },
    {
      "questionId": "2",
      "correctAnswer": "D",
      "studentAnswer": "A",
      "isCorrect": false
    }
  ]
}
```

**Errors:** `404` result not found or not released yet, `404` no entrant record linked.

---

## External API Integrations

The backend integrates three external APIs:

### Clerk (Authentication)

**SDK:** `@clerk/express`

Clerk handles all user authentication — sign-up, sign-in, session management, and 2FA. The backend uses:

- `clerkMiddleware()` — registered globally in `index.js`, validates Clerk session tokens on every request
- `requireAuth()` — guards protected endpoints, extracts `clerkUserId` from the session
- `clerkClient.users.getUser()` — fetches the user's email from Clerk during profile completion (`POST /educators/complete-profile`, `POST /students/complete-profile`)
- `clerkClient.users.deleteUser()` — deletes the Clerk account when a user deletes their app account (`DELETE /auth/account`)

### Supabase Storage (File Uploads)

**SDK:** `@supabase/supabase-js`

Paper and memo PDF files are uploaded directly to a Supabase Storage bucket (configured via `SUPABASE_BUCKET_NAME` env var). Files are held in memory via `multer.memoryStorage()` and uploaded as buffers — no local disk storage is used.

- `supabase.storage.from(BUCKET).upload()` — uploads the file buffer
- `supabase.storage.from(BUCKET).getPublicUrl()` — generates public download URLs stored in the `Paper.fileUrl` and `Paper.memoUrl` database fields

### SendGrid (Email Notifications)

**SDK:** `@sendgrid/mail`

Transactional emails are sent via SendGrid's API. All email functions are defined in `src/lib/email.js` and log their results (success/failure) to the `NotificationLog` database table. Failures are caught and logged but never block the calling operation.

| Function | Trigger | Recipient |
|---|---|---|
| `sendSubmissionReceipt` | Educator submits results (`POST /rounds/:id/submissions`) | Submitting educator |
| `sendRoundOpeningNotification` | Scheduler detects round about to open | All educators at schools with registered entrants |
| `sendRoundClosingNotification` | Scheduler detects round about to close | All educators at schools with registered entrants |
| `sendResultsReleasedNotification` | Scheduler detects results newly released | All educators at schools with registered entrants |
| `sendMissingSubmissionNotification` | Scheduler detects recently closed round with no submission | Educators at schools with registered but unsubmitted entrants |

---

## Notes

- All timestamps are ISO 8601 strings.
- File uploads are stored in Supabase Storage (not local disk). The `Paper.fileUrl` and `Paper.memoUrl` fields contain public Supabase download URLs.
- Submission receipt emails are sent via SendGrid on successful submission. Failures are logged to the `NotificationLog` table but don't affect the submission response.
- The round scheduler runs every 30 seconds and fires all scheduled notification checks (opening, closing, results released, missing submissions).
