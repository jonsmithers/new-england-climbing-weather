import { useEffect, useState } from 'react';

export type ThemePreference = 'system' | 'light' | 'dark';

// Keep in sync with the inline script in index.html, which applies the saved
// theme before first paint to avoid a flash of the wrong palette.
const STORAGE_KEY = 'theme';

function readPreference(): ThemePreference {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'light' || v === 'dark') return v;
  } catch {
    // storage blocked; fall back to system
  }
  return 'system';
}

// "system" removes the attribute so the CSS falls through to
// prefers-color-scheme; light/dark pin it via [data-theme].
export function useThemePreference() {
  const [pref, setPref] = useState<ThemePreference>(readPreference);

  useEffect(() => {
    const root = document.documentElement;
    if (pref === 'system') delete root.dataset.theme;
    else root.dataset.theme = pref;
    try {
      if (pref === 'system') localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, pref);
    } catch {
      // non-fatal
    }
  }, [pref]);

  return [pref, setPref] as const;
}
