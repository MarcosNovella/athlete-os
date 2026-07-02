/**
 * Personal baselines (ADR-012): trailing 28-day mean ± SD per metric.
 * Gap semantics: a missing check-in is a MISSING observation — skipped,
 * never imputed as zero.
 */

export type DatedValue = { date: string; value: number };

export type Baseline = { mean: number; sd: number | null; count: number };

/** Minimum observations for a baseline to be considered formed. */
export const BASELINE_MIN_COUNT = 7;

/**
 * Baseline from the values strictly BEFORE `date`, within a trailing window of
 * `windowDays`. Values must be sorted ascending by date.
 */
export function trailingBaseline(
  values: ReadonlyArray<DatedValue>,
  date: string,
  windowDays = 28,
): Baseline | null {
  const from = shiftIso(date, -windowDays);
  const window = values.filter((v) => v.date >= from && v.date < date);
  if (window.length < 2) return null;
  const nums = window.map((v) => v.value);
  const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
  const variance = nums.reduce((acc, v) => acc + (v - mean) ** 2, 0) / (nums.length - 1);
  const sd = Math.sqrt(variance);
  return { mean, sd: sd < 1e-6 ? null : sd, count: window.length };
}

/** z-score of `value` against a baseline; null when the SD is degenerate. */
export function zScore(value: number, baseline: Baseline): number | null {
  if (baseline.sd === null) return null;
  return (value - baseline.mean) / baseline.sd;
}

export type ZTier = 'way_below' | 'below' | 'typical' | 'above' | 'way_above';

/**
 * Magnitude tiers for z display: |z|<0.5 typical, 0.5–1.5 above/below,
 * ≥1.5 way_above/way_below. Boundaries inclusive outward (0.5 → above).
 */
export function zTier(z: number): ZTier {
  if (z <= -1.5) return 'way_below';
  if (z <= -0.5) return 'below';
  if (z < 0.5) return 'typical';
  if (z < 1.5) return 'above';
  return 'way_above';
}

/**
 * Readiness-drop flag (ADR-012): fires when the LAST `consecutive` days all
 * have z < `threshold` against each day's own trailing baseline.
 */
export function readinessDropFlag(
  values: ReadonlyArray<DatedValue>,
  consecutive = 2,
  threshold = -1,
): boolean {
  if (values.length < consecutive) return false;
  const tail = values.slice(-consecutive);
  for (const day of tail) {
    const base = trailingBaseline(values, day.date);
    if (base === null || base.count < BASELINE_MIN_COUNT) return false;
    const z = zScore(day.value, base);
    if (z === null || z >= threshold) return false;
  }
  return true;
}

function shiftIso(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
