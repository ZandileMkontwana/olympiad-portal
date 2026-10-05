import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { ThemeProvider } from './ThemeProvider';
import ThemeToggle from './ThemeToggle';
import { THEME_STORAGE_KEY } from '@/lib/theme';
import { expectNoAxeViolations } from '@/test/axe';

let systemDark = false;
let mediaListener = null;

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  systemDark = false;
  mediaListener = null;
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    get matches() {
      return systemDark;
    },
    media: query,
    addEventListener: (_event, cb) => {
      mediaListener = cb;
    },
    removeEventListener: vi.fn(),
  }));
});

const theme = () => document.documentElement.getAttribute('data-theme');
const renderToggle = () =>
  render(
    <ThemeProvider>
      <ThemeToggle />
    </ThemeProvider>
  );

describe('ThemeProvider + ThemeToggle', () => {
  it('defaults to light when the OS is light and nothing is stored', () => {
    renderToggle();
    expect(theme()).toBe('light');
    expect(screen.getByRole('button', { name: 'Dark mode' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
  });

  it('defaults to dark when the OS prefers dark (#336)', async () => {
    systemDark = true;
    renderToggle();
    expect(theme()).toBe('dark');
    // React picks the attribute change up asynchronously (MutationObserver).
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Dark mode' })).toHaveAttribute(
        'aria-pressed',
        'true'
      )
    );
  });

  it('toggles, updates aria-pressed and persists the choice (#334, #335)', async () => {
    renderToggle();
    const button = screen.getByRole('button', { name: 'Dark mode' });
    fireEvent.click(button);
    expect(theme()).toBe('dark');
    await waitFor(() => expect(button).toHaveAttribute('aria-pressed', 'true'));
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    fireEvent.click(button);
    expect(theme()).toBe('light');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
    await waitFor(() => expect(button).toHaveAttribute('aria-pressed', 'false'));
  });

  it('restores the stored choice on the next visit, even against the OS (#335)', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    systemDark = false;
    renderToggle();
    expect(theme()).toBe('dark');
  });

  it('follows OS changes only while the user has not chosen (#336)', () => {
    renderToggle();
    systemDark = true;
    act(() => mediaListener?.());
    expect(theme()).toBe('dark');

    fireEvent.click(screen.getByRole('button', { name: 'Dark mode' })); // explicit: light
    systemDark = true;
    act(() => mediaListener?.());
    expect(theme()).toBe('light');
  });

  it('syncs when another tab changes the stored theme', () => {
    renderToggle();
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: THEME_STORAGE_KEY }));
    });
    expect(theme()).toBe('dark');
  });

  it('has no axe accessibility violations', async () => {
    const { container } = renderToggle();
    await expectNoAxeViolations(container);
  });
});
