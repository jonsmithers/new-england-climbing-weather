import { useCallback, useEffect, useState } from 'react';
import { getOldestCacheAgeMs, subscribeToCacheUpdated } from '../lib/cache';
import './RefreshFooter.css';

type Props = { onRefresh: () => void };

export function RefreshFooter({ onRefresh }: Props) {
  const [ageMs, setAgeMs] = useState<number | null>(() => getOldestCacheAgeMs());

  const tick = useCallback(() => setAgeMs(getOldestCacheAgeMs()), []);

  // Keep the "N min old" label aging over time.
  useEffect(() => {
    tick();
    const id = window.setInterval(tick, 15_000);
    return () => window.clearInterval(id);
  }, [tick]);

  // Update the instant a card writes its fetch to cache, so we flip off "no
  // cached data" immediately instead of waiting up to a full interval.
  useEffect(() => subscribeToCacheUpdated(tick), [tick]);

  const [spinning, setSpinning] = useState(false);

  return (
    <footer className="refresh-footer">
      <div className="refresh-pill">
        <span className="refresh-age">
          <span className="refresh-dot" data-stale={isStale(ageMs) ? '' : undefined} />
          {formatAge(ageMs)}
        </span>
        <button
          type="button"
          className="refresh-button"
          data-spinning={spinning ? '' : undefined}
          onAnimationEnd={() => setSpinning(false)}
          onClick={() => {
            onRefresh();
            setAgeMs(0);
            setSpinning(true);
          }}
        >
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
            <path
              d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9M13.5 2.5v3h-3"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Refresh
        </button>
      </div>
      <p className="refresh-credits">
        Crag forecasts from the{' '}
        <a href="https://www.weather.gov/" target="_blank" rel="noopener noreferrer">
          National Weather Service
        </a>
        . Summit forecasts from{' '}
        <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">
          Open-Meteo
        </a>
        . Drive times from{' '}
        <a href="https://routing.openstreetmap.de/" target="_blank" rel="noopener noreferrer">
          OSRM / FOSSGIS
        </a>
        , map data ©{' '}
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">
          OpenStreetMap contributors
        </a>{' '}
        (
        <a href="https://www.openstreetmap.org/fixthemap" target="_blank" rel="noopener noreferrer">
          fix the map
        </a>
        ).
      </p>
    </footer>
  );
}

// Matches the 30-minute cache TTL in the API modules.
function isStale(ageMs: number | null): boolean {
  return ageMs != null && ageMs > 30 * 60_000;
}

function formatAge(ageMs: number | null): string {
  if (ageMs == null) return 'Not yet fetched';
  const minutes = Math.floor(ageMs / 60_000);
  if (minutes < 1) return 'Updated just now';
  if (minutes === 1) return 'Updated 1 min ago';
  return `Updated ${minutes} min ago`;
}
