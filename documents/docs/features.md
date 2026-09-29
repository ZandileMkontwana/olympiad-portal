---
sidebar_position: 3
---

# Features

This page describes every user-facing feature of the Olympiad Portal, organised by role. The portal serves three user types: **organisers** (who create and manage olympiads), **educators** (who register students and submit results), and **students** (who sit tests and view results).

---

## Organiser Features

### Olympiad and Round Management

Organisers create olympiads and configure rounds within them. Each round has an open/close schedule, a qualifying threshold, and an optional prerequisite round.

- **Create olympiads** with a name and description.
- **Create rounds** within an olympiad, setting the open time, close time, qualifying threshold, and prerequisite round.
- **Upload papers and memos** — PDF files stored in Supabase Storage. Papers become downloadable by educators once released; memos are used for automarking.
- **View round status** — each round progresses through `scheduled → open → closed → released` states.
- **Release and unrelease results** — publishing results makes them visible to educators and students; unreleasing hides them again.
- **Configure notifications** — per-round rules for four trigger types: opening soon, closing soon, results released, and missing submission. Each rule specifies how far before the event the notification fires.

### Co-Organiser Access

An olympiad can have multiple organisers. The original creator can add other organisers, who then gain full access to manage the olympiad.

- **Add organisers** by searching for their email.
- **List current organisers** for an olympiad.
- **Remove organisers** — the original creator cannot be removed; added organisers can be removed by the creator.
- **Membership-based access control** — all olympiad-scoped routes check `OlympiadOrganiser` membership, so added organisers see the olympiad in their list and can manage it.

### Standings and Results

- **Live standings** — ranked list of all entrants for a round, sorted by score. Standings recalculate on every fetch from the live `Result` rows; no ranking is stored.
- **Per-school standings** — aggregate ranking of schools by average score across their entrants.
- **Release results** — makes scores visible to educators and students, and enables certificate generation.

### Marking Queue

For non-MCQ questions that require manual marking, organisers can manage a queue of marking tasks.

- **View the marking queue** — lists all marking tasks, filterable by status (unassigned, assigned, marked, moderated).
- **Assign marking tasks** to organisers or moderators.
- **Submit marks** for assigned tasks.
- **Moderate marking** — a senior organiser reviews and approves/rejects submitted marks.

### Appeals and Remarks

When educators disagree with a mark, they can request a remark. Organisers manage the appeals workflow.

- **View the remark queue** — lists all remark requests, filterable by status and assignment.
- **Assign appeals to reviewers** — route a pending appeal to an organiser who will decide it.
- **Review appeals** — approve (with a revised score) or reject. Approved appeals amend the result score and re-trigger qualification/auto-advance in a single transaction.

### Audit Log and Round Replay

Every automatic scheduler action is logged. Organisers can replay a round's history to see exactly what happened and when.

- **Audit log entries** — recorded for round opened, round closed, auto-advance processed, and notifications sent.
- **Round replay** — aggregates the audit log into a timeline view, showing the sequence of events for a round.

---

## Educator Features

### School and Student Management

Educators are linked to a school and manage students at that school.

- **Register students** — creates an entrant record and a student account, then emails the student an invitation to set their password. The student is auto-registered for open rounds of the specified olympiad (subject to qualification gates).
- **View student list** — shows all students at the school with their account status (active or invite pending).
- **Resend invitations** — for students who haven't activated, or who forgot their password.
- **Delete students** — removes the entrant record, student account, and all associated data (results, submissions, sittings, round registrations).

### School Dashboard

An aggregated view of the school's performance across all olympiads.

- **Entrant count and total submissions** — at-a-glance stats.
- **Per-student summaries** — name, grade, email, account status, submission count, average score, and the olympiads each student is registered under.

### Round Participation

- **View available rounds** — educators see rounds for olympiads their school has access to.
- **Submit results** — educators can submit results for their students' submissions (e.g., for offline papers or manually marked components).
- **View standings** — see how their students rank against others.
- **Download certificates** — PDF certificates for students who completed a released round, generated on demand with the student's name, score, school, and round details.

### School Access Requests

Schools must request access to an olympiad before their students can participate.

- **Request access** — sends a request to the olympiad organiser.
- **Access status** — `pending`, `approved`, or `rejected`. Students can only be registered for olympiads the school has approved access to.

---

## Student Features

### Student Authentication

Students authenticate separately from educators/organisers, using a claim-code system.

