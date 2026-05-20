const CACHE_TTL_MS = 30 * 60 * 1000;
const BASE = 'https://api.weather.gov';

export type ForecastPeriod = {
  name: string;
  startTime: string;
  endTime: string;
  isDaytime: boolean;
  temperature: number;
  probabilityOfPrecipitation: { value: number | null };
};

export type PrecipBucket = {
  startIso: string;
  endIso: string;
  mm: number;
};

export type NwsForecast = {
  periods: ForecastPeriod[];
  precipMm: PrecipBucket[];
};

type GeoJson = {
  properties: {
    forecast?: string;
    gridId?: string;
    gridX?: number;
    gridY?: number;
    periods?: ForecastPeriod[];
    quantitativePrecipitation?: {
      values?: { validTime: string; value: number | null }[];
    };
  };
};

export async function fetchNwsForecast(
  lat: number,
  lon: number,
): Promise<NwsForecast> {
  const key = `nws:${lat.toFixed(4)},${lon.toFixed(4)}`;
  const cached = readCache<NwsForecast>(key);
  if (cached) return cached;

  const points = await getJson(`${BASE}/points/${lat},${lon}`);
  const { forecast, gridId, gridX, gridY } = points.properties;
  if (!forecast || !gridId || gridX == null || gridY == null) {
    throw new Error('NWS: incomplete points response');
  }

  const [forecastRes, gridRes] = await Promise.all([
    getJson(forecast),
    getJson(`${BASE}/gridpoints/${gridId}/${gridX},${gridY}`),
  ]);

  const result: NwsForecast = {
    periods: forecastRes.properties.periods ?? [],
    precipMm: parsePrecip(gridRes.properties.quantitativePrecipitation),
  };
  writeCache(key, result);
  return result;
}

async function getJson(url: string): Promise<GeoJson> {
  const r = await fetch(url, {
    headers: { Accept: 'application/geo+json' },
  });
  if (!r.ok) throw new Error(`NWS ${r.status} for ${url}`);
  return r.json() as Promise<GeoJson>;
}

function parsePrecip(
  qpf: GeoJson['properties']['quantitativePrecipitation'],
): PrecipBucket[] {
  if (!qpf?.values) return [];
  const buckets: PrecipBucket[] = [];
  for (const v of qpf.values) {
    if (v.value == null) continue;
    const [startStr, durationStr] = v.validTime.split('/');
    const start = new Date(startStr);
    const end = new Date(start.getTime() + parseIsoDurationMs(durationStr));
    buckets.push({
      startIso: start.toISOString(),
      endIso: end.toISOString(),
      mm: v.value,
    });
  }
  return buckets;
}

function parseIsoDurationMs(s: string): number {
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?$/.exec(s);
  if (!m) return 0;
  const days = Number(m[1] ?? 0);
  const hours = Number(m[2] ?? 0);
  const mins = Number(m[3] ?? 0);
  return ((days * 24 + hours) * 60 + mins) * 60 * 1000;
}

function readCache<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { ts: number; value: T };
    if (Date.now() - parsed.ts > CACHE_TTL_MS) return null;
    return parsed.value;
  } catch {
    return null;
  }
}

function writeCache<T>(key: string, value: T): void {
  try {
    sessionStorage.setItem(key, JSON.stringify({ ts: Date.now(), value }));
  } catch {
    // sessionStorage may be unavailable or full; non-fatal
  }
}
