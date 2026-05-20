const CACHE_TTL_MS = 30 * 60 * 1000;
const BASE = 'https://api.open-meteo.com/v1/forecast';

export type OpenMeteoDaily = {
  time: string[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
  precipitation_probability_max: (number | null)[];
  precipitation_sum: (number | null)[];
};

export type OpenMeteoForecast = {
  elevation: number;
  daily: OpenMeteoDaily;
};

export async function fetchOpenMeteo(
  lat: number,
  lon: number,
  elevationMeters: number,
): Promise<OpenMeteoForecast> {
  const key = `om:${lat.toFixed(4)},${lon.toFixed(4)},${elevationMeters}`;
  const cached = readCache<OpenMeteoForecast>(key);
  if (cached) return cached;

  const params = new URLSearchParams({
    latitude: lat.toString(),
    longitude: lon.toString(),
    elevation: elevationMeters.toString(),
    daily:
      'temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum',
    timezone: 'auto',
    temperature_unit: 'fahrenheit',
    precipitation_unit: 'inch',
    forecast_days: '14',
  });

  const r = await fetch(`${BASE}?${params}`);
  if (!r.ok) throw new Error(`Open-Meteo ${r.status}`);
  const data = (await r.json()) as OpenMeteoForecast;

  const result: OpenMeteoForecast = {
    elevation: data.elevation,
    daily: data.daily,
  };
  writeCache(key, result);
  return result;
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
    // non-fatal
  }
}