- **Invitation-based registration** — educators create student accounts and email an invitation link.
- **Set password** — students click the invitation link and set a password (stored as a bcrypt hash).
- **JWT sessions** — after login, students receive a JWT stored in `localStorage` (separate from the Clerk session used by educators/organisers).
- **Password reset** — educators can resend the invitation, which generates a fresh link for password reset.

### Online Sitting

Students can sit tests online with a timed, resilient session.

- **Start a sitting** — creates a timed session with an expiry (typically the round's close time or a fixed duration).
- **Autosave** — answers are periodically saved to the server while the student works, so progress is not lost.
- **Resume on disconnect** — if the browser closes or the network drops, the student can resume the sitting from where they left off (as long as the session hasn't expired).
- **Submit** — at the end, the student submits their answers. The submission is automarked against the memo (for MCQ questions) and a `Result` is created with the score.
- **Exactly-once semantics** — concurrent or retried submissions are handled idempotently; only one submission per sitting is counted.

### Student Dashboard

- **View available rounds** — shows open rounds with prerequisite gating info. Locked rounds display the unlock criteria (e.g., "Score at least 60% in Round 1 to unlock").
- **View sittings** — lists all sittings with round names, states, and expiry countdowns for in-progress sessions.
- **View results** — shows released results with scores. Unreleased marks stay hidden.
- **Review results** — for a released result, shows the student's answer alongside the correct answer for every question, with the paper PDF link.

### Round Progression

Students automatically advance to subsequent rounds when they meet the qualifying threshold.

- **Qualification gating** — a round with a prerequisite checks whether the student scored at least the threshold in the prerequisite round.
- **Auto-advance** — when results are released or an appeal is approved, the system re-evaluates qualification and registers eligible students for the next round.
- **Add-only advancement** — a raised score can newly register a student; a lowered score never unseats an already-advanced student (the next round may already be in progress).

---

## System Features

### Round Lifecycle Scheduler

The backend runs a cron scheduler that ticks every 30 seconds, comparing the current database time against each round's schedule.

- **Automatic state transitions** — rounds move from `scheduled` to `open` to `closed` based on their `openTime` and `closeTime`.
- **Auto-registration** — when a round opens, all entrants from schools with approved access are registered (subject to qualification gates).
- **Auto-advance** — when a round closes, entrants who met the qualifying threshold are registered for the next round.
- **Notification dispatch** — the scheduler fires emails for configured notification rules (opening soon, closing soon, results released, missing submission).
- **Exactly-once notification logging** — each notification is logged to `NotificationLog` to prevent duplicates.

### Multi-Olympiad Support

Multiple olympiads can run concurrently, each with its own timezone and independent round schedule.

- **Timezone-aware scheduling** — each olympiad stores its timezone; the scheduler compares in UTC; the frontend renders times in the viewer's or olympiad's timezone.
- **Data isolation** — all olympiad-scoped queries enforce membership/access checks to prevent cross-olympiad data leakage.

### Concurrency and Data Integrity

The system is designed to handle concurrent access correctly, particularly around round boundaries.

- **Transaction-wrapped round-state re-checks** — submissions and sitting creation re-check the round state inside a database transaction, so a round that closes between the application check and the database write is caught.
- **Idempotent submissions** — a unique `idempotencyKey` on each submission prevents duplicate processing. Concurrent retries return the original submission with a 200 instead of failing.
- **Guarded status transitions** — `updateMany` with a status condition ensures that concurrent state changes (e.g., two reviewers acting on the same appeal) result in exactly one winner and one 409 conflict.

### Automated Notifications

Emails are sent via SendGrid for round lifecycle events.

| Trigger | Recipient |
|---|---|
| Round opening soon (1 hour before) | Educators with registered entrants |
| Round closing soon (1 hour before) | Educators with registered entrants |
| Results newly released | Educators with registered entrants |
| Missing submission (round closed with no submission) | Educators with unsubmitted entrants |
| Student invitation to set password | Invited student |
| Submission receipt | Submitting educator |

All notifications are logged to `NotificationLog` for audit. Failures are logged but never block the calling operation.

### Certificate Generation

On-demand PDF certificates are generated for students who completed a released round.

- **Generated via PDFKit** — includes the student's name, score, school, round name, and olympiad name.
- **Access control** — only the student's own educator can download the certificate, and only after results are released.
- **Amendments after release** — if an appeal amends the score after the round is released, re-downloading the certificate includes the corrected score (the certificate is generated from live data, not cached).

### Past-Paper Archive

Educators and organisers can download past papers and memos once they are released.

- **Upload** — organisers upload paper and memo PDFs via the organiser console.
- **Download** — educators download papers from the archive page. Files are served from Supabase Storage via the backend (the frontend never talks to Supabase directly).
