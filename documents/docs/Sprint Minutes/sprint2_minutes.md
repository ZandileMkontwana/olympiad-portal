---
sidebar_label: sprint2_minutes
---
# Sprint 2 Minutes

## Meeting 1 — 26 August 2026

**Sprint:** Sprint 2
**Date:** 25 August 2026
**Participants:** Zandile, Kutloano, Ronie, Mlungisi
**Meeting Type:** Sprint Planning

### Objective

The team met to begin Sprint 2 and review the Intermediate requirements that needed to be implemented after completion of the Basic functionality.

### Discussion

The team discussed the Intermediate requirements, with particular attention given to online test-taking, extended marking, progression between rounds, notifications, standings, certificates, student login, school dashboards, and the archive.

The team agreed that the new features needed to build on the existing round, submission, user, and authentication functionality from the previous sprint.

The work was divided according to feature complexity and dependencies.

### Decisions

- Zandile will handle Online Test-Taking (I1) and Archive (B1).
- Kutloano will handle Extended Marking (I2) and Round Progression (I3).
- Ronie will handle Standings & Certificates (I6) and Configurable Notifications (I5).
- Mlungisi will handle Notification Sending (I4) and Student Login & School Dashboard (I7).
- Features should be integrated rather than developed as isolated components.
- Testing will be performed throughout the sprint rather than only at the end.

### Action Items

- **Zandile:** Begin Sitting model and online sitting API design.
- **Kutloano:** Begin MarkingTask and progression requirements.
- **Ronie:** Begin standings and notification-rule designs.
- **Mlungisi:** Begin notification engine and student-role design.

---

## Meeting 2 — 31 August 2026

**Sprint:** Sprint 2
**Date:** 31 August 2026
**Participants:** Zandile, Kutloano, Ronie, Mlungisi
**Meeting Type:** Progress Review

### Objective

The team reviewed progress on the online test-taking and archive functionality and checked that the new Intermediate features were following the agreed architecture.

### Discussion

Zandile presented the initial design for the Sitting model, including the entrant, round, answers, start time, time limit, and completion time.

The team discussed how answers should be saved while a student is completing a test. The importance of allowing a student to reconnect and continue an existing sitting was also discussed.

The archive functionality was reviewed to ensure previous papers could be accessed without interfering with the restrictions applied to active rounds.

Kutloano also discussed the initial structure for marking tasks and how completed submissions from online sittings would enter the marking workflow.

### Decisions

- Each online attempt will have its own Sitting.
- Answers must be persisted rather than relying only on browser state.
- The timer must remain associated with the sitting.
- Completed sittings must not be restarted accidentally.
- Archived papers must remain accessible without allowing inappropriate access to active papers.

### Action Items

- **Zandile:** Continue sitting API and timed test interface.
- **Kutloano:** Connect submission data to the marking workflow.
- **Ronie:** Continue standings and notification-rule implementation.
- **Mlungisi:** Continue notification and student authentication work.

---

## Meeting 3 — 4 September 2026

**Sprint:** Sprint 2
**Date:** 4 September 2026
**Participants:** Zandile, Kutloano, Ronie, Mlungisi
**Meeting Type:** Testing and Integration

### Objective

The team tested the online test-taking workflow and reviewed the interaction between online sittings and submissions.

### Discussion

The team tested the countdown timer, answer auto-saving, sitting retrieval, and reconnect functionality.

Different scenarios were considered, including a student refreshing the page, temporarily losing their connection, returning to the test, and allowing the sitting to reach its time limit.

The team also discussed how completed online sittings should become available to the marking workflow.

The archive page was tested for access to papers from previous rounds.

### Decisions

- Existing sittings should be restored when a student reconnects.
- Answers should be saved regularly during the test.
- A completed or expired sitting should not be reopened as an active attempt.
- Online submissions must use the same downstream marking process where appropriate.
- Archive access should be clearly separated from active-round paper access.

### Action Items

- **Zandile:** Fix timer and reconnect issues found during testing.
- **Kutloano:** Test online submissions entering the marking queue.
- **Ronie:** Continue testing archive/standings integration.
- **Mlungisi:** Test student authentication and dashboard access.

---

## Meeting 4 — 8 September 2026

**Sprint:** Sprint 2
**Date:** 8 September 2026
**Participants:** Zandile, Kutloano, Ronie, Mlungisi
**Meeting Type:** Feature Review

### Objective

The team reviewed the extended marking, notification, and dashboard features and checked their integration with the existing portal.

### Discussion

Kutloano demonstrated the marking queue and discussed how submissions that could not be automatically marked should be placed into the queue.

