// Single source of truth for cache-key prefixes. The API modules build their
// keys from these, and the helpers below match on them, so the two cannot drift.
export const CACHE_PREFIX = {
  nws: 'nws:',
  om: 'om:',
} as const;

const CACHE_PREFIXES = Object.values(CACHE_PREFIX);

export function getOldestCacheAgeMs(): number | null {
  let oldest: number | null = null;
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (!key || !CACHE_PREFIXES.some((p) => key.startsWith(p))) continue;
    try {
      const raw = sessionStorage.getItem(key);
      if (!raw) continue;
      const { ts } = JSON.parse(raw) as { ts: number };
      if (typeof ts !== 'number') continue;
      if (oldest == null || ts < oldest) oldest = ts;
    } catch {
      // skip malformed entries
    }
  }
  return oldest == null ? null : Date.now() - oldest;
}

export function clearForecastCache(): void {
  const toRemove: string[] = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (key && CACHE_PREFIXES.some((p) => key.startsWith(p))) toRemove.push(key);
  }
  for (const key of toRemove) sessionStorage.removeItem(key);
}
