# Sprint 1 Meeting Minutes

## Meeting 1

**Date:** 4 August 2026
**Sprint:** Sprint 1
**Participants:** Zandile, Ronie, Kutloano, Mungisi

### Meeting Objective

To understand the Basic requirements of the Olympiad Portal, divide the system into development areas, and establish the initial implementation plan.

### Discussion

* The team reviewed the Basic requirements of the Olympiad Portal.
* The core users identified were the organiser, schools, educators, and entrants.
* The team discussed the importance of the round lifecycle, including opening and closing times.
* It was agreed that rounds must change state automatically according to their schedules.
* The team discussed the requirement for organisers to upload papers and maintain an archive of past papers.
* The educator portal needs to allow educators to download papers, submit results, and receive confirmation of accepted submissions.
* The team discussed automatic marking for multiple-choice submissions and releasing results when the round closes.
* The organiser console and educator portal were identified as the two main interfaces.

### Responsibilities Confirmed

* **Zandile:** Round lifecycle, data core, database setup, scheduler, and Round/Olympiad API endpoints.
* **Mungisi:** Submissions, marking, paper endpoints, authentication integration, and external API integration.
* **Ronie:** Organiser console, including round setup, paper upload, and organiser dashboard.
* **Kutloano:** Educator portal, including paper downloads, submissions, receipts, and results.

### Decisions

* Development will be divided according to the agreed responsibilities.
* Zandile will own the system-design section of the Initial Design document.
* Mungisi will maintain the API documentation.
* Ronie will be responsible for accessibility and responsiveness on the organiser side.
* Kutloano will establish the Docusaurus documentation site and getting-started guides.

### Action Items

* **Zandile:** Begin database and system design for Olympiad, Round, School, and Entrant.
* **Mungisi:** Begin designing Submission and Result structures.
* **Ronie:** Create the initial organiser console structure.
* **Kutloano:** Create the initial educator portal structure.

---

## Meeting 2

**Date:** 7 August 2026
**Sprint:** Sprint 1
**Participants:** Zandile, Ronie, Kutloano, Mungisi

### Meeting Objective

To review the initial development progress and confirm how the backend and frontend components will interact.

### Discussion

* Zandile presented the initial structure for the core database entities.
* The team discussed relationships between Olympiads, rounds, schools, and entrants.
* The round opening and closing times were discussed in more detail.
* The team agreed that the scheduler should determine whether a round is upcoming, open, or closed.
* Mungisi discussed the planned Submission and Result models.
* The paper upload and download flow was discussed between the backend and frontend members.
* Ronie outlined the organiser dashboard and round setup interface.
* Kutloano outlined the educator workflow for finding and downloading papers.

### Decisions

* The backend APIs will provide the functionality required by both frontend portals.
* Frontend components will consume the backend endpoints rather than directly accessing the database.
* The round state will control whether papers can be downloaded and whether submissions can be accepted.
* The team will keep the Basic requirements as the priority for Sprint 1.

### Action Items

* **Zandile:** Continue database setup, migrations, and round lifecycle implementation.
* **Mungisi:** Continue Submission/Result endpoints and paper upload/download endpoints.
* **Ronie:** Continue the organiser dashboard and round setup UI.
* **Kutloano:** Continue the educator paper download and submission interfaces.

---

## Meeting 3

**Date:** 11 August 2026
**Sprint:** Sprint 1
**Participants:** Zandile, Ronie, Kutloano, Mungisi

### Meeting Objective

To review the implementation of the round lifecycle and core paper/submission functionality.

### Discussion

* The team reviewed the progress of the database and core backend structures.
* Zandile discussed the implementation of scheduled round state transitions.
* The team verified that a paper should not be downloadable before its round opens.
* Mungisi discussed the paper upload and download endpoints.
* The submission process was discussed, including the requirement that educators submit results within the active round window.
* The team discussed the need for submission receipts to confirm what the portal accepted.
* Ronie demonstrated progress on the organiser round setup interface.
* Kutloano demonstrated progress on the educator paper download flow.

### Decisions

* Round state checks will be handled by the backend to ensure consistent behaviour.
* Paper access will be controlled according to the associated round.
* Submission responses will provide confirmation that an accepted submission was received.
* The frontend portals will display backend validation messages where appropriate.

### Action Items

* **Zandile:** Complete the main round lifecycle logic and Round/Olympiad endpoints.
* **Mungisi:** Complete paper and submission endpoints and begin receipt handling.
* **Ronie:** Connect the organiser UI to the Round/Olympiad endpoints.
* **Kutloano:** Connect the educator portal to the paper and submission endpoints.

