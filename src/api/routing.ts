import type { Location } from '../locations';
import type { Origin } from '../lib/origin';

// OSRM's car profile hosted by FOSSGIS (the successor to the OSRM demo
// server). Usage policy: at most 1 req/s, no heavy use, attribution required
// (shown in the RefreshFooter credits). One `/table` call covers every crag.
const BASE = 'https://routing.openstreetmap.de/routed-car/table/v1/driving';

// Drive times don't change week to week, so cache for a month. The `drive:`
// prefix is deliberately NOT in CACHE_PREFIX, so the forecast refresh button
// leaves these alone. localStorage (not session) so they survive a reload.
const CACHE_PREFIX = 'drive:';
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type Drive = {
  seconds: number;
  meters: number;
};

// Resolves to one entry per crag: a Drive, or null when OSRM couldn't route
// to it. Rejects only if the request itself fails.
export async function fetchDriveTimes(
  origin: Origin,
  locations: Location[],
): Promise<Record<string, Drive | null>> {
  const out: Record<string, Drive | null> = {};
  const missing: Location[] = [];
  for (const loc of locations) {
    const cached = readCache(cacheKey(origin, loc));
    if (cached !== undefined) out[loc.id] = cached;
    else missing.push(loc);
  }
  if (missing.length === 0) return out;

  // OSRM takes lon,lat pairs separated by `;`. Index 0 is the origin; the
  // rest are destinations, so `sources=0` asks for a single 1×N row.
  const coords = [origin, ...missing].map((p) => `${p.lon},${p.lat}`).join(';');
  const r = await fetch(`${BASE}/${coords}?sources=0&annotations=duration,distance`);
  if (!r.ok) throw new Error(`OSRM ${r.status}`);
  const json = (await r.json()) as {
    code: string;
    durations?: (number | null)[][];
    distances?: (number | null)[][];
  };
  if (json.code !== 'Ok' || !json.durations || !json.distances) {
    throw new Error(`OSRM: ${json.code}`);
  }

  missing.forEach((loc, i) => {
    const seconds = json.durations![0][i + 1];
    const meters = json.distances![0][i + 1];
    const drive = seconds == null || meters == null ? null : { seconds, meters };
    out[loc.id] = drive;
    writeCache(cacheKey(origin, loc), drive);
  });
  return out;
}

// Origin rounded to 3 decimals (~100 m) so tiny geocoder differences for the
// same place still hit the cache.
function cacheKey(origin: Origin, loc: Location): string {
  return `${CACHE_PREFIX}${origin.lat.toFixed(3)},${origin.lon.toFixed(3)}:${loc.id}`;
}

// undefined = not cached (or expired); null = cached "no route".
function readCache(key: string): Drive | null | undefined {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as { ts: number; value: Drive | null };
    if (Date.now() - parsed.ts > CACHE_TTL_MS) return undefined;
    return parsed.value;
  } catch {
    return undefined;
  }
}

function writeCache(key: string, value: Drive | null): void {
  try {
    localStorage.setItem(key, JSON.stringify({ ts: Date.now(), value }));
  } catch {
    // localStorage may be unavailable or full; non-fatal
  }
}
