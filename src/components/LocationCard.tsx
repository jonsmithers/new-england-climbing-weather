import type { CSSProperties } from 'react';
import { Tooltip } from '@base-ui/react/tooltip';
import type { Location } from '../locations';
import { type Weekend, dayLabel, formatMonthDay } from '../lib/weekend';
import {
  dayCondition,
  weekendVerdict,
  type DaySummary,
} from '../lib/forecast';
import type { ForecastState } from '../hooks/useCragForecasts';
import { formatPrecip, usePrecipUnit } from '../lib/units';
import type { Drive } from '../api/routing';
import { formatDriveDistance, formatDriveTime } from '../lib/drive';
import { WeatherIcon, iconFor } from './WeatherIcon';
import { PrecipStrip } from './PrecipStrip';
import { TempChart } from './TempChart';
import { SummitPanel } from './SummitPanel';
import { CarIcon } from './OriginPicker';
import './LocationCard.css';

type Props = {
  location: Location;
  weekend: Weekend;
  state: ForecastState | undefined;
  // 1-based position in the driest-first ordering; null until scored.
  rank: number | null;
  score: number | null;
  // Drive from the user's origin; undefined while loading or if routing failed.
  drive?: Drive | null;
  refreshNonce: number;
  // Position in the grid, used only to stagger the entrance animation.
  index: number;
};

const CONDITION_LABEL = {
  dry: 'Likely dry',
  damp: 'Possible showers',
  wet: 'Likely wet',
  unknown: 'No data',
} as const;

export function LocationCard({
  location,
  weekend,
  state = { status: 'loading' },
  rank,
  score,
  drive,
  refreshNonce,
  index,
}: Props) {
  const verdict = state.status === 'ok' ? weekendVerdict(state.data) : null;

  return (
    <article
      className="card"
      id={`crag-${location.id}`}
      style={{ '--i': index } as CSSProperties}
    >
      <header className="card-head">
        <div className="card-heading">
          <h2 className="card-name">
            {location.name}
            <span className="card-region">{location.region}</span>
          </h2>
          {drive && <DriveLine drive={drive} />}
          {verdict ? (
            <span className={`verdict verdict-${verdict.level}`}>
              <span className="verdict-dot" aria-hidden />
              {verdict.label}
            </span>
          ) : state.status === 'loading' ? (
            <span className="skeleton verdict-skeleton" />
          ) : null}
        </div>
        {rank != null && (
          <span className={`rank${rank === 1 ? ' rank-first' : ''}`} title="Driest-first rank">
            {rank === 1 ? 'Best bet' : `#${rank}`}
          </span>
        )}
      </header>

      {state.status === 'loading' && <CardSkeleton />}
      {state.status === 'error' && (
        <div className="card-error" role="alert">
          <strong>Forecast unavailable</strong>
          <span>{state.message}</span>
        </div>
      )}
      {state.status === 'ok' && (
        <div className="card-body">
          <div className="day-grid">
            {state.data.days.map((day) => (
              <DayCell key={day.date.getTime()} day={day} />
            ))}
          </div>
          <PrecipStrip days={state.data.days} />
          <TempChart days={state.data.days} />
        </div>
      )}

      {location.summit && (
        <SummitPanel
          summit={location.summit}
          weekend={weekend}
          refreshNonce={refreshNonce}
        />
      )}

      <footer className="card-foot">
        <a
          className="card-link"
          href={buildForecastUrl(location, weekend)}
          target="_blank"
          rel="noopener noreferrer"
        >
          weather.gov <ExternalIcon />
        </a>
        <a
          className="card-link"
          href={buildMeteoblueUrl(location, weekend)}
          target="_blank"
          rel="noopener noreferrer"
        >
          meteoblue <ExternalIcon />
        </a>
        <CardInfo score={score} />
      </footer>
    </article>
  );
}

function DayCell({ day }: { day: DaySummary }) {
  const cond = dayCondition(day);
  const [precipUnit] = usePrecipUnit();
  const pop = day.popMax == null ? '—' : `${Math.round(day.popMax)}%`;
  const precip = formatPrecip(day.precipInches, precipUnit);
  return (
    <Tooltip.Root>
      <Tooltip.Trigger
        delay={150}
        render={<div tabIndex={0} />}
        className={`day day-${cond}`}
        aria-label={`${dayLabel(day.date)}: ${CONDITION_LABEL[cond]}, ${pop} chance of rain, ${precip}`}
      >
        <span className="day-name">{dayLabel(day.date)}</span>
        <span className="day-date">{formatMonthDay(day.date)}</span>
        <WeatherIcon
          className="day-icon"
          kind={iconFor(day.conditions, day.popMax)}
          size={34}
        />
        <span className="day-pop">{pop}</span>
        <span className="day-inches">{precip}</span>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Positioner side="top" sideOffset={8}>
          <Tooltip.Popup className="tooltip-popup day-tip">
            <div className="day-tip-head">
              <span className={`day-tip-dot day-tip-${cond}`} />
              {CONDITION_LABEL[cond]}
            </div>
            {day.conditions && <div>{day.conditions}</div>}
            {day.wind && <div className="day-tip-muted">Wind {day.wind}</div>}
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

function DriveLine({ drive }: { drive: Drive }) {
  const time = formatDriveTime(drive);
  const distance = formatDriveDistance(drive);
  return (
    <span className="card-drive" title="Approximate drive time and distance (no traffic)">
      <CarIcon size={14} />
      {time} · {distance}
    </span>
  );
}

function CardSkeleton() {
  return (
    <div className="card-body" aria-busy="true" aria-label="Loading forecast">
      <div className="day-grid">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton day-skeleton" />
        ))}
      </div>
      <div className="skeleton strip-skeleton" />
      <div className="skeleton chart-skeleton" />
    </div>
  );
}

function ExternalIcon() {
  return (
    <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden>
      <path
        d="M4.5 2.5h5v5M9.5 2.5 3 9"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Bottom-right "info" icon that reveals extra per-card details on hover/focus.
// For now the only detail is the rain-viability score used to order the cards.
function CardInfo({ score }: { score: number | null }) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger delay={150} className="card-info-trigger" aria-label="Card details">
        <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden>
          <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" />
          <circle cx="8" cy="4.5" r="1" fill="currentColor" stroke="none" />
          <rect x="7.25" y="6.75" width="1.5" height="5" fill="currentColor" stroke="none" />
        </svg>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Positioner side="top" align="end" sideOffset={6}>
          <Tooltip.Popup className="tooltip-popup">
            <div className="card-info-row">
              <span className="card-info-label">Rain score</span>
              <span className="card-info-value">
                {score == null ? '—' : score.toFixed(1)}
              </span>
            </div>
            <div className="card-info-hint">Lower is drier. Sat/Sun count triple.</div>
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
