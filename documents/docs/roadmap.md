---
sidebar_label: roadmap
sidebar_position: 5
---

# Roadmap

Our plan follows the brief's basic → intermediate → advanced tiers, with each sprint building a working, demoable slice rather than partial progress across many features at once.

## Sprint 1 — Foundations & Round Lifecycle Core 

The focus of Sprint 1 is the piece the brief identifies as the core of the entire portal: a round that opens and closes itself on schedule, with everything else built around that.

**Delivered:**
- Repo, documentation site, and work tracker set up
- Full database schema (Olympiad, Round, School, User, Educator, Entrant, Paper, Submission, Result, RoundEntrant)
- Round lifecycle scheduler — automatic `scheduled → open → closed` transitions, verified live
- Organiser and Round/Olympiad API endpoints (create, read, list)
- Entrant registration per round (`RoundEntrant`)
- MCQ automarking data model (`memoAnswers`)
- Backend deployed to Railway, documentation deployed to Netlify
- Auth backend (register/login, role-based) in progress
- Frontend deployed on vercel


## Sprint 2 — Rest of Basic Tier + Start of Intermediate

The focus of Sprint 2 was the online test-taking journey end to end — start a timed sitting, autosave, resume after a disconnect, submit with automarking — plus the notifications, standings and dashboard features around it.

**Delivered:**
- Past-paper archive, downloadable once released
- Organiser console and educator portal UI polish
- Online sitting: timed sessions, autosave, resume-on-disconnect, submission with automarking
- Configurable notifications: per-round rules for four trigger types, SendGrid delivery, exactly-once logging
- Standings and per-school rankings
- Certificates, generated on request as PDFs
- Student login (claim-code account ↔ entrant linking) and student/school dashboards
- Backend on Render with the database on Supabase, and CI running lint plus both test suites on every push and PR

**Descoped to Sprint 3 (team decision at sprint close):**
- Marking beyond MCQ — moderation queue, partial credit and remark requests. Sprint capacity went to the online-sitting chain and the notification/standings/dashboard cluster; MCQ automarking already covers the basic tier's marking requirement.
- Qualifying-threshold round advancement — it depends on marks being final, which depends on the marking work above, so it moves with it.

## Sprint 3 — Intermediate Finish + Advanced Start

The focus of Sprint 3 was completing the intermediate-tier features carried over from Sprint 2, plus starting on advanced-tier capabilities.

**Delivered:**
- Marking beyond MCQ: moderation queue, manual marking task assignment, score submission, and moderator review
- Qualifying-threshold round advancement: entrants who meet the threshold are automatically registered for the next round
- Appeals and reviewer workflow: educators can request remarking, organisers assign reviewers, approved appeals amend scores and re-trigger qualification in a single transaction
- Concurrency hardening at round open/close: transaction-wrapped round-state re-checks, exactly-once submission handling under concurrent load, idempotent sitting creation
- Multi-olympiad support with timezone-aware scheduling: each olympiad stores its own timezone, the scheduler compares in UTC, the frontend renders in the viewer's or olympiad's timezone
- Co-organiser access: `OlympiadOrganiser` join table, membership-based access control replacing single-organiser checks, add/list/remove organiser UI
- Audit log and round replay: every automatic scheduler action is logged, organisers can replay a round's history as a timeline
- Load testing: concurrent boundary tests for submissions and sitting starts at round transitions

## Sprint 4 — Advanced Tier

- Question banks with per-entrant variants and difficulty scoring
- Merged online/offline submission handling, duplicate-entrant detection

## Why this order

The round lifecycle came first because every other basic-tier feature — paper access, submission windows, automarking timing — depends on a round's state being correct. Building marking, notifications, or standings before the lifecycle was solid would have meant building on an unstable foundation. Advanced-tier concurrency and multi-tenancy work is deliberately last, since it hardens and scales a system that needs to already work correctly at a small scale first.