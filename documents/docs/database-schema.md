---
sidebar_position: 3
---

# Database Schema

The database is PostgreSQL, hosted on Supabase — the choice of host and the reasoning are in the [Tech Stack](./tech-stack.md). `backend/prisma/schema.prisma` is the single source of truth: every model change becomes a timestamped SQL migration under `backend/prisma/migrations/`, reviewed in a pull request like any code change.

## Entity relationship diagram

```mermaid
erDiagram
  OLYMPIAD ||--o{ ROUND : has
  ROUND ||--o| PAPER : uses
  ROUND ||--o{ SUBMISSION : receives
  ROUND ||--o{ ROUNDENTRANT : has
  ROUND ||--o{ SITTING : has
  SCHOOL ||--o{ EDUCATOR : employs
  SCHOOL ||--o{ ENTRANT : registers
  USER ||--o| EDUCATOR : is
  ENTRANT ||--o{ SUBMISSION : makes
  ENTRANT ||--o{ ROUNDENTRANT : has
  ENTRANT ||--o{ SITTING : takes
  SUBMISSION ||--|| RESULT : produces
  USER |o--o| ENTRANT : "may be"
  ROUND ||--o{ NOTIFICATIONRULE : has
  ROUND ||--o{ NOTIFICATIONLOG : has
  ENTRANT |o--o{ NOTIFICATIONLOG : concerns

  OLYMPIAD {
    string id PK
    string name
    string timezone
  }
  ROUND {
    string id PK
    string olympiadId FK
    string name
    datetime openTime
    datetime closeTime
    string state
  }
  SCHOOL {
    string id PK
    string name
    string timezone
  }
  USER {
    string id PK
    string name
    string email
    string role
    string clerkUserId
  }
  EDUCATOR {
    string id PK
    string userId FK
    string schoolId FK
  }
  ENTRANT {
    string id PK
    string schoolId FK
    string name
    string grade
  }
  PAPER {
    string id PK
    string roundId FK
    string fileUrl
    string memoUrl
    json memoAnswers "optional"
  }
  SUBMISSION {
    string id PK
    string roundId FK
    string entrantId FK
    json answers
    string idempotencyKey
    datetime submittedAt
  }
  RESULT {
    string id PK
    string submissionId FK
    float score
    datetime releasedAt
  }
  ROUNDENTRANT {
    string id PK
    string roundId FK
    string entrantId FK
    datetime registeredAt
  }
  SITTING {
    string id PK
    string roundId FK
    string entrantId FK
    json answers "optional"
    datetime startedAt
    datetime expiresAt
    datetime completedAt "optional"
  }
  NOTIFICATIONRULE {
    string id PK
    string roundId FK
    string triggerType
    boolean enabled
    string recipientRole
    datetime createdAt
    datetime updatedAt
  }
  NOTIFICATIONLOG {
    string id PK
    string roundId FK
    string entrantId FK "optional"
    string triggerType
    string recipientEmail
    string status
    string error "optional"
    datetime sentAt
  }
```

## Tables

### Olympiad
Top-level competition. Has many rounds, each on its own schedule.

### Round
The core state machine: `scheduled → open → closed → released`, driven by a scheduler comparing the current time against `openTime`/`closeTime`. Everything else in the system depends on this table's state.

### School
A registered school competing in the olympiad. Has many educators and entrants.

### User
Login account for anyone — organiser, educator, or student. `name` is the user's display name, required at registration. Password handling goes through our auth library, not custom code. Public registration only ever creates `educator` accounts - organiser accounts are provisioned directly by the team.

### Educator
Links a `User` account to a `School`. Educators upload results on behalf of their entrants.

### Entrant
A competing student, registered against a school. An entrant may be linked to a `User` account so the student can sign in and see their own sittings and results — educators create entrant records before any student account exists, so the link (made through the claim-code flow at student registration) is optional.

### Paper
A round's uploaded test and memo. Download is gated by the round's current state — not accessible before `open`. `memoAnswers` stores the answer key as structured JSON (question number → correct answer), separate from the memo PDF, since automarking needs data it can read programmatically.

### Submission
An educator's results for their entrants. `idempotencyKey` prevents the same submission being recorded twice on retry.

### RoundEntrant
Tracks which entrants are registered to sit a specific round — required since the brief specifies entrants are put forward and registered against individual rounds, not just against the olympiad generally. A unique constraint on `(roundId, entrantId)` prevents duplicate registration. This table is what powers the "Submit Results" flow — an educator's submission page lists only entrants registered for that round.

### Sitting
An entrant's online test-taking session for a round — the online counterpart to sitting the paper physically. A unique constraint on `(roundId, entrantId)` enforces one sitting per entrant per round; requesting a sitting again returns the existing in-progress one, so a reconnect resumes where the student left off. `answers` holds the student's auto-saved work as they type, `expiresAt` mirrors the round's `closeTime`, and `completedAt` is set once the sitting is submitted.

### Result
The mark for a submission. `releasedAt` stays empty until the round closes, so scores aren't visible to schools early.

### NotificationRule
A per-round toggle for each of the four notification triggers (`before_open`, `before_close`, `missing_submission`, `results_released`). Organisers configure these per round from the organiser console; a unique constraint on `(roundId, triggerType)` keeps one rule per trigger per round. Absence of a rule means the trigger is **enabled** — rounds created before this feature existed keep behaving exactly as before, since the scheduler's enablement check treats a missing row as on.

`recipientRole` (`educator` | `organiser` | `all`) is stored for future targeting but does not yet filter recipients: nothing in the data model identifies which organiser owns a round, so every notification currently goes to educators.

### NotificationLog
The delivery record that makes each notification exactly-once per recipient. Before sending, the scheduler checks for a log row with the same `(roundId, triggerType, recipientEmail)` — the table's unique constraint — and skips if one exists. That is what stops a scheduler ticking every 30 seconds from re-sending the same reminder, and what makes re-running after a crash safe. `status` records `sent` or `failed` with the error message kept for debugging; `entrantId` is set only on `missing_submission` logs, to identify whose submission is missing.

## Deliberate omissions

**Certificates have no table.** A certificate is generated on the fly as a PDF (via `pdfkit`) from the entrant, round and released result each time `GET /api/rounds/:id/certificates/:entrantId` is called. Nothing about a certificate is stateful — the same inputs always produce the same document — so persisting it would add a stale-copy risk and storage cost for no benefit.

**Standings have no table either.** They are computed from `Result` rows on request, so a ranking can never disagree with the marks it summarises.