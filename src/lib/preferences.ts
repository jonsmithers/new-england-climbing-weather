import { useCallback, useSyncExternalStore } from 'react';

// Small typed, localStorage-backed preference store. Each preference is
// declared once with definePreference (key + default + validator) and then
// read/written through usePreference, or getPreference/setPreference outside
// React. Values are stored as JSON under a `pref:` key prefix. Every
// component using the same preference re-renders on a change, including
// changes made in other tabs (via the `storage` event).
//
// The theme preference (src/lib/theme.ts) predates this module and stays
// separate: index.html reads its raw `theme` key before first paint.

const KEY_PREFIX = 'pref:';

export type Validator<T> = (value: unknown) => value is T;

export interface Preference<T> {
  readonly key: string;
  readonly defaultValue: T;
  readonly isValid: Validator<T>;
}

export function definePreference<T>(
  key: string,
  defaultValue: T,
  isValid: Validator<T>,
): Preference<T> {
  return { key: KEY_PREFIX + key, defaultValue, isValid };
}

// Validator for a fixed set of primitive values, e.g. isOneOf('F', 'C').
export function isOneOf<const V extends readonly (string | number | boolean)[]>(
  ...values: V
): Validator<V[number]> {
  return (value): value is V[number] => values.includes(value as V[number]);
}

// Raw values for keys whose storage write failed (private mode, quota), so a
// change still takes effect for the rest of this page's lifetime.
const memory = new Map<string, string | null>();

function readRaw(key: string): string | null {
  if (memory.has(key)) return memory.get(key)!;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeRaw(key: string, raw: string | null): void {
  try {
    if (raw == null) localStorage.removeItem(key);
    else localStorage.setItem(key, raw);
    memory.delete(key);
  } catch {
    memory.set(key, raw);
  }
  notify(key);
}

// Parsed values memoized by their raw string, so repeated reads of an unchanged
// object-valued preference return the same reference (useSyncExternalStore
// requires a stable snapshot).
const parsed = new Map<string, { raw: string | null; value: unknown }>();

export function getPreference<T>(pref: Preference<T>): T {
  const raw = readRaw(pref.key);
  const hit = parsed.get(pref.key);
  if (hit && hit.raw === raw) return hit.value as T;
  let value = pref.defaultValue;
  if (raw != null) {
    try {
      const json: unknown = JSON.parse(raw);
      if (pref.isValid(json)) value = json;
    } catch {
      // garbage in storage; fall back to the default
    }
  }
  parsed.set(pref.key, { raw, value });
  return value;
}

export function setPreference<T>(pref: Preference<T>, value: T): void {
  writeRaw(pref.key, JSON.stringify(value));
}

// Forget the stored value so reads return the default again.
export function resetPreference<T>(pref: Preference<T>): void {
  writeRaw(pref.key, null);
}

const listeners = new Map<string, Set<() => void>>();

function notify(key: string): void {
  listeners.get(key)?.forEach((l) => l());
}

function subscribe(key: string, listener: () => void): () => void {
  let set = listeners.get(key);
  if (!set) listeners.set(key, (set = new Set()));
  set.add(listener);
  // Fires only for changes made in *other* tabs; key is null on clear().
  const onStorage = (e: StorageEvent) => {
    if (e.key === key || e.key === null) listener();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    set.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

export function usePreference<T>(pref: Preference<T>): readonly [T, (value: T) => void] {
  const { key } = pref;
  const value = useSyncExternalStore(
    useCallback((l: () => void) => subscribe(key, l), [key]),
    () => getPreference(pref),
  );
  const set = useCallback((next: T) => setPreference(pref, next), [pref]);
  return [value, set] as const;
}
