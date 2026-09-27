---
sidebar_position: 8
---

# Appeals Workflow

An appeal is a formal request to re-check the marking of a submission. This page documents the full lifecycle — who may act at each step, what a decision changes, how revised scores flow back into qualification and standings, and the edge cases the implementation deliberately handles.

## States

```
pending ──assign──▶ assigned ──review──▶ approved   (score amended, qualification re-run)
   │                   │
   └───────────────────┴──────────────▶ rejected   (nothing changes)
```

| State | Meaning |
|---|---|
| `pending` | An educator has raised the appeal; no reviewer has been routed to it yet. |
| `assigned` | An organiser reviewer is responsible for deciding it. |
| `approved` | The appeal was upheld with a new score (`newScore`, 0–100). |
| `rejected` | The original marking stands; no data is touched. |

## Permissions

| Action | Endpoint | Who |
|---|---|---|
| Raise an appeal | `POST /api/submissions/:id/remark` | An **educator** (the submission must have been marked; at most one `pending`/`assigned` appeal per submission). |
| List the review queue | `GET /api/remark/queue` | An **organiser** — sees appeals they own plus appeals assigned to them. `?assignedTo=me` returns assigned work, `?status=all` includes resolved appeals. |
| Route an appeal to a reviewer | `PATCH /api/remark/:id/assign` | Only the organiser who **owns the olympiad**. Defaults to assigning themselves; any other assignee must also hold the organiser role. |
| Decide an appeal | `PATCH /api/remark/:id/review` | Only the **assigned reviewer** (`status` must be `approved` or `rejected`). |

All three endpoints run behind `requireRole('organiser')`; the review decision additionally requires `newScore` to be a finite number within **0–100** when approving.

## What an approval changes

1. **The result is amended in place.** `Result.score` is the single canonical source for live standings, on-demand certificate PDFs, statutory progress checks and every qualification gate — so the decision is wired straight into it with an upsert (`newScore` also lands on the appeal record for audit).
2. **Qualification and auto-advance re-run immediately.** See the next section.
3. **Standings recalculate on the next fetch.** No ranking is stored anywhere — the standings endpoints rank the live `Result` rows on every request, so the revised score and its new rank appear immediately.
4. **Published results stay published.** See "Appeals after publication".

## Qualification re-trigger (auto-advance)

Round qualification is computed from `Result.score >= Round.qualifyingThreshold`. When an approval revises a score, the same shared pass that the scheduler runs (`advanceQualifiedEntrantsForRound` in `backend/src/lib/qualification.js`) re-evaluates the source round:

- **Immediate, in-transaction.** The review route re-runs the pass inside the same transaction that amends the score, so no scheduler tick is required and no time window exists in which the revision is invisible.
- **Idempotent, never double-processing.** Registrations use `createMany` with `skipDuplicates` against the unique `(roundId, entrantId)` constraint. If a concurrent scheduler tick processes the same round, both passes queue the same rows and the database keeps exactly one. `autoAdvanceProcessedAt` is stamped in the same pass so the periodic sweep skips the round afterwards.
- **Add-only.** A raised score can newly register an entrant; a **lowered score never unseats** an entrant who was already advanced — the next round may already be in progress, so removals are left to the organiser.
- **No backfill into ended rounds.** If the inferred next round is no longer `scheduled` or `open`, nothing is registered (a late approval does not drop the entrant into an even later round, either) — the organiser handles that exceptional case manually.
- **Open rounds wait.** A round that has not closed yet is left to the scheduler sweep, which processes it after it closes with the revised score.

## Appeals after publication (released rounds / certificates)

**Defined behaviour: an upheld appeal amends the published score in place.** The upsert updates only `score` and preserves `Result.releasedAt`, so:

- the round **stays `released`** — nothing is unpublished and no re-release step is needed;
- **standings** reflect the revised mark on the next fetch;
- **certificate PDFs regenerate on demand** from the live result, so a re-download includes the corrected score (the round must be `released` and the result must exist — both remain true);
- **qualification re-runs exactly as for closed rounds** (the scheduler's sweep includes `released` rounds).

No notification emails are re-sent for the amendment; the appeal record itself is the audit trail. Blocking amendments after publication (e.g. requiring organisers to unrelease first) was rejected as a deliberate design choice: it would leave wrong marks on released results and force a destructive unpublish/re-publish cycle.

## Edge cases

| Case | Behaviour |
|---|---|
| Appeal raised before marking | Blocked at creation (`400`) — there is no score to appeal. |
| Second appeal after a resolved one | Allowed; creation only blocks while a `pending`/`assigned` appeal exists for the submission. |
| Two reviewers act concurrently | Guarded `updateMany` on the current status — the loser gets `409`, never a double decision. |
| Concurrent scheduler tick vs. approval | Both passes are add-only with `skipDuplicates`; the final registration set is the union, with no duplicates. |
| Score revised below threshold | No new registrations; an already-advanced entrant keeps their place (organiser decides on withdrawal). |
| Next round already ended | No automatic registration; the organiser resolves the late appeal manually. |
| `newScore` out of range / not a number | Rejected with `400`; scores are percentages (0–100). |
| Rejected appeal | The result, standings and qualification are untouched. |

## Audit trail

The `RemarkRequest` row records the whole decision: `reason`, `requestedById`, `assignedToId`, `reviewedById`, `reviewedAt`, `reviewNotes`, and — when approved — `newScore` alongside the amended `Result.score`. The queue endpoint returns these relations so reviewers can see exactly who asked, who decided, and on what grounds.
