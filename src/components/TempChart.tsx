import { useId } from 'react';
import type { DaySummary } from '../lib/forecast';
import './TempChart.css';

type Props = { days: DaySummary[] };

const WIDTH = 400;
const HEIGHT = 108;
const PAD_Y = 24;

type Point = { x: number; y: number };

// Smooth curve through the points (Catmull-Rom converted to cubic Béziers).
// With only four days, straight segments look jagged; this keeps the shape
// honest since the curve still passes exactly through every reading.
function smoothPath(points: Point[], move = true): string {
  if (points.length === 0) return '';
  let d = `${move ? 'M' : 'L'}${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${c1x},${c1y} ${c2x},${c2y} ${p2.x},${p2.y}`;
  }
  return d;
}

// Hi/lo band for each forecast day. Each day's x sits at the center of its
// quarter of the width, so it lines up with the 4-column day grid above it.
export function TempChart({ days }: Props) {
  const gradientId = useId();
  const temps = days
    .flatMap((day) => [day.high, day.low])
    .filter((v): v is number => v !== null);
  if (temps.length === 0) return null;

  const min = Math.min(...temps) - 2;
  const max = Math.max(...temps) + 2;
  const range = max - min || 1;
  const colWidth = WIDTH / days.length;
  const x = (i: number) => colWidth * (i + 0.5);
  const y = (t: number) => PAD_Y + (HEIGHT - 2 * PAD_Y) * (1 - (t - min) / range);

  const highs = days.flatMap((d, i) => (d.high == null ? [] : [{ x: x(i), y: y(d.high), t: d.high }]));
  const lows = days.flatMap((d, i) => (d.low == null ? [] : [{ x: x(i), y: y(d.low), t: d.low }]));
  const bothAt = days.flatMap((d, i) =>
    d.high != null && d.low != null ? [{ i, hi: y(d.high), lo: y(d.low) }] : [],
  );
  const band =
    bothAt.length >= 2
      ? smoothPath(bothAt.map((p) => ({ x: x(p.i), y: p.hi }))) +
        ' ' +
        smoothPath(
          [...bothAt].reverse().map((p) => ({ x: x(p.i), y: p.lo })),
          false,
        ) +
        ' Z'
      : null;

  return (
    <svg
      className="temp-chart"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="img"
      aria-label={days
        .map(
          (d) =>
            `${d.date.toLocaleDateString('en-US', { weekday: 'long' })}: high ${d.high ?? 'unknown'}, low ${d.low ?? 'unknown'}`,
        )
        .join('; ')}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" style={{ stopColor: 'var(--temp-warm)', stopOpacity: 0.32 }} />
          <stop offset="100%" style={{ stopColor: 'var(--temp-cool)', stopOpacity: 0.26 }} />
        </linearGradient>
      </defs>
      {band && <path d={band} fill={`url(#${gradientId})`} />}
      {highs.length >= 2 && <path d={smoothPath(highs)} className="temp-line temp-line-high" />}
      {lows.length >= 2 && <path d={smoothPath(lows)} className="temp-line temp-line-low" />}
      {highs.map((p) => (
        <g key={`h${p.x}`}>
          <circle cx={p.x} cy={p.y} r={4} className="temp-dot temp-dot-high" />
          <text x={p.x} y={p.y - 9} textAnchor="middle" className="temp-label temp-label-high">
            {Math.round(p.t)}°
          </text>
        </g>
      ))}
      {lows.map((p) => (
        <g key={`l${p.x}`}>
          <circle cx={p.x} cy={p.y} r={4} className="temp-dot temp-dot-low" />
          <text x={p.x} y={p.y + 19} textAnchor="middle" className="temp-label temp-label-low">
            {Math.round(p.t)}°
          </text>
        </g>
      ))}
    </svg>
  );
}
