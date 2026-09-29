# Sprint Retrospective – Zandile

## What Went Well

During this sprint, I focused primarily on **Scrum practices, project documentation, stakeholder feedback, and user feedback**. Keeping these responsibilities together allowed me to maintain consistency across the sprint and ensure that the development process was properly documented.

I maintained the **daily stand-up minutes**, recording the team's progress, completed tasks, current work, and any issues encountered. This provided a clear record of the team's development process and made it easier to track progress throughout the sprint.

I also focused on **collecting and analysing user feedback** through the Google Form. The feedback provided useful insight into how users experienced the portal, including areas such as usability, navigation, performance, student management, organiser access, and progression between rounds.

A particularly successful aspect of the sprint was ensuring that feedback did not simply remain as survey responses. I helped translate the feedback into **identifiable improvements and backlog items**. Issues raised by users, such as unclear student-to-Olympiad relationships, unrestricted progression to subsequent rounds, organiser access to unrelated Olympiads, and the need for co-organiser functionality, were incorporated into the development process.

The documentation work also helped provide evidence of our **Scrum methodology and iterative development process**, rather than only documenting the final product.

## What Could Be Improved

One challenge was that maintaining documentation alongside feedback collection required consistent effort throughout the sprint. Some information had to be consolidated after activities had already taken place, which made the documentation process more time-consuming.

The feedback collection could also have been more structured. Although we received useful responses from users, some feedback was broad, such as requests for general UI improvements. In future sprints, questions could be designed to obtain more specific feedback about individual features and workflows.

Another area for improvement is making the connection between feedback and the backlog even more explicit. While the identified issues were communicated to the team and implemented, each feedback item could have been formally linked to a specific backlog item, acceptance criterion, or completed task. This would make it easier to demonstrate exactly how user feedback influenced development.

## What We Learned

This sprint demonstrated the importance of **continuous documentation rather than treating documentation as an end-of-sprint activity**. Maintaining stand-up records and feedback throughout the sprint provided evidence of how the team progressed and how decisions were made.

We also learned that collecting user feedback is most valuable when it results in **actionable changes**. The feedback helped identify issues that may not have been obvious during development, particularly around access control, round progression, student organisation, and usability.

The sprint also reinforced the value of Scrum practices in coordinating the team. Regular stand-ups and backlog updates helped keep development activities visible and provided a way to monitor whether user concerns were being addressed.

## Action Items for the Next Sprint

- Continue recording daily stand-up minutes consistently throughout the sprint.
- Link each significant piece of user feedback directly to a backlog item or development task.
- Make user-testing questions more feature-specific to obtain more actionable responses.
- Maintain a feedback-to-implementation changelog showing what was reported, what was changed, and when it was implemented.
- Continue documenting Scrum activities throughout the sprint rather than retrospectively.
- Collect follow-up feedback after major improvements to determine whether the implemented changes addressed the original user concerns.

## Overall Reflection

Overall, this sprint was successful in establishing a stronger connection between **Scrum practices, user feedback, documentation, and development**. My main contribution was ensuring that the team's process and feedback were visible and traceable throughout the sprint. The most valuable outcome was seeing user feedback translated into actual portal improvements rather than being treated only as evaluation data.

For the next sprint, I would focus on making the feedback-to-backlog-to-implementation relationship even more explicit and maintaining documentation continuously so that the team's progress and decision-making remain easy to demonstrate.

---

# Sprint Retrospective – Kutloano

## What Went Well

During this sprint, I focused primarily on **concurrency, round-boundary correctness, database performance, load testing, and debugging**. My work was aimed at making the portal more reliable when multiple users interact with the system at the same time, particularly around round openings, submissions, and database transactions.

I worked on several tasks related to **time and boundary correctness**, including comparing application-server and database-server times, testing for clock skew, reviewing potential race conditions, and implementing transaction-level locking. These changes helped ensure that important decisions, such as whether a round is open or closed, are based on consistent database state rather than relying only on application timing.

I also implemented and worked on **concurrent submission load testing**. The load-testing scripts were designed to simulate multiple requests occurring at the same time and helped identify how the system behaves under increased concurrency. This provided a practical way to investigate whether simultaneous submissions could result in race conditions, duplicate processing, or database connection problems.

