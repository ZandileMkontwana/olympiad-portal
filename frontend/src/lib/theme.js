/**
 * Theme helpers (#333, #335, #336).
 *
 * The user's explicit choice is stored in localStorage under THEME_STORAGE_KEY
 * as 'light' or 'dark'. When nothing is stored, the OS setting
 * (prefers-color-scheme) decides, and follows the OS if it changes.
 * The resolved theme is applied as `data-theme` on <html>.
 */
export const THEME_STORAGE_KEY = 'olympiad-theme';
export const THEMES = ['light', 'dark'];

export function isTheme(value) {
  return THEMES.includes(value);
}

/** Stored preference: 'light' | 'dark', or null when the user never chose. */
export function getStoredTheme() {
  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(value) ? value : null;
  } catch {
    return null; // storage blocked (private mode, disabled cookies)
  }
}

export function storeTheme(theme) {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* ignore: the choice still applies for this page view */
  }
}

export function clearStoredTheme() {
  try {
    window.localStorage.removeItem(THEME_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function getSystemTheme() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** The theme actually shown: explicit choice first, then the OS setting. */
export function resolveTheme(stored, system) {
  return isTheme(stored) ? stored : system === 'dark' ? 'dark' : 'light';
}

export function applyTheme(theme) {
  const root = document.documentElement;
  root.setAttribute('data-theme', theme);
  root.style.colorScheme = theme;
}

/**
 * Inline script run in <head> before first paint so the page never flashes
 * the wrong theme. It must stay self-contained (no imports) and mirror
 * resolveTheme() above.
 */
export const themeInitScript = `(function(){try{var s=null;try{s=localStorage.getItem('${THEME_STORAGE_KEY}')}catch(e){}var t=(s==='light'||s==='dark')?s:(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');var r=document.documentElement;r.setAttribute('data-theme',t);r.style.colorScheme=t;}catch(e){}})();`;
