import { useEffect, useState } from 'react';
import { Tooltip } from '@base-ui/react/tooltip';
import type { Location } from '../locations';
import { type Weekend, dayLabel } from '../lib/weekend';
import { fetchNwsForecast } from '../api/nws';
import {
  summarizeWeekend,
  rainScore,
  type DaySummary,
  type WeekendForecast,
} from '../lib/forecast';
import { PrecipBadge } from './PrecipBadge';
import { TempChart } from './TempChart';
import { SummitPanel } from './SummitPanel';
import './LocationCard.css';

type Props = {
  location: Location;
  weekend: Weekend;
  refreshNonce: number;
  // Reports this crag's rain-viability score (lower = drier) so App can sort
  // cards. null while loading or on error, so those sort to the bottom.
  onScore: (id: string, score: number | null) => void;
};

type CardState =
  | { status: 'loading' }
  | { status: 'ok'; data: WeekendForecast }
  | { status: 'error'; message: string };

export function LocationCard({
  location,
  weekend,
  refreshNonce,
  onScore,
}: Props) {
  const [state, setState] = useState<CardState>({ status: 'loading' });
  const score = state.status === 'ok' ? rainScore(state.data) : null;

  useEffect(() => {
    onScore(location.id, score);
  }, [score, location.id, onScore]);

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
  }, [location.lat, location.lon, weekend.saturday.getTime(), refreshNonce]);

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
            {state.data.days.map((day) => (
              <DayBlock
                key={day.date.getTime()}
                label={dayLabel(day.date)}
                day={day}
                maxHourMm={maxHourMm(state.data)}
              />
            ))}
          </div>
          <TempChart days={state.data.days} />
        </>
      )}
      {location.summit && (
        <SummitPanel
          summit={location.summit}
          weekend={weekend}
          refreshNonce={refreshNonce}
        />
      )}
      <div className="forecast-links">
        <a
          className="forecast-link"
          href={buildForecastUrl(location, weekend)}
          target="_blank"
          rel="noopener noreferrer"
        >
          weather.gov →
        </a>
        <a
          className="forecast-link"
          href={buildMeteoblueUrl(location, weekend)}
          target="_blank"
          rel="noopener noreferrer"
        >
          meteoblue →
        </a>
        <CardInfo score={score} />
      </div>
    </article>
  );
}

// Bottom-right "info" icon that reveals extra per-card details on hover/focus.
// For now the only detail is the rain-viability score used to order the cards.
function CardInfo({ score }: { score: number | null }) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger className="card-info-trigger" aria-label="Card details">
        <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden>
          <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" />
          <circle cx="8" cy="4.5" r="1" fill="currentColor" stroke="none" />
          <rect x="7.25" y="6.75" width="1.5" height="5" fill="currentColor" stroke="none" />
        </svg>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Positioner side="top" align="end" sideOffset={6}>
          <Tooltip.Popup className="card-info-popup">
            <div className="card-info-row">
              <span className="card-info-label">Rain score</span>
              <span className="card-info-value">
                {score == null ? '—' : score.toFixed(1)}
              </span>
            </div>
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

// meteoblue's weekly forecast supports ?day=N to expand a specific day's
// detail panel. N is 1-indexed from today (today=1, tomorrow=2, ...).
function buildMeteoblueUrl(location: Location, weekend: Weekend): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const saturday = new Date(weekend.saturday);
  saturday.setHours(0, 0, 0, 0);
  const daysFromToday = Math.round(
    (saturday.getTime() - today.getTime()) / 86_400_000,
  );
  const day = Math.max(1, Math.min(7, daysFromToday + 1));
  return `https://www.meteoblue.com/en/weather/week/${location.lat}N${location.lon}E?day=${day}`;
}

// Builds a forecast.weather.gov graphical hourly forecast URL pointed at
// Saturday morning of the selected weekend.
//
// Param reference (from the form on weather.gov's hourly graph page):
//   AheadHour     hours from "now" to the start of the displayed window
//   FcstType      "graphical" = the hourly chart view
//   textField1/2  lat / lon (the form's coordinate inputs)
//   unit          0 = English, 1 = metric (global toggle)
//   dd, bw        display flags (dashes/dots, black-and-white); empty = off
//
// w0..w8 pick which variables are plotted (each is one row of the chart):
//   w0=t        temperature
//   w1=td       dewpoint
//   w2=hi       heat index
//   w3=sfcwind  surface wind  (w3u=1 selects mph)
//   w4=sky      sky cover %
//   w5=pop      probability of precipitation
//   w6=rh       relative humidity
//   w7=rain     rain amount
//   w8=thunder  thunder probability
//
// w10u/w11u/w12u are unit selectors for rows we don't plot (wave/snow/ice),
// but weather.gov's form posts them regardless, so we include the defaults.
function buildForecastUrl(location: Location, weekend: Weekend): string {
  const target = new Date(weekend.saturday);
  target.setHours(8, 0, 0, 0);
  const aheadHour = Math.max(
    0,
    Math.round((target.getTime() - Date.now()) / 3_600_000),
  );
  const params = new URLSearchParams({
    w0: 't',
    w1: 'td',
    w2: 'hi',
    w3: 'sfcwind',
    w3u: '1',
    w4: 'sky',
    w5: 'pop',
    w6: 'rh',
    w7: 'rain',
    w8: 'thunder',
    w10u: '0',
    w11u: '1',
    w12u: '1',
    AheadHour: String(aheadHour),
    Submit: 'Submit',
    FcstType: 'graphical',
    textField1: String(location.lat),
    textField2: String(location.lon),
    site: 'all',
    unit: '0',
    dd: '',
    bw: '',
  });
  return `https://forecast.weather.gov/MapClick.php?${params.toString()}`;
}

function DayBlock({
  label,
  day,
  maxHourMm,
}: {
  label: string;
  day: DaySummary;
  maxHourMm: number;
}) {
  return (
    <div className="day">
      <div className="day-label">{label}</div>
      <PrecipBadge
        popMax={day.popMax}
        precipInches={day.precipInches}
        precipMmByHour={day.precipMmByHour}
        maxHourMm={maxHourMm}
      />
    </div>
  );
}

function maxHourMm(forecast: WeekendForecast): number {
  let max = 0;
  for (const day of forecast.days) {
    for (const v of day.precipMmByHour) {
      max = Math.max(max, v);
    }
  }
  return max;
}