---

## Meeting 4

**Date:** 14 August 2026
**Sprint:** Sprint 1
**Participants:** Zandile, Ronie, Kutloano, Mungisi

### Meeting Objective

To integrate the backend and frontend components and review the submission and marking workflow.

### Discussion

* The team reviewed the integration between the organiser console, educator portal, and backend APIs.
* Zandile reported on the round state transition functionality.
* Mungisi discussed the automatic marking process for multiple-choice papers.
* The team reviewed how submissions would be associated with their corresponding rounds and results.
* Ronie worked on consuming the backend endpoints from the organiser console.
* Kutloano worked on displaying submission receipts in the educator portal.
* The team discussed authentication integration on the backend.
* The SendGrid integration was discussed as part of the planned external API functionality for reminders and receipts.

### Decisions

* Multiple-choice submissions will be marked automatically against the relevant memo.
* Results will be associated with the appropriate submission and entrant.
* Authentication will be handled through the agreed backend authentication integration.
* API documentation will be maintained alongside endpoint development.

### Action Items

* **Zandile:** Continue testing scheduled round transitions and core APIs.
* **Mungisi:** Complete the MCQ automarking logic and continue authentication/API integration.
* **Ronie:** Integrate organiser dashboard functionality and begin responsiveness checks.
* **Kutloano:** Complete receipt and submission views and begin the Docusaurus documentation setup.

---

## Meeting 5

**Date:** 19 August 2026
**Sprint:** Sprint 1
**Participants:** Zandile, Ronie, Kutloano, Mungisi

### Meeting Objective

To test the integrated Basic functionality and identify issues before the final Sprint 1 review.

### Discussion

* The team performed an end-to-end review of the main Basic workflow.
* The round lifecycle was tested from setup through opening and closing.
* Paper upload and download functionality was reviewed.
* The team tested educator submissions during an open round.
* Late submissions were discussed to ensure that submissions are not accepted after the round closes.
* Automatic MCQ marking was tested using sample submissions.
* The team reviewed how results would be made available when a round closes.
* Ronie reviewed the organiser interface for responsiveness and accessibility.
* Kutloano reviewed the educator portal and documentation progress.
* Mungisi reviewed the API documentation and backend integration.

### Decisions

* Issues affecting the Basic requirements will be prioritised before additional functionality.
* The organiser and educator interfaces must correctly reflect the state of the round.
* The team will perform another complete integration test before the final Sprint 1 meeting.

### Action Items

* **Zandile:** Fix issues identified in round scheduling and state transitions.
* **Mungisi:** Fix backend submission/marking issues and update API documentation.
* **Ronie:** Complete the organiser-side responsiveness and accessibility checks.
* **Kutloano:** Complete the main educator workflows and continue the getting-started documentation.

---

## Meeting 6

**Date:** 24 August 2026
**Sprint:** Sprint 1
**Participants:** Zandile, Ronie, Kutloano, Mungisi

### Meeting Objective

To review Sprint 1 progress against the Basic requirements and agree on the remaining work.

### Discussion

* The team reviewed all work completed during Sprint 1.
* The round lifecycle and scheduled state transitions were reviewed.
* The core data structures for Olympiads, rounds, schools, and entrants were reviewed.
* Paper upload and controlled paper download were reviewed.
* Educator result submission and submission receipts were reviewed.
* Automatic marking for multiple-choice submissions was reviewed.
* The organiser console and educator portal were reviewed.
* The team checked the integration between frontend interfaces and backend APIs.
* Accessibility and responsiveness work on the organiser side was reviewed.
* API documentation and the Docusaurus documentation site were reviewed.
* Remaining issues and improvements were recorded for the next development period.

### Sprint 1 Outcome

The team established and integrated the main components required for the Basic functionality of the Olympiad Portal. The main workflow now covers round management, paper management, educator submissions, automatic MCQ marking, and access to results. These correspond to the core Basic requirements specified for the portal.

### Final Action Items

* **Zandile:** Finalise remaining Round/Olympiad API and scheduler issues and update the system-design section.
* **Mungisi:** Finalise submission and marking functionality, authentication integration, external API work, and API documentation.
* **Ronie:** Finalise organiser console functionality and complete responsiveness/accessibility checks.
* **Kutloano:** Finalise educator portal functionality and Docusaurus getting-started documentation.

### Next Steps

* Address outstanding Sprint 1 issues.
* Stabilise the Basic requirements.
* Prepare the project for the next set of development tasks.
