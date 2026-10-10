/**
 * Onboarding tour: storage and step definitions (#339, #340, #342).
 *
 * Completion state is kept in localStorage per role AND per user id, so a
 * second educator signing in on the same browser still sees the tour. It is
 * stored as { status: 'completed' | 'dismissed', at: ISO date }. Replaying
 * the tour never auto-starts it again; only a brand-new user (no entry) gets
 * the automatic tour.
 */
export const TOUR_VERSION = 'v1';

export function tourStorageKey(role, userId) {
  return `olympiad-tour:${TOUR_VERSION}:${role}:${userId}`;
}

/** { status, at } or null when the user has never finished or dismissed it. */
export function getTourState(role, userId) {
  if (!userId) return null;
  try {
    const raw = window.localStorage.getItem(tourStorageKey(role, userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && (parsed.status === 'completed' || parsed.status === 'dismissed')
      ? parsed
      : null;
  } catch {
    return null; // storage blocked or corrupt value
  }
}

export function saveTourState(role, userId, status) {
  if (!userId) return;
  try {
    window.localStorage.setItem(
      tourStorageKey(role, userId),
      JSON.stringify({ status, at: new Date().toISOString() })
    );
  } catch {
    /* ignore: the tour simply may show again next time */
  }
}

export function clearTourState(role, userId) {
  if (!userId) return;
  try {
    window.localStorage.removeItem(tourStorageKey(role, userId));
  } catch {
    /* ignore */
  }
}

const REPLAY_KEY = 'olympiad-tour-replay';

/** Remember (for this tab) that a replay was asked for, across a page change. */
export function requestReplay(role) {
  try {
    window.sessionStorage.setItem(REPLAY_KEY, role);
  } catch {
    /* ignore */
  }
}
export function isReplayRequested(role) {
  try {
    return window.sessionStorage.getItem(REPLAY_KEY) === role;
  } catch {
    return false;
  }
}
export function clearReplayRequest() {
  try {
    window.sessionStorage.removeItem(REPLAY_KEY);
  } catch {
    /* ignore */
  }
}

/** True only for a signed-in user who has never completed or dismissed the tour. */
export function shouldAutoStartTour(role, userId) {
  return Boolean(userId) && getTourState(role, userId) === null;
}

/*
 * Steps. `target` is a CSS selector for the element to highlight; when it is
 * missing, hidden or off-screen (for example a sidebar link while the mobile
 * drawer is closed) the step is shown centred without a highlight.
 */

/** #339: register students, view rounds, submit results, check standings. */
export const EDUCATOR_TOUR = {
  role: 'educator',
  home: '/educator',
  steps: [
    {
      id: 'register-students',
      target: '[data-tour="educator-nav-school"]',
      title: 'Register your students',
      body: 'Open the School Dashboard to add your students and enter them into olympiads. You will also see how each learner is doing.',
    },
    {
      id: 'view-rounds',
      target: '[data-tour="educator-rounds"]',
      title: 'See your rounds',
      body: 'Olympiad activity lists the rounds your school can take part in, with opening and closing times. Papers unlock when a round opens.',
    },
    {
      id: 'submit-results',
      target: '[data-tour="educator-rounds"]',
      title: 'Submit results',
      body: 'Open a round to download its paper, then upload your students\u2019 answers before it closes. You get a receipt for everything the portal accepts.',
    },
    {
      id: 'check-standings',
      target: '[data-tour="educator-quick-actions"]',
      title: 'Check standings',
      body: 'Once a round closes, open it to see standings for your school and your entrants. Past papers and results are in the Archive.',
    },
  ],
};

/** #340: create olympiad, add rounds, upload papers, view dashboard. */
export const ORGANISER_TOUR = {
  role: 'organiser',
  home: '/organiser',
  steps: [
    {
      id: 'create-olympiad',
      target: '[data-tour="organiser-create"]',
      title: 'Create an olympiad',
      body: 'Start here. Give your olympiad a name, a timezone and a schedule. You can run several olympiads at once.',
    },
    {
      id: 'add-rounds',
      target: '[data-tour="organiser-olympiads"]',
      title: 'Add rounds',
      body: 'Each olympiad is a series of rounds with an opening and a closing time. The portal opens and closes them for you.',
    },
    {
      id: 'upload-papers',
      target: '[data-tour="organiser-olympiads"]',
      title: 'Upload papers',
      body: 'Open a round to upload its paper and memo. Multiple choice answers are marked automatically as soon as they are submitted.',
    },
    {
      id: 'view-dashboard',
      target: '[data-tour="organiser-activity"]',
      title: 'Watch it run',
      body: 'Recent activity shows what the portal did and when. Open Replay to step through a round after it has finished.',
    },
    {
      id: 'tools',
      target: '[data-tour="organiser-nav"]',
      title: 'Marking, remarks and archive',
      body: 'Use the menu to mark papers, review remark requests and browse the archive of past papers.',
    },
  ],
};
