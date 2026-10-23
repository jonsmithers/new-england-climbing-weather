import type { Drive } from '../api/routing';

// "~27 min", "~2h 05m". The tilde is honest: OSRM has no traffic data and
// runs a bit long on highway trips.
export function formatDriveTime(drive: Drive): string {
  const minutes = Math.round(drive.seconds / 60);
  if (minutes < 60) return `~${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `~${h}h ${String(m).padStart(2, '0')}m`;
}

export function formatDriveDistance(drive: Drive): string {
  return `${Math.round(drive.meters / 1609.344)} mi`;
}
