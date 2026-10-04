'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';

/**
 * Light/dark switch. A real toggle button: the label stays "Dark mode" and
 * aria-pressed carries the state, so screen readers say "Dark mode, toggle
 * button, pressed". Sized for touch (44px) via the .theme-toggle class.
 */
export default function ThemeToggle({ className = '' }) {
  const { theme, ready, toggleTheme } = useTheme();
  const isDark = ready && theme === 'dark';
  const Icon = isDark ? Sun : Moon;

  return (
    <button
      type="button"
      className={`theme-toggle${className ? ` ${className}` : ''}`}
      onClick={toggleTheme}
      aria-pressed={isDark}
      aria-label="Dark mode"
      title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
    >
      <Icon size={18} aria-hidden="true" />
    </button>
  );
}
