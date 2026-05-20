export type Weekend = { saturday: Date; sunday: Date };

export function nextWeekend(now: Date = new Date()): Weekend {
  return weekendAt(0, now);
}

export function weekendAt(offset: number, now: Date = new Date()): Weekend {
  const dow = now.getDay();
  const daysUntilSat = dow === 6 ? 0 : (6 - dow + 7) % 7;
  const saturday = startOfDay(addDays(now, daysUntilSat + offset * 7));
  const sunday = startOfDay(addDays(saturday, 1));
  return { saturday, sunday };
}

export function formatRange(w: Weekend): string {
  const sameMonth = w.saturday.getMonth() === w.sunday.getMonth();
  const m = w.saturday.getMonth() + 1;
  if (sameMonth) {
    return `${m}/${w.saturday.getDate()}–${w.sunday.getDate()}`;
  }
  return `${m}/${w.saturday.getDate()}–${w.sunday.getMonth() + 1}/${w.sunday.getDate()}`;
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function formatShort(d: Date): string {
  const dows = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return `${dows[d.getDay()]} ${d.getMonth() + 1}/${d.getDate()}`;
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
