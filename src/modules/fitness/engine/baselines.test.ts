import { describe, expect, it } from 'vitest';
import { readinessDropFlag, trailingBaseline, zScore, zTier } from './baselines';

function seriesOf(values: number[], startDate = '2026-06-01'): { date: string; value: number }[] {
  return values.map((value, i) => {
    const d = new Date(`${startDate}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    return { date: d.toISOString().slice(0, 10), value };
  });
}

describe('trailingBaseline', () => {
  it('uses only values strictly before the target date, inside the window', () => {
    const values = seriesOf([3, 3, 3, 3, 3, 3, 3, 5]); // last value must be excluded
    const lastDate = values.at(-1)?.date ?? '';
    const base = trailingBaseline(values, lastDate);
    expect(base?.mean).toBe(3);
    expect(base?.count).toBe(7);
  });

  it('skips missing days instead of imputing zeros', () => {
    // Only 3 observations across 28 days — mean reflects the 3 real values.
    const values = [
      { date: '2026-06-10', value: 4 },
      { date: '2026-06-20', value: 3 },
      { date: '2026-06-25', value: 5 },
    ];
    const base = trailingBaseline(values, '2026-07-01');
    expect(base?.count).toBe(3);
    expect(base?.mean).toBeCloseTo(4);
  });

  it('is null with fewer than 2 prior values', () => {
    expect(trailingBaseline([{ date: '2026-06-30', value: 4 }], '2026-07-01')).toBeNull();
  });
});

describe('zScore', () => {
  it('is null when the SD is degenerate (identical values)', () => {
    const base = trailingBaseline(seriesOf([3, 3, 3, 3, 3, 3, 3, 3]), '2026-07-01');
    expect(base?.sd).toBeNull();
    if (base) expect(zScore(2, base)).toBeNull();
  });

  it('computes standard deviations from the mean', () => {
    const base = { mean: 3, sd: 0.5, count: 10 };
    expect(zScore(2, base)).toBeCloseTo(-2);
  });
});

describe('zTier', () => {
  it('maps magnitude boundaries, inclusive outward at ±0.5 and ±1.5', () => {
    expect(zTier(0)).toBe('typical');
    expect(zTier(0.49)).toBe('typical');
    expect(zTier(-0.49)).toBe('typical');
    expect(zTier(0.5)).toBe('above');
    expect(zTier(-0.5)).toBe('below');
    expect(zTier(1.49)).toBe('above');
    expect(zTier(1.5)).toBe('way_above');
    expect(zTier(-1.5)).toBe('way_below');
    expect(zTier(-2.78)).toBe('way_below');
  });
});

describe('readinessDropFlag', () => {
  it('fires after 2 consecutive clearly-low days against a formed baseline', () => {
    const stable = Array.from({ length: 14 }, () => 4);
    const values = seriesOf([...stable.map((v, i) => (i % 3 === 0 ? 3 : v)), 1, 1]);
    expect(readinessDropFlag(values)).toBe(true);
  });

  it('does not fire on a single bad day', () => {
    const stable = Array.from({ length: 14 }, (_, i) => (i % 3 === 0 ? 3 : 4));
    const values = seriesOf([...stable, 1]);
    expect(readinessDropFlag(values)).toBe(false);
  });

  it('does not fire without a formed baseline (cold start)', () => {
    const values = seriesOf([4, 3, 1, 1]);
    expect(readinessDropFlag(values)).toBe(false);
  });
});
