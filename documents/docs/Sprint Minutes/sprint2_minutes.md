# Sprint 2 Meeting Minutes

## Meeting 1

**Date:** 26 August 2026
**Sprint:** Sprint 2
**Participants:** Zandile, Ronie, Kutloano, Mlungisi

### Meeting Objective

To analyse the Intermediate requirements and plan the implementation of online test sittings, advanced marking, and progression between rounds.

### Discussion

* The team reviewed the Intermediate requirements for Sprint 2.
* The possibility of allowing students to complete papers online was discussed.
* The team identified the need for each online sitting to have its own timer.
* The team discussed saving student answers as they are submitted.
* Connection loss and the ability for students to resume an unfinished sitting were identified as important requirements.
* The team discussed extending marking beyond multiple-choice questions.
* Non-MCQ submissions will require a marker queue.
* Partial credit and moderation were identified as additional marking requirements.
* The team discussed allowing entrants to request a remark.
* The team also reviewed the requirement for qualifying entrants to progress automatically to another round.

### Responsibilities

* **Zandile:** Extend the round and data models to support online sittings, sitting states, timers, and progression between rounds.
* **Mlungisi:** Implement sitting, answer, marking, moderation, and remark-related backend functionality.
* **Ronie:** Design the organiser interface for configuring online rounds and monitoring sittings.
* **Kutloano:** Design the student online test interface, timer, answer saving, resume functionality, and educator-facing results.

### Decisions

* Online sittings will be associated with a specific entrant and round.
* The timer will belong to an individual sitting rather than being shared globally.
* Answers must be persisted so that students can continue after losing their connection.
* The team will first implement the online sitting workflow before expanding the marking workflow.

### Action Items

* **Zandile:** Design the online sitting database structure.
* **Mlungisi:** Define the sitting and answer API requirements.
* **Ronie:** Begin organiser-side online round configuration.
* **Kutloano:** Begin the online test interface and timer design.

---

## Meeting 2

**Date:** 29 August 2026
**Sprint:** Sprint 2
**Participants:** Zandile, Ronie, Kutloano, Mlungisi

### Meeting Objective

To review the online sitting implementation and ensure that the timer and answer-saving functionality support the Intermediate requirements.

### Discussion

* The team reviewed progress on the online test functionality.
* Zandile discussed the database structure for individual student sittings.
* The team discussed how a sitting should record its start time and current state.
* The timer was discussed to ensure that each student has an independent countdown.
* Kutloano presented the online test interface and answer-selection workflow.
* The team discussed automatically saving answers as students work through a paper.
* Connection interruptions were considered, particularly how saved answers would be restored when the student reconnects.
* Ronie reviewed how organisers would monitor online rounds.
* Mlungisi discussed the backend endpoints required to save and retrieve answers.

### Decisions

* The server will remain the authoritative source for the sitting's timing information.
* Answers will be saved incrementally rather than only when the student submits the complete paper.
* Students will be able to retrieve their previous answers when resuming a sitting.
* A sitting will retain its state while the round remains active.

### Action Items

* **Zandile:** Implement sitting state and timing support.
* **Mlungisi:** Implement save-answer and resume-sitting endpoints.
* **Ronie:** Continue the organiser monitoring interface.
* **Kutloano:** Connect the online test interface to the answer-saving endpoints.

---

## Meeting 3

**Date:** 2 September 2026
**Sprint:** Sprint 2
**Participants:** Zandile, Ronie, Kutloano, Mlungisi

### Meeting Objective

To test online sittings and implement support for students resuming their tests after connection interruptions.

### Discussion

* The team tested the creation of online sittings for individual entrants.
* The timer behaviour was reviewed during active sittings.
* The team tested answers being saved while a student progressed through the paper.
* Connection loss scenarios were discussed and tested.
* The team verified that previously saved answers could be retrieved when the student returned.
* The team discussed what should happen when a sitting reaches the end of its allotted time.
* Ronie reviewed the organiser dashboard for visibility of active sittings.
* Kutloano refined the student interface to make the current question, saved answers, and remaining time clear.
* Mlungisi tested the backend endpoints responsible for saving and restoring sitting information.

### Decisions

* Saved answers must remain associated with the correct sitting.
* Reconnecting students should continue from their existing sitting instead of starting a new one.
* The system must prevent a completed or expired sitting from being resumed incorrectly.
* The timer and sitting state must remain consistent between the frontend and backend.

### Action Items

* **Zandile:** Resolve any timing and sitting-state issues discovered during testing.
* **Mlungisi:** Test resume functionality and endpoint validation.
* **Ronie:** Improve organiser visibility of online sittings.
* **Kutloano:** Refine the online test and resume experience.

