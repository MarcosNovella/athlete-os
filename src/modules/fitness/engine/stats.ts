// Relative import: this pure module is also consumed by scripts/ outside Next (ADR-016).
import { addDaysIso } from '../../../lib/dates';
import type { DatedValue } from './baselines';

/**
 * Statistics primitives (V2.3 ADR-025): pure functions shared by the
 * training-load math (load.ts) and the pattern-candidate engine
 * (patterns.ts). `sampleSd` moved here from load.ts, `aggregateByDate` moved
 * here from trends.ts — both behavior-identical moves; the originals import
 * these back.
 */

export function mean(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Sample standard deviation (n-1); null for fewer than 2 points. */
export function sampleSd(values: readonly number[]): number | null {
  if (values.length < 2) return null;
  const m = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((acc, v) => acc + (v - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/** Pooled SD across two independent samples; null when either sample or the pooled SD is degenerate. */
export function pooledSd(a: readonly number[], b: readonly number[]): number | null {
  const sdA = sampleSd(a);
  const sdB = sampleSd(b);
  const dof = a.length + b.length - 2;
  if (sdA === null || sdB === null || dof <= 0) return null;
  const pooled = Math.sqrt(((a.length - 1) * sdA ** 2 + (b.length - 1) * sdB ** 2) / dof);
  return pooled < 1e-6 ? null : pooled;
}

/** Cohen's d for two independent samples (a − b, in pooled-SD units); null on a degenerate pooled SD. */
export function cohensD(a: readonly number[], b: readonly number[]): number | null {
  const ma = mean(a);
  const mb = mean(b);
  const sd = pooledSd(a, b);
  if (ma === null || mb === null || sd === null) return null;
  return (ma - mb) / sd;
}

/** 1-based average ranks (ties share the mean rank of their tied block). */
function ranks(values: readonly number[]): number[] {
  const order = values
    .map((_, i) => i)
    .sort((i, j) => (values[i] as number) - (values[j] as number));
  const out = new Array<number>(values.length).fill(0);
  let i = 0;
  while (i < order.length) {
    let j = i;
    while (j + 1 < order.length && values[order[j + 1] as number] === values[order[i] as number])
      j++;
    const avgRank = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) out[order[k] as number] = avgRank;
    i = j + 1;
  }
  return out;
}

/**
 * Spearman rank correlation (average-rank ties). Null when the arrays differ
 * in length, have fewer than 2 points, or either rank vector has zero
 * variance (degenerate — e.g. all-tied input).
 */
export function spearmanRho(xs: readonly number[], ys: readonly number[]): number | null {
  if (xs.length !== ys.length || xs.length < 2) return null;
  const rx = ranks(xs);
  const ry = ranks(ys);
  const sdX = sampleSd(rx);
  const sdY = sampleSd(ry);
  if (sdX === null || sdY === null || sdX < 1e-6 || sdY < 1e-6) return null;
  const mx = mean(rx) as number;
  const my = mean(ry) as number;
  let cov = 0;
  for (let i = 0; i < rx.length; i++) {
    cov += ((rx[i] as number) - mx) * ((ry[i] as number) - my);
  }
  cov /= rx.length - 1;
  return cov / (sdX * sdY);
}

export type LaggedPair = { date: string; predictor: number; outcome: number };

/**
 * Aligns a predictor series to an outcome series by CALENDAR DATE, never
 * index zipping (ADR-012 spirit): predictor[d] pairs with outcome[d+lagDays].
 * A missing day on either side yields NO pair, never a misaligned one.
 */
export function alignLagged(
  predictor: ReadonlyArray<DatedValue>,
  outcome: ReadonlyArray<DatedValue>,
  lagDays: number,
): LaggedPair[] {
  const outcomeByDate = new Map(outcome.map((o) => [o.date, o.value]));
  const pairs: LaggedPair[] = [];
  for (const p of predictor) {
    const outcomeDate = addDaysIso(p.date, lagDays);
    const outcomeValue = outcomeByDate.get(outcomeDate);
    if (outcomeValue !== undefined) {
      pairs.push({ date: p.date, predictor: p.value, outcome: outcomeValue });
    }
  }
  return pairs;
}

/** Combines same-date points with `combine` (e.g. max for e1RM PRs, mean for point samples). */
export function aggregateByDate(
  points: ReadonlyArray<DatedValue>,
  combine: (values: number[]) => number,
): DatedValue[] {
  const byDate = new Map<string, number[]>();
  for (const p of points) {
    const bucket = byDate.get(p.date);
    if (bucket) bucket.push(p.value);
    else byDate.set(p.date, [p.value]);
  }
  return [...byDate.entries()]
    .map(([date, values]) => ({ date, value: combine(values) }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}
