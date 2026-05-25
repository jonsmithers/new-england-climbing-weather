import './PrecipBadge.css';

type Props = {
  popMax: number | null;
  precipInches: number;
  precipMmByHour: number[];
  maxHourMm: number;
};

export function PrecipBadge({
  popMax,
  precipInches,
  precipMmByHour,
  maxHourMm,
}: Props) {
  const level = bucketize(popMax);
  const popStr = popMax === null ? '—' : `${Math.round(popMax)}%`;
  return (
    <div className={`precip-wrap precip-${level}`}>
      <div className="precip-badge">
        <div className="precip-pop">
          <DropletIcon />
          <span>{popStr}</span>
        </div>
        <div className="precip-inches">{precipInches.toFixed(2)}″</div>
      </div>
      <PrecipChart hourly={precipMmByHour} maxMm={maxHourMm} />
    </div>
  );
}

function PrecipChart({ hourly, maxMm }: { hourly: number[]; maxMm: number }) {
  if (maxMm <= 0) return null;
  return (
    <svg
      className="precip-chart"
      viewBox="0 0 24 1"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      {hourly.map((mm, hour) => {
        if (mm <= 0) return null;
        const h = Math.max(0.05, mm / maxMm);
        return (
          <rect
            key={hour}
            x={hour}
            y={1 - h}
            width={1}
            height={h}
            fill="var(--precip-bar-color)"
          />
        );
      })}
    </svg>
  );
}

function DropletIcon() {
  return (
    <svg
      className="precip-droplet"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 2.5s-6 7-6 11.5a6 6 0 0 0 12 0c0-4.5-6-11.5-6-11.5z" />
    </svg>
  );
}

function bucketize(pop: number | null): 'low' | 'med' | 'high' | 'unknown' {
  if (pop === null) return 'unknown';
  if (pop < 20) return 'low';
  if (pop <= 50) return 'med';
  return 'high';
}
