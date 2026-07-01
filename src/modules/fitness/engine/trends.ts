import { addDaysIso } from '@/lib/dates';
import { BASELINE_MIN_COUNT, type DatedValue, trailingBaseline } from './baselines';
import { type DayValue, dailyLoadSeries, ewmaSeries, monotony, strain } from './load';
import type { ObservationLite } from './snapshot';

/**
 * Trend series for the dashboards (ADR-012/015). Pure. Same gap semantics as
 * the snapshot: rest days are real zeros; missing check-ins stay missing.
 */

export type WeekSummary = {
  weekStart: string; // Monday
  totalLoad: number;
  sessionCount: number;
  avgSleep: number | null;
  avgReadiness: number | null;
  monotony: number | null;
  strain: number | null;
};

export type TrendsData = {
  today: string;
  /** Last 28 days, dense (rest = 0). */
  daily: DayValue[];
  acute7: DayValue[];
  chronic28: DayValue[];
  /** Last 28 days, gaps preserved. */
  sleep: DatedValue[];
  readiness: DatedValue[];
  /** Personal means for overlay lines; null while baselines form. */
  sleepMean: number | null;
  readinessMean: number | null;
  /** Last 4 calendar weeks (Monday start), oldest → newest; current week partial. */
  weeks: WeekSummary[];
};

export function computeTrends(obs: ReadonlyArray<ObservationLite>, today: string): TrendsData {
  const firstDate = obs.reduce<string>(
    (min, o) => (o.effective_date < min ? o.effective_date : min),
    today,
  );

  const sessionLoads = obs
    .filter((o) => o.metric_key === 'session_load')
    .map((o) => ({ effective_date: o.effective_date, value: o.value }));
  const fullDaily = dailyLoadSeries(sessionLoads, firstDate, today);
  const acuteFull = ewmaSeries(fullDaily, 7);
  const chronicFull = ewmaSeries(fullDaily, 28);

  const from28 = addDaysIso(today, -27);
  const sleepAll = metricSeries(obs, 'sleep_duration');
  const readinessAll = metricSeries(obs, 'readiness');

  return {
    today,
    daily: fullDaily.filter((d) => d.date >= from28),
    acute7: acuteFull.filter((d) => d.date >= from28),
    chronic28: chronicFull.filter((d) => d.date >= from28),
    sleep: sleepAll.filter((v) => v.date >= from28),
    readiness: readinessAll.filter((v) => v.date >= from28),
    sleepMean: baselineMean(sleepAll, today),
    readinessMean: baselineMean(readinessAll, today),
    weeks: weekSummaries(fullDaily, sessionLoads, sleepAll, readinessAll),
  };
}

/** Monday of the week containing `isoDate`. */
export function weekStartMonday(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  const shift = (d.getUTCDay() + 6) % 7; // Mon=0 ... Sun=6
  d.setUTCDate(d.getUTCDate() - shift);
  return d.toISOString().slice(0, 10);
}

function weekSummaries(
  fullDaily: ReadonlyArray<DayValue>,
  sessionLoads: ReadonlyArray<{ effective_date: string; value: number }>,
  sleep: ReadonlyArray<DatedValue>,
  readiness: ReadonlyArray<DatedValue>,
): WeekSummary[] {
  const byWeek = new Map<string, DayValue[]>();
  for (const day of fullDaily) {
    const ws = weekStartMonday(day.date);
    const bucket = byWeek.get(ws);
    if (bucket) bucket.push(day);
    else byWeek.set(ws, [day]);
  }

  const starts = [...byWeek.keys()].sort().slice(-4);
  return starts.map((weekStart) => {
    const days = byWeek.get(weekStart) ?? [];
    const weekEnd = addDaysIso(weekStart, 6);
    const inWeek = (date: string) => date >= weekStart && date <= weekEnd;
    const loads = days.map((d) => d.value);
    return {
      weekStart,
      totalLoad: loads.reduce((a, b) => a + b, 0),
      sessionCount: sessionLoads.filter((s) => inWeek(s.effective_date)).length,
      avgSleep: avg(sleep.filter((v) => inWeek(v.date)).map((v) => v.value)),
      avgReadiness: avg(readiness.filter((v) => inWeek(v.date)).map((v) => v.value)),
      monotony: roundOrNull(monotony(loads), 2),
      strain: roundOrNull(strain(loads), 0),
    };
  });
}

function baselineMean(values: ReadonlyArray<DatedValue>, today: string): number | null {
  const base = trailingBaseline(values, today);
  if (base === null || base.count < BASELINE_MIN_COUNT) return null;
  return Math.round(base.mean * 100) / 100;
}

function metricSeries(obs: ReadonlyArray<ObservationLite>, key: string): DatedValue[] {
  return obs
    .filter((o) => o.metric_key === key)
    .map((o) => ({ date: o.effective_date, value: o.value }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

function avg(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100;
}

function roundOrNull(n: number | null, decimals: number): number | null {
  if (n === null) return null;
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}