Another important part of the sprint was investigating **database connection-pool limitations**. I identified that the application was initially using the Supabase session pooler on port 5432 and investigated the difference between session-mode and transaction-mode pooling. I then updated the Prisma configuration to use a pooled `DATABASE_URL` for application requests and a `DIRECT_URL` for database operations such as migrations.

I also increased the transaction waiting and timeout settings so that requests could wait longer for an available database connection during bursts of activity. This was treated as a mitigation rather than a complete infrastructure solution, which helped clarify the limitations of the current database setup.

I contributed to the development of the **concurrent sitting-start load test**, which simulated multiple users attempting to start sittings around the same round boundary. This extended the concurrency testing beyond submissions and allowed the team to investigate another important point where simultaneous requests could affect the system.

A significant part of the sprint also involved **debugging database and Prisma issues**. When the backend began producing errors after switching branches, I investigated the generated Prisma client and discovered that the schema contained duplicate fields in the `Round` model. I identified duplicated relationships such as `prerequisiteRoundId`, `sittings`, `notificationLogs`, and `notificationRules`, as well as an additional duplicate-style audit-log relationship. This allowed the underlying schema problem to be identified rather than treating the resulting backend errors as isolated API problems.

The sprint also involved documenting the **load-testing process and known limitations**, including the fact that the tests were executed against the shared Supabase database from a developer machine rather than directly through the deployed Render backend. Recording this limitation made the results more transparent and prevented the testing results from being interpreted as a complete representation of production behaviour.

## What Could Be Improved

One challenge during the sprint was that **database configuration and concurrency testing were closely connected**, which made some tasks dependent on infrastructure issues. The initial load testing exposed database connection limitations, meaning that some tests could not immediately be used as a straightforward measure of application performance.

The database pooler configuration also took longer to resolve than expected. Switching from the session pooler to transaction-mode pooling required changes to both the environment configuration and Prisma schema. A later authentication and connectivity issue with the database showed that infrastructure configuration should be verified earlier before relying heavily on load-test results.

Another area that could be improved is **test planning and sequencing**. Some of the concurrency work was developed before the final deployment configuration was available. As a result, the team had to distinguish between local load tests against the shared database and tests performed against the deployed application. Establishing this distinction earlier would have made the testing process easier to organise.

The Prisma debugging also highlighted the importance of **keeping the database schema and generated Prisma client synchronised**. Switching branches while generated files and local schema changes were present contributed to confusion when the backend started producing `findMany` errors. A cleaner process for regenerating Prisma Client after schema or branch changes would reduce the likelihood of similar issues.

The connection between **load-test results and documented limitations** could also be made more explicit. The testing documentation should clearly identify the environment, concurrency level, database configuration, and whether the test exercised the deployed backend or the database directly. This would make future comparisons between test runs more reliable.

## What We Learned

This sprint demonstrated that **concurrency problems cannot be evaluated only by looking at individual requests**. A feature may work correctly when tested by one user but behave differently when several requests reach the same database state simultaneously. Testing round boundaries and concurrent submissions therefore provided useful insight into how the portal behaves under realistic simultaneous activity.

I also learned the importance of **using database state and transaction-level protection when correctness depends on multiple users accessing the same data at the same time**. Application-level checks alone may not be sufficient when several requests can pass the same check before either request has completed its update.

The sprint also reinforced the importance of **database connection management**. The difference between Supabase session-mode and transaction-mode pooling showed how infrastructure configuration can directly affect application behaviour under concurrency. Increasing transaction timeouts can help requests tolerate short bursts, but it does not increase the underlying capacity of the database pool.

Another important lesson was that **load testing is only meaningful when its environment and limitations are clearly documented**. Running tests against the shared database can provide useful information about database behaviour, but it does not necessarily represent the behaviour of the complete deployed application. This distinction needs to be recorded alongside the results.

The Prisma issues also reinforced the need to keep **schema files, migrations, generated clients, and branches consistent**. When these become out of sync, an error in one part of the system can appear to be an unrelated backend problem. Investigating the generated Prisma client and schema helped identify the actual source of the errors.

