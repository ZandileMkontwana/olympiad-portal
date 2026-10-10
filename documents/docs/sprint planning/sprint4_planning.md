---
sidebar_label: sprint4_planning
sidebar_position: 8
---

# Sprint 4 Planning

- **Sprint:** Sprint 4 (final milestone sprint)
- **Dates:** 29 September 2026 – 10 October 2026
- **Participants:** Zandile, Kutloano, Ronie, Mlungisi

## Sprint Goal

Close out the advanced tier and ship six differentiating standout features, each delivered end-to-end with tests and documentation, validated by a full QA sweep against the deployed production stack — a polished, demoable portal for Milestone 4.

## Planning Inputs

- Sprint 3 retrospective action items: batch related work, use checklists for large multi-file features, add integration checkpoints to cross-layer stories, and document deployment issues as they're solved
- The rubric lesson from Sprint 3 planning: aim at the "Advanced" column on every criterion, prioritising depth over breadth — a smaller set implemented solidly with tests scores better than attempting everything with bugs
- With the basic and intermediate tiers and most advanced-tier items already delivered, the ~12 days of remaining capacity went to standout features chosen for demo impact vs feasibility

## Sprint Objectives

- Question banks with per-entrant question variants and difficulty scoring
- Analytics dashboards for organisers and educators
- Duplicate-entrant detection and anti-cheating signals
- Account-deletion UI, client-side 503 retry, and session persistence
- Responsive layout, WCAG 2.1 AA accessibility, dark mode, and a first-user onboarding tour
- Real-time activity feed, branded transactional emails, production demo data, a load-test re-run, a full QA sweep, and a documentation update

## Standout Features

Six standout features were selected at planning and attached to the role whose existing load shares the same skill domain:

| Standout feature | Owner | Paired with |
|---|---|---|
| Analytics dashboards | Kutloano | Question bank (data-heavy organiser UI) |
| Anti-cheating signals | Ronie | Duplicate-entrant detection (detection logic) |
| Real-time activity feed (SSE) | Zandile | Notifications and infrastructure |
| Branded email templates | Zandile | Notifications and infrastructure |
| Dark mode | Mlungisi | Responsive and accessibility work |
| Onboarding tour | Mlungisi | Responsive and accessibility work |

The activity feed was scoped to Server-Sent Events rather than WebSockets to avoid new connection infrastructure for a one-directional feed.

## Team Responsibilities

**Zandile — Activity Feed, Email Branding, Seeding, Load Testing, QA & Documentation (US-4.1–US-4.6)**
- Real-time organiser activity feed over Server-Sent Events, with broadcasts from round transitions, submissions, marking and access decisions
- Brand all transactional SendGrid emails with the portal identity
- Seed realistic production demo data for the whole team to test and demo against
- Re-run the load tests (boundary scripts and main harness) and close the deployed-run gap left open in September
- Run the full QA sweep: automated suites with coverage, CI-equivalent lint, production API UAT, a deployed student journey, and a browser pass
- Update the documentation site for all Sprint 4 features; maintain the sprint board, standup minutes and the retrospective

**Kutloano — Question Bank, Variants & Analytics (US-1.1–US-1.5)**
- Question bank management for organisers, scoped per olympiad
- Per-entrant question variants, assigned deterministically at sitting start
- Difficulty scoring and weighted automarking
- Organiser analytics dashboard (participation, score distributions, round trends)
- Educator analytics dashboard (school-level performance)

**Ronie — Duplicate Detection, Anti-Cheating & Account Hardening (US-2.1–US-2.5)**
- Duplicate-entrant detection on registration and import
- Anti-cheating signals recorded against sittings, surfaced for organiser review
- Account-deletion UI over the existing deletion endpoints
- Client-side 503 retry honouring `Retry-After` (the #202 contract)
- Session persistence for student sessions across refresh and reconnect

**Mlungisi — Responsive, Accessibility, Dark Mode & Onboarding (US-3.1–US-3.4)**
- Responsive layout verified at 320/768/1024 px across all pages
- WCAG 2.1 AA accessibility with a Lighthouse audit
- Dark mode via CSS variables, persisted preference, and system default
- First-user onboarding tour for educators and organisers

## User Stories

Formalised with acceptance criteria (serving as user acceptance tests) and task breakdowns in Taiga; bugs are tracked as Gitea issues per team policy.

| Story | Title | Owner |
|---|---|---|
| US-1.1 | Question bank management | Kutloano |
| US-1.2 | Per-entrant variant assignment | Kutloano |
| US-1.3 | Difficulty scoring and weighted automarking | Kutloano |
| US-1.4 | Organiser analytics dashboard | Kutloano |
| US-1.5 | Educator analytics dashboard | Kutloano |
| US-2.1 | Duplicate-entrant detection | Ronie |
| US-2.2 | Anti-cheating signals | Ronie |
| US-2.3 | Account-deletion UI | Ronie |
| US-2.4 | 503 retry with Retry-After | Ronie |
| US-2.5 | Session persistence | Ronie |
| US-3.1 | Responsive layout at 320/768/1024 | Mlungisi |
| US-3.2 | Accessibility compliance (WCAG 2.1 AA) | Mlungisi |
| US-3.3 | Dark mode with persisted preference | Mlungisi |
| US-3.4 | First-user onboarding tour | Mlungisi |
| US-4.1 | Real-time activity feed (SSE) | Zandile |
| US-4.2 | Branded email templates | Zandile |
| US-4.3 | Production data seeding | Zandile |
| US-4.4 | Load-test re-run | Zandile |
| US-4.5 | Full QA sweep | Zandile |
| US-4.6 | Documentation update | Zandile |

The advanced-tier roadmap item "merged online/offline submission handling" folds into US-2.1, where offline and online submissions for the same entrant meet the duplicate check.

## Sprint Deliverables

By the end of Sprint 4, the team aims to have:

- Question banks with variants and difficulty scoring feeding the sitting chain
- Organiser and educator analytics dashboards
- Duplicate-entrant detection and anti-cheating signals
- Account-deletion UI, 503 retry, and session persistence
- A responsive, accessible portal with dark mode and an onboarding tour
- A live organiser activity feed and branded transactional emails
- Production demo data, refreshed load-test results, a completed QA sweep, and updated documentation

## Definition of Done

A story is complete when it has been implemented, integrated with the existing system, tested (both suites green and coverage thresholds met), lint-clean, merged to `main` through a reviewed pull request, documented on the docs site, and — for user-facing features — verified end-to-end on the deployed stack.

## Known Risks / Open Items

- The question bank touches the shared sitting/submission chain — the highest integration risk this sprint; schema agreement was pulled forward to the first days
- The shared Supabase pooler caps load-test concurrency at roughly 10, and boundary-script setups must batch fixture creation rather than fan out parallel creates
- Render free-tier cold starts (~30 s) require warming the service before any deployed load or QA run
- Only ~12 days of capacity: standout features were chosen for demo impact vs feasibility, and depth wins over breadth per the Sprint 3 lesson
