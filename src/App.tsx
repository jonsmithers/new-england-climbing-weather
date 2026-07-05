import { useCallback, useEffect, useMemo, useState } from 'react';
import { LOCATIONS } from './locations';
import { LocationCard } from './components/LocationCard';
import { WeekendPicker } from './components/WeekendPicker';
import { RefreshFooter } from './components/RefreshFooter';
import { weekendAt } from './lib/weekend';
import { clearForecastCache } from './lib/cache';
import './App.css';

export function App() {
  const [offset, setOffset] = useState(0);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const weekend = weekendAt(offset);

  // Rain-viability scores reported by each card (lower = drier). Cleared
  // whenever the forecast window or a refresh changes so stale scores from the
  // previous fetch don't drive the ordering.
  const [scores, setScores] = useState<Record<string, number | null>>({});
  useEffect(() => {
    setScores({});
  }, [offset, refreshNonce]);

  const handleScore = useCallback((id: string, score: number | null) => {
    setScores((prev) => (prev[id] === score ? prev : { ...prev, [id]: score }));
  }, []);

  // Sort driest-first. Cards not yet scored (loading/error → null/undefined)
  // fall to the bottom; Array.sort is stable so ties keep LOCATIONS order.
  const orderedLocations = useMemo(() => {
    const rank = (id: string) => scores[id] ?? Infinity;
    return [...LOCATIONS].sort((a, b) => rank(a.id) - rank(b.id));
  }, [scores]);

  return (
    <div className="app">
      <header className="app-header">
        <h1>New England Climbing Weather</h1>
        <WeekendPicker offset={offset} onOffsetChange={setOffset} />
      </header>
      <main className="grid">
        {orderedLocations.map((loc) => (
          <LocationCard
            key={loc.id}
            location={loc}
            weekend={weekend}
            refreshNonce={refreshNonce}
            onScore={handleScore}
          />
        ))}
      </main>
      <RefreshFooter
        onRefresh={() => {
          clearForecastCache();
          setRefreshNonce((n) => n + 1);
        }}
      />
    </div>
  );
}
