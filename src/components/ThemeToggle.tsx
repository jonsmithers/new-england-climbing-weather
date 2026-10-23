import type { ReactNode } from 'react';
import { ToggleGroup } from '@base-ui/react/toggle-group';
import { Toggle } from '@base-ui/react/toggle';
import { type ThemePreference, useThemePreference } from '../lib/theme';
import './ThemeToggle.css';

const OPTIONS: { value: ThemePreference; label: string; icon: ReactNode }[] = [
  {
    value: 'light',
    label: 'Light theme',
    icon: (
      <g stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none">
        <circle cx="10" cy="10" r="3.4" />
        <path d="M10 2.5v1.6M10 15.9v1.6M2.5 10h1.6M15.9 10h1.6M4.7 4.7l1.1 1.1M14.2 14.2l1.1 1.1M4.7 15.3l1.1-1.1M14.2 5.8l1.1-1.1" />
      </g>
    ),
  },
  {
    value: 'system',
    label: 'Match system theme',
    icon: (
      <g stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinejoin="round">
        <rect x="3" y="4" width="14" height="9.5" rx="1.8" />
        <path d="M7.5 16.5h5" strokeLinecap="round" />
      </g>
    ),
  },
  {
    value: 'dark',
    label: 'Dark theme',
    icon: (
      <path
        d="M15.8 12.6A6.5 6.5 0 0 1 7.4 4.2a6.5 6.5 0 1 0 8.4 8.4z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    ),
  },
];

export function ThemeToggle() {
  const [pref, setPref] = useThemePreference();
  return (
    <ToggleGroup
      className="theme-toggle"
      value={[pref]}
      onValueChange={(values) => {
        const next = values[values.length - 1] as ThemePreference | undefined;
        if (next) setPref(next);
      }}
      aria-label="Color theme"
    >
      {OPTIONS.map((opt) => (
        <Toggle
          key={opt.value}
          value={opt.value}
          className="theme-option"
          aria-label={opt.label}
          title={opt.label}
        >
          <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden>
            {opt.icon}
          </svg>
        </Toggle>
      ))}
    </ToggleGroup>
  );
}
