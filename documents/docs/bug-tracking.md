---
sidebar_position: 2
---

# Bug Tracking

Bugs are tracked in the repository's **Issues** on Gitea. A bug in a shared tracker beats a bug in a chat message — it can't be lost, it can be assigned, and its history (who found it, who fixed it, what verified the fix) stays attached to it.

## Filing a bug

Anyone on the team files an issue as soon as a defect is confirmed reproducible, labelled `bug`. A useful bug report contains:

- **Steps to reproduce** — the shortest sequence that triggers it
- **Expected vs actual** — what should happen, what happens
- **Environment** — local dev, the deployed Render/Vercel stack, or a test run
- **Severity** — see below

## Severity

Severity describes impact; it is agreed at triage and recorded on the issue with a Critical/Major/Minor label.

| Severity | Meaning |
| --- | --- |
| Critical | Wrong or unrecoverable marks, data loss — results cannot be trusted |
| Major | A feature is broken for some or all users, but a workaround exists |
| Minor | Broken edge case or cosmetic issue |

A Critical bug interrupts whatever story it was found in — it gets fixed before new feature work continues.

## Triage and status

New issues are triaged at standup. An issue's life in Gitea:

- **Open, unassigned** — filed, not yet triaged
- **Open, assigned** — someone owns the fix; the fix branch references the issue where practical (`fix/short-description`, per our [branch naming](./code_quality_tool.md))
- **Closed** — the fix is merged to `main`

An issue is not closed when the fix is written — it's closed when the fix is merged.

## Bugs and code changes

The issue is the record; the PR is the fix. Mentioning `#<issue>` in a commit message or PR description links the change on the issue's timeline — our history already does this habitually — and a closing keyword (`fixes #N`, `closes #N`, `resolves #N`) closes the issue automatically once the PR lands on `main`. Because direct pushes to `main` are branch-protected, every bug fix passes review and the CI lint-and-test jobs before its issue can close.

## Why the repo tracker

Bugs live next to the code they describe. The issue page collects every referencing commit, the fixing PR and its CI run, all one click from each other — and nothing needs synchronising between tools, because there is only one.
