'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from 'react';
import {
  THEME_STORAGE_KEY,
  applyTheme,
  clearStoredTheme,
  getStoredTheme,
  getSystemTheme,
  resolveTheme,
  storeTheme,
} from '@/lib/theme';

const ThemeContext = createContext({
  theme: 'light',
  ready: false,
  setTheme: () => {},
  toggleTheme: () => {},
  resetTheme: () => {},
});

/* The source of truth is the data-theme attribute on <html>. The inline script
   in layout.js sets it before first paint; applyTheme() updates it afterwards.
   React reads it through useSyncExternalStore, so server and first client
   render agree ('light') and the real value arrives right after hydration. */
function subscribeToTheme(callback) {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  return () => observer.disconnect();
}
const getThemeSnapshot = () =>
  document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
const getServerThemeSnapshot = () => 'light';

const noopSubscribe = () => () => {};

/**
 * Owns the current theme: follows the OS while the user has not chosen,
 * stores an explicit choice in localStorage, and syncs across tabs.
 */
export function ThemeProvider({ children }) {
  const theme = useSyncExternalStore(subscribeToTheme, getThemeSnapshot, getServerThemeSnapshot);
  const ready = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  );

  useEffect(() => {
    // Make sure the attribute matches the stored/OS choice even if the inline
    // script was blocked (for example by a strict CSP).
    applyTheme(resolveTheme(getStoredTheme(), getSystemTheme()));

    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    const onSystemChange = () => {
      // Only follow the OS while the user has no explicit choice.
      if (getStoredTheme() === null) applyTheme(resolveTheme(null, getSystemTheme()));
    };
    const onStorage = (event) => {
      if (event.key !== THEME_STORAGE_KEY) return;
      applyTheme(resolveTheme(getStoredTheme(), getSystemTheme()));
    };
    media?.addEventListener?.('change', onSystemChange);
    window.addEventListener('storage', onStorage);
    return () => {
      media?.removeEventListener?.('change', onSystemChange);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const setTheme = useCallback((next) => {
    storeTheme(next);
    applyTheme(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(getThemeSnapshot() === 'dark' ? 'light' : 'dark');
  }, [setTheme]);

  /** Forget the explicit choice and go back to following the OS. */
  const resetTheme = useCallback(() => {
    clearStoredTheme();
    applyTheme(resolveTheme(null, getSystemTheme()));
  }, []);

  const value = useMemo(
    () => ({ theme, ready, setTheme, toggleTheme, resetTheme }),
    [theme, ready, setTheme, toggleTheme, resetTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
