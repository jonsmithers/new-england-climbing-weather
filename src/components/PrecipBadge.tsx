import './PrecipBadge.css';

type Props = { popMax: number | null; precipInches: number };

export function PrecipBadge({ popMax, precipInches }: Props) {
  const level = bucketize(popMax);
  const popStr = popMax === null ? '—' : `${Math.round(popMax)}%`;
  return (
    <div className={`precip-badge precip-${level}`}>
      <div className="precip-pop">{popStr}</div>
      <div className="precip-inches">{precipInches.toFixed(2)}″</div>
    </div>
  );
}

function bucketize(pop: number | null): 'low' | 'med' | 'high' | 'unknown' {
  if (pop === null) return 'unknown';
  if (pop < 20) return 'low';
  if (pop <= 50) return 'med';
  return 'high';
}
