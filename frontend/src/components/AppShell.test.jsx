import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const pathState = vi.hoisted(() => ({ pathname: '/educator' }));

vi.mock('next/navigation', () => ({
  usePathname: () => pathState.pathname,
}));

import AppShell from './AppShell';

function Sidebar({ open, onClose }) {
  return (
    <aside id="app-sidebar" className={open ? 'sidebar sidebar-open' : 'sidebar'}>
      <a href="/educator">Olympiads</a>
      <button type="button" onClick={onClose}>
        Close
      </button>
    </aside>
  );
}

function renderShell() {
  return render(
    <AppShell section="Educator overview" renderSidebar={(p) => <Sidebar {...p} />}>
      <p>page body</p>
    </AppShell>
  );
}

describe('AppShell (mobile drawer)', () => {
  it('renders the page content, section label and a closed hamburger button', () => {
    renderShell();
    expect(screen.getByText('page body')).toBeInTheDocument();
    expect(screen.getByText('Educator overview')).toBeInTheDocument();
    const button = screen.getByRole('button', { name: 'Open menu' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).toHaveAttribute('aria-controls', 'app-sidebar');
    expect(document.querySelector('.sidebar')).not.toHaveClass('sidebar-open');
  });

  it('opens the drawer from the hamburger, shows a scrim and moves focus into it', () => {
    renderShell();
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    expect(document.querySelector('.sidebar')).toHaveClass('sidebar-open');
    expect(screen.getByRole('button', { name: 'Open menu' })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
    expect(document.querySelector('.scrim')).toBeInTheDocument();
    expect(screen.getByText('Olympiads')).toHaveFocus();
  });

  it('closes on Escape and returns focus to the hamburger', () => {
    renderShell();
    const button = screen.getByRole('button', { name: 'Open menu' });
    fireEvent.click(button);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(document.querySelector('.sidebar')).not.toHaveClass('sidebar-open');
    expect(document.querySelector('.scrim')).not.toBeInTheDocument();
    expect(button).toHaveFocus();
  });

  it('closes when the scrim is clicked', () => {
    renderShell();
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    fireEvent.click(document.querySelector('.scrim'));
    expect(document.querySelector('.sidebar')).not.toHaveClass('sidebar-open');
  });

  it('locks body scrolling only while the drawer is open', () => {
    renderShell();
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    expect(document.body.style.overflow).toBe('hidden');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(document.body.style.overflow).not.toBe('hidden');
  });
});