Finally, the sprint showed the value of **incremental debugging**. Rather than changing several parts of the system at once, checking the authentication middleware, database configuration, Prisma schema, generated client, and individual failing routes helped narrow down the source of each problem.

## Action Items for the Next Sprint

* Continue testing concurrency around **round openings, round closings, submissions, and sitting creation**.

* Document each load test with its **environment, concurrency level, database configuration, and results**.

* Clearly distinguish between tests performed against the **database directly** and tests performed through the **deployed backend**.

* Keep the Prisma schema, migrations, and generated Prisma Client synchronised when switching branches or merging database-related changes.

* Verify database connection and pooler configuration **before beginning large-scale load tests**.

* Continue monitoring database connection-pool behaviour during concurrent requests and record any connection exhaustion or timeout errors.

* Link concurrency findings to the relevant backlog tasks so that each identified problem has a clear implementation and verification path.

* Continue documenting known limitations so that load-test results are interpreted within the correct context.

## Overall Reflection

Overall, this sprint gave me practical experience with **concurrency, database transactions, load testing, Prisma, connection pooling, and debugging issues that occur when multiple parts of a system interact**.

My main contribution was investigating and improving the reliability of the portal around situations where multiple requests can occur simultaneously. The work progressed from identifying potential timing and race-condition problems to implementing transaction-level protections and creating load tests to observe the system under concurrent activity.

One of the most valuable outcomes was learning that improving application reliability is not only about changing application code. **Database configuration, transaction behaviour, testing methodology, deployment environment, and documentation all affect how confidently the system can be evaluated.**

For the next sprint, I would focus on making the concurrency-testing process more structured, keeping the database and Prisma configuration consistent across branches and environments, and ensuring that every test result is clearly connected to the specific system behaviour or backlog item it was intended to validate.

---

# Sprint Retrospective – Mlungisi 

## What Went Well

This sprint was my most productive yet. I completed **25 tasks across 5 user stories**, covering multi-olympiad isolation, timezone-aware scheduling, audit logging, round replay, and co-organiser access. The breadth of work gave me a strong understanding of how different parts of the system interact.

