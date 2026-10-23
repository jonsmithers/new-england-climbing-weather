import type { Location } from '../locations';
import { type Weekend, dayLabel, formatRange } from '../lib/weekend';
import { dayCondition, weekendVerdict } from '../lib/forecast';
import { formatTemp, useTempUnit } from '../lib/units';
import type { ForecastState } from '../hooks/useCragForecasts';
import { WeatherIcon, iconFor } from './WeatherIcon';
import { TempChart } from './TempChart';
import './Overview.css';

export type OverviewRow = {
  location: Location;
  state: ForecastState | undefined;
};

type Props = {
  // Already sorted best-first by viability score.
  rows: OverviewRow[];
  weekend: Weekend;
};

export function Overview({ rows, weekend }: Props) {
  return (
    <section className="overview" aria-label="Weekend at a glance">
      <BestBet rows={rows} weekend={weekend} />
      <Matrix rows={rows} weekend={weekend} />
    </section>
  );
}

function BestBet({ rows, weekend }: Props) {
  const [unit] = useTempUnit();
  const settled = rows.every((r) => r.state && r.state.status !== 'loading');
  const top = rows[0];
  const range = formatRange(weekend);

  if (!settled || !top?.state) {
    return (
      <div className="best best-loading" aria-busy="true">
        <span className="best-eyebrow">Best bet · {range}</span>
        <span className="skeleton best-name-skeleton" />
        <span className="skeleton best-line-skeleton" />
        <div className="best-days">
          {weekend.days.map((d) => (
            <span key={d.getTime()} className="skeleton best-day-skeleton" />
          ))}
        </div>
      </div>
    );
  }

  if (top.state.status !== 'ok') {
    return (
      <div className="best">
        <span className="best-eyebrow">Best bet · {range}</span>
        <p className="best-empty">Couldn’t load any forecasts. Try refreshing.</p>
      </div>
    );
  }

  const { data } = top.state;
  const verdict = weekendVerdict(data);
  const highs = data.days.map((d) => d.high).filter((v): v is number => v != null);
  const lows = data.days.map((d) => d.low).filter((v): v is number => v != null);
  const anchor = data.days.find((d) => d.date.getDay() === 6) ?? data.days[0];

  return (
    <a className={`best best-${verdict.level}`} href={`#crag-${top.location.id}`}>
      <WeatherIcon
        className="best-art"
        kind={iconFor(anchor.conditions, anchor.popMax)}
        size={160}
      />
      <span className="best-eyebrow">Best bet · {range}</span>
      <span className="best-name">{top.location.name}</span>
      <span className="best-line">
        <span className={`best-verdict best-verdict-${verdict.level}`}>{verdict.label}</span>
        {highs.length > 0 && lows.length > 0 && (
          <span className="best-temps">
            {formatTemp(Math.min(...lows), unit)}–
            {formatTemp(Math.max(...highs), unit, { withUnit: true })}
          </span>
        )}
      </span>
      <div className="best-chart">
        <TempChart days={data.days} />
      </div>
      <span className="best-days">
        {data.days.map((d) => (
          <span key={d.date.getTime()} className="best-day">
            <span className="best-day-name">{dayLabel(d.date)}</span>
            <WeatherIcon kind={iconFor(d.conditions, d.popMax)} size={28} />
            <span className={`best-day-pop best-pop-${dayCondition(d)}`}>
              {d.popMax == null ? '—' : `${Math.round(d.popMax)}%`}
            </span>
          </span>
        ))}
      </span>
    </a>
  );
}

function Matrix({ rows, weekend }: Props) {
  return (
    <div className="matrix" role="table" aria-label="Chance of rain by crag and day">
      <div className="matrix-row matrix-header" role="row">
        <span className="matrix-name" role="columnheader">
          Crag
        </span>
        {weekend.days.map((d) => (
          <span key={d.getTime()} className="matrix-day" role="columnheader">
            {dayLabel(d)}
          </span>
        ))}
      </div>
      {rows.map(({ location, state }) => (
        <a
          key={location.id}
          className="matrix-row"
          role="row"
          href={`#crag-${location.id}`}
        >
          <span className="matrix-name" role="rowheader">
            {location.name}
            <span className="matrix-region">{location.region}</span>
          </span>
          {weekend.days.map((_, i) => {
            if (!state || state.status === 'loading') {
              return <span key={i} className="matrix-cell skeleton" role="cell" />;
            }
            if (state.status === 'error') {
              return (
                <span key={i} className="matrix-cell matrix-unknown" role="cell">
                  ×
                </span>
              );
            }
            const day = state.data.days[i];
            const cond = dayCondition(day);
            return (
              <span key={i} className={`matrix-cell matrix-${cond}`} role="cell">
                {day.popMax == null ? '—' : `${Math.round(day.popMax)}%`}
              </span>
            );
          })}
        </a>
      ))}
      <div className="matrix-legend" aria-hidden>
        <span><i className="matrix-swatch matrix-dry" /> Dry</span>
        <span><i className="matrix-swatch matrix-damp" /> Showers possible</span>
        <span><i className="matrix-swatch matrix-wet" /> Wet</span>
        <span className="matrix-legend-note">% = max chance of rain</span>
      </div>
    </div>
  );
}
