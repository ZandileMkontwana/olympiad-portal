---
sidebar_label: api-reference
---
# API Reference

All endpoints are mounted under the `/api` prefix.

**Production base URL:** `https://olympiad-portal-backend.onrender.com` — e.g. `https://olympiad-portal-backend.onrender.com/api/olympiads`. For local development the backend runs at `http://localhost:5000`.

## Authentication
Authentication is handled by **Clerk** (`@clerk/express`). Protected endpoints require a valid Clerk session — the frontend uses Clerk's `<SignIn>` / `<SignUp>` components, and the backend validates the session via `requireAuth()` middleware or `clerkMiddleware()` globally.

There is no `POST /api/auth/login` or `POST /api/auth/register` endpoint. Registration and login are managed entirely through Clerk's hosted UI or embedded components on the frontend.

Organiser accounts are created via the seed script (`node prisma/seed.js`), not self-registration.

**Students do not use Clerk** — educator-registered students sign in with email and password and receive a JWT ([`POST /api/students/login`](#post-apistudentslogin)); the same applies to consuming an invitation ([`POST /api/students/set-password`](#post-apistudentsset-password)). Student endpoints are listed under the [Student](#student) section.



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

## Question Bank & Variants

A paper can carry a structured question bank: questions with optional per-question variants. All endpoints require the caller to be an **organiser of the paper's olympiad**. Question `type` is one of `multiple_choice`, `short_answer`, `essay`, `numeric`; `options` holds MCQ options as JSON (`[{"label": "A", "text": "..."}]`) and `rubric` a marking rubric as JSON.

A question's `number` is unique within its paper; a variant's `label` is unique within its question. A variant can override the parent question's `text`, `memoAnswer` and `options` — when a sitting starts, each entrant is deterministically assigned one variant per question, and automarking prefers the assigned variant's `memoAnswer`.

### GET /api/papers/:paperId/questions

Requires auth, organiser of the paper's olympiad. Lists the paper's questions ordered by `number`, each with its `variants` array.

**Response (200):** array of question objects with nested `variants`.

**Errors:** `403` not an organiser of this olympiad, `404` paper or user not found.

---

### POST /api/papers/:paperId/questions

Requires auth, role `organiser` and membership of the paper's olympiad. Creates a question.

**Body:**
```json
{
  "number": 1,
  "text": "What is 2 + 2?",
  "type": "multiple_choice",
  "marks": 5,
  "memoAnswer": "B",
  "options": [{ "label": "A", "text": "3" }, { "label": "B", "text": "4" }],
  "rubric": null
}
```
All fields except `memoAnswer`, `options` and `rubric` are required.

**Response (201):** the created question with its (empty) `variants` array.

**Errors:** `400` validation (missing fields, unknown `type`, negative `marks`, non-positive `number`), `403` not an organiser of this olympiad, `404` paper not found, `409` question number already exists for this paper.

---

### GET /api/questions/:id

Requires auth, organiser of the question's olympiad. Returns one question with its `variants` and parent `paper`.

**Errors:** `403`, `404`.

---

### PUT /api/questions/:id

Requires auth, role `organiser` and olympiad membership. Updates any subset of `number`, `text`, `type`, `marks`, `memoAnswer`, `options`, `rubric`; only the provided fields change.

**Response (200):** the updated question with `variants`.

**Errors:** `400` validation, `403`, `404`, `409` the new `number` already exists on this paper.

---

### DELETE /api/questions/:id

Requires auth, role `organiser` and olympiad membership. Deletes the question **and all of its variants**.

**Response:** `204` no content.

**Errors:** `403`, `404`.

---

### GET /api/questions/:id/variants

Requires auth, organiser of the question's olympiad. Lists the question's variants ordered by `label`.

**Errors:** `403`, `404`.

---

### POST /api/questions/:id/variants

Requires auth, role `organiser` and olympiad membership. Creates a variant.

**Body:**
```json
{
  "label": "Variant A",
  "text": "What is 3 + 3?",
  "memoAnswer": "C",
  "options": null
}
```
Only `label` is required; other fields default to `null` (meaning "use the parent question's value").

**Response (201):** the created variant.

**Errors:** `400` missing `label`, `403`, `404`, `409` variant label already exists for this question.

---

### PUT /api/variants/:id

Requires auth, role `organiser` and olympiad membership. Updates any subset of `label`, `text`, `memoAnswer`, `options`.

**Response (200):** the updated variant.

**Errors:** `400`, `403`, `404`, `409` label conflict.

---

### DELETE /api/variants/:id

Requires auth, role `organiser` and olympiad membership. Deletes the variant.

**Response:** `204` no content.

**Errors:** `403`, `404`.

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
  "timezone": "Africa/Johannesburg",
  "description": "A national maths olympiad",
  "grades": "Grade 8–12",
  "startDate": "2026-02-01",
  "endDate": "2026-03-01"
}
```

`description`, `grades`, `startDate` and `endDate` are optional organiser-set info fields shown to educators on the olympiad info card.

**Response (201):**
```json
{
  "id": "string",
  "name": "Wits Maths Olympiad",
  "timezone": "Africa/Johannesburg",
  "description": "A national maths olympiad",
  "grades": "Grade 8–12",
  "startDate": "2026-02-01T00:00:00.000Z",
  "endDate": "2026-03-01T00:00:00.000Z"
}
```

**Errors:** `400` if `name` or `timezone` is missing, or if `endDate` is before `startDate`.

---

### GET /api/olympiads

Returns all olympiads, each including its nested rounds ordered by `openTime` ascending.

When the request carries a valid Clerk token for an **educator**, each olympiad is additionally enriched with the educator's school access state and the distinct learner count per school — these power the educator dashboard's olympiad info card.

**Response (200, authenticated educator):**
```json
[
  {
    "id": "string",
    "name": "Wits Maths Olympiad",
    "timezone": "Africa/Johannesburg",
    "description": "A national maths olympiad",
    "grades": "Grade 8–12",
    "startDate": "ISO date",
    "endDate": "ISO date",
    "rounds": [
      { "id": "string", "name": "Round 1", "state": "open", "openTime": "ISO date", "closeTime": "ISO date" }
    ],
    "schoolAccess": "approved",
    "schoolEntrantCounts": [
      { "schoolName": "Testville High", "entrantCount": 12 }
    ]
  }
]
```

`schoolAccess` is one of `"approved" | "pending" | "declined" | "none"` (the caller's school only). Anonymous and organiser callers get the plain list without the enrichment fields.

---

### PUT /api/olympiads/:id

Requires auth, role `organiser`. Edits an olympiad's name, timezone and organiser-set info fields. Only the fields present in the body are updated; sending an empty string clears an optional field.

**Body (all fields optional):**
```json
{
  "name": "Wits Maths Olympiad",
  "timezone": "Africa/Johannesburg",
  "description": "A national maths olympiad",
  "grades": "Grade 8–12",
  "startDate": "2026-02-01",
  "endDate": "2026-03-01"
}
```

**Response (200):** the updated olympiad object.

**Errors:** `400` if `name` or `timezone` would be cleared, or if `endDate` would end up before `startDate`, `403` if the caller is not an organiser, `404` if no olympiad matches.

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

## Olympiad Access Requests

A school joins an olympiad by requesting access and having an organiser approve it — see the [SchoolOlympiad](./database-schema.md) table. Access is school-scoped: every educator of an approved school shares its entrants.

### POST /api/olympiads/:id/request-access

Requires auth, role `educator`. Asks for the educator's school to be granted access to an olympiad, creating (or re-activating) a pending `SchoolOlympiad` row. A declined school can re-request — the row flips back to `pending`.

**Response (201):**
```json
{ "status": "pending" }
```

**Errors:** `403` if the caller is not an educator or has no school linked, `404` if no olympiad matches, `409` if the school already has access or a request is already pending.

---

### GET /api/olympiads/access-requests

Requires auth, role `organiser`. Lists pending access requests for the organiser console, oldest first.

**Response (200):**
```json
[
  {
    "id": "string",
    "school": { "id": "string", "name": "Testville High" },
    "olympiad": { "id": "string", "name": "Wits Maths Olympiad" },
    "requestedBy": { "id": "string", "name": "Ms Teacher", "email": "teacher@school.com" },
    "requestedAt": "ISO date"
  }
]
```

`requestedBy` is `null` when the requesting user's account no longer exists.

---

### POST /api/olympiads/access-requests/:id/approve

Requires auth, role `organiser`. Approves a pending access request — the school can immediately register entrants into that olympiad's rounds. Existing entrants are **not** auto-registered on approval; the educator adds them explicitly.

**Response (200):**
```json
{ "id": "string", "status": "approved" }
```

**Errors:** `403` if the caller is not an organiser, `404` if no request matches.

---

### POST /api/olympiads/access-requests/:id/decline

Requires auth, role `organiser`. Declines a pending access request. The school can request again later.

**Response (200):**
```json
{ "id": "string", "status": "declined" }
```

**Errors:** `403` if the caller is not an organiser, `404` if no request matches.

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

**Errors:** `400` if `entrantId` is missing, `403` if the round is no longer accepting registrations (`closed`/`released`), the school hasn't been granted approved access to the olympiad, the entrant belongs to a different school, or no educator profile exists, `404` if the round or entrant does not exist, `409` if the entrant is already registered for this round.

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

Requires auth, role `educator`. Creates an entrant (student) at the authenticated educator's school and emails them a link to set their password.

**Body:**
```json
{
  "name": "Test Student",
  "email": "student@school.com",
  "grade": "10"
}
```

**Response (201):**
```json
{
  "id": "string",
  "schoolId": "string",
  "name": "Test Student",
  "grade": "10",
  "email": "student@school.com",
  "accountStatus": "invite_pending",
  "invitationSent": true,
  "registeredRounds": [
    { "id": "string", "name": "Round 1", "olympiadName": "Wits Maths Olympiad" }
  ]
}
```

**Errors:** `400` if `name`, `email` or `grade` is missing or invalid, `409` if a user with that email already exists, `403` if the account has no educator profile.

**Note:** the new entrant is auto-registered for all currently open rounds of olympiads the school has approved access to — `registeredRounds` lists them so the educator can see which olympiads the student falls under.

---

### GET /api/entrants

Requires auth, role `educator`. Lists the entrants at the authenticated educator's school, ordered by name ascending.

**Response (200):** array of entrant objects with `email` and `accountStatus` fields — the base shape of the `POST /api/entrants` response, without the invitation/registration fields.

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
    "variantChoices": { "questionId": "variantId" },
    "startedAt": "ISO date",
    "expiresAt": "ISO date",
    "completedAt": null
  },
  "round": { "id": "string", "name": "Round 1", "closeTime": "ISO date" },
  "paper": {
    "fileUrl": "string",
    "questions": [
      { "id": "string", "number": 1, "text": "What is 2 + 2?", "type": "multiple_choice", "marks": 5, "options": [{ "label": "A", "text": "..." }] }
    ]
  }
}
```

`expiresAt` mirrors the round's `closeTime` — the sitting ends when the round closes. Once past `expiresAt` the sitting can no longer be resumed or saved to. `answers` carries the student's previously auto-saved answers when resuming.

When the paper carries question variants, `variantChoices` maps each question ID to the variant assigned to this entrant (deterministic per entrant and question), and each entry in `paper.questions` renders the assigned variant's `text` and `options` where one exists. Memo answers and rubrics are never sent to the student. Papers without variants return questions from the base question list, and legacy sittings created before variants carry no `variantChoices`.

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

Requires auth. Returns aggregated dashboard statistics for a school: entrant count, total submissions, per-entrant average scores, and the olympiads each entrant is registered under. Organisers can view any school; educators can only view their own.

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
      "averageScore": 72.5,
      "olympiads": [
        { "id": "string", "name": "Wits Maths Olympiad" }
      ]
    }
  ]
}
```

`olympiads` lists each distinct olympiad the entrant has a round registration in, sorted by name — empty when the student hasn't been registered for any rounds yet.

**Errors:** `403` not authorized, `404` school not found.

---

## Student

Students do not sign in through Clerk — educator-registered students authenticate with email and password via the endpoints below and receive a JWT that is sent as a Bearer header on all `/api/students/me/...` requests.

### POST /api/students/login

Public. Email + password sign-in for students. Returns a JWT session token (valid for 7 days) and the current-user object in the same shape as `GET /api/auth/me`.

**Body:**
```json
{ "email": "alice@student.com", "password": "string" }
```

**Response (200):**
```json
{
  "token": "string",
  "user": {
    "id": "string",
    "email": "alice@student.com",
    "role": "student",
    "name": "Alice Nkosi",
    "school": { "id": "string", "name": "Parktown High" },
    "entrantId": "string"
  }
}
```

`school` and `entrantId` are `null` if the account has no linked entrant record.

**Errors:** `400` email or password missing, `401` invalid email or password (deliberately vague — the response never reveals whether the email exists), `403` account not activated yet (invited but no password set — the student should look for their invitation email).

---

### POST /api/students/set-password

Public. Consumes the invitation token from a student's invitation email, stores the chosen password (bcrypt-hashed) and returns a session token so the student is signed in immediately. Also migrates legacy Clerk-linked student accounts to email login by clearing `clerkUserId`.

**Body:**
```json
{ "token": "string", "password": "string" }
```

**Response (200):** same shape as [`POST /api/students/login`](#post-apistudentslogin).

**Errors:** `400` token or password missing, password shorter than 8 characters, invitation token not valid, or invitation link expired.

---

### POST /api/students/forgot-password

Public. Self-service password reset for students. Accepts an email address and, if the account exists and is activated, sends a branded reset link valid for 48 hours. Always returns 200 — the response never reveals whether the email is registered.

**Body:**
```json
{ "email": "string" }
```

**Response (200):**
```json
{ "message": "If that email is registered, a reset link has been sent." }
```

**Errors:** `400` email missing, `500` server error.

---

### POST /api/students/reset-password

Public. Consumes a reset token from the forgot-password email, stores the new password (bcrypt-hashed), clears the token, and returns a session token so the student is signed in immediately.

**Body:**
```json
{ "token": "string", "password": "string" }
```

**Response (200):** same shape as [`POST /api/students/login`](#post-apistudentslogin).

**Errors:** `400` token or password missing, password shorter than 8 characters, reset link not valid or expired.

---

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

## Standings

### GET /api/rounds/:id/standings

Requires auth. Per-entrant standings for a round, ranked by average score. Educators see only their school's entrants; organisers see all.

**Response (200):**
```json
[
  {
    "rank": 1,
    "entrantId": "string",
    "entrantName": "Alice Nkosi",
    "schoolId": "string",
    "schoolName": "Parktown High",
    "score": 85.5
  }
]
```

**Errors:** `403` not authorized, `404` round not found.

---

### GET /api/rounds/:id/standings/schools

Requires auth. Per-school aggregated standings for a round, ranked by total score. Educators see only their own school's row; organisers see all schools.

**Response (200):**
```json
[
  {
    "rank": 1,
    "schoolId": "string",
    "schoolName": "Parktown High",
    "totalScore": 256.5,
    "entrantCount": 3
  }
]
```

**Errors:** `403` not authorized, `404` round not found.

---

## Analytics

Round-level analytics powering the organiser and educator dashboards. Metrics are computed from submissions and their results — a submission only counts toward "completed" once its result exists.

### GET /api/analytics/rounds/:roundId

Requires auth, role `organiser` (of the round's olympiad). Returns full analytics for a round: participation, score statistics and distribution, per-question performance and a per-school breakdown.

**Response (200):**
```json
{
  "round": { "id": "string", "name": "Round 1", "maxScore": 60 },
  "participation": {
    "totalEntrants": 45,
    "completedSubmissions": 38,
    "completionRate": 0.84
  },
  "scores": {
    "average": 62.4,
    "median": 65,
    "min": 12,
    "max": 98,
    "distribution": [
      { "range": "0-6", "percentage": 0, "count": 1 }
    ]
  },
  "timing": {
    "averageCompletionMinutes": 0,
    "minCompletionMinutes": 0,
    "maxCompletionMinutes": 0
  },
  "questions": [
    {
      "id": "string",
      "number": 1,
      "text": "string (first 100 characters…)",
      "maxMarks": 10,
      "averageScore": 62.4,
      "difficulty": 0.71
    }
  ],
  "schools": [
    {
      "id": "string",
      "name": "Parktown High",
      "entrants": 12,
      "completed": 10,
      "totalScore": 620,
      "averageScore": 62,
      "completionRate": 0.83
    }
  ]
}
```

Notes:

- `distribution` is a 10-bin histogram spanning 0 to the paper's total marks.
- `difficulty` is the question's stored success rate (0.0–1.0); `null` when there is no data yet. It is recalculated at round close and on results release.
- Per-question `averageScore` currently uses the overall result score as a proxy — per-question breakdown scores are not parsed yet.
- Timing metrics are placeholders (always `0`): submissions don't record a linked sitting start time, so completion duration can't be computed reliably.

**Errors:** `403` not an organiser of this olympiad, `404` round not found or user not found.

---

### GET /api/analytics/rounds/:roundId/schools/:schoolId

Requires auth. Organisers (of the round's olympiad) can view any school; educators are restricted to their own school. Returns the same analytics shape as the round endpoint, scoped to one school — without `timing` and `schools`, plus a `school` block.

**Response (200):** as above, with:
```json
"school": { "id": "string", "name": "Parktown High" }
```

**Errors:** `403` educator requesting a school other than their own, `404` round not found or user not found.

---

## Activity Stream

A real-time feed of portal activity for the organiser dashboard, delivered over Server-Sent Events (SSE). Route handlers and the round scheduler broadcast events through an in-process pub/sub bus; every connected organiser receives them live.

### GET /api/activity/stream

Requires auth, role `organiser`. Opens a persistent `text/event-stream` connection. Because `EventSource` cannot set `Authorization` headers, the session token is passed as a query parameter — `GET /api/activity/stream?token=<token>` — and app-level middleware promotes it to a Bearer header before the standard auth chain runs.

**Stream protocol:**

- On connect the server sends `retry: 5000` (how long `EventSource` waits before reconnecting), then a named `history` event carrying up to 30 recent events, newest first — a dropped connection never loses more than the seconds it was down.
- Every new event is broadcast as an unnamed `data` frame.
- A `: ping` comment heartbeat is written every 25 seconds to keep idle connections alive through proxies.

**Event shape:**
```json
{
  "id": "string",
  "type": "sitting_submitted",
  "message": "Alice Nkosi submitted for Round 1",
  "olympiadId": "string | null",
  "roundId": "string | null",
  "schoolId": "string | null",
  "createdAt": "ISO date"
}
```

Known event types: `round_opened`, `round_closed`, `auto_advanced`, `sitting_submitted`, `submission_received`, `marking_completed`, `results_released`, `access_request_decided`.

**Errors:** `403` not an organiser.

---

## Results Management

### POST /api/rounds/:id/release-results

Requires auth, role `educator`. Releases all automarked results for a closed round so students can view them. Sets `releasedAt` on every result that doesn't have it yet, and transitions the round state to `released`.

**Response (200):**
```json
{ "releasedCount": 12, "round": { "id": "string", "state": "released" } }
```

**Errors:** `403` round is not `closed`, `404` round not found.

---

### POST /api/rounds/:id/unrelease-results

Requires auth, role `educator`. Hides all released results for a round so students can no longer view them. Clears `releasedAt` on every result. If the round was in `released` state it reverts to `closed`.

**Response (200):**
```json
{ "unreleasedCount": 12, "round": { "id": "string", "state": "closed" } }
```

**Errors:** `404` round not found.

---

## Marking

The marking workflow lets organisers manually review submissions that go beyond MCQ automarking. Tasks progress through states: `unassigned` → `assigned` → `marked` → `moderated`.

### GET /api/marking/queue

Requires auth, role `organiser`. Lists marking tasks for olympiads the caller organises. Defaults to `unassigned` tasks; pass `?status=assigned`, `?status=marked`, `?status=moderated`, or `?status=all` to filter.

**Response (200):**
```json
[
  {
    "id": "string",
    "status": "unassigned",
    "submission": {
      "id": "string",
      "entrant": { "id": "string", "name": "Alice Nkosi" },
      "round": { "id": "string", "name": "Round 1" }
    },
    "assignedTo": { "id": "string", "name": "Organiser One" } | null,
    "score": null,
    "breakdown": null,
    "moderatedScore": null,
    "createdAt": "ISO date"
  }
]
```

**Errors:** `403` not an organiser.

---

### PATCH /api/marking/:id/assign

Requires auth, role `organiser`. Assigns a marking task to an organiser. If `assignedToId` is omitted, the task is assigned to the requester.

**Body:**
```json
{ "assignedToId": "string" }
```

**Response (200):** the updated marking task with `status: "assigned"`.

**Errors:** `400` assignedToId does not match a known user, `403` not a organiser of this olympiad, `404` task not found.

---

### PATCH /api/marking/:id

Requires auth, role `organiser`. Records the marker's score for a task, with optional per-question breakdown for partial credit. Transitions the task to `marked`.

**Body:**
```json
{ "score": 75, "breakdown": { "q1": 10, "q2": 8, "q3": 7 } }
```

`score` (number, required) is the percentage score. `breakdown` (optional) is a per-question score map.

**Response (200):** the updated marking task with `status: "marked"`.

**Errors:** `400` score is missing or not a number, `403` not a organiser of this olympiad, `404` task not found.

---

### PATCH /api/marking/:id/moderate

Requires auth, role `organiser`. Records a moderator's reviewed score for an already-marked task, separate from the original marker's score. Transitions the task to `moderated`.

**Body:**
```json
{ "moderatedScore": 80 }
```

**Response (200):** the updated marking task with `status: "moderated"`.

**Errors:** `400` moderatedScore is missing or not a number, `403` task is not in `marked` status or caller is not a organiser of this olympiad, `404` task not found.

---

## Remark / Appeals

Educators can request a remark on a submission; organisers review and approve or reject the appeal. When approved, the result score is updated and qualification is re-evaluated atomically.

### POST /api/submissions/:id/remark

Requires auth, role `educator`. Creates a remark request for a marked submission.

**Body:**
```json
{ "reason": "Marker appears to have missed question 3" }
```

**Response (201):**
```json
{
  "id": "string",
  "submissionId": "string",
  "requestedById": "string",
  "reason": "Marker appears to have missed question 3",
  "status": "pending",
  "createdAt": "ISO date"
}
```

**Errors:** `400` reason is missing or submission has not been marked, `404` submission not found, `409` a remark request is already active for this submission.

---

### GET /api/remark/queue

Requires auth, role `organiser`. Lists remark requests for olympiads the caller organises. Defaults to `pending` requests; pass `?status=assigned`, `?status=approved`, `?status=rejected`, or `?status=all`. Use `?assignedTo=me` to see only the caller's assigned work.

**Response (200):**
```json
[
  {
    "id": "string",
    "status": "pending",
    "reason": "Marker appears to have missed question 3",
    "submission": {
      "id": "string",
      "entrant": { "id": "string", "name": "Alice Nkosi" },
      "round": { "id": "string", "name": "Round 1" },
      "result": { "id": "string", "score": 66.67 }
    },
    "requestedBy": { "id": "string", "name": "Ms Teacher", "email": "teacher@school.com" },
    "assignedTo": null,
    "reviewedBy": null,
    "newScore": null,
    "reviewNotes": null,
    "createdAt": "ISO date"
  }
]
```

**Errors:** `403` not an organiser.

---

### PATCH /api/remark/:id/assign

Requires auth, role `organiser`. Routes a pending remark request to a reviewer. If `assignedToId` is omitted, the requester is assigned.

**Body:**
```json
{ "assignedToId": "string" }
```

**Response (200):** the updated remark request with `status: "assigned"`.

**Errors:** `400` assignedToId does not match a known organiser, `403` caller is not an organiser of this olympiad, `404` request not found, `409` request is not in `pending` status.

---

### PATCH /api/remark/:id/review

Requires auth, role `organiser`. The assigned reviewer approves or rejects a remark request. When approved, the result score is updated and qualification-based advancement is re-evaluated atomically inside the same transaction.

**Body:**
```json
{ "status": "approved", "newScore": 80, "reviewNotes": "Question 3 was indeed missed" }
```

`status` must be `"approved"` or `"rejected"`. `newScore` (0–100) is required when approving. `reviewNotes` is optional.

**Response (200):** the updated remark request.

**Errors:** `400` invalid status or newScore out of range, `403` request is assigned to a different reviewer, `404` request not found, `409` request is not in `assigned` status.

---

## Co-Organisers

Olympiad creators can add other organisers as co-organisers to share management responsibilities. Co-organisers have the same permissions as the creator within the scope of that olympiad.

### GET /api/organisers

Requires auth, role `organiser`. Lists all users with role `organiser` — used by the "Add organiser" dropdown.

**Response (200):**
```json
[
  { "id": "string", "name": "Organiser One", "email": "org@example.com" }
]
```

---

### GET /api/olympiads/:id/organisers

Requires auth, role `organiser`. Lists all organisers (creator + co-organisers) for an olympiad.

**Response (200):**
```json
[
  {
    "id": "string",
    "organiserId": "string",
    "name": "Organiser One",
    "email": "org@example.com",
    "addedAt": "ISO date",
    "isCreator": true
  }
]
```

**Errors:** `403` caller is not an organiser of this olympiad.

---

### POST /api/olympiads/:id/organisers

Requires auth, role `organiser`. Adds a co-organiser to an olympiad.

**Body:**
```json
{ "organiserId": "string" }
```

**Response (201):**
```json
{
  "id": "string",
  "organiserId": "string",
  "name": "Co-organiser Name",
  "email": "co@example.com",
  "addedAt": "ISO date",
  "isCreator": false
}
```

**Errors:** `400` organiserId is missing or target user is not an organiser, `403` caller is not an organiser of this olympiad, `404` olympiad or user not found, `409` user is already an organiser of this olympiad.

---

### DELETE /api/olympiads/:id/organisers/:organiserId

Requires auth, role `organiser`. Removes a co-organiser from an olympiad. The creator cannot be removed.

**Response (204):** No content.

**Errors:** `403` caller is not an organiser of this olympiad, or the target is the creator, `404` olympiad or organiser not found.

---

## Audit Log & Replay

### GET /api/rounds/:id/audit-log

Requires auth. Returns the raw audit log entries for a round, newest first. Available to organisers and educators who have access to the olympiad.

**Response (200):**
```json
[
  {
    "id": "string",
    "action": "round_opened",
    "timestamp": "ISO date",
    "roundId": "string",
    "payload": {}
  }
]
```

Known action types: `round_opened`, `round_closed`, `auto_advanced`, `notification_sent`.

**Errors:** `403` not authorized, `404` round not found.

---

### GET /api/rounds/:id/replay

Requires auth. Returns the round's audit log as a chronological timeline enriched with human-readable summaries — useful for organisers reviewing what happened during a round's lifecycle.

**Response (200):**
```json
{
  "round": {
    "id": "string",
    "name": "Round 1",
    "olympiadName": "Wits Maths Olympiad",
    "state": "closed",
    "openTime": "ISO date",
    "closeTime": "ISO date"
  },
  "timeline": [
    {
      "id": "string",
      "action": "round_opened",
      "timestamp": "ISO date",
      "roundId": "string",
      "payload": {},
      "summary": "Round opened at 2026-09-15T08:00:00.000Z"
    }
  ]
}
```

**Errors:** `403` not authorized, `404` round not found.

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
