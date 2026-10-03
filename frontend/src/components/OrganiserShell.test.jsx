import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('next/navigation', () => ({ usePathname: () => '/organiser' }));
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

import OrganiserShell from './OrganiserShell';

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
