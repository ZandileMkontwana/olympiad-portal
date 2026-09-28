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
