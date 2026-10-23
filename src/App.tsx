import { useMemo, useState } from 'react';
import { LOCATIONS } from './locations';
import { LocationCard } from './components/LocationCard';
import { Overview } from './components/Overview';
import { WeekendPicker } from './components/WeekendPicker';
import { ThemeToggle } from './components/ThemeToggle';
import { OriginPicker } from './components/OriginPicker';
import { PrecipUnitToggle, TempUnitToggle } from './components/UnitToggle';
import { RefreshFooter } from './components/RefreshFooter';
import { useCragForecasts } from './hooks/useCragForecasts';
import { useDriveTimes } from './hooks/useDriveTimes';
import { usePreference } from './lib/preferences';
import { ORIGIN } from './lib/origin';
import { weekendAt } from './lib/weekend';
import { viabilityScore } from './lib/forecast';
import { clearForecastCache } from './lib/cache';
import './App.css';

export function App() {
  const [offset, setOffset] = useState(0);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const weekend = weekendAt(offset);
  const states = useCragForecasts(LOCATIONS, weekend, refreshNonce);
  const [origin] = usePreference(ORIGIN);
  const drives = useDriveTimes(LOCATIONS, origin);

  // Sort best-first by viability score (rain, prior-day rain, temperature,
  // drive time). Crags not yet scored (loading/error) fall to the bottom;
  // Array.sort is stable so ties keep LOCATIONS order.
  const ranked = useMemo(() => {
    const rows = LOCATIONS.map((location) => {
      const state = states[location.id];
      const drive = drives[location.id];
      const score = state?.status === 'ok' ? viabilityScore(state.data, drive?.seconds) : null;
      return { location, state, score, drive };
    });
    return rows.sort(
      (a, b) => (a.score?.total ?? Infinity) - (b.score?.total ?? Infinity),
    );
  }, [states, drives]);

  return (
    <>
      <header className="hero">
        <div className="hero-sky" aria-hidden />
        <Ridges />
        <div className="hero-inner">
          <div className="hero-bar">
            <span className="brand">
              <svg viewBox="0 0 32 32" width="22" height="22" aria-hidden>
                <path d="M2 27 12 9l5 8 4-5 9 15z" fill="var(--accent)" />
              </svg>
              New England Climbing Weather
            </span>
            <div className="hero-controls">
              <OriginPicker />
              <TempUnitToggle />
              <PrecipUnitToggle />
              <ThemeToggle />
            </div>
          </div>
          <h1 className="hero-title">
            Where’s it dry
            <br />
            <span className="hero-title-accent">
              {offset === 0 ? 'this weekend' : 'next weekend'}?
            </span>
          </h1>
          <p className="hero-sub">
            Friday–Monday forecasts for {LOCATIONS.length} crags, best conditions first.
          </p>
          <WeekendPicker offset={offset} onOffsetChange={setOffset} />
        </div>
      </header>

      <main className="container">
        <Overview rows={ranked} weekend={weekend} />

        <div className="section-head">
          <h2 className="section-title">Crag by crag</h2>
          <span className="section-note">Hover a day for conditions and wind</span>
        </div>
        <div className="grid">
          {ranked.map(({ location, state, score, drive }, i) => (
            <LocationCard
              key={location.id}
              index={i}
              location={location}
              weekend={weekend}
              state={state}
              score={score}
              drive={drive}
              rank={score == null ? null : i + 1}
              refreshNonce={refreshNonce}
            />
          ))}
        </div>

        <RefreshFooter
          onRefresh={() => {
            clearForecastCache();
            setRefreshNonce((n) => n + 1);
          }}
        />
      </main>
    </>
  );
}

// Layered mountain silhouettes along the bottom of the header. The nearest
// ridge is filled with the page background so the hero melts into the page.
function Ridges() {
  return (
    <svg className="hero-ridges" viewBox="0 0 1440 160" preserveAspectRatio="none" aria-hidden>
      <path
        fill="var(--ridge-far)"
        d="M0 104 L110 72 L210 92 L330 38 L460 88 L560 62 L690 98 L815 46 L930 82 L1065 26 L1185 78 L1300 56 L1440 86 V160 H0Z"
      />
      <path
        fill="var(--ridge-mid)"
        d="M0 128 L140 96 L255 118 L395 82 L515 112 L640 90 L775 124 L895 86 L1015 118 L1150 76 L1290 108 L1440 94 V160 H0Z"
      />
      <path
        fill="var(--ridge-near)"
        d="M0 150 L175 130 L320 146 L480 124 L640 148 L820 132 L980 150 L1140 128 L1300 146 L1440 134 V160 H0Z"
      />
    </svg>
  );
}
