import { useState } from 'react';
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
  return (
    <div className="app">
      <header className="app-header">
        <h1>Northeast Climbing Weather</h1>
        <WeekendPicker offset={offset} onOffsetChange={setOffset} />
      </header>
      <main className="grid">
        {LOCATIONS.map((loc) => (
          <LocationCard
            key={loc.id}
            location={loc}
            weekend={weekend}
            refreshNonce={refreshNonce}
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
