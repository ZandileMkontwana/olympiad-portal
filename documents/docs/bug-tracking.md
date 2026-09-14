---
sidebar_position: 2
---

# Bug Tracking

We track bugs where the rest of the sprint work already lives: in our **Taiga** project's Issues section. A bug in a shared tracker beats a bug in a chat message — it can't be lost, it can be assigned, and its history (who found it, who fixed it, what verified the fix) stays attached to it.

## Filing a bug

Anyone on the team files an issue in Taiga as soon as a defect is confirmed reproducible. A useful bug report contains:

- **Steps to reproduce** — the shortest sequence that triggers it
- **Expected vs actual** — what should happen, what happens
- **Environment** — local dev, the deployed Render/Vercel stack, or a test run
- **Severity** — see below

## Severity

Severity describes impact; triage sets it alongside priority.

| Severity | Meaning |
| --- | --- |
| Critical | Wrong or unrecoverable marks, data loss — results cannot be trusted |
| Major | A feature is broken for some or all users, but a workaround exists |
| Minor | Broken edge case or cosmetic issue |

A Critical bug interrupts whatever story it was found in — it gets fixed before new feature work continues.

## Triage and status

New issues are triaged at standup. The status flow is Taiga's default issue workflow:

- **New** — filed, not yet triaged
- **In progress** — someone is actively fixing it
- **Ready for test** — the fix is on a PR branch and needs review
- **Closed** — the fix is merged to `main`

**Needs info**, **Rejected** (not a bug, or by design) and **Postponed** (real, but not this sprint) are the side exits.

Anything that blocks the current sprint's demo becomes a task on the active sprint board; everything else waits in the backlog for sprint planning.

## Bugs and code changes

The issue is the record; the PR is the fix. Every bug-fix PR references its issue in the description or commit message so Taiga links the two, and an issue isn't closed when the fix is written — it's closed when the fix is merged.

## Why one tool

Bugs could live next to the code in Gitea's issue tracker, but the sprint board, backlog and bug list are used together during planning — splitting them across two tools means the planning conversation happens without the bugs in view. One tool, one place to look.
