import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

// Mutable state — individual tests override before rendering.
const clerkState = vi.hoisted(() => ({
  user: { fullName: 'Ms Teacher', primaryEmailAddress: { emailAddress: 'teacher@school.com' } },
}));
const pathState = vi.hoisted(() => ({ pathname: '/educator' }));

const mockSignOut = vi.fn();

vi.mock('@clerk/nextjs', () => ({
  useClerk: () => ({ signOut: mockSignOut }),
  useUser: () => ({ user: clerkState.user }),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => pathState.pathname,
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import EducatorSidebar from './EducatorSidebar';
import { expectNoAxeViolations } from '@/test/axe';

describe('EducatorSidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true)
    );
    clerkState.user = {
      fullName: 'Ms Teacher',
      primaryEmailAddress: { emailAddress: 'teacher@school.com' },
    };
    pathState.pathname = '/educator';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders links to olympiads, the school dashboard and the archive', () => {
    render(<EducatorSidebar />);

    expect(screen.getByText('Olympiads').closest('a')).toHaveAttribute('href', '/educator');
    expect(screen.getByText('School Dashboard').closest('a')).toHaveAttribute(
      'href',
      '/educator/school'
    );
    expect(screen.getByText('Archive').closest('a')).toHaveAttribute('href', '/educator/archive');
  });

  it('marks Olympiads as the current page on the olympiads board', () => {
    render(<EducatorSidebar />);

    expect(screen.getByText('Olympiads').closest('a')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('School Dashboard').closest('a')).not.toHaveAttribute('aria-current');
  });

  it('keeps Olympiads highlighted on round detail and submission pages', () => {
    pathState.pathname = '/educator/round_view?id=round-1';
    render(<EducatorSidebar />);

    expect(screen.getByText('Olympiads').closest('a')).toHaveAttribute('aria-current', 'page');
  });

  it('marks School Dashboard as the current page on the school dashboard', () => {
    pathState.pathname = '/educator/school';
    render(<EducatorSidebar />);

    expect(screen.getByText('School Dashboard').closest('a')).toHaveAttribute(
      'aria-current',
      'page'
    );
    expect(screen.getByText('Olympiads').closest('a')).not.toHaveAttribute('aria-current');
  });

  it('marks Archive as the current page on the educator archive', () => {
    pathState.pathname = '/educator/archive';
    render(<EducatorSidebar />);

    expect(screen.getByText('Archive').closest('a')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('Olympiads').closest('a')).not.toHaveAttribute('aria-current');
  });

  it('hides the labels when collapsed and brings them back on expand', () => {
    function SidebarShell() {
      const [collapsed, setCollapsed] = useState(false);
      return <EducatorSidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />;
    }
    render(<SidebarShell />);

    expect(screen.getByText('Olympiads')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /collapse sidebar/i }));
    expect(screen.queryByText('Olympiads')).not.toBeInTheDocument();
    expect(screen.getByTitle('Olympiads')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /expand sidebar/i })).toHaveAttribute(
      'aria-expanded',
      'false'
    );

    fireEvent.click(screen.getByRole('button', { name: /expand sidebar/i }));
    expect(screen.getByText('Olympiads')).toBeInTheDocument();
  });

  it('falls back to the email address when the account has no name', () => {
    clerkState.user = {
      fullName: null,
      primaryEmailAddress: { emailAddress: 'teacher@school.com' },
    };
    render(<EducatorSidebar />);

    expect(screen.getByText('teacher@school.com')).toBeInTheDocument();
  });

  it('signs the educator out after confirming', async () => {
    render(<EducatorSidebar />);

    fireEvent.click(screen.getByRole('button', { name: /log out/i }));
    expect(confirm).toHaveBeenCalledWith('Are you sure you want to log out?');
    await vi.waitFor(() => {
      expect(mockSignOut).toHaveBeenCalledWith({ redirectUrl: '/login' });
    });
  });

  it('stays signed in when the logout confirmation is cancelled', () => {
    confirm.mockReturnValue(false);
    render(<EducatorSidebar />);

    fireEvent.click(screen.getByRole('button', { name: /log out/i }));
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it('shows a placeholder while the Clerk user loads', () => {
    clerkState.user = null;
    render(<EducatorSidebar />);

    expect(screen.getByText(/loading account/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /log out/i })).not.toBeInTheDocument();
  });
});

describe('EducatorSidebar mobile drawer', () => {
  beforeEach(() => {
    clerkState.user = {
      fullName: 'Ms Teacher',
      primaryEmailAddress: { emailAddress: 'teacher@school.com' },
    };
    pathState.pathname = '/educator';
  });

  it('has a stable id and is closed by default', () => {
    const { container } = render(<EducatorSidebar />);
    const aside = container.querySelector('aside');
    expect(aside).toHaveAttribute('id', 'app-sidebar');
    expect(aside).not.toHaveClass('sidebar-open');
    expect(screen.queryByRole('button', { name: 'Close menu' })).not.toBeInTheDocument();
  });

  it('shows the open state and calls onClose from the close button and nav links', () => {
    const onClose = vi.fn();
    const { container } = render(<EducatorSidebar open onClose={onClose} />);
    expect(container.querySelector('aside')).toHaveClass('sidebar-open');

    fireEvent.click(screen.getByRole('button', { name: 'Close menu' }));
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('Archive').closest('a'));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

describe('EducatorSidebar accessibility', () => {
  it('has no axe accessibility violations (closed and open drawer)', async () => {
    const { container, rerender } = render(<EducatorSidebar />);
    await expectNoAxeViolations(container);
    rerender(<EducatorSidebar open onClose={() => {}} />);
    await expectNoAxeViolations(container);
  });
});

describe('EducatorSidebar onboarding (#317)', () => {
  beforeEach(() => {
    clerkState.user = {
      fullName: 'Ms Teacher',
      primaryEmailAddress: { emailAddress: 'teacher@school.com' },
    };
    pathState.pathname = '/educator';
  });

  it('offers a Replay tour button in Settings', () => {
    render(<EducatorSidebar />);
    fireEvent.click(screen.getByText('Settings'));
    expect(screen.getByRole('dialog', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Replay tour' })).toBeInTheDocument();
  });

  it('marks the School Dashboard link as a tour anchor', () => {
    render(<EducatorSidebar />);
    expect(screen.getByText('School Dashboard').closest('a')).toHaveAttribute(
      'data-tour',
      'educator-nav-school'
    );
  });
});
