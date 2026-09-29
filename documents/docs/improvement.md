---
sidebar_position: 12
---

# Improvements from User and Stakeholder Feedback

This page traces every piece of user and stakeholder feedback through to the concrete system changes it produced. It demonstrates that feedback was not only collected but was analysed, prioritised, and integrated into the codebase.

The full feedback collection and analysis is documented in [User Feedback](./User%20Feedback). This page focuses on the **implementation evidence** — what was built, where it lives in the code, and how it addresses the original concern.

---

## 1. Qualification-Based Round Access

**User feedback:** "Students were able to proceed to the next round without satisfying the qualification requirements."

**Stakeholder input:** Round progression should be controlled by qualification thresholds, not left open.

**Implementation:** A central prerequisite gate was built in `backend/src/lib/qualification.js`. Every path that registers an entrant for a round — whether at creation time, when a round opens, or when an appeal is approved — passes through the same gate.

| Function | Purpose |
|---|---|
| `hasQualifiedForRound(entrantId, round)` | Checks whether a single entrant meets the round's entry requirements (prerequisite submission exists with score >= threshold). |
| `filterQualifiedEntrantIds(entrantIds, round)` | Batch version — returns only the entrants from a candidate list who qualify. Used by auto-registration paths. |
| `advanceQualifiedEntrantsForRound(round, tx)` | Re-evaluates qualification for a closed/released round and registers qualifying entrants for the next round. Runs inside a transaction to prevent race conditions. |

**Where enforced:**

- `backend/src/routes/entrants.js` — when a new student is registered, only open rounds they qualify for are auto-assigned.
- `backend/src/routes/students.js` — `GET /students/me/rounds` checks qualification before allowing a sitting; locked rounds show `lockedReason`.
- `backend/src/scheduler.js` — `registerEntrantsForNewlyOpenRounds()` and `advanceQualifiedEntrantsForRound()` only register qualified entrants.
- `backend/src/routes/remark.js` — when an appeal is approved, `advanceQualifiedEntrantsForRound` re-runs inside the same transaction.

**Tests:** Qualification logic is covered by backend tests for each route that enforces it, plus the scheduler tests for auto-advance.

---

## 2. Organiser Access Control

**User feedback:** "Organisers could access Olympiads created by other organisers."

**Implementation:** A membership-based access control system was built, replacing the previous single-organiser model.

| Component | File | Purpose |
|---|---|---|
| `OlympiadOrganiser` join table | `backend/prisma/schema.prisma` | Stores organiser/olympiad membership with a unique constraint. |
| `isOlympiadOrganiser(userId, olympiadId)` | `backend/src/lib/authorization.js` | Checks whether a user is a member of a specific olympiad. |
| `requireOlympiadAccess(req, res, round)` | `backend/src/lib/authorization.js` | Middleware that verifies the caller has access to the round's olympiad — organisers must be members, educators must have school access. |
| Backfill migration | `backend/prisma/migrations/` | Existing `organiserId` values were migrated into the join table so the creator is also a member. |

**Where enforced:** Every olympiad-scoped route now calls `requireOlympiadAccess` or `isOlympiadOrganiser` instead of comparing `organiserId` directly. This was audited across all routes in `rounds.js`, `papers.js`, `submissions.js`, `marking.js`, `remark.js`, and others.

**Tests:** `backend/src/routes/isolation.test.js` verifies that two olympiads cannot leak data into each other. `backend/src/routes/olympiadOrganisers.test.js` covers add/list/remove organiser flows.

---

## 3. Co-Organiser Functionality

**User feedback:** "Users requested the ability to work with other organisers" (open-ended response).

**Implementation:** A full CRUD system for managing co-organisers was built on top of the `OlympiadOrganiser` join table.

| Endpoint | File | Purpose |
|---|---|---|
| `GET /api/organisers` | `backend/src/routes/olympiadOrganisers.js` | Lists all organisers. |
| `GET /api/olympiads/:id/organisers` | `backend/src/routes/olympiadOrganisers.js` | Lists organisers for a specific olympiad. |
| `POST /api/olympiads/:id/organisers` | `backend/src/routes/olympiadOrganisers.js` | Adds an organiser to an olympiad (creator-only). |
| `DELETE /api/olympiads/:id/organisers/:organiserId` | `backend/src/routes/olympiadOrganisers.js` | Removes an organiser (creator-only; creator cannot be removed). |

**Frontend:** The organiser console (`frontend/src/app/organiser/page.js`) includes an Add Organiser form and a current-organiser list.

**Tests:** `backend/src/routes/olympiadOrganisers.test.js` (295 lines) covers positive and negative cases including permission checks, duplicate adds, and removal rules.

---

## 4. Olympiad Selection When Adding Students

