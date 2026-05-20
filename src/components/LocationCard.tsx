import { useEffect, useState } from 'react';
import type { Location } from '../locations';
import type { Weekend } from '../lib/weekend';
import { fetchNwsForecast } from '../api/nws';
import {
  summarizeWeekend,
  type DaySummary,
  type WeekendForecast,
} from '../lib/forecast';
import { PrecipBadge } from './PrecipBadge';
import { TempChart } from './TempChart';
import { SummitPanel } from './SummitPanel';
import './LocationCard.css';

type Props = { location: Location; weekend: Weekend };

type CardState =
  | { status: 'loading' }
  | { status: 'ok'; data: WeekendForecast }
  | { status: 'error'; message: string };

export function LocationCard({ location, weekend }: Props) {
  const [state, setState] = useState<CardState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    fetchNwsForecast(location.lat, location.lon)
      .then((forecast) => {
        if (cancelled) return;
        setState({
          status: 'ok',
          data: summarizeWeekend(forecast, weekend),
        });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        setState({ status: 'error', message });
      });
    return () => {
      cancelled = true;
    };
  }, [location.lat, location.lon, weekend.saturday.getTime()]);

  return (
    <article className="location-card">
      <h2 className="location-name">{location.name}</h2>
      {state.status === 'loading' && <p className="status">Loading…</p>}
      {state.status === 'error' && (
        <p className="status status-error">{state.message}</p>
      )}
      {state.status === 'ok' && (
        <>
          <div className="day-row">
            <DayBlock label="Sat" day={state.data.saturday} />
            <DayBlock label="Sun" day={state.data.sunday} />
          </div>
          <TempChart
            saturday={state.data.saturday}
            sunday={state.data.sunday}
          />
        </>
      )}
      {location.summit && (
        <SummitPanel summit={location.summit} weekend={weekend} />
      )}
      <a
        className="forecast-link"
        href={`https://forecast.weather.gov/MapClick.php?lat=${location.lat}&lon=${location.lon}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        Full forecast →
      </a>
    </article>
  );
}

function DayBlock({ label, day }: { label: string; day: DaySummary }) {
  return (
    <div className="day">
      <div className="day-label">{label}</div>
      <PrecipBadge popMax={day.popMax} precipInches={day.precipInches} />
    </div>
  );
}
