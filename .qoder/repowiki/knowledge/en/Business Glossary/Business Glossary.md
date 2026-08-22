---
kind: business_term
name: Business Glossary
category: business_term
scope:
    - '**'
---

### Olympiad
- Definition：Top-level competition entity that groups one or more Rounds; each Olympiad has a name and a timezone used for display.

### Round
- Definition：A single timed contest within an Olympiad, governed by a state machine: scheduled → open → closed → results released. State transitions are driven automatically by comparing `openTime`/`closeTime` against UTC every 30 seconds; no manual button press moves a Round between states.

### Entrant
- Definition：A competing student registered against a School. Entrants are linked to specific Rounds via the RoundEntrant table, which is what drives the 'Submit Results' flow — educators can only submit for entrants registered to that round.

### Educator
- Definition：A User account linked to a School; educators upload results on behalf of their school's entrants and are the only role that creates Submissions.

### Submission
- Definition：An educator's batch of answers/results for their entrants in a given Round. Each Submission carries a unique `idempotencyKey` so retries do not duplicate recorded results.

### Result
- Definition：The mark produced for a Submission. The `releasedAt` field stays empty until marking is complete and the Round reaches the 'results released' state, preventing schools from seeing scores early.

### Paper
- Definition：A Round's uploaded test PDF and its memo (answer key). The memo also stores structured JSON (`memoAnswers`) mapping question numbers to correct answers so automarking can read them programmatically. Papers are gated by Round state — not downloadable before `open`.

### RoundEntrant
- Definition：Junction table linking an Entrant to a specific Round. A unique constraint on `(roundId, entrantId)` prevents duplicate registration and powers the list shown on the educator's submission page.

### Automarking
- Definition：Automatic scoring of submissions using the structured `memoAnswers` JSON stored alongside the Paper's memo, rather than manual grading.
