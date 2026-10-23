import { useEffect, useState } from 'react';
import { Collapsible } from '@base-ui/react/collapsible';
import type { Location } from '../locations';
import { type Weekend, dayLabel } from '../lib/weekend';
import { WeatherIcon, iconFor } from './WeatherIcon';
import { fetchOpenMeteo } from '../api/openMeteo';
import {
  summarizeSummitWeekend,
  type DaySummary,
  type WeekendForecast,
} from '../lib/forecast';
import { formatPrecip, formatTemp, usePrecipUnit, useTempUnit } from '../lib/units';
import './SummitPanel.css';

type Props = {
  summit: NonNullable<Location['summit']>;
  weekend: Weekend;
  refreshNonce: number;
};

type PanelState =
  | { status: 'loading' }
  | { status: 'ok'; data: WeekendForecast }
  | { status: 'error'; message: string };

export function SummitPanel({ summit, weekend, refreshNonce }: Props) {
  const [state, setState] = useState<PanelState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    fetchOpenMeteo(summit.lat, summit.lon, summit.elevationMeters)
      .then((forecast) => {
        if (cancelled) return;
        setState({
          status: 'ok',
          data: summarizeSummitWeekend(forecast, weekend),
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
  }, [
    summit.lat,
    summit.lon,
    summit.elevationMeters,
    weekend.saturday.getTime(),
    refreshNonce,
  ]);

  const feet = Math.round(summit.elevationMeters * 3.28084);

  return (
    <Collapsible.Root className="summit">
      <Collapsible.Trigger className="summit-trigger">
        <MountainIcon />
        <span className="summit-title">
          {summit.name ?? 'Summit'}
          <span className="summit-elev">{feet.toLocaleString()} ft</span>
        </span>
        <span className="summit-source">Open-Meteo</span>
        <svg className="summit-chevron" viewBox="0 0 12 12" width="12" height="12" aria-hidden>
          <path
            d="M3 4.5 6 7.5 9 4.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </Collapsible.Trigger>
      <Collapsible.Panel className="summit-panel">
        <div className="summit-content">
          {state.status === 'loading' && <div className="skeleton summit-skeleton" />}
          {state.status === 'error' && (
            <p className="summit-error">{state.message}</p>
          )}
          {state.status === 'ok' && (
            <div className="summit-days">
              {state.data.days.map((day) => (
                <SummitDay
                  key={day.date.getTime()}
                  label={dayLabel(day.date)}
                  day={day}
                />
              ))}
            </div>
          )}
        </div>
      </Collapsible.Panel>
    </Collapsible.Root>
  );
}

function SummitDay({ label, day }: { label: string; day: DaySummary }) {
  const [tempUnit] = useTempUnit();
  const [precipUnit] = usePrecipUnit();
  const hi = formatTemp(day.high, tempUnit);
  const lo = formatTemp(day.low, tempUnit);
  const pop = day.popMax == null ? '—' : `${Math.round(day.popMax)}%`;
  return (
    <div className="summit-day">
      <span className="summit-day-label">{label}</span>
      <WeatherIcon kind={iconFor(null, day.popMax)} size={22} />
      <span className="summit-day-temps">
        <span className="summit-hi">{hi}</span>
        <span className="summit-lo">{lo}</span>
      </span>
      <span className="summit-day-precip">
        {pop} ·{' '}
        {formatPrecip(day.precipInches, precipUnit)}
      </span>
    </div>
  );
}

function MountainIcon() {
  return (
    <svg className="summit-icon" viewBox="0 0 20 20" width="18" height="18" aria-hidden>
      <path d="M1.5 16.5 7.5 6l3.2 5.2 2-2.7 5.8 8z" fill="currentColor" opacity="0.85" />
      <path d="M7.5 6 5.6 9.3l1.2-.6.9.9.9-1L10 9.6z" fill="var(--surface-solid)" />
    </svg>
  );
}
