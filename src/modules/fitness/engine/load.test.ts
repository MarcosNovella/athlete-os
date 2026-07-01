import { describe, expect, it } from 'vitest';
import { acwr, acwrBand, dailyLoadSeries, ewmaSeries, monotony, strain } from './load';

describe('dailyLoadSeries', () => {
  it('fills rest days with a REAL 0 and sums multiple sessions per day', () => {
    const series = dailyLoadSeries(
      [
        { effective_date: '2026-07-01', value: 560 },
        { effective_date: '2026-07-01', value: 200 },
        { effective_date: '2026-07-03', value: 300 },
      ],
      '2026-07-01',
      '2026-07-04',
    );
    expect(series).toEqual([
      { date: '2026-07-01', value: 760 },
      { date: '2026-07-02', value: 0 },
      { date: '2026-07-03', value: 300 },
      { date: '2026-07-04', value: 0 },
    ]);
  });
});

describe('ewmaSeries', () => {
  it('returns a constant for a constant series', () => {
    const series = Array.from({ length: 30 }, (_, i) => ({
      date: `2026-06-${String(i + 1).padStart(2, '0')}`,
      value: 100,
    }));
    const out = ewmaSeries(series.slice(0, 28), 7);
    expect(out.at(-1)?.value).toBeCloseTo(100, 6);
  });

  it('reacts faster with a shorter time constant', () => {
    const series = [
      ...Array.from({ length: 10 }, (_, i) => ({ date: `d${i}`, value: 100 })),
      { date: 'spike', value: 500 },
    ];
    const fast = ewmaSeries(series, 7).at(-1)?.value ?? 0;
    const slow = ewmaSeries(series, 28).at(-1)?.value ?? 0;
    expect(fast).toBeGreaterThan(slow);
  });

  it('is empty for an empty series', () => {
    expect(ewmaSeries([], 7)).toEqual([]);
  });
});

describe('acwr', () => {
  it('computes the ratio and is null without a chronic base', () => {
    expect(acwr(120, 100)).toBeCloseTo(1.2);
    expect(acwr(120, 0)).toBeNull();
  });

  it('maps bands per ADR-012', () => {
    expect(acwrBand(0.5)).toBe('low');
    expect(acwrBand(1.0)).toBe('optimal');
    expect(acwrBand(1.4)).toBe('caution');
    expect(acwrBand(1.8)).toBe('high');
  });
});

describe('monotony & strain (Foster)', () => {
  const variedWeek = [400, 0, 600, 0, 500, 0, 300];

  it('computes mean/sd and total×monotony', () => {
    const m = monotony(variedWeek);
    expect(m).not.toBeNull();
    const total = variedWeek.reduce((a, b) => a + b, 0);
    expect(strain(variedWeek)).toBeCloseTo(total * (m ?? 0));
  });

  it('is null when every day is identical (SD = 0)', () => {
    expect(monotony([100, 100, 100, 100, 100, 100, 100])).toBeNull();
    expect(strain([100, 100, 100, 100, 100, 100, 100])).toBeNull();
  });
});
