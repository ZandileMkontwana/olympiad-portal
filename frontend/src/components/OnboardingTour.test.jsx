import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { TourHost, useTour } from './OnboardingTour';
import { getTourState, saveTourState, isReplayRequested } from '@/lib/tour';
import { expectNoAxeViolations } from '@/test/axe';

const nav = vi.hoisted(() => ({ pathname: '/educator', push: vi.fn() }));
vi.mock('next/navigation', () => ({
  usePathname: () => nav.pathname,
  useRouter: () => ({ push: nav.push, replace: vi.fn() }),
}));

const TOUR = {
  role: 'educator',
  home: '/educator',
  steps: [
    {
      id: 'one',
      target: '[data-tour="one"]',
      title: 'First thing',
      body: 'About the first thing.',
    },
    {
      id: 'two',
      target: '[data-tour="two"]',
      title: 'Second thing',
      body: 'About the second thing.',
    },
    {
      id: 'three',
      target: '[data-tour="missing"]',
      title: 'Third thing',
      body: 'No anchor for this one.',
    },
  ],
};

function Page({ userId = 'user-1', withReplay = false }) {
  return (
    <TourHost tour={TOUR} userId={userId}>
      <button type="button" data-tour="one">
        Anchor one
      </button>
      <button type="button" data-tour="two">
        Anchor two
      </button>
      {withReplay && <ReplayButton />}
    </TourHost>
  );
}
function ReplayButton() {
  const { startTour } = useTour();
  return (
    <button type="button" onClick={startTour}>
      Replay tour
    </button>
  );
}

// jsdom has no layout, so give the anchors a real size (like a browser would).
const ANCHOR_RECT = { top: 100, left: 80, right: 280, bottom: 140, width: 200, height: 40 };
const ZERO_RECT = { top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 };

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function rect() {
    return this.hasAttribute('data-tour') ? ANCHOR_RECT : ZERO_RECT;
  });
  window.localStorage.clear();
  window.sessionStorage.clear();
  nav.pathname = '/educator';
  nav.push.mockClear();
  document.body.style.overflow = '';
});

const dialog = () => screen.findByRole('dialog');