---

## Meeting 4

**Date:** 7 September 2026
**Sprint:** Sprint 2
**Participants:** Zandile, Ronie, Kutloano, Mlungisi

### Meeting Objective

To implement marking functionality for questions that cannot be automatically marked.

### Discussion

* The team reviewed the Intermediate marking requirements.
* It was agreed that questions which cannot be automatically marked should enter a marker queue.
* The team discussed how markers would receive and process submissions.
* Partial credit was identified as necessary for questions where an entrant receives only part of the available marks.
* The team discussed the moderation process after marking.
* The remark process for entrants was also discussed.
* Mlungisi presented the planned marking workflow and backend structures.
* Kutloano discussed how results and marking statuses could be displayed to educators.
* Zandile reviewed the relationship between submissions, results, entrants, and rounds.

### Decisions

* Automatically markable questions will continue through the automatic marking process.
* Non-MCQ questions will be placed into a marker queue.
* Marker results must support partial marks.
* A moderation stage will be included before final results are confirmed.
* A remark request will create a reviewable record associated with the entrant's result.

### Action Items

* **Zandile:** Update relevant data structures for marking and result states.
* **Mlungisi:** Implement the marker queue, partial-credit logic, moderation workflow, and remark endpoints.
* **Ronie:** Add organiser views for monitoring marking and moderation.
* **Kutloano:** Add appropriate educator/result views for marking statuses and final results.

---

## Meeting 5

**Date:** 11 September 2026
**Sprint:** Sprint 2
**Participants:** Zandile, Ronie, Kutloano, Mlungisi

### Meeting Objective

To integrate online sittings with the marking workflow and begin implementing progression between rounds.

### Discussion

* The team reviewed the integration between online sittings and the existing submission workflow.
* Online submissions were tested to ensure they could proceed into the appropriate marking process.
* The team tested both automatically marked and manually marked question types.
* Partial-credit results were reviewed.
* The moderation workflow was tested using sample marked submissions.
* The team discussed how an entrant's final score would determine whether they qualify for the next round.
* Zandile presented the planned qualifying threshold structure.
* The team discussed automatically identifying entrants who meet the required threshold.
* Ronie reviewed how organisers could configure and view qualifying entrants.
* Kutloano reviewed how students and educators would see progression information.

### Decisions

* Final results will be calculated after the appropriate marking and moderation stages.
* A qualifying threshold will determine which entrants progress.
* Qualified entrants should be carried into the next round automatically.
* Organisers should not need to manually rebuild the entrant list for the next round.

### Action Items

* **Zandile:** Implement qualifying thresholds and automatic entrant progression.
* **Mlungisi:** Ensure final marked results are available to the progression logic.
* **Ronie:** Add organiser controls for configuring thresholds and viewing qualifiers.
* **Kutloano:** Display progression and result information in the educator/student interfaces.

---

## Meeting 6

**Date:** 15 September 2026
**Sprint:** Sprint 2
**Participants:** Zandile, Ronie, Kutloano, Mlungisi

### Meeting Objective

To review Sprint 2 against the Intermediate requirements, test the integrated functionality, and identify outstanding work.

### Discussion

* The team reviewed all Intermediate functionality implemented during Sprint 2.
* Online student sittings were tested from creation through completion.
* Individual sitting timers were tested.
* Answer saving was tested throughout an online paper.
* Connection-loss and resume functionality were tested.
* The team reviewed the marker queue for non-MCQ questions.
* Partial-credit marking was tested.
* The moderation workflow was reviewed.
* The remark-request workflow was reviewed.
* Qualifying thresholds and automatic progression between rounds were tested.
* The organiser and educator interfaces were reviewed for the new functionality.
* Remaining defects and improvements were documented for future development.

### Sprint 2 Outcome

The team progressed the portal beyond the Basic requirements by implementing the main Intermediate workflows: online test sittings with individual timers, persistent answers and resume support, extended marking with a marker queue and partial credit, moderation and remark functionality, and progression between rounds based on qualifying thresholds. These requirements are specified in the Intermediate section of the project brief.

### Final Action Items

* **Zandile:** Finalise sitting, timing, round progression, and qualifying-threshold functionality.
* **Mlungisi:** Finalise manual marking, partial credit, moderation, remark handling, and related API documentation.
* **Ronie:** Finalise organiser controls and perform responsiveness/accessibility checks on the new functionality.
* **Kutloano:** Finalise the online test, resume, results, and progression interfaces and update the Docusaurus guides.

### Next Steps

* Resolve remaining Sprint 2 defects.
* Complete testing of the Intermediate workflows.
* Prepare the system for the Advanced requirements.
* Ensure documentation reflects the newly implemented functionality.
