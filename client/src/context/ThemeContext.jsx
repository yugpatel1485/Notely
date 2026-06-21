/**
 * ThemeContext.jsx  (Phase 4)
 * ─────────────────────────────────────────────────────────────────────────────
 * Provides theme state ('light' | 'dark') to the whole app.
 *
 * Priority order:
 *   1. localStorage value (user's explicit choice)
 *   2. OS prefers-color-scheme
 *   3. 'light' (fallback)
 *
 * The chosen value is applied as data-theme="light|dark" on <html>, so every
 * CSS variable block in globals.css activates automatically — no inline styles
 * or className juggling needed in components.
 */

import { createContext, useContext, useEffect, useState } from 'react';

const STORAGE_KEY = 'notely-theme';

function getInitialTheme() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // localStorage blocked (private browsing, etc.)
  }
  // Fall back to OS preference
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
}

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    const initial = getInitialTheme();
    // Apply immediately — before first render — to avoid flash
    applyTheme(initial);
    return initial;
  });

  // Keep <html data-theme> in sync whenever theme changes
  useEffect(() => {
    applyTheme(theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Non-fatal
    }
  }, [theme]);

  // Track OS preference changes (e.g. user changes system theme while app is open)
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return;

    function handleChange(e) {
      // Only respond to OS change if the user hasn't made an explicit choice
      const stored = (() => {
        try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
      })();
      if (!stored) {
        setTheme(e.matches ? 'dark' : 'light');
      }
    }

    mq.addEventListener('change', handleChange);
    return () => mq.removeEventListener('change', handleChange);
  }, []);

  function toggleTheme() {
    setTheme((t) => (t === 'light' ? 'dark' : 'light'));
  }

  function setExplicitTheme(value) {
    if (value === 'light' || value === 'dark') setTheme(value);
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme: setExplicitTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}
