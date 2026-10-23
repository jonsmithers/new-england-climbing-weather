import { definePreference } from './preferences';

// Where drive times are measured from. `label` is shown in the header control.
export type Origin = { lat: number; lon: number; label: string };

export const DEFAULT_ORIGIN: Origin = {
  lat: 42.3967,
  lon: -71.1225,
  label: 'Davis Square, Somerville',
};

export const ORIGIN = definePreference<Origin>(
  'origin',
  DEFAULT_ORIGIN,
  (v): v is Origin => {
    if (typeof v !== 'object' || v === null) return false;
    const o = v as Record<string, unknown>;
    return (
      typeof o.lat === 'number' &&
      typeof o.lon === 'number' &&
      Number.isFinite(o.lat) &&
      Number.isFinite(o.lon) &&
      typeof o.label === 'string'
    );
  },
);

export function isDefaultOrigin(origin: Origin): boolean {
  return origin.lat === DEFAULT_ORIGIN.lat && origin.lon === DEFAULT_ORIGIN.lon;
}
