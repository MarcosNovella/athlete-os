// Relative import: this pure module is also consumed by scripts/ outside Next (ADR-016).
import { addDaysIso } from '../../../lib/dates';
import { BASELINE_MIN_COUNT, type DatedValue, trailingBaseline } from './baselines';
import {
  acwr,
  type DayValue,
  dailyLoadSeries,
  ewmaSeries,
  type MonotonyBand,
  monotony,
  monotonyBand,
  monotonyDisplay,
  strain,
} from './load';
import type { ObservationLite } from './snapshot';
import { UNLOCK_THRESHOLDS } from './unlock';

/**
 * Trend series for the dashboards (ADR-012/015). Pure. Same gap semantics as
 * the snapshot: rest days are real zeros; missing check-ins stay missing.
 */

export type WeekSummary = {
  weekStart: string; // Monday
  totalLoad: number;
  /** vs the previous CALENDAR week; null on the oldest known week or prev 0. */
  loadDeltaPct: number | null;
  sessionCount: number;
  avgSleep: number | null;
  avgReadiness: number | null;
  monotony: number | null;
  monotonyBand: MonotonyBand | null;
  monotonyDisplay: string | null;
  strain: number | null;
  /** True while the week hasn't finished — deltas/tints should be read softly. */
  isPartial: boolean;
};

export type TrendsData = {
  today: string;
  /** Last 28 days, dense (rest = 0). */
  daily: DayValue[];
  acute7: DayValue[];
  chronic28: DayValue[];
  /**
   * Daily ACWR, last 28 days. A day is included only from the acwr_provisional
   * unlock day onward AND while chronic is a meaningful denominator — the same
   * gating semantics as the snapshot. Gaps preserved; values round2, uncapped.
   */
  acwr: DayValue[];
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

  // Daily ACWR, gated exactly like the snapshot: no ratio before the
  // provisional unlock day, no ratio over a ~0 chronic denominator.
  const acwrFull: DayValue[] = [];
  fullDaily.forEach((day, i) => {
    if (i + 1 < UNLOCK_THRESHOLDS.acwr_provisional) return;
    const acute = acuteFull[i];
    const chronic = chronicFull[i];
    if (acute === undefined || chronic === undefined) return;
    const ratio = acwr(acute.value, chronic.value);
    if (ratio !== null) acwrFull.push({ date: day.date, value: Math.round(ratio * 100) / 100 });
  });

  return {
    today,
    daily: fullDaily.filter((d) => d.date >= from28),
    acute7: acuteFull.filter((d) => d.date >= from28),
    chronic28: chronicFull.filter((d) => d.date >= from28),
    acwr: acwrFull.filter((d) => d.date >= from28),
    sleep: sleepAll.filter((v) => v.date >= from28),
    readiness: readinessAll.filter((v) => v.date >= from28),
    sleepMean: baselineMean(sleepAll, today),
    readinessMean: baselineMean(readinessAll, today),
    weeks: weekSummaries(fullDaily, sessionLoads, sleepAll, readinessAll, today),
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
  today: string,
): WeekSummary[] {
  const byWeek = new Map<string, DayValue[]>();
  for (const day of fullDaily) {
    const ws = weekStartMonday(day.date);
    const bucket = byWeek.get(ws);
    if (bucket) bucket.push(day);
    else byWeek.set(ws, [day]);
  }

  // Summarize ALL known weeks so the oldest returned week still gets its delta,
  // then keep the last 4.
  const starts = [...byWeek.keys()].sort();
  const all = starts.map((weekStart) => {
    const days = byWeek.get(weekStart) ?? [];
    const weekEnd = addDaysIso(weekStart, 6);
    const inWeek = (date: string) => date >= weekStart && date <= weekEnd;
    const loads = days.map((d) => d.value);
    const monotonyVal = roundOrNull(monotony(loads), 2);
    return {
      weekStart,
      totalLoad: loads.reduce((a, b) => a + b, 0),
      loadDeltaPct: null as number | null,
      sessionCount: sessionLoads.filter((s) => inWeek(s.effective_date)).length,
      avgSleep: avg(sleep.filter((v) => inWeek(v.date)).map((v) => v.value)),
      avgReadiness: avg(readiness.filter((v) => inWeek(v.date)).map((v) => v.value)),
      monotony: monotonyVal,
      monotonyBand: monotonyVal === null ? null : monotonyBand(monotonyVal),
      monotonyDisplay: monotonyVal === null ? null : monotonyDisplay(monotonyVal),
      strain: roundOrNull(strain(loads), 0),
      isPartial: weekEnd > today,
    };
  });
  for (let i = 1; i < all.length; i++) {
    const prev = all[i - 1];
    const cur = all[i];
    if (prev !== undefined && cur !== undefined && prev.totalLoad > 0) {
      cur.loadDeltaPct = Math.round(((cur.totalLoad - prev.totalLoad) / prev.totalLoad) * 100);
    }
  }
  return all.slice(-4);
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
