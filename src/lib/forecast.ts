import type { NwsForecast } from '../api/nws';
import type { OpenMeteoForecast } from '../api/openMeteo';
import { type Weekend, isSameDay, formatYmd } from './weekend';

export type DaySummary = {
  date: Date;
  high: number | null;
  low: number | null;
  popMax: number | null;
  precipInches: number;
};

export type WeekendForecast = {
  saturday: DaySummary;
  sunday: DaySummary;
};

export function summarizeWeekend(
  forecast: NwsForecast,
  weekend: Weekend,
): WeekendForecast {
  return {
    saturday: summarizeDay(forecast, weekend.saturday),
    sunday: summarizeDay(forecast, weekend.sunday),
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

  const dayStart = new Date(day);
  const dayEnd = new Date(day);
  dayEnd.setDate(dayEnd.getDate() + 1);
  const mm = forecast.precipMm
    .filter((b) => {
      const s = new Date(b.startIso);
      const e = new Date(b.endIso);
      return s < dayEnd && e > dayStart;
    })
    .reduce((sum, b) => sum + b.mm, 0);

  return {
    date: day,
    high: dayPeriod?.temperature ?? null,
    low: nightPeriod?.temperature ?? null,
    popMax,
    precipInches: mm / 25.4,
  };
}

export function summarizeSummitWeekend(
  forecast: OpenMeteoForecast,
  weekend: Weekend,
): WeekendForecast {
  return {
    saturday: summarizeSummitDay(forecast, weekend.saturday),
    sunday: summarizeSummitDay(forecast, weekend.sunday),
  };
}

function summarizeSummitDay(
  forecast: OpenMeteoForecast,
  day: Date,
): DaySummary {
  const idx = forecast.daily.time.indexOf(formatYmd(day));
  if (idx === -1) {
    return { date: day, high: null, low: null, popMax: null, precipInches: 0 };
  }
  return {
    date: day,
    high: forecast.daily.temperature_2m_max[idx] ?? null,
    low: forecast.daily.temperature_2m_min[idx] ?? null,
    popMax: forecast.daily.precipitation_probability_max[idx] ?? null,
    precipInches: forecast.daily.precipitation_sum[idx] ?? 0,
  };
}
