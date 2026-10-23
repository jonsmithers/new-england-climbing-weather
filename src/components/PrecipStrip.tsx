import type { DaySummary } from '../lib/forecast';
import './PrecipStrip.css';

// Hourly rate that fills the strip to full height: 4 mm/h (~0.16″/h) is a
// solid downpour. A sqrt scale keeps light drizzle visible without letting a
// single burst flatten everything else. The scale is absolute, not per-card,
// so bar heights are comparable across crags.
const FULL_MM_PER_HOUR = 4;

type Props = { days: DaySummary[] };

// One continuous timeline across all forecast days, laid out so each day's 24
// bars sit directly under that day's column in the card above.
export function PrecipStrip({ days }: Props) {
  const hours = days.flatMap((d) => d.precipMmByHour);
  const anyRain = hours.some((mm) => mm > 0);
  const total = hours.length;

  return (
    <div className="precip-strip" data-dry={anyRain ? undefined : ''}>
      <svg
        viewBox={`0 0 ${total} 1`}
        preserveAspectRatio="none"
        aria-hidden="true"
        focusable="false"
      >
        {days.map((_, i) =>
          i === 0 ? null : (
            <line
              key={`sep-${i}`}
              className="precip-strip-sep"
              x1={i * 24}
              x2={i * 24}
              y1={0}
              y2={1}
              vectorEffect="non-scaling-stroke"
            />
          ),
        )}
        {hours.map((mm, h) => {
          if (mm <= 0) return null;
          const height = Math.max(0.08, Math.min(1, Math.sqrt(mm / FULL_MM_PER_HOUR)));
          return (
            <rect
              key={h}
              className="precip-strip-bar"
              x={h + 0.12}
              y={1 - height}
              width={0.76}
              height={height}
            />
          );
        })}
      </svg>
      {!anyRain && <span className="precip-strip-empty">No measurable rain</span>}
    </div>
  );
}
