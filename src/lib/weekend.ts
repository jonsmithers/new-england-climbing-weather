// `days` are the forecast days shown per crag, in display order:
// Friday, Saturday, Sunday, Monday. `saturday` is kept as the anchor the
// external forecast links and effect/cache keys pivot on.
export type Weekend = { saturday: Date; days: Date[] };

export function nextWeekend(now: Date = new Date()): Weekend {
  return weekendAt(0, now);
}

export function weekendAt(offset: number, now: Date = new Date()): Weekend {
  const dow = now.getDay();
  const daysUntilSat = dow === 6 ? 0 : (6 - dow + 7) % 7;
  const saturday = startOfDay(addDays(now, daysUntilSat + offset * 7));
  const days = [-1, 0, 1, 2].map((d) => startOfDay(addDays(saturday, d)));
  return { saturday, days };
}

export function formatRange(w: Weekend): string {
  const first = w.days[0];
  const last = w.days[w.days.length - 1];
  const sameMonth = first.getMonth() === last.getMonth();
  const m = first.getMonth() + 1;
  if (sameMonth) {
    return `${m}/${first.getDate()}–${last.getDate()}`;
  }
  return `${m}/${first.getDate()}–${last.getMonth() + 1}/${last.getDate()}`;
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function dayLabel(d: Date): string {
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
}

export function formatMonthDay(d: Date): string {
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function formatShort(d: Date): string {
  return `${dayLabel(d)} ${formatMonthDay(d)}`;
}

export function formatYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, days: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  return r;
}

function startOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}