describe('automatic start (#317: first login)', () => {
  it('shows the tour to a new user on the home page', async () => {
    render(<Page />);
    const d = await dialog();
    expect(d).toHaveAccessibleName('First thing');
    expect(screen.getByText('Step 1 of 3')).toBeInTheDocument();
  });

  it('does not start without a user id', async () => {
    render(<Page userId={undefined} />);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('does not start away from the home page', async () => {
    nav.pathname = '/educator/archive';
    render(<Page />);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it.each(['completed', 'dismissed'])('does not start again after it was %s', async (status) => {
    saveTourState('educator', 'user-1', status);
    render(<Page />);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('still starts for a different user on the same browser', async () => {
    saveTourState('educator', 'someone-else', 'completed');
    render(<Page />);
    expect(await dialog()).toBeInTheDocument();
  });
});

describe('steps', () => {
  it('moves forward and back, updating the counter and content', async () => {
    render(<Page />);
    await dialog();
    expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Second thing');
    expect(screen.getByText('Step 2 of 3')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('dialog')).toHaveAccessibleName('First thing');
  });

  it('shows Done on the last step instead of Next', async () => {
    render(<Page />);
    await dialog();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Step 3 of 3')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
  });

  it('highlights the target when it is visible and still shows a step when it is not', async () => {
    render(<Page />);
    await dialog();
    await waitFor(() => expect(screen.getByTestId('tour-spotlight')).toBeInTheDocument());
    const spot = screen.getByTestId('tour-spotlight');
    expect(spot).toHaveStyle({ top: '92px', left: '72px', width: '216px', height: '56px' });

    // Step 3 points at an element that is not on the page: shown without a highlight.
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(screen.queryByTestId('tour-spotlight')).not.toBeInTheDocument());
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Third thing');
  });

  it('moves focus into the card on every step', async () => {
    render(<Page />);
    const d = await dialog();
    await waitFor(() => expect(d).toHaveFocus());
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(screen.getByRole('dialog')).toHaveFocus());
  });
});

describe('finishing, skipping and persisting (#317, #342)', () => {
  it('Done marks the tour completed and closes it', async () => {
    render(<Page />);
    await dialog();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(getTourState('educator', 'user-1').status).toBe('completed');
  });

  it('Skip tour works on the first step and marks it dismissed', async () => {
    render(<Page />);
    await dialog();
    fireEvent.click(screen.getByRole('button', { name: 'Skip tour' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(getTourState('educator', 'user-1').status).toBe('dismissed');
  });

  it('Skip works on a later step', async () => {
    render(<Page />);
    await dialog();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Skip tour' }));
    expect(getTourState('educator', 'user-1').status).toBe('dismissed');
  });

  it('the close button and Escape also dismiss', async () => {
    const { unmount } = render(<Page />);
    await dialog();
    fireEvent.click(screen.getByRole('button', { name: 'Close tour' }));
    expect(getTourState('educator', 'user-1').status).toBe('dismissed');
    unmount();

    window.localStorage.clear();
    render(<Page />);
    await dialog();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(getTourState('educator', 'user-1').status).toBe('dismissed');
  });

  it('does not come back after a reload once finished or dismissed', async () => {
    const first = render(<Page />);
    await dialog();
    fireEvent.click(screen.getByRole('button', { name: 'Skip tour' }));
    first.unmount();

    render(<Page />);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('replay (#343)', () => {
  it('can be replayed after being dismissed, and does not need the auto-start', async () => {
    saveTourState('educator', 'user-1', 'dismissed');
    render(<Page withReplay />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Replay tour' }));
    expect(await dialog()).toHaveAccessibleName('First thing');
    expect(screen.getByText('Step 1 of 3')).toBeInTheDocument();
  });

  it('returns focus to the button that started the replay', async () => {
    saveTourState('educator', 'user-1', 'dismissed');
    render(<Page withReplay />);
    const replay = screen.getByRole('button', { name: 'Replay tour' });
    replay.focus();
    fireEvent.click(replay);
    await dialog();
    fireEvent.click(screen.getByRole('button', { name: 'Skip tour' }));
    expect(replay).toHaveFocus();
  });

  it('a replayed tour is marked completed when finished', async () => {
    saveTourState('educator', 'user-1', 'dismissed');
    render(<Page withReplay />);
    fireEvent.click(screen.getByRole('button', { name: 'Replay tour' }));
    await dialog();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(getTourState('educator', 'user-1').status).toBe('completed');
  });

  it('from another page it goes to the home page first and starts there', async () => {
    saveTourState('educator', 'user-1', 'dismissed');
    nav.pathname = '/educator/archive';
    const { unmount } = render(<Page withReplay />);
    fireEvent.click(screen.getByRole('button', { name: 'Replay tour' }));
    expect(nav.push).toHaveBeenCalledWith('/educator');
    expect(isReplayRequested('educator')).toBe(true);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    // The navigation remounts the shell on the home page.
    unmount();
    nav.pathname = '/educator';
    render(<Page withReplay />);
    expect(await dialog()).toHaveAccessibleName('First thing');
    expect(isReplayRequested('educator')).toBe(false);
  });
});

describe('accessibility', () => {
  it('the tour card has dialog semantics and no axe violations', async () => {
    render(<Page />);
    const d = await dialog();
    expect(d).toHaveAttribute('aria-modal', 'true');
    expect(d).toHaveAccessibleDescription('About the first thing.');
    await expectNoAxeViolations(d);
  });

  it('keeps Tab inside the card', async () => {
    render(<Page />);
    await dialog();
    const buttons = screen.getAllByRole('button').filter((b) => b.closest('.tour-card'));
    const last = buttons[buttons.length - 1];
    last.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(buttons[0]).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(last).toHaveFocus();
  });
});
