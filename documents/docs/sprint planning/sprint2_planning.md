---
sidebar_position: 7
---

# Sprint 2 Planning

- **Sprint:** Sprint 2
- **Dates:** 25 August 2026 – 15 September 2026
- **Participants:** Zandile, Kutloano, Ronie, Mlungisi

## Sprint Goal

The goal of Sprint 2 is to implement the Intermediate Requirements and extend the existing Basic functionality of the Olympiad Portal.

## Sprint Objectives

- Implement online test-taking with timed sittings, auto-save and resume functionality.
- Provide an archive of papers from previous rounds.
- Implement extended marking, partial credit, moderation and remark requests.
- Implement qualifying thresholds and automatic progression between rounds.
- Implement configurable and automated notifications.
- Provide standings and certificate generation.
- Add student login and school dashboards.
- Test and integrate all new functionality.

## Stakeholder Input

Lauren (client) joined the sprint planning session on 25 August. Two pieces of input came out of that discussion:

- **Scope** — the Intermediate requirements for the sprint were walked through with her and confirmed as the direction.
- **Deployment advice** — with the Railway trial ending, she advised researching Render and Vercel to see which suited us. The team evaluated both: Vercel already hosts the frontend and fits it well, but the backend's round-lifecycle scheduler needs a long-running process, which Vercel's serverless functions don't provide — Render does. Following that advice, the database was moved to Supabase during the sprint and the backend was deployed to Render at sprint close.

## Team Responsibilities

**Zandile — Online Test-Taking & Archive**
- Develop the Sitting model and online sitting APIs.
- Implement timed online tests, auto-save and resume functionality.
- Develop the archive for previous-round papers.
- Write API and UI tests for online sittings.
- Maintain Sitting database and timer documentation.

**Kutloano — Extended Marking & Progression**
- Develop the MarkingTask model and marking queue.
- Implement partial credit, moderation and remark requests.
- Add qualifying thresholds to rounds.
- Implement automatic progression to the next round.
- Write marking and progression tests.

**Ronie — Standings & Notifications**
- Implement standings and ranking functionality.
- Generate downloadable certificates.
- Develop configurable notification rules.
- Create the organiser notification configuration interface.
- Maintain API and testing documentation.

**Mlungisi — Notification Sending & Dashboards**
- Implement notification email templates and SendGrid integration.
- Create notification logs and scheduled notification jobs.
- Add student authentication and the student role.
- Develop student and school dashboards.
- Maintain deployment and third-party integration documentation.

## Sprint Deliverables

By the end of Sprint 2, the team aims to have:

- Online test-taking functionality.
- An archive of previous papers.
- Extended marking and moderation.
- Automatic round progression.
- Configurable and automated notifications.
- Standings and certificates.
- Student login.
- Student and school dashboards.
- Completed testing and documentation.

## Definition of Done

A feature is complete when it has been implemented, integrated with the existing system, tested, documented, and reviewed by the team.
