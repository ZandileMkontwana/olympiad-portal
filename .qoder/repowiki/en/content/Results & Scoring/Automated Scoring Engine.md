# Automated Scoring Engine

<cite>
**Referenced Files in This Document**
- [index.js](file://backend/src/index.js)
- [scheduler.js](file://backend/src/scheduler.js)
- [submissions.js](file://backend/src/routes/submissions.js)
- [rounds.js](file://backend/src/routes/rounds.js)
- [email.js](file://backend/src/lib/email.js)
- [schema.prisma](file://backend/prisma/schema.prisma)
- [migration.sql](file://backend/prisma/migrations/20260811072329_add_memo_answers_to_paper/migration.sql)
- [papers page (frontend)](file://frontend/src/app/rounds/[id]/papers/page.js)
- [submit page (frontend)](file://frontend/src/app/educator/submit/page.js)
- [database-schema.md](file://documents/docs/database-schema.md)
</cite>

## Update Summary
**Changes Made**
- Enhanced submissions endpoint with immediate automarking functionality when memo answer keys exist
- Improved email functionality with better error handling and logging for SendGrid integration
- Updated scoring flow to calculate scores in real-time during submission processing
- Added comprehensive error handling for email delivery failures without blocking submission workflow

## Table of Contents
1. [Introduction](#introduction)
2. [Project Structure](#project-structure)
3. [Core Components](#core-components)
4. [Architecture Overview](#architecture-overview)
5. [Detailed Component Analysis](#detailed-component-analysis)
6. [Dependency Analysis](#dependency-analysis)
7. [Performance Considerations](#performance-considerations)
8. [Troubleshooting Guide](#troubleshooting-guide)
9. [Conclusion](#conclusion)
10. [Appendices](#appendices)

## Introduction
This document explains the automated scoring engine that compares student submissions against memo answer keys and computes scores in real-time. The system now features immediate automarking when memo answer keys are present, calculating scores instantly upon submission and creating results automatically. It covers:
- Real-time scoring triggered on submission when a memo answer key exists
- The exact match algorithm used to compare answers
- How results are stored and immediately available
- Enhanced email functionality with robust error handling for submission receipts
- Error handling for corrupted submissions, missing answer keys, and idempotency conflicts
- The scheduler's role in transitioning rounds to closed state

The system supports immediate automarking when an answer key is present; otherwise, submissions are accepted without an automatic score until manual marking or future automation is implemented.

## Project Structure
Key backend components involved in scoring and scheduling:
- API routes handle submission intake and immediate automarking
- Scheduler transitions round states based on open/close times
- Database schema defines Paper.memoAnswers, Submission.answers, and Result.score
- Enhanced email utility with improved error handling for SendGrid integration
- Frontend builds and submits answer keys and submissions with live score preview

```mermaid
graph TB
subgraph "Backend"
A["Express App<br/>index.js"]
B["Submissions Router<br/>routes/submissions.js"]
C["Scheduler<br/>scheduler.js"]
D["Enhanced Email Utility<br/>lib/email.js"]
E["Prisma Client<br/>prisma/schema.prisma"]
end
subgraph "Frontend"
F["Paper Upload & Answer Key Builder<br/>frontend/pages/papers"]
G["Bulk Submitter & Live Score Preview<br/>frontend/pages/submit"]
end
F --> A
G --> A
A --> B
B --> E
B --> D
A --> C
```

**Diagram sources**
- [index.js:1-43](file://backend/src/index.js#L1-L43)
- [submissions.js:1-93](file://backend/src/routes/submissions.js#L1-L93)
- [scheduler.js:1-29](file://backend/src/scheduler.js#L1-L29)
- [email.js:1-23](file://backend/src/lib/email.js#L1-L23)
- [schema.prisma:69-97](file://backend/prisma/schema.prisma#L69-L97)
- [papers page (frontend):49-79](file://frontend/src/app/rounds/[id]/papers/page.js#L49-L79)
- [submit page (frontend):130-138](file://frontend/src/app/educator/submit/page.js#L130-L138)

**Section sources**
- [index.js:1-43](file://backend/src/index.js#L1-L43)
- [schema.prisma:69-97](file://backend/prisma/schema.prisma#L69-L97)

## Core Components
- **Enhanced Submission Endpoint**: validates input, persists the submission, performs immediate automarking if a memo answer key exists, and sends receipt emails with improved error handling
- **Scheduler**: periodically opens and closes rounds based on configured times
- **Improved Email Utility**: sends submission receipts to educators with robust error handling and logging for SendGrid integration
- **Data Models**: Paper.memoAnswers stores correct answers; Submission.answers stores student responses; Result.score stores computed percentage

**Updated** Immediate automarking functionality now processes scores in real-time during submission handling.

Scoring behavior:
- Exact match per question between submission.answers[questionId] and memoAnswers[questionId]
- Score = (number of exact matches / total number of questions in memoAnswers) × 100
- Results created immediately upon successful submission when memoAnswers exist
- If no memoAnswers exist, no automatic result is created but submission is still accepted

**Section sources**
- [submissions.js:32-59](file://backend/src/routes/submissions.js#L32-L59)
- [schema.prisma:69-97](file://backend/prisma/schema.prisma#L69-L97)
- [database-schema.md:116-117](file://documents/docs/database-schema.md#L116-L117)

## Architecture Overview
The enhanced scoring flow integrates immediate automarking with the submission lifecycle and scheduler:

```mermaid
sequenceDiagram
participant FE as "Frontend"
participant API as "Submissions Router"
participant DB as "Database"
participant Mail as "Enhanced Email Service"
participant SCH as "Scheduler"
FE->>API : POST /api/rounds/ : id/submissions {entrantId, answers, idempotencyKey}
API->>DB : Validate round and state
DB-->>API : Round + Paper.memoAnswers
alt Memo answer key present
API->>API : Immediate automark - Compare answers vs memoAnswers (exact match)
API->>DB : Create Result with score (%)
else No memo answer key
API->>DB : Create Submission only (no Result)
end
API->>Mail : Send submission receipt (with error handling)
Mail-->>API : Success/Failure logged
API-->>FE : {submission, result?}
Note over SCH,DB : Every 30s, scheduler updates round state
SCH->>DB : Update scheduled -> open (when openTime reached)
SCH->>DB : Update open -> closed (when closeTime reached)
```

**Diagram sources**
- [submissions.js:9-85](file://backend/src/routes/submissions.js#L9-L85)
- [scheduler.js:4-23](file://backend/src/scheduler.js#L4-L23)
- [email.js:5-19](file://backend/src/lib/email.js#L5-L19)
- [schema.prisma:18-29](file://backend/prisma/schema.prisma#L18-L29)

## Detailed Component Analysis

### Enhanced Submission Endpoint and Immediate Automark Logic
**Updated** The submission endpoint now includes immediate automarking functionality that calculates scores in real-time when memo answer keys are present.

- Validates required fields: entrantId, answers, idempotencyKey
- Ensures round exists and is in 'open' state before accepting submissions
- Persists submission with unique idempotencyKey to prevent duplicates
- **Immediate Automarking**: If Paper.memoAnswers exists:
  - Iterates all questions in memoAnswers
  - Counts exact matches where submission.answers[questionId] equals memoAnswers[questionId]
  - Computes score as percentage of correct answers
  - Creates a Result record linked to the submission immediately
- **Enhanced Email Functionality**: Sends a submission receipt email with improved error handling and logging
- Returns both submission and result data to frontend for live score display

```mermaid
flowchart TD
Start(["POST /rounds/:id/submissions"]) --> Validate["Validate required fields"]
Validate --> |Invalid| Err400["Return 400"]
Validate --> LoadRound["Load round + paper"]
LoadRound --> Found{"Round found?"}
Found --> |No| Err404["Return 404"]
Found --> |Yes| StateCheck{"State == 'open'?"}
StateCheck --> |No| Err403["Return 403"]
StateCheck --> Persist["Create Submission"]
Persist --> HasMemo{"memoAnswers present?"}
HasMemo --> |No| Receipt["Send receipt email (enhanced)"]
HasMemo --> |Yes| Score["Immediate Automark: Exact match count vs memoAnswers"]
Score --> Percent["score = (correct / total) * 100"]
Percent --> SaveResult["Create Result(score) immediately"]
SaveResult --> Receipt
Receipt --> Ok["Return 201 with submission + result"]
Err400 --> End(["Done"])
Err404 --> End
Err403 --> End
Ok --> End
```

**Diagram sources**
- [submissions.js:9-85](file://backend/src/routes/submissions.js#L9-L85)

**Section sources**
- [submissions.js:9-85](file://backend/src/routes/submissions.js#L9-L85)

### Enhanced Email Functionality with Robust Error Handling
**Updated** The email utility now includes comprehensive error handling and logging for SendGrid integration.

- Uses SendGrid (@sendgrid/mail) for reliable email delivery
- Implements try-catch blocks around email sending operations
- Logs successful email deliveries with recipient information
- Catches and logs email failures without blocking the submission workflow
- Maintains consistent email format with HTML and text versions
- Handles environment configuration for API keys and sender addresses

```mermaid
flowchart TD
EmailReq["sendSubmissionReceipt()"] --> BuildMsg["Build email message"]
BuildMsg --> TrySend["Try send via SendGrid"]
TrySend --> |Success| LogSuccess["Log success: 'Receipt email sent to [email]'"]
TrySend --> |Failure| LogError["Log error: 'Failed to send email: [message]'"]
LogSuccess --> Return["Return without throwing"]
LogError --> Return
```

**Diagram sources**
- [email.js:5-19](file://backend/src/lib/email.js#L5-L19)

**Section sources**
- [email.js:5-19](file://backend/src/lib/email.js#L5-L19)

### Scheduler and Round Lifecycle
- Runs every 30 seconds via cron
- Opens rounds whose openTime has passed (state: scheduled → open)
- Closes rounds whose closeTime has passed (state: open → closed)
- Logs counts when changes occur

Important note: In the current implementation, closing a round does not automatically trigger scoring of pending submissions. Scoring occurs at submission time when memoAnswers are available.

```mermaid
sequenceDiagram
participant Cron as "Cron"
participant Sch as "Scheduler"
participant DB as "Database"
Cron->>Sch : Tick every 30s
Sch->>DB : UpdateMany(state='scheduled', openTime <= now) -> set state='open'
Sch->>DB : UpdateMany(state='open', closeTime <= now) -> set state='closed'
Sch-->>Cron : Log opened/closed counts
```

**Diagram sources**
- [scheduler.js:4-23](file://backend/src/scheduler.js#L4-L23)

**Section sources**
- [scheduler.js:4-23](file://backend/src/scheduler.js#L4-L23)

### Data Models and Storage
- Paper.memoAnswers: JSON object mapping question identifiers to correct answers
- Submission.answers: JSON object mapping question identifiers to student answers
- Result.score: Float representing percentage score
- Result.releasedAt: Nullable timestamp controlling visibility of scores

```mermaid
erDiagram
PAPER {
string id PK
string roundId UK
string fileUrl
string memoUrl
datetime uploadedAt
json memoAnswers
}
SUBMISSION {
string id PK
string roundId
string entrantId
json answers
string idempotencyKey UK
datetime submittedAt
}
RESULT {
string id PK
string submissionId UK
float score
datetime releasedAt
}
PAPER ||--o{ ROUND : "linked by roundId"
SUBMISSION ||--o| RESULT : "has one"
```

**Diagram sources**
- [schema.prisma:69-97](file://backend/prisma/schema.prisma#L69-L97)

**Section sources**
- [schema.prisma:69-97](file://backend/prisma/schema.prisma#L69-L97)
- [migration.sql:1-2](file://backend/prisma/migrations/20260811072329_add_memo_answers_to_paper/migration.sql#L1-L2)
- [database-schema.md:116-117](file://documents/docs/database-schema.md#L116-L117)

### Frontend Integration with Live Score Preview
- Answer key builder constructs memoAnswers from user-entered rows and normalizes answers to uppercase
- **Enhanced Bulk Submitter**: computes live preview scores using the same exact-match logic as the backend and displays immediate results
- Submission payloads include entrantId, answers, and idempotencyKey
- Frontend handles both successful submissions with scores and cases without automatic scoring

```mermaid
flowchart TD
Build["Build memoAnswers from rows"] --> Normalize["Normalize answers to uppercase"]
Normalize --> Upload["Upload paper + memoAnswers"]
Bulk["Collect answers per entrant"] --> Submit["POST submissions with idempotencyKey"]
Submit --> Receive["Receive response with submission + result?"]
Receive --> Display["Display immediate score or 'pending' status"]
```

**Diagram sources**
- [papers page (frontend):49-79](file://frontend/src/app/rounds/[id]/papers/page.js#L49-L79)
- [submit page (frontend):130-138](file://frontend/src/app/educator/submit/page.js#L130-L138)

**Section sources**
- [papers page (frontend):49-79](file://frontend/src/app/rounds/[id]/papers/page.js#L49-L79)
- [submit page (frontend):130-138](file://frontend/src/app/educator/submit/page.js#L130-L138)

## Dependency Analysis
- Express app mounts routers and starts scheduler on boot
- Submissions router depends on Prisma client and enhanced email utility
- Scheduler depends on Prisma client and node-cron
- Frontend pages depend on backend APIs for paper upload and submission with immediate feedback

```mermaid
graph LR
Index["index.js"] --> Papers["routes/papers.js"]
Index --> Rounds["routes/rounds.js"]
Index --> Subs["routes/submissions.js"]
Index --> Auth["routes/auth.js"]
Index --> Sched["scheduler.js"]
Subs --> Prisma["prisma client"]
Subs --> Email["Enhanced lib/email.js"]
Sched --> Prisma
```

**Diagram sources**
- [index.js:1-43](file://backend/src/index.js#L1-L43)
- [submissions.js:1-93](file://backend/src/routes/submissions.js#L1-L93)
- [scheduler.js:1-29](file://backend/src/scheduler.js#L1-L29)
- [email.js:1-23](file://backend/src/lib/email.js#L1-L23)

**Section sources**
- [index.js:1-43](file://backend/src/index.js#L1-L43)

## Performance Considerations
- **Immediate scoring** is O(Q) per submission where Q is the number of questions in memoAnswers
- IdempotencyKey prevents duplicate writes and reduces redundant processing
- Real-time scoring provides instant feedback but may increase load during peak submission windows
- Enhanced email functionality uses non-blocking error handling to avoid impacting submission performance
- Consider indexing frequently queried fields (e.g., roundId, idempotencyKey) if needed

## Troubleshooting Guide
Common issues and how the system handles them:

- Missing required fields: Returns 400 with error message indicating required fields
- Round not found: Returns 404
- Round not open: Returns 403 with current state
- Duplicate submission: Unique constraint on idempotencyKey returns existing submission and result (idempotent behavior)
- Unexpected errors: Returns 500 with generic error message
- **Enhanced Email Failures**: Logged without blocking submission flow - email delivery issues don't prevent submissions from being processed
- **Automarking Errors**: Gracefully handled - if scoring fails, submission is still saved but no result is created

Error handling locations:
- Validation and state checks in submissions route
- Idempotency conflict handling
- **Enhanced email sending wrapped in try-catch with detailed logging**

**Section sources**
- [submissions.js:13-30](file://backend/src/routes/submissions.js#L13-L30)
- [submissions.js:75-85](file://backend/src/routes/submissions.js#L75-L85)
- [email.js:14-19](file://backend/src/lib/email.js#L14-L19)

## Conclusion
The enhanced automated scoring engine performs exact-match comparison between student submissions and memo answer keys at submission time with immediate automarking capabilities. Scores are calculated in real-time and stored in Result records, providing instant feedback to users. The scheduler manages round lifecycle transitions but does not currently trigger batch scoring upon closure. Robust error handling ensures resilience for common failure modes such as missing data, invalid states, duplicate submissions, and email delivery failures. The enhanced email functionality provides reliable submission receipts while maintaining system stability through comprehensive error handling and logging.

## Appendices

### Scoring Criteria and Formulas
- Exact match: submission.answers[questionId] must equal memoAnswers[questionId] exactly
- Total questions: number of entries in memoAnswers
- Score formula: score = (correctCount / totalQuestions) × 100
- If memoAnswers is absent or empty: no automatic result is created

Examples:
- 2-question memo with 1 correct answer → score = 50%
- 3-question memo with 0 correct answers → score = 0%
- 4-question memo with 4 correct answers → score = 100%

**Section sources**
- [submissions.js:40-52](file://backend/src/routes/submissions.js#L40-L52)
- [submit page (frontend):130-138](file://frontend/src/app/educator/submit/page.js#L130-L138)

### Grade Boundaries and Release Policy
- Results store a numeric percentage score
- Visibility control: Result.releasedAt remains unset until release; documentation indicates scores are not visible to schools early
- Actual release mechanism beyond storing releasedAt is not implemented in the examined code

**Section sources**
- [schema.prisma:91-97](file://backend/prisma/schema.prisma#L91-L97)
- [database-schema.md:116-117](file://documents/docs/database-schema.md#L116-L117)

### Scheduler Behavior Clarification
- The scheduler transitions rounds to 'closed' when closeTime is reached
- There is no automatic scoring job triggered by closure in the current implementation
- Scoring happens immediately upon submission when memoAnswers exist

**Section sources**
- [scheduler.js:4-23](file://backend/src/scheduler.js#L4-L23)
- [submissions.js:37-59](file://backend/src/routes/submissions.js#L37-L59)

### Enhanced Email System Details
**New Section** The email system now provides robust error handling and comprehensive logging for submission receipt emails.

- Uses SendGrid (@sendgrid/mail) for reliable email delivery
- Implements try-catch blocks around all email operations
- Logs successful deliveries with recipient email addresses
- Catches and logs failures with detailed error messages
- Non-blocking design ensures email failures don't impact submission processing
- Supports both HTML and plain text email formats
- Configurable sender address and API key via environment variables

**Section sources**
- [email.js:1-23](file://backend/src/lib/email.js#L1-L23)
- [email.test.js:1-85](file://backend/src/lib/email.test.js#L1-L85)