// Keep in sync with the prefixes used by api/nws.ts and api/openMeteo.ts.
const CACHE_PREFIXES = ['nws:', 'om:'];

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