The **multi-olympiad isolation** work (#171) was particularly satisfying. I audited the schema for olympiad-scoping gaps, added enforcement across all relevant queries and routes, implemented authorization checks to prevent cross-olympiad access, and wrote isolation tests verifying that two olympiads cannot leak data into each other. This was foundational work that made the other features possible.

The **timezone-aware scheduling** (#176) required careful thinking about where time comparisons happen. Adding the timezone field to the Olympiad model, updating the scheduler to store and compare in UTC, and updating the frontend to render times in the viewer's or olympiad's timezone was a good exercise in tracing data flow from database to UI. Writing tests for timezone conversion and boundary correctness gave confidence that the implementation handles edge cases.

The **audit log** (#181) and **round replay** (#186) features worked well together. Designing the AuditLog schema, instrumenting the scheduler to write entries for automatic actions (open, close, auto-advance, notifications), building the replay endpoint that aggregates the log, and creating the organiser-facing timeline UI all connected cleanly. Writing tests for both the log entries and the replay endpoint ensured correctness.

The **co-organiser access** feature (#242) was the largest piece of work this sprint. Adding the OlympiadOrganiser join table, backfilling existing organisers, building add/list routes, replacing the old `organiserId` filters with membership checks, deciding removal rules, building the UI, writing tests, and documenting the model was a full-stack effort. The membership-based access control is more flexible than the previous single-organiser model and sets us up for future collaboration features.

I also fixed a critical bug where the `POST /rounds` endpoint was missing auth middleware, which was causing "You are not an organiser of this olympiad" errors even for valid organisers. Catching and fixing this during deployment testing prevented users from hitting the same issue.

## What Could Be Improved

The volume of tasks meant I sometimes worked on multiple features in parallel, which made context-switching costly. In future sprints, I would try to batch related tasks more aggressively rather than jumping between different user stories within the same day.

The co-organiser work involved touching many files across the backend and frontend, and I occasionally lost track of which routes still needed updating. A checklist or task breakdown at the start would have helped me track progress more systematically.

I also spent time debugging database connection issues during deployment that turned out to be configuration problems (PgBouncer incompatibility with Prisma transactions, clerkUserId with leading spaces). These were not code bugs but cost debugging time. Documenting common deployment issues and their solutions would help avoid repeating this investigation.

The isolation tests I wrote were thorough but could have been written earlier in the sprint. Writing them after the implementation meant I was sometimes fixing bugs the tests revealed rather than having them guide the implementation from the start.

## What We Learned

I learned that **authorization checks need to be consistent across all routes**. The multi-olympiad isolation work showed that even one route missing a check can break the entire isolation guarantee. Auditing all routes systematically was more effective than fixing issues as they were reported.

The timezone work reinforced that **time should always be stored in UTC and converted at the edges** (frontend display, API input). Comparing timestamps in different timezones is a subtle source of bugs that tests caught before they reached production.

The audit log feature taught me the value of **instrumenting automatic actions for observability**. Being able to query a round's history and replay what happened when is invaluable for debugging and for user trust in the system.

The co-organiser work showed that **replacing implicit access rules with explicit membership tables** is more work upfront but pays off in flexibility and clarity. The old model where only the creator could manage an olympiad was too restrictive for real-world use.

I also learned the importance of **testing deployments end-to-end**. The auth middleware bug on `POST /rounds` only appeared after deployment because the local environment had different state. Automated tests caught logic errors but not configuration or middleware wiring issues.

## Action Items for the Next Sprint

- Batch related tasks together to reduce context-switching overhead.
- Create a checklist when starting large features that touch many files.
- Document common deployment issues and their solutions for the team.
- Write isolation and authorization tests before implementation, not after.
- Continue the pattern of instrumenting automatic actions for auditability.
- Review all routes for consistent authorization checks when adding new features.

## Overall Reflection

This sprint was a significant step up in both scope and complexity. Completing 25 tasks across 5 user stories gave me confidence that I can handle large, multi-feature sprints. The work on multi-olympiad isolation and co-organiser access was particularly valuable because it established patterns that will make future features easier to implement.

The most important lesson was that **systematic auditing and testing are more effective than ad-hoc fixes**. Whether it was checking every route for olympiad scoping, writing isolation tests for two olympiads, or verifying timezone boundary correctness, the systematic approach caught more issues than reactive debugging would have.

For the next sprint, I would focus on maintaining this systematic approach while improving how I organize and batch work to reduce the cognitive load of context-switching between features.

---

# Sprint Retrospective – Ronie

## What Went Well

During this sprint, I focused primarily on **appeal workflow completion, assign-flow closure, race-condition fixes, and frontend integration**. My work closed the full appeal lifecycle from educator submission through reviewer assignment, decision recording, and standings/qualification update.

The **marker-clear race closure** was a significant correctness improvement. The old flow cleared `autoAdvanceProcessedAt` and waited 30 seconds for the next scheduler tick, during which a concurrent tick could re-stamp the marker and silently swallow the re-trigger. Extracting `advanceQualifiedEntrantsForRound` into a shared function and running it inline inside the review transaction eliminated both the delay and the race. Idempotency via `skipDuplicates` made concurrent passes safe.

**Test coverage was strong across both layers.** 11 net new backend tests for appeal outcomes (score amendment, immediate re-advance, released-round re-trigger, below-threshold no-op, out-of-range rejection, boundary values, rejected-path guards) and 3 new frontend tests for appeal assignment (self-assign, dropdown routing, assignment failure). The full backend suite reached 444/444 passing, and the frontend suite reached 215/215 passing with clean ESLint and Prettier.

**Post-publication semantics were defined and implemented, not deferred.** Before this sprint, it was undefined what should happen when an appeal is approved after results have been released and certificates issued. The implementation amends released results in place, preserves `releasedAt`, regenerates certificates on demand, and still re-runs qualification. This prevents future ambiguity and is documented in `appeal-workflow.md`.

The **frontend assign-flow closed a real integration gap.** The reviewer story was implemented but appeals could never reach a reviewer through the UI because there was no assign UI. Adding the pending appeals section with "Assign to me" and "Route to another reviewer" dropdown to `/organiser/remarks` unblocked the full reviewer workflow for manual testing and real use.

**Clean separation of concerns between backend and frontend.** The backend already had the assign endpoint; the frontend just consumed it. No backend changes were needed for the frontend assignment story. The shared advancement pass is used by both scheduler and review route — a single source of truth that prevents drift.

**Documentation was comprehensive.** `appeal-workflow.md` covers the full lifecycle: states, permissions, endpoints, approval effects, re-trigger safety properties, post-publication policy, edge cases, and audit trail. Future maintainers have a clear reference for how the appeal system works.

## What Could Be Improved

The **assign-flow gap blocked manual testing longer than it should have.** The reviewer story was implemented but couldn't be tested end-to-end because there was no way to assign appeals through the UI. This gap existed because backend and frontend work were tracked separately without an integration checkpoint. It should have been caught during sprint planning or earlier integration testing.

**Post-publication semantics required careful reasoning about edge cases.** What does it mean to amend a score after certificates have been issued and results released? The answer (amend in place, preserve `releasedAt`, regenerate certificates on demand, re-run qualification) seems obvious in retrospect but required deliberate design decisions that weren't captured in the original story description.

The **marker-clear race was a pre-existing gap** that only surfaced when post-publication semantics required immediate re-trigger. Earlier code review or integration testing might have caught it sooner.

**Line-ending normalization added friction** to the verification step. The editing tool wrote LF endings; Prettier check flagged CRLF mismatches. This required manual normalization and wasn't a bug, but it added a non-trivial verification step after each edit.

## What We Learned

**Race conditions in concurrent systems are often invisible until the timing changes.** The marker-clear race existed for a while but only surfaced when the approval flow needed synchronous re-trigger instead of waiting for the next scheduler tick. Testing under different timing assumptions is a good way to surface latent races.

**Post-publication semantics are easy to defer but hard to retrofit.** Defining what happens when an appeal is approved after results are released and certificates issued required deliberate design decisions. Leaving this undefined would have caused ambiguity and inconsistency later.

**Integration gaps between backend and frontend work are easy to miss when they're tracked as separate stories.** The assign-flow gap existed because no one checked whether the frontend could actually reach the backend through a real user workflow. End-to-end integration testing, even manual, catches these gaps.

**Extracting shared logic into a single source of truth pays off quickly.** The `advanceQualifiedEntrantsForRound` function is now used by both the scheduler and the review route. This prevents drift, makes the logic easier to test, and ensures both callers behave consistently.

## Action Items for the Next Sprint

- Add a note to `appeal-workflow.md` about the frontend UI at `/organiser/remarks`, including the pending appeals queue and reviewer selector.
- Consider an integration test for the full appeal lifecycle (create → assign → review → standings/certificate/qualification update). Priority: medium.
- Sprint planning for future cross-layer stories should include an "integration checkpoint" sub-task: verify the full workflow end-to-end before marking the story done.
- Raise the line-ending normalization issue as a team-wide configuration item (`.editorconfig` or Prettier config).

## Overall Reflection

This sprint delivered the complete appeal workflow from end to end, closing a significant gap in the portal's functionality. The work progressed from implementing the appeal submission and reviewer assignment UI, through wiring appeal decisions into standings and qualification, to defining and documenting post-publication semantics.

The most valuable outcome was the marker-clear race closure — immediate re-trigger is both faster and safer than the old 30-second-delay approach, and the shared advancement pass is now the single source of truth for qualification re-trigger across both scheduler and review route.

The most important lesson was that **integration gaps between backend and frontend work are easy to miss when they're tracked separately**. The assign-flow gap blocked manual testing for the reviewer story, and the marker-clear race only surfaced when post-publication semantics changed the timing assumptions. Both would have been caught earlier by end-to-end integration testing or by coordinating backend and frontend work more tightly.

For the next sprint, I would focus on maintaining the strong test coverage while adding integration tests for cross-cutting workflows, and ensuring that future cross-layer stories include an integration checkpoint as part of their definition of done.
