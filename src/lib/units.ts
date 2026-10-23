import { definePreference, isOneOf, usePreference } from './preferences';

// Display units. Both APIs are asked for °F and inches, and every internal
// value (DaySummary, scoring) stays in those units; conversion happens only
// here, at display time. Use these helpers for any displayed temperature or
// precipitation amount rather than formatting by hand.

export type TempUnit = 'F' | 'C';
export type PrecipUnit = 'in' | 'mm';

export const TEMP_UNIT = definePreference<TempUnit>('tempUnit', 'F', isOneOf('F', 'C'));
export const PRECIP_UNIT = definePreference<PrecipUnit>('precipUnit', 'in', isOneOf('in', 'mm'));

export function useTempUnit() {
  return usePreference(TEMP_UNIT);
}

export function usePrecipUnit() {
  return usePreference(PRECIP_UNIT);
}

export function convertTemp(fahrenheit: number, unit: TempUnit): number {
  return unit === 'C' ? ((fahrenheit - 32) * 5) / 9 : fahrenheit;
}

// Whole degrees: "52°", or "52°F" with `withUnit`. null (no data) → "—".
export function formatTemp(
  fahrenheit: number | null,
  unit: TempUnit,
  { withUnit = false }: { withUnit?: boolean } = {},
): string {
  if (fahrenheit == null) return '—';
  // `|| 0` turns a rounded -0 into 0 so we never show "-0°".
  const n = Math.round(convertTemp(fahrenheit, unit)) || 0;
  return `${n}°${withUnit ? unit : ''}`;
}

export function convertPrecip(inches: number, unit: PrecipUnit): number {
  return unit === 'mm' ? inches * 25.4 : inches;
}

// "0.25″" in inches (hundredths, matching NWS QPF resolution); in mm, one
// decimal below 10 mm and whole millimeters above ("2.5 mm", "14 mm").
// null (no data) → "—".
export function formatPrecip(inches: number | null, unit: PrecipUnit): string {
  if (inches == null) return '—';
  if (unit === 'in') return `${inches.toFixed(2)}″`;
  const mm = convertPrecip(inches, 'mm');
  return `${mm >= 9.95 ? Math.round(mm) : mm.toFixed(1)} mm`;
}
