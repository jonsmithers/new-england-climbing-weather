import type { NwsForecast } from '../api/nws';
import type { OpenMeteoForecast } from '../api/openMeteo';
import { type Weekend, isSameDay, formatYmd } from './weekend';

export type DaySummary = {
  date: Date;
  high: number | null;
  low: number | null;
  popMax: number | null;
  // null when the source returned no precip data for this day (distinct from a
  // dry-but-forecasted 0).
  precipInches: number | null;
  precipMmByHour: number[];
};

export type WeekendForecast = {
  days: DaySummary[];
};

// Lower is drier and therefore more viable for climbing. Rain amount
// dominates (0.1" ≈ 1 point) with probability-of-precip as a lighter tiebreak
// (100% PoP ≈ 1 point). Saturday and Sunday are weighted 3× vs. Fri/Mon since
// those are the days most people actually get out.
export function rainScore(forecast: WeekendForecast): number {
  let score = 0;
  for (const day of forecast.days) {
    const dow = day.date.getDay();
    const weight = dow === 0 || dow === 6 ? 3 : 1;
    const badness = (day.precipInches ?? 0) * 10 + (day.popMax ?? 0) / 100;
    score += weight * badness;
  }
  return score;
}

export function summarizeWeekend(
  forecast: NwsForecast,
  weekend: Weekend,
): WeekendForecast {
  return {
    days: weekend.days.map((day) => summarizeDay(forecast, day)),
  };
}

function summarizeDay(forecast: NwsForecast, day: Date): DaySummary {
  const periods = forecast.periods.filter((p) =>
    isSameDay(new Date(p.startTime), day),
  );
  const dayPeriod = periods.find((p) => p.isDaytime);
  const nightPeriod = periods.find((p) => !p.isDaytime);

  const pops = periods
    .map((p) => p.probabilityOfPrecipitation.value)
    .filter((v): v is number => v !== null);
  const popMax = pops.length ? Math.max(...pops) : null;

  const dayStart = new Date(day).getTime();
  const dayEnd = dayStart + 24 * 3_600_000;
  const precipMmByHour = new Array<number>(24).fill(0);
  let mm = 0;
  let hasPrecipData = false;
  for (const r of forecast.precipMm) {
    const t = new Date(r.hourIso).getTime();
    if (t < dayStart || t >= dayEnd) continue;
    const hour = Math.floor((t - dayStart) / 3_600_000);
    precipMmByHour[hour] += r.mm;
    mm += r.mm;
    hasPrecipData = true;
  }

  return {
    date: day,
    high: dayPeriod?.temperature ?? null,
    low: nightPeriod?.temperature ?? null,
    popMax,
    precipInches: hasPrecipData ? mm / 25.4 : null,
    precipMmByHour,
  };
}

export function summarizeSummitWeekend(
  forecast: OpenMeteoForecast,
  weekend: Weekend,
): WeekendForecast {
  return {
    days: weekend.days.map((day) => summarizeSummitDay(forecast, day)),
  };
}

function summarizeSummitDay(
  forecast: OpenMeteoForecast,
  day: Date,
): DaySummary {
  const idx = forecast.daily.time.indexOf(formatYmd(day));
  if (idx === -1) {
    return {
      date: day,
      high: null,
      low: null,
      popMax: null,
      precipInches: null,
      precipMmByHour: new Array<number>(24).fill(0),
    };
  }
  return {
    date: day,
    high: forecast.daily.temperature_2m_max[idx] ?? null,
    low: forecast.daily.temperature_2m_min[idx] ?? null,
    popMax: forecast.daily.precipitation_probability_max[idx] ?? null,
    precipInches: forecast.daily.precipitation_sum[idx] ?? null,
    precipMmByHour: new Array<number>(24).fill(0),
  };
}
