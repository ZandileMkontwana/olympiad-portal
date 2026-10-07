import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  usePathname: () => '/organiser',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock('next/dynamic', () => ({
  default: () => () => null,
}));
vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ getToken: () => Promise.resolve('test-token') }),
  useUser: () => ({ user: { id: 'test-user', fullName: 'Test User' } }),
}));

import OrganiserShell from './OrganiserShell';
import { getTourState, saveTourState } from '@/lib/tour';

function renderShell() {
  return render(
    <OrganiserShell activeNav="dashboard" breadcrumb="Overview" user={{ name: 'Ola Mkhize' }}>
      <p>organiser content</p>
    </OrganiserShell>
  );
}

describe('OrganiserShell (mobile drawer)', () => {
  it('starts closed with an accessible hamburger button', () => {
    renderShell();
    const button = screen.getByRole('button', { name: 'Open menu' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).toHaveAttribute('aria-controls', 'organiser-sidebar');
    expect(document.getElementById('organiser-sidebar')).not.toHaveClass('is-open');
    expect(screen.getByText('organiser content')).toBeInTheDocument();
  });

  it('opens from the hamburger and closes on Escape, link click or scrim click', () => {
    renderShell();
    const sidebar = document.getElementById('organiser-sidebar');

    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    expect(sidebar).toHaveClass('is-open');
    expect(document.querySelector('.organiser-scrim')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(sidebar).not.toHaveClass('is-open');

    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    fireEvent.click(screen.getByText('Marking').closest('a'));
    expect(sidebar).not.toHaveClass('is-open');

    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    fireEvent.click(document.querySelector('.organiser-scrim'));
    expect(sidebar).not.toHaveClass('is-open');
  });

  it('marks the active nav item with aria-current', () => {
    renderShell();
    expect(screen.getByText('Dashboard').closest('a')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('Marking').closest('a')).not.toHaveAttribute('aria-current');
  });
});

describe('OrganiserShell onboarding (#317)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function rect() {
      return { top: 10, left: 10, right: 110, bottom: 50, width: 100, height: 40 };
    });
  });

  it('shows the tour to a first-time organiser and remembers when they skip it', async () => {
    render(
      <OrganiserShell activeNav="dashboard" user={{ id: 'org-1', name: 'Ola Mkhize' }}>
        <button type="button" data-tour="organiser-create">
          Create Olympiad
        </button>
      </OrganiserShell>
    );
    const tour = await screen.findByRole('dialog', { name: 'Create an olympiad' });
    expect(tour).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Skip tour' }));
    expect(getTourState('organiser', 'org-1').status).toBe('dismissed');
  });

  it('does not show the tour to an organiser who has already dismissed it', async () => {
    saveTourState('organiser', 'org-2', 'dismissed');
    render(
      <OrganiserShell activeNav="dashboard" user={{ id: 'org-2', name: 'Ola Mkhize' }}>
        <p>organiser content</p>
      </OrganiserShell>
    );
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByRole('dialog', { name: 'Create an olympiad' })).not.toBeInTheDocument();
  });

  it('replays the tour from Settings', async () => {
    saveTourState('organiser', 'org-3', 'completed');
    render(
      <OrganiserShell activeNav="dashboard" user={{ id: 'org-3', name: 'Ola Mkhize' }}>
        <button type="button" data-tour="organiser-create">
          Create Olympiad
        </button>
      </OrganiserShell>
    );
    fireEvent.click(screen.getByRole('button', { name: /Settings/ }));
    const settings = screen.getByRole('dialog', { name: 'Settings' });
    expect(settings).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Replay tour' }));
    await waitFor(() =>
      expect(screen.getByRole('dialog', { name: 'Create an olympiad' })).toBeInTheDocument()
    );
    expect(screen.queryByRole('dialog', { name: 'Settings' })).not.toBeInTheDocument();
  });
});
