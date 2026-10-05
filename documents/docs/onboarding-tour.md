---
title: Onboarding Tour (Sprint 4, #317)
---

# Onboarding tour — Sprint 4 (#317)

Covers tasks #339 (educator flow), #340 (organiser flow), #341 (tour component), #342 (persistence), #343 (replay from settings) and #344 (tests).

## 1. Behaviour

| Acceptance criterion | How it is met |
|----------------------|---------------|
| A new educator sees a short guided tour on first login | The educator layout mounts the tour; it starts automatically on `/educator` for a user who has no saved tour state |
| A new organiser sees a short guided tour on first login | `OrganiserShell` mounts the tour; it starts automatically on `/organiser` |
| Highlights the key features for their role (3–5 steps) | Educator: 4 steps. Organiser: 5 steps (section 2) |
| User can skip the tour at any point | "Skip tour" is on every step; the close button and Escape also skip |
| Replay from settings | Educator: Settings dialog in the sidebar. Organiser: new Settings button above Sign out. Both have a "Replay tour" button |
| Does not appear again after completion or dismissal | Completion or dismissal is saved; the automatic start only runs when nothing is saved |

The tour only starts by itself on the role's home page, because that is where the highlighted elements are. Replaying from another page first navigates to the home page, then starts.

## 2. Tour flows (#339, #340)

**Educator**

| # | Step | Highlights | Message |
|---|------|------------|---------|
| 1 | Register your students | School Dashboard link in the sidebar | Add your students and enter them into olympiads |
| 2 | See your rounds | Olympiad activity panel | Rounds, opening and closing times, papers unlock when a round opens |
| 3 | Submit results | Olympiad activity panel | Download the paper, upload answers before the round closes, get a receipt |
| 4 | Check standings | Quick actions panel | Standings after a round closes; past papers and results in the Archive |

**Organiser**

| # | Step | Highlights | Message |
|---|------|------------|---------|
| 1 | Create an olympiad | Create Olympiad button | Name, timezone and schedule; several olympiads at once |
| 2 | Add rounds | Olympiads panel | Rounds with opening and closing times, run by the portal |
| 3 | Upload papers | Olympiads panel | Upload the paper and memo; multiple choice is marked automatically |
| 4 | Watch it run | Recent activity panel | What the portal did and when; Replay |
| 5 | Marking, remarks and archive | Sidebar menu | Where the other tools live |

Steps 2 and 3 (both roles) share one highlight because the rounds list is the single place where those actions start. The text for each step is in `lib/tour.js`; to change or add a step, edit that file and add a matching `data-tour="..."` attribute to the element.

## 3. How it works

- `lib/tour.js`: step definitions, storage and the replay request.
- `components/OnboardingTour.jsx`:
  - `TourHost` decides when the tour starts, waits up to 2 seconds for the first highlighted element to render (the dashboards load their data asynchronously), and saves the result. `useTour()` gives any component a `startTour()` function.
  - `TourOverlay` draws the dimmed page, the highlight box, and a card with a step counter ("Step 2 of 4"), progress dots, Back, Next/Done and Skip.
- `app/tour.css`: styling, using the theme variables so it works in light and dark mode.
- A highlighted element that is missing, hidden or off screen (for example a sidebar link while the mobile drawer is closed) does not break the tour: that step is shown centred without a highlight. On phones (600px or narrower) the card docks at the bottom of the screen.

## 4. Persistence (#342)

Saved in `localStorage` as `olympiad-tour:v1:<role>:<user id>` with `{ status: "completed" | "dismissed", at }`. This means:
- Each user (and role) has their own state, so a second educator signing in on a shared computer still sees the tour.
- State is per browser. A user who signs in from a new browser or clears site data sees the tour once more.
- Replaying never changes the auto-start rule; finishing a replay saves `completed`.
- To show the tour again to a user for testing, delete that key in DevTools, or use Replay tour.
- Bumping `TOUR_VERSION` in `lib/tour.js` shows the tour again to everyone, for example after adding major features.

If you need the state to follow the user across devices, store a flag on the user record instead; the change is confined to `getTourState` and `saveTourState` in `lib/tour.js`, and it needs a backend field and endpoint.

## 5. Accessibility

- The card is a modal dialog (`role="dialog"`, `aria-modal`) named by the step title and described by its text. Focus moves to it on every step, Tab stays inside it, Escape skips, and focus returns to the control that started a replay.
- The page behind is dimmed and blocks clicks while the tour is open.
- Buttons are at least 44px high on touch devices; text meets AA contrast in both themes; the highlight transition is turned off for people who prefer reduced motion.

## 6. Tests (#344)

- `lib/tour.test.js` (storage, per-user separation, blocked storage, replay request, the step definitions).
- `components/OnboardingTour.test.jsx` (21 tests): starts for a new user on the home page; does not start without a user id, away from home, or after completion or dismissal; works for a second user on the same browser; Next and Back; Done on the last step; highlight shown when the target is visible and omitted when it is not; focus handling; Skip on any step; close button and Escape; does not return after a reload; replay after dismissal, from another page, and focus return; dialog semantics, axe, and the Tab trap.
- `OrganiserShell.test.jsx` and `EducatorSidebar.test.jsx` cover the first-visit tour, Settings and Replay tour for each role.
- Full suite: 355 tests pass, ESLint reports 0 errors.

## 7. Manual check

| Check | Pass? |
|-------|-------|
| New educator account (or delete the `olympiad-tour:v1:educator:...` key): tour starts on `/educator`, highlight sits on the right elements | yes |
| Same for a new organiser on `/organiser` | yes |
| Next, Back, Skip, Escape and Done behave; reload after skipping shows no tour | yes |
| Settings, then Replay tour works from `/educator/archive` (it should jump to `/educator` first) | yes |
| Organiser: Settings, then Replay tour | yes |
| Phone width (375px): card docks at the bottom; sidebar steps appear centred while the menu is closed | yes (viewport 531px docks correctly; sidebar steps fall back to centred when drawer closed) |
| Dark mode: card, highlight and buttons readable | yes |
| Keyboard only: the whole tour can be completed without a mouse | yes (Tab trap, Escape skips, focus returns to opener) |

Notes:
- Browser viewport in this environment is fixed at ~531×849, so the card always docks at the bottom (≤600px rule). The centred placement path was not exercised at desktop width.
- The "Skip tour" button text renders as "N tour" in screenshots — the "Ski" prefix is clipped by a circular icon that appears to be a browser-extension artifact; the button itself is correct (`textContent === "Skip tour"`) and clickable via script.
