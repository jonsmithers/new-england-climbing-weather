export type IconKind =
  | 'sun'
  | 'partly'
  | 'cloud'
  | 'rain'
  | 'storm'
  | 'snow'
  | 'fog'
  | 'unknown';

// Maps an NWS shortForecast ("Mostly Sunny", "Chance Rain Showers", ...) to an
// icon. Order matters: precipitation types win over sky cover, and "partly" /
// "mostly sunny" are checked before the bare "cloudy" match. Without text
// (Open-Meteo, or a missing period) we fall back to the precip probability.
export function iconFor(conditions: string | null, pop: number | null): IconKind {
  const c = conditions?.toLowerCase() ?? '';
  if (c) {
    if (/thunder|t-storm/.test(c)) return 'storm';
    if (/snow|flurr|sleet|freezing|wintry|ice/.test(c)) return 'snow';
    if (/rain|shower|drizzle/.test(c)) return 'rain';
    if (/fog|haze|smoke|mist/.test(c)) return 'fog';
    if (/partly|mostly sunny|mostly clear/.test(c)) return 'partly';
    if (/cloud|overcast/.test(c)) return 'cloud';
    if (/sunny|clear|fair/.test(c)) return 'sun';
  }
  if (pop == null) return 'unknown';
  if (pop >= 50) return 'rain';
  if (pop >= 25) return 'cloud';
  if (pop >= 10) return 'partly';
  return 'sun';
}

const CLOUD = 'M10 25a5 5 0 0 1-.6-9.96 7 7 0 0 1 13.4-1.9A6 6 0 0 1 23 25z';

function Sun({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  const rays = Array.from({ length: 8 }, (_, i) => {
    const a = (i * Math.PI) / 4;
    const r1 = r + 2.5;
    const r2 = r + 5;
    return (
      <line
        key={i}
        x1={cx + Math.cos(a) * r1}
        y1={cy + Math.sin(a) * r1}
        x2={cx + Math.cos(a) * r2}
        y2={cy + Math.sin(a) * r2}
      />
    );
  });
  return (
    <g stroke="var(--sun)" strokeWidth={2} strokeLinecap="round">
      <circle cx={cx} cy={cy} r={r} fill="var(--sun)" stroke="none" />
      {rays}
    </g>
  );
}

function Cloud({ fill, transform }: { fill: string; transform?: string }) {
  return <path d={CLOUD} fill={fill} transform={transform} />;
}

export function WeatherIcon({
  kind,
  size = 32,
  className,
}: {
  kind: IconKind;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden="true"
      focusable="false"
    >
      {kind === 'sun' && <Sun cx={16} cy={16} r={6} />}
      {kind === 'partly' && (
        <>
          <Sun cx={12} cy={11} r={4.5} />
          <Cloud fill="var(--cloud-light)" transform="translate(3 3)" />
        </>
      )}
      {kind === 'cloud' && (
        <>
          <Cloud fill="var(--cloud-light)" transform="translate(-4 -5) scale(0.9)" />
          <Cloud fill="var(--cloud)" transform="translate(1 1)" />
        </>
      )}
      {kind === 'rain' && (
        <>
          <Cloud fill="var(--cloud)" transform="translate(0 -6)" />
          <g stroke="var(--rain)" strokeWidth={2} strokeLinecap="round">
            <line x1={11} y1={23} x2={9.5} y2={27} />
            <line x1={16.5} y1={23} x2={15} y2={27} />
            <line x1={22} y1={23} x2={20.5} y2={27} />
          </g>
        </>
      )}
      {kind === 'storm' && (
        <>
          <Cloud fill="var(--cloud)" transform="translate(0 -6)" />
          <path d="M17 19l-4 6h3.5l-1.5 5 5-7h-3.5l1.5-4z" fill="var(--sun)" />
        </>
      )}
      {kind === 'snow' && (
        <>
          <Cloud fill="var(--cloud-light)" transform="translate(0 -6)" />
          <g fill="var(--rain)">
            <circle cx={10.5} cy={24} r={1.4} />
            <circle cx={16} cy={27} r={1.4} />
            <circle cx={21.5} cy={24} r={1.4} />
          </g>
        </>
      )}
      {kind === 'fog' && (
        <g stroke="var(--cloud)" strokeWidth={2.2} strokeLinecap="round">
          <line x1={6} y1={11} x2={24} y2={11} />
          <line x1={9} y1={16} x2={27} y2={16} />
          <line x1={5} y1={21} x2={21} y2={21} />
          <line x1={11} y1={26} x2={25} y2={26} />
        </g>
      )}
      {kind === 'unknown' && (
        <circle
          cx={16}
          cy={16}
          r={7}
          fill="none"
          stroke="var(--text-faint)"
          strokeWidth={2}
          strokeDasharray="3 3"
        />
      )}
    </svg>
  );
}
