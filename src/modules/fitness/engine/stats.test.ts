import { describe, expect, it } from 'vitest';
import {
  aggregateByDate,
  alignLagged,
  cohensD,
  mean,
  pooledSd,
  sampleSd,
  spearmanRho,
} from './stats';

describe('mean', () => {
  it('is null for an empty array', () => {
    expect(mean([])).toBeNull();
  });
  it('averages values', () => {
    expect(mean([1, 2, 3])).toBe(2);
  });
});

describe('sampleSd', () => {
  it('is null for fewer than 2 points', () => {
    expect(sampleSd([5])).toBeNull();
  });
  it('matches the known sample SD (n-1) of [2,4,4,4,5,5,7,9]', () => {
    // Textbook example: mean 5, sample SD 2.13809...
    const sd = sampleSd([2, 4, 4, 4, 5, 5, 7, 9]);
    expect(sd).not.toBeNull();
    expect(sd as number).toBeCloseTo(2.13809, 4);
  });
});

describe('pooledSd / cohensD', () => {
  it('is null when either sample has fewer than 2 points', () => {
    expect(pooledSd([1], [1, 2, 3])).toBeNull();
    expect(cohensD([1], [1, 2, 3])).toBeNull();
  });

  it('is null on a degenerate (near-zero) pooled SD', () => {
    // Both samples constant → pooled SD ~0.
    expect(cohensD([5, 5, 5], [5, 5, 5])).toBeNull();
  });

  it('computes a known Cohen d', () => {
    // a: mean 6, sd ~0.707; b: mean 4, sd ~0.707 (equal variance, n=5 each)
    // → pooled sd ~0.707, d = (6-4)/0.707 ≈ 2.828.
    const a = [5, 6, 6, 6, 7];
    const b = [3, 4, 4, 4, 5];
    const d = cohensD(a, b);
    expect(d).not.toBeNull();
    expect(d as number).toBeCloseTo(2.8284, 3);
  });
});

describe('spearmanRho', () => {
  it('is null for mismatched lengths or <2 points', () => {
    expect(spearmanRho([1], [1])).toBeNull();
    expect(spearmanRho([1, 2], [1])).toBeNull();
  });

  it('is 1 for a perfectly monotonic relationship', () => {
    const rho = spearmanRho([1, 2, 3, 4, 5], [10, 20, 30, 40, 50]);
    expect(rho).not.toBeNull();
    expect(rho as number).toBeCloseTo(1, 6);
  });

  it('is -1 for a perfectly inverse relationship', () => {
    const rho = spearmanRho([1, 2, 3, 4, 5], [50, 40, 30, 20, 10]);
    expect(rho).not.toBeNull();
    expect(rho as number).toBeCloseTo(-1, 6);
  });

  it('handles tied ranks (average-rank) with a known value', () => {
    // x has a tie at positions 2,3 (both value 2); textbook rho for this pair.
    const xs = [1, 2, 2, 3, 4];
    const ys = [1, 3, 2, 4, 5];
    const rho = spearmanRho(xs, ys);
    expect(rho).not.toBeNull();
    expect(rho as number).toBeCloseTo(0.9746794, 5);
  });

  it('is null when one vector is degenerate (all tied → zero variance)', () => {
    expect(spearmanRho([1, 1, 1, 1], [1, 2, 3, 4])).toBeNull();
  });
});

describe('alignLagged', () => {
  it('pairs predictor[d] with outcome[d+lagDays] via calendar-date lookup', () => {
    const predictor = [
      { date: '2026-01-01', value: 6 },
      { date: '2026-01-02', value: 7 },
    ];
    const outcome = [
      { date: '2026-01-02', value: 4 },
      { date: '2026-01-03', value: 5 },
    ];
    const pairs = alignLagged(predictor, outcome, 1);
    expect(pairs).toEqual([
      { date: '2026-01-01', predictor: 6, outcome: 4 },
      { date: '2026-01-02', predictor: 7, outcome: 5 },
    ]);
  });

  it('drops a predictor day when the lagged outcome day is missing (never misaligns)', () => {
    const predictor = [
      { date: '2026-01-01', value: 6 },
      { date: '2026-01-02', value: 7 }, // outcome for 01-03 missing below → dropped
      { date: '2026-01-03', value: 8 },
    ];
    const outcome = [
      { date: '2026-01-02', value: 4 },
      { date: '2026-01-04', value: 5 },
    ];
    const pairs = alignLagged(predictor, outcome, 1);
    expect(pairs).toEqual([
      { date: '2026-01-01', predictor: 6, outcome: 4 },
      { date: '2026-01-03', predictor: 8, outcome: 5 },
    ]);
  });

  it('supports lag 0 (same-day join)', () => {
    const predictor = [{ date: '2026-01-01', value: 1 }];
    const outcome = [{ date: '2026-01-01', value: 2 }];
    expect(alignLagged(predictor, outcome, 0)).toEqual([
      { date: '2026-01-01', predictor: 1, outcome: 2 },
    ]);
  });
});

describe('aggregateByDate', () => {
  it('combines same-date points and sorts ascending', () => {
    const points = [
      { date: '2026-01-02', value: 5 },
      { date: '2026-01-01', value: 3 },
      { date: '2026-01-01', value: 7 },
    ];
    const result = aggregateByDate(points, (values) => Math.max(...values));
    expect(result).toEqual([
      { date: '2026-01-01', value: 7 },
      { date: '2026-01-02', value: 5 },
    ]);
  });
});
