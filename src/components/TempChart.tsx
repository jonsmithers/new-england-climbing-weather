import type { DaySummary } from '../lib/forecast';
import './TempChart.css';

type Props = { saturday: DaySummary; sunday: DaySummary };

export function TempChart({ saturday, sunday }: Props) {
  const days = [
    { label: 'Sat', day: saturday },
    { label: 'Sun', day: sunday },
  ];
  const temps = days
    .flatMap(({ day }) => [day.high, day.low])
    .filter((v): v is number => v !== null);
  if (temps.length === 0) return null;

  const min = Math.min(...temps) - 5;
  const max = Math.max(...temps) + 5;
  const range = max - min || 1;

  const width = 200;
  const height = 80;
  const padTop = 14;
  const padBottom = 14;
  const innerH = height - padTop - padBottom;
  const colWidth = width / days.length;

  const y = (temp: number) => padTop + innerH * (1 - (temp - min) / range);

  return (
    <svg
      className="temp-chart"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="High and low temperatures for Saturday and Sunday"
    >
      {days.map(({ day }, i) => {
        const cx = colWidth * (i + 0.5);
        if (day.high == null || day.low == null) return null;
        const yHigh = y(day.high);
        const yLow = y(day.low);
        return (
          <g key={i}>
            <line
              x1={cx}
              x2={cx}
              y1={yHigh}
              y2={yLow}
              className="temp-line"
            />
            <circle cx={cx} cy={yHigh} r={3.5} className="temp-dot-high" />
            <circle cx={cx} cy={yLow} r={3.5} className="temp-dot-low" />
            <text
              x={cx}
              y={yHigh - 5}
              className="temp-label"
              textAnchor="middle"
            >
              {Math.round(day.high)}°
            </text>
            <text
              x={cx}
              y={yLow + 12}
              className="temp-label"
              textAnchor="middle"
            >
              {Math.round(day.low)}°
            </text>
          </g>
        );
      })}
    </svg>
  );
}
