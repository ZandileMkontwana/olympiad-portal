---
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

- Past-paper archive, downloadable once released
- Organiser console and educator portal UI polish
- Online sitting: timer, autosave, resume-on-disconnect
- Marking beyond MCQ: moderation queue, partial credit
- Qualifying-threshold round advancement

## Sprint 3 — Intermediate Finish + Start of Advanced

- Configurable notifications (reminders, results-out)
- Standings and certificates
- Student login and per-school dashboard
- Concurrency hardening at round open/close under load
- Idempotent submission handling (already partially in place via `idempotencyKey`)

## Sprint 4 — Advanced Tier

- Question banks with per-entrant variants and difficulty scoring
- Merged online/offline submission handling, duplicate-entrant detection
- Appeals flow (entrant → reviewer → outcome reflected in standings)
- Multi-olympiad support across timezones, sharing one paper archive
- Full audit log and round replay

## Why this order

The round lifecycle came first because every other basic-tier feature — paper access, submission windows, automarking timing — depends on a round's state being correct. Building marking, notifications, or standings before the lifecycle was solid would have meant building on an unstable foundation. Advanced-tier concurrency and multi-tenancy work is deliberately last, since it hardens and scales a system that needs to already work correctly at a small scale first.