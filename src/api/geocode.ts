import type { Origin } from '../lib/origin';

// Photon (komoot's OSM geocoder). Free and keyless under a fair-use policy, so
// we only search on submit (never per keystroke) and remember results for the
// page's lifetime.
const BASE = 'https://photon.komoot.io/api/';

// Bias results toward New England without excluding anywhere else.
const BIAS = { lat: 42.8, lon: -71.8 };

type PhotonFeature = {
  geometry: { coordinates: [number, number] };
  properties: {
    name?: string;
    housenumber?: string;
    street?: string;
    city?: string;
    county?: string;
    state?: string;
    country?: string;
    countrycode?: string;
  };
};

const memo = new Map<string, Origin[]>();

export async function searchPlaces(query: string): Promise<Origin[]> {
  const q = query.trim();
  if (!q) return [];
  const hit = memo.get(q.toLowerCase());
  if (hit) return hit;

  const params = new URLSearchParams({
    q,
    limit: '6',
    lang: 'en',
    lat: String(BIAS.lat),
    lon: String(BIAS.lon),
  });
  const r = await fetch(`${BASE}?${params.toString()}`);
  if (!r.ok) throw new Error(`Photon ${r.status}`);
  const json = (await r.json()) as { features?: PhotonFeature[] };

  const seen = new Set<string>();
  const results: Origin[] = [];
  for (const f of json.features ?? []) {
    const [lon, lat] = f.geometry.coordinates;
    const label = formatLabel(f.properties);
    if (!label || seen.has(label)) continue;
    seen.add(label);
    results.push({ lat, lon, label });
  }
  memo.set(q.toLowerCase(), results);
  return results;
}

// "Davis Square, Somerville, MA" style: the place itself, then the town and
// state (or country outside the US). Skips parts that repeat the name.
function formatLabel(p: PhotonFeature['properties']): string {
  const street = p.street ? [p.housenumber, p.street].filter(Boolean).join(' ') : undefined;
  const parts = [
    p.name ?? street,
    p.city,
    p.countrycode === 'US' ? stateAbbrev(p.state) : (p.state ?? p.country),
  ];
  const out: string[] = [];
  for (const part of parts) {
    if (part && !out.includes(part)) out.push(part);
  }
  return out.join(', ');
}

const US_STATES: Record<string, string> = {
  Connecticut: 'CT',
  Maine: 'ME',
  Massachusetts: 'MA',
  'New Hampshire': 'NH',
  'New Jersey': 'NJ',
  'New York': 'NY',
  Pennsylvania: 'PA',
  'Rhode Island': 'RI',
  Vermont: 'VT',
};

function stateAbbrev(state: string | undefined): string | undefined {
  return state ? (US_STATES[state] ?? state) : undefined;
}
