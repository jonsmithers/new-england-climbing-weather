import { useEffect, useState } from 'react';
import { Collapsible } from '@base-ui/react/collapsible';
import type { Location } from '../locations';
import type { Weekend } from '../lib/weekend';
import { fetchOpenMeteo } from '../api/openMeteo';
import {
  summarizeSummitWeekend,
  type DaySummary,
  type WeekendForecast,
} from '../lib/forecast';
import './SummitPanel.css';

type Props = { summit: NonNullable<Location['summit']>; weekend: Weekend };

type PanelState =
  | { status: 'loading' }
  | { status: 'ok'; data: WeekendForecast }
  | { status: 'error'; message: string };

export function SummitPanel({ summit, weekend }: Props) {
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
  ]);

  const feet = Math.round(summit.elevationMeters * 3.28084);

  return (
    <Collapsible.Root className="summit-root">
      <Collapsible.Trigger className="summit-trigger">
        <span className="summit-chevron" aria-hidden>
          ▸
        </span>
        <span className="summit-title">
          {summit.name ?? 'Summit'}
          <span className="summit-elev"> · {feet.toLocaleString()} ft</span>
        </span>
      </Collapsible.Trigger>
      <Collapsible.Panel className="summit-panel">
        {state.status === 'loading' && (
          <p className="summit-status">Loading summit…</p>
        )}
        {state.status === 'error' && (
          <p className="summit-status summit-error">{state.message}</p>
        )}
        {state.status === 'ok' && (
          <div className="summit-days">
            <SummitDay label="Sat" day={state.data.saturday} />
            <SummitDay label="Sun" day={state.data.sunday} />
          </div>
        )}
      </Collapsible.Panel>
    </Collapsible.Root>
  );
}

function SummitDay({ label, day }: { label: string; day: DaySummary }) {
  const hi = day.high == null ? '—' : `${Math.round(day.high)}°`;
  const lo = day.low == null ? '—' : `${Math.round(day.low)}°`;
  const pop = day.popMax == null ? '—' : `${Math.round(day.popMax)}%`;
  return (
    <div className="summit-day">
      <span className="summit-day-label">{label}</span>
      <span className="summit-day-temps">
        {hi} / {lo}
      </span>
      <span className="summit-day-pop">{pop}</span>
      <span className="summit-day-precip">{day.precipInches.toFixed(2)}″</span>
    </div>
  );
}