**User feedback:** "Users wanted to specify the Olympiad when adding a student."

**Implementation:** The `POST /entrants` endpoint now requires `olympiadId` in the request body. The student is auto-registered for open rounds of the specified olympiad (subject to qualification gates and school access).

**Code:** `backend/src/routes/entrants.js` lines 54–62:

```js
if (!olympiadId) {
  return res.status(400).json({
    error: 'olympiadId is required — select which olympiad to add the student under',
  });
}
```

The response includes `registeredRounds` so the educator can see which rounds the student was registered for.

---

## 5. Improved Student Organisation

**User feedback:** "Educators could not easily identify which Olympiad a student belonged to."

**Implementation:** The school dashboard endpoint (`GET /schools/:id/dashboard`) now returns the distinct olympiads each entrant is registered under, derived from their `RoundEntrant` registrations.

**Code:** `backend/src/routes/schools.js` lines 130–161:

```js
const olympiadById = new Map();
for (const registration of entrant.roundEntrants) {
  const olympiad = registration.round.olympiad;
  if (olympiad) olympiadById.set(olympiad.id, olympiad);
}

return {
  // ...
  olympiads: [...olympiadById.values()].sort((a, b) => a.name.localeCompare(b.name)),
};
```

**Frontend:** The educator school dashboard (`frontend/src/app/educator/school/page.js`) displays olympiad badges on each student card.

---

## 6. Appeals and Reviewer Workflow

**Stakeholder input:** The marking and appeals process needed a formal workflow with reviewer routing, not just ad-hoc remark requests.

**Implementation:** A full state-machine-driven appeals workflow was built.

| Endpoint | File | Purpose |
|---|---|---|
| `POST /api/submissions/:id/remark` | `backend/src/routes/submissions.js` | Educator raises an appeal. |
| `GET /api/remark/queue` | `backend/src/routes/remark.js` | Organiser views pending/assigned appeals. |
| `PATCH /api/remark/:id/assign` | `backend/src/routes/remark.js` | Organiser routes an appeal to a reviewer. |
| `PATCH /api/remark/:id/review` | `backend/src/routes/remark.js` | Reviewer approves (with new score) or rejects. |

**Key design decisions:**

- Approved appeals amend `Result.score` in place and re-trigger qualification in the same transaction — no scheduler tick needed.
- Post-publication appeals amend the released score without unpublishing — certificates regenerate with the corrected score.
- Concurrent reviewer actions are guarded by `updateMany` with a status condition — the loser gets a 409.

**Documentation:** The full lifecycle is documented in [Appeals Workflow](./appeal-workflow).

**Tests:** `backend/src/routes/remark.test.js` (726 lines) covers the full state machine, permission checks, score validation, and concurrent access.

---

## 7. UI and Navigation Improvements

**User feedback:** "The font is quite small", "The UI needs some improvement", "Logout/back navigation is inconsistent."

**Implementation:**

- Font sizing and typography were refined across the frontend.
- Navigation behaviour was improved for consistency — logout redirects, back navigation, and page transitions were reviewed and fixed.
- The organiser console was redesigned with an olympiad-first hierarchy (see `frontend/src/app/organiser/page.js`).

---

## 8. Performance Improvements

**User feedback:** "Pages containing results could take a while to load", "The response time could be improved."

**Implementation:**

- Database queries were audited for unnecessary joins and N+1 patterns.
- The connection pooler configuration was updated to use transaction-mode pooling (`DATABASE_URL`) with a direct connection for migrations (`DIRECT_URL`), reducing connection exhaustion under load.
- Load testing was performed to identify bottlenecks (see [Load Testing](./load-testing)).

---

## Summary Traceability Table

| # | User/Stakeholder Feedback | System Response | Code Location |
|---|---|---|---|
| 1 | Students proceed without qualifying | Qualification gate with auto-advance | `lib/qualification.js`, routes, scheduler |
| 2 | Organisers access other olympiads | Membership-based access control | `lib/authorization.js`, all olympiad routes |
| 3 | Need co-organiser collaboration | Co-organiser CRUD + UI | `routes/olympiadOrganisers.js`, organiser page |
| 4 | No olympiad selection when adding student | `olympiadId` required on `POST /entrants` | `routes/entrants.js` |
| 5 | Can't tell which olympiad a student belongs to | Olympiad list per entrant on dashboard | `routes/schools.js`, educator school page |
| 6 | No formal appeals workflow | Full state-machine appeals system | `routes/remark.js`, `routes/submissions.js` |
| 7 | Small font, UI needs polish, nav inconsistent | Typography, layout, navigation fixes | Frontend components |
| 8 | Pages load slowly | Query optimisation, pooler config, load testing | `lib/prisma.js`, load-test scripts |
