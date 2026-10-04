import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  THEME_STORAGE_KEY,
  applyTheme,
  clearStoredTheme,
  getStoredTheme,
  getSystemTheme,
  resolveTheme,
  storeTheme,
  themeInitScript,
} from './theme';

function mockMatchMedia(matches) {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.style.colorScheme = '';
  mockMatchMedia(false);
});

describe('resolveTheme', () => {
  it('uses the stored choice over the system setting', () => {
    expect(resolveTheme('dark', 'light')).toBe('dark');
    expect(resolveTheme('light', 'dark')).toBe('light');
  });
  it('falls back to the system setting when nothing valid is stored', () => {
    expect(resolveTheme(null, 'dark')).toBe('dark');
    expect(resolveTheme(null, 'light')).toBe('light');
    expect(resolveTheme('purple', 'dark')).toBe('dark');
  });
});

describe('storage', () => {
  it('stores, reads and clears the preference', () => {
    expect(getStoredTheme()).toBeNull();
    storeTheme('dark');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(getStoredTheme()).toBe('dark');
    clearStoredTheme();
    expect(getStoredTheme()).toBeNull();
  });
  it('ignores invalid stored values', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'neon');
    expect(getStoredTheme()).toBeNull();
  });
  it('survives blocked storage', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(getStoredTheme()).toBeNull();
    spy.mockRestore();
  });
});

describe('getSystemTheme', () => {
  it('reads prefers-color-scheme', () => {
    mockMatchMedia(true);
    expect(getSystemTheme()).toBe('dark');
    mockMatchMedia(false);
    expect(getSystemTheme()).toBe('light');
  });
});

describe('applyTheme', () => {
  it('sets data-theme and color-scheme on <html>', () => {
    applyTheme('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(document.documentElement.style.colorScheme).toBe('dark');
  });
});

describe('themeInitScript (runs before first paint)', () => {
  const run = () => new Function(themeInitScript)();

  it('applies the OS dark setting when nothing is stored', () => {
    mockMatchMedia(true);
    run();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });
  it('applies the OS light setting when nothing is stored', () => {
    run();
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });
  it('prefers the stored choice over the OS', () => {
    mockMatchMedia(true);
    window.localStorage.setItem(THEME_STORAGE_KEY, 'light');
    run();
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });
  it('does not throw when localStorage is blocked', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(run).not.toThrow();
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    spy.mockRestore();
  });
});
