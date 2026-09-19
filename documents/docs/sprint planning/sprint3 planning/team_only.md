# Sprint 3 Planning — Team Meeting

**Project:** Olympiad Portal
**Meeting type:** Sprint planning — team only
**Date:** 15 September 2926
**Time:** 15:00 – 16:00
**Location:** MSL 005
**Attendees:**
- Zandile 
- Kutloano
- Ronie
- Mlungisi

**Sprint duration:** 25 September 2026 – 29 September 2026

---

## 1. Purpose of the meeting

To finalise the Sprint 3 task breakdown and assign ownership, following the earlier stakeholder session where scope and the rubric were reviewed together.

## 2. Sprint 3 requirements and rubric — reviewed as a team

Revisited the rubric to make sure task assignment targets the "Advanced" column on every criterion:

| Criterion | Weight | Advanced (target) |
|---|---|---|
| User Feedback | 10% | Extensive user testing and feedback gathering |
| Automated Testing | 10% | Extensive automated testing across all code bases (>60% coverage) |
| Feature Implementation | 20% | Most/all features implemented with minimal or non-severe bugs |
| API Implementation | 20% | All endpoints implemented, mostly bug free |
| Performance | 5% | No performance issues |
| Improvement | 5% | Extensive evidence of integrating user and stakeholder feedback |
| Documentation | 15% | All aspects of the project well documented |
| Project Methodology | 15% | Evidence of strictly following methodology |

**Team discussion:**
- Agreed to prioritise depth over breadth on Advanced features — a smaller set implemented solidly with tests scores better than attempting all Advanced items with bugs, per the rubric's own grading bands.
- Agreed test coverage stays owned by whoever builds a feature, not deferred to a testing pass at the end.
- Agreed deployment needs to happen with margin before the 29th, not on the deadline day, to leave time for load testing and fixes.

## 3. Sprint 3 scope

Advanced features in scope this sprint:

1. **Co-organiser access for olympiads** — allow multiple organisers per olympiad, with the ability to add organisers and view the current organiser list
2. **Multi-olympiad support** — proper scoping so several olympiads can run concurrently, each with its own timezone, without data leaking across olympiads
3. **Audit log and round replay** — log every automatic scheduler action and let organisers replay a round's history
4. **Concurrency and boundary correctness** — ensure round open/close and submissions are judged against one authoritative clock and behave correctly under concurrent load
5. **Appeals and reviewer workflow** — route a mark appeal to a reviewer and reflect the outcome in standings, including safe re-triggering of qualification/auto-advance

Out of scope this sprint (explicitly deferred): question-bank variants, and merging the online/offline sitting routes into a single deduplicated result set.

## 4. Task assignment

### Zandile — Scrum, Documentation, Feedback, Deployment & Performance
- Maintain sprint board and daily standups
- Publish sprint plan and retrospective
- Run user testing sessions and collect stakeholder feedback
- Document feedback → action → outcome trail
- Deploy Sprint 3 changes (backend, frontend, docs)
- Own post-deploy performance monitoring; coordinate load testing with Person 3

### Mlungisi — Co-organiser Access, Multi-Olympiad/Timezone, Audit Log & Replay
- **Sequenced first:** co-organiser access (`OlympiadOrganiser` join table, access-control rewrite across olympiad-scoped routes, add/list organiser UI)
- Multi-olympiad scoping and timezone-aware scheduling
- Audit log of automatic scheduler actions
- Round replay view

### Kutloano — Concurrency & Boundary Correctness
- Single authoritative clock for round transitions
- Exactly-once submission handling under concurrent load
- Concurrent/load tests for round open and round close
- Load testing against the deployed environment (with Person 1)

### Ronie — Appeals & Reviewer Workflow
- Extend appeal/remark model to support reviewer routing
- Reviewer-facing UI to action appeals
- Wire appeal outcomes into standings and auto-advance
- Handle appeals resolving after publication/certificates

*(Full user stories, acceptance criteria, and task breakdowns tracked in Taiga.)*

## 5. Risks and open questions

- Co-organiser access and multi-olympiad scoping touch the same authorization logic — sequencing co-organisers first to avoid rework
- Open product question: can an added organiser remove the original creator or other organisers, or is that creator-only? **Needs a decision before Mlungisi builds removal logic.**
- Concurrency work carries the highest risk of surfacing bugs late — flagged for early start and dedicated load-testing time before the 29th


---
*Minutes recorded by: Zandile Mkontwana*