The team reviewed partial-credit requirements and the different states of a MarkingTask.

Ronie presented the notification-rule configuration and standings work. The team discussed the different notification triggers and how organisers should configure them for individual rounds.

Mlungisi presented progress on notification delivery and the student and school dashboard structure.

### Decisions

- Automatically markable work should continue through the automatic marking process.
- Work requiring human assessment should enter the marking queue.
- Partial credit must be stored with the marking result.
- Marking, moderation, and remark states must remain distinguishable.
- Notification rules should be configurable per round.
- Notification delivery should be recorded in NotificationLog.
- Students should have access to their own results and sittings.

### Action Items

- **Zandile:** Resolve remaining online sitting issues.
- **Kutloano:** Complete marking, moderation, and remark workflows.
- **Ronie:** Complete notification configuration and standings.
- **Mlungisi:** Complete notification templates and dashboard functionality.

---

## Meeting 5 — 12 September 2026

**Sprint:** Sprint 2
**Date:** 12 September 2026
**Participants:** Zandile, Kutloano, Ronie, Mlungisi
**Meeting Type:** Integration Testing

### Objective

The team integrated the major Intermediate features and tested the complete workflow from online participation through marking, progression, notifications, and results.

### Discussion

The team tested the relationship between online sittings and the marking pipeline.

Kutloano demonstrated the qualifying-threshold functionality and automatic progression logic. The team checked that entrants meeting the threshold could be registered for the next round without requiring manual data entry.

Ronie tested standings aggregation and notification configuration.

Mlungisi tested notification delivery and confirmed that notification activity could be recorded for auditing. The student and school dashboards were also reviewed.

The team identified several integration issues involving result availability and timing of downstream actions.

### Decisions

- Progression should occur after the relevant results are finalised.
- Qualifying entrants should be carried into the next round automatically.
- Standings should use finalised scores.
- Notifications should be triggered according to configured rules.
- Notification activity should be logged.
- Dashboard information should reflect the latest available results.

### Action Items

- **Zandile:** Complete final integration of sittings and archive.
- **Kutloano:** Fix progression edge cases and finalise marking tests.
- **Ronie:** Finalise standings, certificates, and notification configuration.
- **Mlungisi:** Complete notification and dashboard integration.

---

## Meeting 6 — 15 September 2026

**Sprint:** Sprint 2
**Date:** 15 September 2026
**Participants:** Zandile, Kutloano, Ronie, Mlungisi
**Meeting Type:** Sprint Review and Retrospective

### Objective

The final Sprint 2 meeting was used to review the completed Intermediate functionality, test the major workflows, and identify remaining issues before moving towards the Advanced requirements.

### Discussion

The team reviewed the online test-taking workflow, including individual sittings, timers, answer saving, and reconnect functionality.

The marking workflow was reviewed from submission through marking, partial credit, moderation, and remark requests.

The team also reviewed automatic round progression using qualifying thresholds.

Standings, certificates, configurable notifications, notification delivery, student login, and school dashboards were demonstrated and tested.

The archive functionality was also reviewed to confirm that previous-round papers could be accessed appropriately.

### Decisions

- The major Intermediate features are sufficiently integrated for the Sprint 2 outcome.
- Remaining defects will be prioritised before beginning Advanced requirements.
- Testing evidence should be retained for the implemented features.
- Documentation must be updated before the next development phase.
- The team will use the lessons from Sprint 2 when planning the Advanced requirements.

### Sprint Outcomes

| Feature | Owner | Status |
|---|---|---|
| Online Test-Taking (I1) | Zandile | Completed / Final Testing |
| Archive (B1) | Zandile | Completed |
| Extended Marking (I2) | Kutloano | Completed / Final Testing |
| Round Progression (I3) | Kutloano | Completed |
| Standings & Certificates (I6) | Ronie | Completed / Final Testing |
| Configurable Notifications (I5) | Ronie | Completed |
| Notification Sending (I4) | Mlungisi | Completed / Final Testing |
| Student Login & School Dashboard (I7) | Mlungisi | Completed / Final Testing |

### Final Action Items

- **Zandile:** Finalise Sitting and Archive documentation and resolve outstanding test issues.
- **Kutloano:** Finalise marking and progression tests and documentation.
- **Ronie:** Finalise API/testing documentation and certificate/standings testing.
- **Mlungisi:** Finalise deployment, notification, and student dashboard documentation.

### Next Steps

The team will address outstanding defects, complete final integration testing, update documentation, and prepare the system for work on the Advanced Requirements.
