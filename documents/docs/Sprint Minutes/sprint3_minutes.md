# Sprint 3 Daily Standup Minutes

**Period:** 15 September 2026 – 28 September 2026  
**Team:** Olympiad Portal Development Team

---

## Meeting 1 — 15 September 2026

### Zandile — Scrum, Documentation, Feedback, Deployment & Performance

**Previous work:**  
Reviewed Sprint 3 requirements and organised the initial Sprint 3 backlog and task ownership.

**Today:**  
Set up the Sprint 3 standup log and sprint documentation. Begin reviewing deployment requirements and prepare the deployment checklist for backend, frontend and documentation changes.

**Blockers:**  
No major blockers. Waiting for confirmation of final feature dependencies from the development team.

**Next steps:**  
Continue sprint planning and coordinate with the team to ensure all Sprint 3 stories are assigned and tracked.

---

### Mlungisi — Multi-Olympiad, Co-organisers, Timezone, Audit Log & Replay

**Previous work:**  
Reviewed the existing olympiad-related routes and identified areas where access is currently based directly on `organiserId`.

**Today:**  
Begin designing the `OlympiadOrganiser` join table for UserStory on Taiga and review the existing olympiad schema to determine how current organiser ownership can be preserved through a backfill.

**Blockers:**  
The exact removal rules for co-organisers still need confirmation, particularly whether the original creator can be removed.

**Next steps:**  
Create the Prisma migration and plan the membership-based authorisation changes across olympiad-scoped routes.

---

### Kutloano — Concurrency & Boundary Correctness

**Previous work:**  
Reviewed the round transition and submission flows for possible concurrency issues.

**Today:**  
Investigate the current use of application-server time in round transitions and identify areas that should use an authoritative time source.

**Blockers:**  
Need to confirm which database/server time mechanism is already available in the backend.

**Next steps:**  
Document affected code paths and begin preparing tests for clock-skew scenarios.

---

### Ronie — Appeals & Reviewer Workflow

**Previous work:**  
Reviewed the existing remark/appeal-related models and identified the changes needed for the new reviewer workflow.

**Today:**  
Begin designing the appeal routing and reviewer workflow, including the information that reviewers need to see when processing an appeal.

**Blockers:**  
Reviewer permissions and role behaviour need to be confirmed against the current authentication model.

**Next steps:**  
Define the required database and route changes before implementing the reviewer interface.

---

## Meeting 2 — 17 September 2026

### Zandile — Scrum, Documentation, Feedback, Deployment & Performance

**Previous work:**  
Set up the Sprint 3 standup documentation and reviewed deployment requirements.

**Today:**  
Continue preparing the deployment checklist and review the Sprint 3 stories for dependencies between frontend, backend and database changes.

**Blockers:**  
Some deployment steps depend on completed backend migrations and feature integration.

**Next steps:**  
Coordinate with Persons 2–4 on migration and integration requirements and keep the sprint board updated.

---

### Mlungisi — Multi-Olympiad, Co-organisers, Timezone, Audit Log & Replay

**Previous work:**  
Designed the initial `OlympiadOrganiser` relationship containing `olympiadId`, `organiserId`, `addedAt`, and a unique constraint for each organiser/olympiad pair.

**Today:**  
Implement the Prisma migration and backfill existing `Olympiad.organiserId` values into `OlympiadOrganiser`. Begin the routes for adding and listing organisers.

**Blockers:**  
The ownership-sensitive removal behaviour remains an open decision.

**Next steps:**  
Complete the membership routes and start replacing direct organiser ownership checks with membership checks.

---

### Kutloano — Concurrency & Boundary Correctness

**Previous work:**  
Identified round transition code that relies on server-side application time.

**Today:**  
Implement the authoritative-time changes and start writing tests that simulate differences between client and server clocks.

**Blockers:**  
Some existing tests assume the previous time-handling behaviour and may need updating.

**Next steps:**  
Complete the clock-skew tests and review submission handling for race conditions around round closing.

---

### Ronie — Appeals & Reviewer Workflow

**Previous work:**  
Defined the main states and information required for an entrant appeal.

