import { useEffect, useState } from 'react';
import type { Location } from '../locations';
import type { Weekend } from '../lib/weekend';
import { fetchNwsForecast } from '../api/nws';
import { summarizeWeekend, type WeekendForecast } from '../lib/forecast';

export type ForecastState =
  | { status: 'loading' }
  | { status: 'ok'; data: WeekendForecast }
  | { status: 'error'; message: string };

// Fetches the NWS forecast for every crag in parallel. Each crag resolves into
// its own slot, so one failed fetch only errors that crag's card. Lifted to App
// (rather than per-card) so the overview and the sort order can see all crags.
export function useCragForecasts(
  locations: Location[],
  weekend: Weekend,
  refreshNonce: number,
): Record<string, ForecastState> {
  const [states, setStates] = useState<Record<string, ForecastState>>({});
  const saturdayMs = weekend.saturday.getTime();

  useEffect(() => {
    let cancelled = false;
    setStates({});
    for (const loc of locations) {
      fetchNwsForecast(loc.lat, loc.lon)
        .then((forecast): ForecastState => ({
          status: 'ok',
          data: summarizeWeekend(forecast, weekend),
        }))
        .catch((err: unknown): ForecastState => ({
          status: 'error',
          message: err instanceof Error ? err.message : String(err),
        }))
        .then((state) => {
          if (cancelled) return;
          setStates((prev) => ({ ...prev, [loc.id]: state }));
        });
    }
    return () => {
      cancelled = true;
    };
    // `weekend` is rebuilt every render; saturdayMs is its stable identity.
  },[locations, saturdayMs, refreshNonce]);

  return states;
}
