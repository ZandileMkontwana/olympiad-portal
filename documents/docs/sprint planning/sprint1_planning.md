---
sidebar_label: sprint1_planning
sidebar_position: 6
---

# Sprint 1 Planning

![Sprint 1 Planning Board](./Untitled-2026-08-23-1323.png)

## Sprint Goal

Deliver a working, demoable slice of the basic tier centered on the round lifecycle — the piece the brief identifies as the core the rest of the portal depends on — along with the foundational tooling, documentation, and infrastructure the course requires.

## Scope

**In scope for Sprint 1:**
- Round lifecycle: automatic `scheduled → open → closed` state transitions
- Organiser: create olympiads and rounds, upload papers
- Educator: register/login, view rounds, download papers when open, submit results for registered entrants
- MCQ automarking against a structured answer key
- All course-wide requirements: version control, CI/CD, responsive/accessible UI, hand-written API, auth via established library, external API integration, public documentation site

## Team & Task Ownership

| Person | Owns |
|---|---|
| Zandile | Database schema, round lifecycle scheduler, Round/Olympiad/Entrant API endpoints, backend deployment |
| Mlungisi | Paper upload/download, submissions, MCQ automarking, auth backend, external API integration |
| Ronie | Organiser console UI, landing/register/login pages, accessibility |
| Kutloano | Educator portal UI, role-based redirect logic, documentation site |

## Definition of Done (per feature)

A feature is considered done when:
- It works end-to-end against the live (not just local) database
- It's covered by an API reference entry (for backend work) or has been manually tested against a running backend (for frontend work)
- It's been through a reviewed Pull Request and merged to `main`
- Any schema or architecture change is reflected in the documentation site

## Sprint 1 Definition of Done (overall)

- All course-wide requirements demonstrably met
- Backend and documentation site deployed and publicly reachable
- Frontend deployed and pointed at the live backend
- All Sprint 1 rubric criteria have supporting evidence in the repo/docs (version control history, git methodology followed, documented tech stack, etc.)

## Known Risks / Open Items

- CI/CD pipeline is written but not yet running due to no available Gitea Actions runners — awaiting confirmation from the course on shared runner availability
