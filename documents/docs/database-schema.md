---
sidebar_position: 3
---

# Database Schema

## Entity relationship diagram

```mermaid
erDiagram
  OLYMPIAD ||--o{ ROUND : has
  ROUND ||--o| PAPER : uses
  ROUND ||--o{ SUBMISSION : receives
  SCHOOL ||--o{ EDUCATOR : employs
  SCHOOL ||--o{ ENTRANT : registers
  USER ||--o| EDUCATOR : is
  ENTRANT ||--o{ SUBMISSION : makes
  SUBMISSION ||--|| RESULT : produces

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
    string email
    string passwordHash
    string role
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
```

## Tables

### Olympiad
Top-level competition. Has many rounds, each on its own schedule.

### Round
The core state machine: `scheduled → open → closed → released`, driven by a scheduler comparing the current time against `openTime`/`closeTime`. Everything else in the system depends on this table's state.

### School
A registered school competing in the olympiad. Has many educators and entrants.

### User
Login account for anyone — organiser, educator, or student. Password handling goes through our auth library, not custom code.

### Educator
Links a `User` account to a `School`. Educators upload results on behalf of their entrants.

### Entrant
A competing student, registered against a school.

### Paper
A round's uploaded test and memo. Download is gated by the round's current state — not accessible before `open`.

### Submission
An educator's results for their entrants. `idempotencyKey` prevents the same submission being recorded twice on retry.

### Result
The mark for a submission. `releasedAt` stays empty until the round closes, so scores aren't visible to schools early.