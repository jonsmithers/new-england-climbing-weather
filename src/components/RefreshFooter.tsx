import { useEffect, useState } from 'react';
import { getOldestCacheAgeMs } from '../lib/cache';
import './RefreshFooter.css';

type Props = { onRefresh: () => void };

export function RefreshFooter({ onRefresh }: Props) {
  const [ageMs, setAgeMs] = useState<number | null>(() => getOldestCacheAgeMs());

  useEffect(() => {
    const tick = () => setAgeMs(getOldestCacheAgeMs());
    tick();
    const id = window.setInterval(tick, 15_000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <footer className="refresh-footer">
      <button
        type="button"
        className="refresh-button"
        onClick={() => {
          onRefresh();
          setAgeMs(0);
        }}
      >
        Refresh
      </button>
      <span className="refresh-age">{formatAge(ageMs)}</span>
    </footer>
  );
}

function formatAge(ageMs: number | null): string {
  if (ageMs == null) return 'no cached data';
  const minutes = Math.floor(ageMs / 60_000);
  if (minutes < 1) return 'just fetched';
  if (minutes === 1) return '1 min old';
  return `${minutes} min old`;
}
