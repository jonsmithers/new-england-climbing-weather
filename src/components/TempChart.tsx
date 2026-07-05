import type { DaySummary } from '../lib/forecast';
import { dayLabel } from '../lib/weekend';
import './TempChart.css';

type Props = { days: DaySummary[] };

export function TempChart({ days }: Props) {
  const temps = days
    .flatMap((day) => [day.high, day.low])
    .filter((v): v is number => v !== null);
  if (temps.length === 0) return null;

  const min = Math.min(...temps) - 5;
  const max = Math.max(...temps) + 5;
  const range = max - min || 1;

  const width = 200;
  const height = 92;
  const padTop = 14;
  const padBottom = 26; // room for the day-label row along the bottom
  const innerH = height - padTop - padBottom;
  const colWidth = width / days.length;

  const y = (temp: number) => padTop + innerH * (1 - (temp - min) / range);

  return (
    <svg
      className="temp-chart"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="High and low temperatures for each forecast day"
    >
      {days.map((day, i) => {
        const cx = colWidth * (i + 0.5);
        const hasData = day.high != null && day.low != null;
        return (
          <g key={i}>
            {hasData ? (
              <>
                <line
                  x1={cx}
                  x2={cx}
                  y1={y(day.high!)}
                  y2={y(day.low!)}
                  className="temp-line"
                />
                <circle
                  cx={cx}
                  cy={y(day.high!)}
                  r={3.5}
                  className="temp-dot-high"
                />
                <circle
                  cx={cx}
                  cy={y(day.low!)}
                  r={3.5}
                  className="temp-dot-low"
                />
                <text
                  x={cx}
                  y={y(day.high!) - 5}
                  className="temp-label"
                  textAnchor="middle"
                >
                  {Math.round(day.high!)}°
                </text>
                <text
                  x={cx}
                  y={y(day.low!) + 12}
                  className="temp-label"
                  textAnchor="middle"
                >
                  {Math.round(day.low!)}°
                </text>
              </>
            ) : (
              <text
                x={cx}
                y={padTop + innerH / 2}
                className="temp-label temp-empty"
                textAnchor="middle"
                dominantBaseline="middle"
              >
                —
              </text>
            )}
            <text
              x={cx}
              y={height - 8}
              className="temp-day-label"
              textAnchor="middle"
            >
              {dayLabel(day.date)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