**Today:**  
Implement the appeal model/route changes and begin the educator-facing appeal submission flow.

**Blockers:**  
Need to ensure duplicate appeals are handled consistently.

**Next steps:**  
Add validation for existing appeals and write tests for appeal creation.

---

## Meeting 3 — 18 September 2026

### Zandile — Scrum, Documentation, Feedback, Deployment & Performance

**Previous work:**  
Reviewed Sprint 3 progress and identified deployment dependencies.

**Today:**  
Continue maintaining the sprint board and begin preparing the documentation structure for the new features. Coordinate with the team on testing requirements.

**Blockers:**  
No significant blockers.

**Next steps:**  
Prepare documentation for the sprint plan and begin arranging user-testing sessions.

---

### Mlungisi — Multi-Olympiad, Co-organisers, Timezone, Audit Log & Replay

**Previous work:**  
Implemented the initial `OlympiadOrganiser` migration and started the existing-organiser backfill.

**Today:**  
Continue implementing the add/list organiser routes and update olympiad-scoped authorisation checks so that an organiser with membership can access the olympiad even when they are not the original creator.

**Blockers:**  
Some routes still rely on the old `organiserId` filter and need to be reviewed individually.

**Next steps:**  
Audit `rounds.js` and other olympiad-related routes, then implement the agreed ownership-sensitive restrictions.

---

### Kutloano — Concurrency & Boundary Correctness

**Previous work:**  
Implemented the initial authoritative-time changes and began clock-skew testing.

**Today:**  
Review submission creation and sitting creation for race conditions. Focus particularly on simultaneous submissions at the round closing boundary.

**Blockers:**  
Need to reproduce concurrent requests reliably before finalising the transaction changes.

**Next steps:**  
Create concurrent tests for submission creation and investigate transaction-level locking.

---

### Ronie — Appeals & Reviewer Workflow

**Previous work:**  
Implemented the initial appeal creation flow.

**Today:**  
Build the reviewer permission checks and reviewer-facing route/UI for viewing assigned appeals.

**Blockers:**  
Reviewer assignment behaviour needs to work consistently with the existing user roles.

**Next steps:**  
Complete the reviewer queue and begin implementing the decision-recording flow.

---

## Meeting 4 — 21 September 2026

### Zandile — Scrum, Documentation, Feedback, Deployment & Performance

**Previous work:**  
Updated the sprint documentation and monitored progress against the Sprint 3 backlog.

**Today:**  
Coordinate integration testing across the team and prepare the deployment checklist, including migrations, environment variables and smoke tests.

**Blockers:**  
Final deployment timing depends on backend feature completion.

**Next steps:**  
Begin arranging user-testing sessions and prepare the process for recording actionable feedback.

---

### Mlungisi — Multi-Olympiad, Co-organisers, Timezone, Audit Log & Replay

**Previous work:**  
Completed most of the membership-based access changes and reviewed the remaining routes for direct `organiserId` checks.

**Today:**  
Complete the co-organiser UI with an **Add Organiser** form and current-organiser list. Implement and test the agreed removal/ownership rules.

**Blockers:**  
Need to ensure the original creator remains distinguishable from added organisers for ownership-sensitive actions.

**Next steps:**  
Test positive and negative access cases and verify that added organisers see the olympiad in their own olympiad list.

---

### Kutloano — Concurrency & Boundary Correctness

**Previous work:**  
Reviewed submission and sitting creation paths for concurrency risks.

**Today:**  
Implement transaction-level protections and run concurrent tests for submissions arriving around the round closing time.

**Blockers:**  
Load-test behaviour needs to be compared against the expected acceptance/rejection boundary.

**Next steps:**  
Expand tests to simultaneous sitting starts and prepare the round open/close load-testing scenarios.

---

### Ronie — Appeals & Reviewer Workflow

**Previous work:**  
Implemented reviewer access and the initial reviewer queue.

**Today:**  
Implement reviewer decisions to uphold or adjust an appeal and record the reviewer identity and timestamp.

**Blockers:**  
Need to ensure score changes correctly propagate to the existing result/standings logic.

