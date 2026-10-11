---
sidebar_label: Milestone 4 demo script
sidebar_position: 12
---

# Milestone 4 Demo Script

A guided walkthrough of the Olympiad Portal for the Milestone 4 presentation. The demo covers all four roles and every Sprint 4 standout feature, end to end.

**Estimated duration:** 15–20 minutes

**Prerequisites:**
- Production backend live at `https://olympiad-portal-backend.onrender.com`
- Production frontend live on Vercel
- Seeded production data (US-4.3) populated
- Educator and organiser Clerk accounts with device verification completed
- At least one student account with a set password

---

## 1. Landing Page & First Impressions (1 min)

1. Open the production frontend URL.
2. Point out the branding, hero section, and feature cards.
3. Toggle **dark mode** — show the CSS-variable palette, the `aria-pressed` toggle, and that the preference persists.
4. Toggle back to light mode. Mention `prefers-color-scheme` as the default for first visits.

---

## 2. Organiser Journey (5 min)

### Sign in
1. Select **Organiser** on the login page.
2. Sign in with Clerk — show the Clerk widget, role routing to `/organiser`.

### Dashboard & Activity Feed (US-4.1)
1. Point out the **real-time activity feed** on the organiser dashboard.
2. Show the Connecting → Live status transition.
3. Trigger an event (e.g., release results for a round) — the feed should show the event in real time.

### Question Bank & Variants (US-1.1, US-1.2)
1. Navigate to a paper's **Questions** page.
2. Show the question list with **difficulty badges**.
3. Click a question to show its **variants** — different text and memo answers per variant.
4. Explain deterministic per-entrant assignment (hash of entrant + question IDs).

### Analytics Dashboard (US-1.4)
1. Navigate to a **closed round** page.
2. Show the **participation chart**, **score distribution histogram**, **per-question performance**, and **per-school breakdown**.
3. Mention these are fed by real seeded production data.

### Duplicate Detection & Anti-Cheating (US-2.1, US-2.2)
1. Navigate to the **Duplicates** page.
2. Show flagged duplicate entrants with **confidence tiers**.
3. Open a round's standings — show the **duplicate warning badge** next to flagged entrants.
4. If demo data includes cheating signals, show the **signal badges** and the detail modal.

### Co-Organiser Management
1. Show the co-organiser list on an olympiad.
2. Add or list organisers — membership-based access control.

### Audit Log & Round Replay
1. Show the **audit log** for a round.
2. Open the **replay timeline** — every scheduler action recorded.

---

## 3. Educator Journey (4 min)

### Sign in
1. Sign out from the organiser account.
2. Select **Educator** on the login page.
3. Sign in with Clerk — role routing to `/educator`.

### School Dashboard
1. Show the **school dashboard**: entrant count, total submissions, per-student summaries.
2. Point out the **analytics charts** on a round view (US-1.5) — participation, score distribution, per-question metrics scoped to the school.

### Register a Student
1. Navigate to **Register Students**.
2. Walk through the registration form: name, email, grade, olympiad selection.
3. Show the **invitation email** that the student receives.

### Onboarding Tour (US-3.4)
1. If available, sign in with a fresh educator account to trigger the **first-user onboarding tour**.
2. Walk through the tour steps: dashboard, register students, rounds, submit results, standings.
3. Dismiss the tour — show that the dismissed state persists per account.

### Account Deletion (US-2.3)
1. Open the sidebar profile section.
2. Show the **delete account** button and the confirmation dialog with ARIA semantics.
3. Cancel the deletion (don't actually delete the demo account).

---

## 4. Student Journey (5 min)

### Sign in
1. Sign out from the educator account.
2. Select **Student** on the login page.
3. Sign in with email and password — show the JWT-based student auth flow.
4. **Forgot password?** — show the link, enter an email, show the "check your email" confirmation. Explain the self-service reset flow.

### Student Dashboard
1. Show the **student dashboard**: available rounds, sittings, results.
2. Point out **locked rounds** with prerequisite gating info (e.g., "Score at least 60% in Round 1").

### Online Sitting (Sprint 2)
1. Start a sitting for an open round.
2. Show the **timer**, the **question variants** (different from other students' for the same question).
3. Answer a few questions — show **autosave** in action.
4. Submit — show the **automarking result** and the score.
5. Show the **exactly-once** guarantee: try to submit again, get the original submission back.

### Review Results
1. Navigate to a **released result**.
2. Show the student's answer alongside the correct answer for each question.
3. Download the **certificate** PDF.

### Session Persistence (US-2.5)
1. During a sitting, **refresh the browser**.
2. Show that the sitting resumes from where it left off — autosave data intact, timer still running.

---

## 5. Responsive Layout (US-3.1, 1 min)

1. Resize the browser to **320 px** — show the mobile layout with collapsible sidebar.
2. Resize to **768 px** — show the tablet layout.
3. Resize to **1024 px** — show the desktop layout.
4. Mention that every page is verified at all three breakpoints.

---

## 6. Accessibility (US-3.2, 1 min)

1. Navigate using **keyboard only** — Tab through the organiser dashboard.
2. Show the **skip link** on page load.
3. Show the `aria-pressed` state on the theme toggle.
4. Mention **Lighthouse accessibility 100** on all 21 pages in both themes.

---

## 7. External API & API Keys (1 min)

1. Show the **API key management** page on the organiser console.
2. Create an API key — show the key value (displayed once).
3. Use `curl` to query the **public API** (no auth): `GET /api/olympiads`.
4. Use `curl` with the API key to query the **extended API**: `GET /api/external/rounds/:id/results`.

---

## 8. Under the Hood (1 min)

1. **CI/CD**: show the Gitea Actions workflow — lint + test on every push, auto-deploy to Netlify (docs), Render (backend), Vercel (frontend).
2. **Load testing**: mention the first full-size deployed run — 565 requests, zero errors, exactly-once verified.
3. **Test coverage**: 709 backend tests + 491 frontend tests = 1,200 total, all passing, above coverage thresholds.

---

## 9. Documentation Site

1. Open `https://olympiad-portal-docs.netlify.app`.
2. Show the features page, API reference, database schema, known limitations, third-party code documentation.
3. Mention it's built with Docusaurus and auto-deployed to Netlify on every push to `main`.

---

## Backup / Fallback

If a live feature doesn't work during the demo:
- **Activity feed**: the feed is in-memory; if the Render service restarted, it starts empty. Trigger a new event to populate it.
- **Clerk sign-in**: if Clerk is slow, have the student email/password flow ready as the primary demo path.
- **Email sending**: if SendGrid is rate-limited, show the branded email templates in the codebase and the dry-run preview.
- **Render cold start**: the free tier spins down after 15 minutes. Send a warmup request before the demo, or expect a ~27 second delay on the first request.
