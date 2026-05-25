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

type Props = { location: Location; weekend: Weekend; refreshNonce: number };

type CardState =
  | { status: 'loading' }
  | { status: 'ok'; data: WeekendForecast }
  | { status: 'error'; message: string };

export function LocationCard({ location, weekend, refreshNonce }: Props) {
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
          href={buildMeteoblueUrl(location)}
          target="_blank"
          rel="noopener noreferrer"
        >
          meteoblue →
        </a>
      </div>
    </article>
  );
}

function buildMeteoblueUrl(location: Location): string {
  return `https://www.meteoblue.com/en/weather/forecast/week/${location.lat}N${location.lon}E`;
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

function DayBlock({ label, day }: { label: string; day: DaySummary }) {
  return (
    <div className="day">
      <div className="day-label">{label}</div>
      <PrecipBadge popMax={day.popMax} precipInches={day.precipInches} />
    </div>
  );
}
