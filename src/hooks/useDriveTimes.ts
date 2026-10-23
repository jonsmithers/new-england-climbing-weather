import { useEffect, useState } from 'react';
import type { Location } from '../locations';
import type { Origin } from '../lib/origin';
import { fetchDriveTimes, type Drive } from '../api/routing';

// Drive time from `origin` to every crag, from one batched routing request.
// A crag is absent from the map while loading or if routing failed, and null
// if OSRM had no route; either way the card just shows no distance.
export function useDriveTimes(
  locations: Location[],
  origin: Origin,
): Record<string, Drive | null> {
  const [drives, setDrives] = useState<Record<string, Drive | null>>({});
  const { lat, lon } = origin;

  useEffect(() => {
    let cancelled = false;
    setDrives({});
    fetchDriveTimes({ lat, lon, label: '' }, locations)
      .then((result) => {
        if (!cancelled) setDrives(result);
      })
      .catch((err: unknown) => {
        console.warn('Drive times unavailable:', err);
      });
    return () => {
      cancelled = true;
    };
  }, [locations, lat, lon]);

  return drives;
}
