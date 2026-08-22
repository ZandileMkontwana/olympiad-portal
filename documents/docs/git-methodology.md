---
sidebar_position: 2
---

# Git Methodology

This page documents the practices our team commits to following throughout the project. Documenting a methodology only counts for something if it's actually followed — this page is the reference we hold ourselves to, and any deviation from it should be a deliberate, discussed exception, not a default.

## When to commit
After each logically complete, working chunk — not time-based.

A good gut check: could you explain this commit's diff in one sentence? If it takes a paragraph, it's probably two commits. Committing by logical unit rather than by clock keeps history reviewable and makes it possible to revert one change without undoing unrelated work.

## How to write commits
[Conventional Commits](https://www.conventionalcommits.org/) format: `type(scope): description`

Common types we use: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`. The scope names the area touched (`backend`, `frontend`, `docs`) so a reader can tell what changed without opening the diff.

## When to branch
One branch per ticket/task, off `main`.

Branching at the level of a single ticket keeps each branch small enough to review quickly and merge often, avoiding the long-lived branches that tend to produce painful conflicts.

## How to name branches
`feature/short-description` (e.g. `feature/round-lifecycle-setup`), `fix/short-description` for bug fixes.

## When to merge
When the feature works and passes CI, via Pull Request — not direct pushes.

Direct pushes to `main` are blocked by branch protection, so this isn't just a guideline — it's enforced. Every change, including from any team member, goes through a reviewed PR.

## Requirements for merging
At least 1 approval + CI passing.

Requiring review means at least one other person understands and has checked every change before it lands on `main` — this is what turns "we use pull requests" from a formality into something that actually catches problems.

## When to version
At sprint boundaries (end of each sprint).

Tagging a version at each sprint's end gives a clean, referenceable snapshot of what existed at that milestone — useful for both grading checkpoints and for rolling back if something in a later sprint breaks core functionality.

## How to version
[Semantic Versioning](https://semver.org/) (`MAJOR.MINOR.PATCH`) via git tags, with a `CHANGELOG.md` tracking what changed in each version.

- **MAJOR** — breaking change
- **MINOR** — new feature, backward-compatible
- **PATCH** — bug fix, no new functionality