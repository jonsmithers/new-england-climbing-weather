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
  // NWS short forecast text ("Mostly Sunny", "Chance Rain Showers") and wind
  // range ("5 to 10 mph"), preferring the daytime period. null for Open-Meteo.
  conditions: string | null;
  wind: string | null;
};

// Coarse climbability bucket for a single day. Thresholds favor caution: a
// modest chance of showers is enough to call a day "damp".
export type DayCondition = 'dry' | 'damp' | 'wet' | 'unknown';

export function dayCondition(day: DaySummary): DayCondition {
  if (day.popMax == null && day.precipInches == null) return 'unknown';
  const pop = day.popMax ?? 0;
  const inches = day.precipInches ?? 0;
  if (inches >= 0.1 || pop >= 60) return 'wet';
  if (inches >= 0.02 || pop >= 30) return 'damp';
  return 'dry';
}

export type Verdict = {
  level: Exclude<DayCondition, 'unknown'>;
  label: string;
  dryDays: number;
};

// One-line summary of the whole window, driven by how many days are dry.
export function weekendVerdict(forecast: WeekendForecast): Verdict {
  const total = forecast.days.length;
  const dryDays = forecast.days.filter((d) => dayCondition(d) === 'dry').length;
  const level = dryDays >= total - 1 ? 'dry' : dryDays >= total / 2 ? 'damp' : 'wet';
  const label =
    dryDays === total
      ? 'Dry all weekend'
      : dryDays === 0
        ? 'No dry days'
        : `${dryDays} of ${total} days dry`;
  return { level, label, dryDays };
}

export type WeekendForecast = {
  days: DaySummary[];
};

// Climbing viability, as penalty points: lower is better, 0 is a dry,
// comfortable weekend at a crag within an hour. Rain dominates; prior-day
// rain, temperature and drive time are smaller adjustments. Each factor is
// kept separate so the card's info tooltip can explain the ranking.
export type Viability = {
  rain: number;
  wetRock: number;
  temp: number;
  drive: number;
  total: number;
};

// Saturday and Sunday count 3× vs. Fri/Mon since those are the days most
// people actually get out. Applies to every per-day factor below.
const WEEKEND_DAY_WEIGHT = 3;
// Rain on the day before still leaves rock damp, but much less than rain on
// the day itself: 20% of the previous day's rain penalty.
const WET_ROCK_FACTOR = 0.2;
// Comfortable daytime highs (°F). Outside the band, points per °F; cold hurts
// more than heat (numb fingers vs. greasy holds).
const COMFORT_LOW_F = 45;
const COMFORT_HIGH_F = 75;
const COLD_PER_F = 0.05;
const HOT_PER_F = 0.025;
// The first hour of driving is free, then points per extra hour. Charged once
// per trip, not per day.
const FREE_DRIVE_HOURS = 1;
const DRIVE_PER_HOUR = 0.4;

export const COMFORT_BAND_F = { low: COMFORT_LOW_F, high: COMFORT_HIGH_F } as const;

function dayWeight(day: DaySummary): number {
  const dow = day.date.getDay();
  return dow === 0 || dow === 6 ? WEEKEND_DAY_WEIGHT : 1;
}

// Rain amount dominates (0.1" ≈ 1 point) with probability-of-precip as a
// lighter tiebreak (100% PoP ≈ 1 point).
function rainPoints(day: DaySummary): number {
  return (day.precipInches ?? 0) * 10 + (day.popMax ?? 0) / 100;
}

function tempPoints(day: DaySummary): number {
  if (day.high == null) return 0;
  if (day.high < COMFORT_LOW_F) return (COMFORT_LOW_F - day.high) * COLD_PER_F;
  if (day.high > COMFORT_HIGH_F) return (day.high - COMFORT_HIGH_F) * HOT_PER_F;
  return 0;
}

// `driveSeconds` is null/undefined when routing hasn't answered or failed;
// that contributes 0 rather than guessing, so a routing outage leaves the
// weather-only order intact.
export function viabilityScore(
  forecast: WeekendForecast,
  driveSeconds?: number | null,
): Viability {
  let rain = 0;
  let wetRock = 0;
  let temp = 0;
  forecast.days.forEach((day, i) => {
    const weight = dayWeight(day);
    rain += weight * rainPoints(day);
    temp += weight * tempPoints(day);
    // Prior day within the window: Fri→Sat, Sat→Sun, Sun→Mon. Thursday isn't
    // summarized, so Friday has no prior-day term.
    const prev = forecast.days[i - 1];
    if (prev) wetRock += weight * WET_ROCK_FACTOR * rainPoints(prev);
  });
  const drive =
    driveSeconds == null
      ? 0
      : Math.max(0, driveSeconds / 3600 - FREE_DRIVE_HOURS) * DRIVE_PER_HOUR;
  return { rain, wetRock, temp, drive, total: rain + wetRock + temp + drive };
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
    conditions: (dayPeriod ?? nightPeriod)?.shortForecast ?? null,
    wind: (dayPeriod ?? nightPeriod)?.windSpeed ?? null,
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
      conditions: null,
      wind: null,
    };
  }
  return {
    date: day,
    high: forecast.daily.temperature_2m_max[idx] ?? null,
    low: forecast.daily.temperature_2m_min[idx] ?? null,
    popMax: forecast.daily.precipitation_probability_max[idx] ?? null,
    precipInches: forecast.daily.precipitation_sum[idx] ?? null,
    precipMmByHour: new Array<number>(24).fill(0),
    conditions: null,
    wind: null,
  };
}