**Next steps:**  
Connect appeal outcomes to standings and begin testing revised scores.

---

## Meeting 5 — 23 September 2026

### Zandile — Scrum, Documentation, Feedback, Deployment & Performance

**Previous work:**  
Coordinated integration testing and reviewed progress on Sprint 3 features.

**Today:**  
Run user-testing sessions and collect feedback from organiser, educator and student flows. Log actionable issues in Taiga.

**Blockers:**  
Some testing depends on the latest integrated backend and frontend changes.

**Next steps:**  
Summarise feedback and link actionable issues to the corresponding sprint tasks.

---

### Mlungisi — Multi-Olympiad, Co-organisers, Timezone, Audit Log & Replay

**Previous work:**  
Completed the main co-organiser functionality and began testing membership-based access control.

**Today:**  
Run tests for adding and listing organisers, access to organiser-only actions, backfill correctness and visibility of shared olympiads in an organiser's olympiad list. Continue integration work on timezone and audit-log functionality.

**Blockers:**  
A few edge cases around non-members accessing olympiad resources require additional testing.

**Next steps:**  
Fix identified access-control issues and complete the replay and audit-log integration tests.

---

### Kutloano — Concurrency & Boundary Correctness

**Previous work:**  
Implemented transaction protections and tested concurrent submissions at round boundaries.

**Today:**  
Run larger concurrent tests for round opening and closing and verify that simultaneous sitting creation and submissions are processed consistently.

**Blockers:**  
Some tests require a staging/deployed environment to accurately reproduce production-like concurrency.

**Next steps:**  
Coordinate with Person 1 on load testing against the deployed environment and document the results.

---

### Ronie — Appeals & Reviewer Workflow

**Previous work:**  
Connected reviewer decisions to score updates.

**Today:**  
Test standings recalculation and auto-advance behaviour when an appeal changes an entrant's score.

**Blockers:**  
Need to verify edge cases where an appeal is resolved after standings or certificates have already been published.

**Next steps:**  
Implement and test the post-publication behaviour and document the complete appeal workflow.

---

## Meeting 6 — 25 September 2026

### Zandile — Scrum, Documentation, Feedback, Deployment & Performance

**Previous work:**  
Collected user-testing feedback and recorded actionable issues against the Sprint 3 backlog.

**Today:**  
Complete the deployment checklist, review outstanding sprint tasks and prepare the final deployment and smoke-testing process.

**Blockers:**  
Waiting for final confirmation that all feature branches are ready for deployment.

**Next steps:**  
Deploy the completed Sprint 3 changes, smoke-test the core flows and document any deployment issues or manual steps.

---

### Mlungisi — Multi-Olympiad, Co-organisers, Timezone, Audit Log & Replay

**Previous work:**  
Completed the main co-organiser implementation and tested membership-based access control, including positive and negative cases.

**Today:**  
Fix remaining integration issues, complete tests for the `OlympiadOrganiser` backfill and document the co-organiser access model and ownership rules. Finalise audit-log and replay testing.

**Blockers:**  
No major implementation blockers. Remaining work is focused on integration testing and documentation.

**Next steps:**  
Merge the completed changes, verify that multiple olympiads remain isolated, and perform final regression testing across organiser permissions, timezone handling, audit logs and replay.

---

### Kutloano — Concurrency & Boundary Correctness

**Previous work:**  
Ran concurrent round-open and round-close tests and reviewed the results with the team.

**Today:**  
Complete regression testing for authoritative time, exactly-once submissions and simultaneous sitting creation. Document test results and remaining limitations.

**Blockers:**  
No major blockers identified.

**Next steps:**  
Provide final concurrency findings to Person 1 for deployment documentation and verify the deployed system once available.

---

### Ronie — Appeals & Reviewer Workflow

**Previous work:**  
Tested standings updates and auto-advance behaviour after appeal decisions.

**Today:**  
Complete post-publication appeal handling, finalise workflow documentation and run regression tests across educator, reviewer and organiser flows.

**Blockers:**  
No major blockers. Final testing depends on the latest integrated version.

**Next steps:**  
Complete the remaining tests and prepare the appeal workflow for deployment.