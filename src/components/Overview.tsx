import {
  Fragment,
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import type { Location } from '../locations';
import { type Weekend, dayLabel, formatRange } from '../lib/weekend';
import {
  COMFORT_BAND_F,
  FAR_BAND_F,
  dayCondition,
  tempComfort,
  weekendVerdict,
  type DaySummary,
  type TempComfort,
} from '../lib/forecast';
import { definePreference, usePreference } from '../lib/preferences';
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
      <Pages rows={rows} weekend={weekend} />
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

// The heatmap panel is a pager: pages sit side by side in a horizontal
// scroll-snap track, so touch users swipe, and everyone else uses the tab
// switch above it. The tabs and the scroll position stay in sync both ways,
// and the chosen page is remembered.
//
// Pages are data: adding one is one entry here. A page's content is rendered
// only once it is first visited (or starts sliding into view), so a page can
// React.lazy its component and its chunk loads on first visit. Content should
// fill the page (height: 100%) rather than set the panel's height.
export type OverviewPage = {
  id: string;
  label: string;
  render: (props: Props) => ReactNode;
};

const PAGES = [
  { id: 'rain', label: 'Rain', render: (props) => <RainMatrix {...props} /> },
  { id: 'temp', label: 'Temperature', render: (props) => <TempMatrix {...props} /> },
] as const satisfies readonly OverviewPage[];

type PageId = (typeof PAGES)[number]['id'];

const OVERVIEW_PAGE = definePreference<PageId>(
  'overviewPage',
  'rain',
  (v): v is PageId => PAGES.some((p) => p.id === v),
);

function Pages({ rows, weekend }: Props) {
  const [page, setPage] = usePreference(OVERVIEW_PAGE);
  // Pages rendered so far. Grows only, so a visited page keeps its state.
  const [visited, setVisited] = useState<ReadonlySet<PageId>>(() => new Set([page]));
  const visit = (ids: PageId[]) =>
    setVisited((prev) => (ids.every((id) => prev.has(id)) ? prev : new Set([...prev, ...ids])));
  // A tab change (or a restored/cross-tab preference) renders the target page
  // before paint, so it isn't blank while it slides in.
  useLayoutEffect(() => visit([page]), [page]);
  const trackRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const index = PAGES.findIndex((p) => p.id === page);

  // Keep the track on the selected page: instantly on first render (restored
  // preference), smoothly after a tab change. A swipe that already landed on
  // the page is a no-op.
  const firstRun = useRef(true);
  useLayoutEffect(() => {
    const track = trackRef.current;
    const instant =
      firstRun.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    firstRun.current = false;
    if (!track) return;
    const left = index * track.clientWidth;
    if (Math.abs(track.scrollLeft - left) < 2) return;
    track.scrollTo({ left, behavior: instant ? 'instant' : 'smooth' });
  }, [index]);

  // Swipe → tab: once scrolling settles, select whichever page it snapped to.
  // (A debounce rather than `scrollend`, which older Safari lacks.)
  const settleTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(settleTimer.current), []);
  const onScroll = () => {
    // Render whatever is sliding into view right away, not after it settles.
    const track = trackRef.current;
    if (track && track.clientWidth > 0) {
      const pos = track.scrollLeft / track.clientWidth;
      visit([PAGES[Math.floor(pos)], PAGES[Math.ceil(pos)]].filter(Boolean).map((p) => p.id));
    }
    window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(() => {
      const track = trackRef.current;
      if (!track || track.clientWidth === 0) return;
      const landed = PAGES[Math.round(track.scrollLeft / track.clientWidth)];
      if (landed && landed.id !== page) setPage(landed.id);
    }, 120);
  };

  // WAI-ARIA tabs pattern: arrows/Home/End move and activate.
  const onTabKey = (e: KeyboardEvent) => {
    const last = PAGES.length - 1;
    const next =
      e.key === 'ArrowRight' ? Math.min(last, index + 1)
      : e.key === 'ArrowLeft' ? Math.max(0, index - 1)
      : e.key === 'Home' ? 0
      : e.key === 'End' ? last
      : null;
    if (next == null) return;
    e.preventDefault();
    setPage(PAGES[next].id);
    tabRefs.current[next]?.focus();
  };

  return (
    <div className="pages">
      <div className="pages-head">
        <div
          className="segmented pages-tabs"
          role="tablist"
          aria-label="Overview"
          onKeyDown={onTabKey}
        >
          {PAGES.map((p, i) => (
            <button
              key={p.id}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`overview-tab-${p.id}`}
              aria-controls={`overview-page-${p.id}`}
              aria-selected={p.id === page}
              tabIndex={p.id === page ? 0 : -1}
              className="segmented-option pages-tab"
              onClick={() => setPage(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>
        <span className="pages-dots" aria-hidden>
          {PAGES.map((p) => (
            <i key={p.id} data-active={p.id === page ? '' : undefined} />
          ))}
        </span>
      </div>
      <div className="pages-track" ref={trackRef} onScroll={onScroll}>
        {PAGES.map((p) => {
          const hidden = p.id !== page;
          return (
            <div
              key={p.id}
              className="pages-page"
              role="tabpanel"
              id={`overview-page-${p.id}`}
              aria-labelledby={`overview-tab-${p.id}`}
              aria-hidden={hidden || undefined}
              inert={hidden}
            >
              {visited.has(p.id) && p.render({ rows, weekend })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Crag × day grid shared by both pages: header, one linked row per crag in the
// ranked order, loading/error cells. Each page supplies its cell and legend.
function CragGrid({
  rows,
  weekend,
  label,
  cell,
  legend,
}: Props & {
  label: string;
  cell: (day: DaySummary) => ReactNode;
  legend: ReactNode;
}) {
  return (
    <div className="matrix" role="table" aria-label={label}>
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
            return <Fragment key={i}>{cell(state.data.days[i])}</Fragment>;
          })}
        </a>
      ))}
      <div className="matrix-legend" aria-hidden>
        {legend}
      </div>
    </div>
  );
}

function RainMatrix({ rows, weekend }: Props) {
  return (
    <CragGrid
      rows={rows}
      weekend={weekend}
      label="Chance of rain by crag and day"
      cell={(day) => {
        const cond = dayCondition(day);
        return (
          <span className={`matrix-cell matrix-${cond}`} role="cell">
            {day.popMax == null ? '—' : `${Math.round(day.popMax)}%`}
          </span>
        );
      }}
      legend={
        <>
          <span><i className="matrix-swatch matrix-dry" /> Dry</span>
          <span><i className="matrix-swatch matrix-damp" /> Showers possible</span>
          <span><i className="matrix-swatch matrix-wet" /> Wet</span>
          <span className="matrix-legend-note">% = max chance of rain</span>
        </>
      }
    />
  );
}

// Daytime highs, judged against the viability score's comfort band. No high
// (e.g. Friday once its daytime period has passed) shows "—": a night low
// in its place would always read as "cold" and mislead.
function TempMatrix({ rows, weekend }: Props) {
  const [unit] = useTempUnit();
  const t = (f: number, withUnit = false) => formatTemp(f, unit, { withUnit });
  return (
    <CragGrid
      rows={rows}
      weekend={weekend}
      label="Daytime high by crag and day"
      cell={(day) => {
        const comfort = tempComfort(day);
        if (day.high == null || !comfort) {
          return (
            <span
              className="matrix-cell matrix-unknown"
              role="cell"
              aria-label={`${dayLabel(day.date)}: no daytime high`}
            >
              —
            </span>
          );
        }
        const kind = comfort.side ?? 'comfy';
        return (
          <span
            className={`matrix-cell temp-${kind} temp-l${comfort.level}`}
            role="cell"
            aria-label={`${dayLabel(day.date)}: high ${t(day.high, true)}, ${comfortWord(comfort)}`}
          >
            <span aria-hidden>
              {comfort.side && <TempArrow side={comfort.side} />}
              {t(day.high)}
            </span>
          </span>
        );
      }}
      legend={
        <>
          <span>
            <i className="matrix-swatch temp-cold" /> <TempArrow side="cold" />
            Cold
          </span>
          <span>
            <i className="matrix-swatch temp-comfy" /> Comfy {t(COMFORT_BAND_F.low)}–
            {t(COMFORT_BAND_F.high, true)}
          </span>
          <span>
            <i className="matrix-swatch temp-hot" /> <TempArrow side="hot" />
            Hot
          </span>
          <span className="matrix-legend-note">
            Daytime highs · ringed = {t(FAR_BAND_F.low)} or colder, {t(FAR_BAND_F.high)} or hotter
          </span>
        </>
      }
    />
  );
}

// Direction cue so cold/hot never relies on color alone.
function TempArrow({ side }: { side: 'cold' | 'hot' }) {
  return <span className="temp-arrow">{side === 'cold' ? '▼' : '▲'}</span>;
}

function comfortWord(c: TempComfort): string {
  if (c.side === 'cold') return c.level === 2 ? 'very cold' : 'cool';
  if (c.side === 'hot') return c.level === 2 ? 'very hot' : 'warm';
  return 'comfortable';
}
