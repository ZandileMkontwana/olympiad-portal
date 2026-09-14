---
sidebar_position: 7
---

# Sprint 2 Planning (25 August)

## Sprint Goal

Finish the basic tier and start the intermediate tier: past papers become downloadable after release, students can sit a paper online (not just on paper), and marking begins to go beyond MCQ automarking.

## Dates

26 August – 15 September 2026. Sprint board and stories live on Taiga.

## Scope

**In scope for Sprint 2 (from the [roadmap](../roadmap.md)):**

- Past-paper archive, downloadable once released
- Organiser console and educator portal UI polish
- Online sitting: timer, autosave, resume-on-disconnect, submission (stories A2–A5)
- Marking beyond MCQ: moderation queue, partial credit
- Qualifying-threshold round advancement

**Out of scope:** notifications, standings and certificates, student login (D3 — Clerk-account ↔ entrant linking), concurrency hardening, question banks, appeals — all Sprint 3+.

## Team & Task Ownership

| Person | Owns |
|---|---|
| Zandile | Paper archive (merged, PR #71), online sitting A2/A3 (in review), sitting submission A5 |
| Mlungisi | to be confirmed (Taiga) |
| Ronie | to be confirmed (Taiga) |
| Kutloano | to be confirmed (Taiga) |

Remaining ownership (moderation queue, partial credit, round advancement, UI polish) to be confirmed against the Taiga stories — update this table once assigned.

## Progress Checkpoint (2 September)

- Paper archive: done and merged (PR #71)
- Online sitting A2/A3 (start, resume, autosave, expiry enforcement): implemented, PR open
- Sitting submission (A5): not started — next up
- Moderation queue / partial credit: not started
- Qualifying-threshold advancement: not started
- UI polish: organiser dashboard redesigned (olympiad-first hierarchy); educator portal polish not started

## Definition of Done (per feature)

A feature is considered done when:

- It works end-to-end against the live (not just local) database
- It's covered by an API reference entry (for backend work) or has been manually tested against a running backend (for frontend work)
- It's been through a reviewed Pull Request and merged to `main`
- Any schema or architecture change is reflected in the documentation site

## Sprint 2 Definition of Done (overall)

- Each of the five roadmap items is either delivered or explicitly descoped by team decision
- The documentation site reflects all new endpoints and any schema changes
- A version tag is cut at sprint close, per the [git methodology](../git-methodology.md)

## Known Risks / Open Items

- CI runners are still not running (carried over from Sprint 1) — PRs currently rely on approval alone
- Two roadmap items (marking beyond MCQ, round advancement) are unstarted with roughly two weeks left; descoping decisions should be made early rather than late
- A5 (sitting submission) is blocked on the A2/A3 PR being reviewed and merged
- Until D3 lands, any signed-in user can start a sitting for any registered entrant by selecting their name — accepted interim state, noted in code
