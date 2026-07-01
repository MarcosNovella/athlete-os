// Relative import: this pure module is also consumed by scripts/ outside Next (ADR-016).
import { addDaysIso } from '../../../lib/dates';

/**
 * Training-load math (ADR-012). Pure functions over daily series.
 * Gap semantics: a day WITHOUT training is a REAL 0 (rest day) — the daily
 * series is dense from the athlete's first data day onward.
 */

export type DayValue = { date: string; value: number };

/** Dense daily-load series from `fromDate` to `toDate` (0 on days without sessions). */
export function dailyLoadSeries(
  sessionLoads: ReadonlyArray<{ effective_date: string; value: number }>,
  fromDate: string,
  toDate: string,
): DayValue[] {
  const byDate = new Map<string, number>();
  for (const s of sessionLoads) {
    byDate.set(s.effective_date, (byDate.get(s.effective_date) ?? 0) + s.value);
  }
  const series: DayValue[] = [];
  for (let d = fromDate; d <= toDate; d = addDaysIso(d, 1)) {
    series.push({ date: d, value: byDate.get(d) ?? 0 });
  }
  return series;
}

/**
 * EWMA over a dense daily series (Williams et al. 2017): lambda = 2/(N+1),
 * seeded with the first day's value. Returns one smoothed value per input day.
 */
export function ewmaSeries(series: ReadonlyArray<DayValue>, nDays: number): DayValue[] {
  const lambda = 2 / (nDays + 1);
  const out: DayValue[] = [];
  let prev: number | null = null;
  for (const day of series) {
    const value: number = prev === null ? day.value : day.value * lambda + prev * (1 - lambda);
    out.push({ date: day.date, value });
    prev = value;
  }
  return out;
}

export type AcwrBand = 'low' | 'optimal' | 'caution' | 'high';

/** ACWR bands (ADR-012): heuristic FLAGS, never verdicts. */
export function acwrBand(ratio: number): AcwrBand {
  if (ratio < 0.8) return 'low';
  if (ratio <= 1.3) return 'optimal';
  if (ratio <= 1.5) return 'caution';
  return 'high';
}

/** acute/chronic ratio; null when chronic is ~0 (no meaningful denominator). */
export function acwr(acute: number, chronic: number): number | null {
  if (chronic < 1e-6) return null;
  return acute / chronic;
}

/** Sample standard deviation (n-1); null for fewer than 2 points. */
function sampleSd(values: readonly number[]): number | null {
  if (values.length < 2) return null;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/** Foster monotony: weekly mean daily load / SD. Null when SD is 0 (undefined). */
export function monotony(weekDailyLoads: readonly number[]): number | null {
  const sd = sampleSd(weekDailyLoads);
  if (sd === null || sd < 1e-6) return null;
  const mean = weekDailyLoads.reduce((a, b) => a + b, 0) / weekDailyLoads.length;
  return mean / sd;
}

/** Foster strain: weekly total load × monotony. Null when monotony is null. */
export function strain(weekDailyLoads: readonly number[]): number | null {
  const m = monotony(weekDailyLoads);
  if (m === null) return null;
  const total = weekDailyLoads.reduce((a, b) => a + b, 0);
  return total * m;
}
