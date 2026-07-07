import { describe, expect, it } from 'vitest';
import {
  computePatternCandidates,
  formatCandidateEs,
  PATTERN_MIN_ABS_D,
  PATTERN_MIN_N_PER_BIN,
  type PatternPair,
  type PatternResult,
} from './patterns';
import type { ObservationLite } from './snapshot';

function dateAt(startIso: string, offset: number): string {
  const d = new Date(`${startIso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

const START = '2026-01-01';
const DAYS_84 = 84;
const today84 = dateAt(START, DAYS_84 - 1);

function findResult(results: PatternResult[], pairId: string): PatternResult {
  const r = results.find((x) => x.pairId === pairId);
  if (!r) throw new Error(`missing result for ${pairId}`);
  return r;
}

describe('computePatternCandidates — unlock gate', () => {
  it('is locked before 56 days of history, with empty results and correct remainingDays', () => {
    const days = 10;
    const today = dateAt(START, days - 1);
    const obs: ObservationLite[] = [];
    for (let i = 0; i < days; i++) {
      obs.push({ metric_key: 'readiness', value: 3, effective_date: dateAt(START, i) });
    }
    const data = computePatternCandidates(obs, today);
    expect(data.locked).toBe(true);
    expect(data.historyDays).toBe(days);
    expect(data.remainingDays).toBe(56 - days);
    expect(data.results).toEqual([]);
    expect(data.surfaced).toEqual([]);
    expect(data.evaluatedCount).toBe(0);
  });

  it('unlocks at exactly 56 days', () => {
    const days = 56;
    const today = dateAt(START, days - 1);
    const obs: ObservationLite[] = [];
    for (let i = 0; i < days; i++) {
      obs.push({ metric_key: 'readiness', value: 3, effective_date: dateAt(START, i) });
    }
    const data = computePatternCandidates(obs, today);
    expect(data.locked).toBe(false);
    expect(data.remainingDays).toBe(0);
    expect(data.evaluatedCount).toBeGreaterThan(0);
  });
});

describe('computePatternCandidates — planted association', () => {
  // 84 days, alternating low/high sleep with a matching readiness swing.
  const obs: ObservationLite[] = [];
  for (let i = 0; i < DAYS_84; i++) {
    const date = dateAt(START, i);
    const low = i % 2 === 0;
    // Small wobble keeps within-group SD nonzero (avoids a degenerate pooled SD)
    // while preserving a clean, large separation between groups.
    const wobble = (i % 4 === 0 ? 0.2 : -0.2) as number;
    obs.push({
      metric_key: 'sleep_duration',
      value: (low ? 6.0 : 8.0) + wobble,
      effective_date: date,
    });
    obs.push({
      metric_key: 'readiness',
      value: (low ? 2.0 : 4.0) + wobble,
      effective_date: date,
    });
  }
  const data = computePatternCandidates(obs, today84);

  it('surfaces the planted sleep→readiness association as a candidate with the correct sign', () => {
    const r = findResult(data.results, 'sleep_duration_low_readiness');
    expect(r.status).toBe('candidate');
    expect(r.nExposed).toBeGreaterThanOrEqual(PATTERN_MIN_N_PER_BIN);
    expect(r.nReference).toBeGreaterThanOrEqual(PATTERN_MIN_N_PER_BIN);
    // Exposed = low-sleep days → lower readiness → negative diff.
    expect(r.diff).not.toBeNull();
    expect(r.diff as number).toBeLessThan(0);
    expect(r.cohensD).not.toBeNull();
    expect(Math.abs(r.cohensD as number)).toBeGreaterThanOrEqual(0.6);
  });

  it('surfaces the candidate in the top-K ranked list', () => {
    expect(data.surfaced.some((c) => c.pair.id === 'sleep_duration_low_readiness')).toBe(true);
  });
});

describe('computePatternCandidates — noise and negative controls', () => {
  it('does not fire on an uncorrelated (noise) toggle', () => {
    const obs: ObservationLite[] = [];
    for (let i = 0; i < DAYS_84; i++) {
      const date = dateAt(START, i);
      // Caffeine alternates independently of readiness — deliberately uncoupled.
      obs.push({ metric_key: 'caffeine', value: i % 2, effective_date: date });
      // Readiness wobbles on its own 3-day cycle, unrelated to caffeine's 2-day cycle.
      obs.push({
        metric_key: 'readiness',
        value: 3 + (i % 3 === 0 ? 0.1 : -0.05),
        effective_date: date,
      });
    }
    const data = computePatternCandidates(obs, today84);
    const r = findResult(data.results, 'caffeine_readiness');
    expect(r.status).toBe('no_signal');
  });
});

describe('computePatternCandidates — n-gating', () => {
  it('is insufficient_data when a bin has exactly one fewer than the minimum (n=7)', () => {
    // 7 exposed (alcohol=1) + plenty of reference (alcohol=0), well past the
    // 56d unlock, so the ONLY reason to gate is the n<8 exposed bin.
    const days = 70;
    const obs: ObservationLite[] = [];
    for (let i = 0; i < days; i++) {
      const date = dateAt(START, i);
      const drank = i < 7; // exactly 7 exposed days
      obs.push({ metric_key: 'alcohol', value: drank ? 1 : 0, effective_date: date });
      obs.push({ metric_key: 'readiness', value: drank ? 2 : 4, effective_date: date });
    }
    const today = dateAt(START, days - 1);
    const data = computePatternCandidates(obs, today);
    const r = findResult(data.results, 'alcohol_readiness');
    expect(r.nExposed).toBe(7);
    expect(r.status).toBe('insufficient_data');
  });
});

describe('computePatternCandidates — binary bins', () => {
  it('bins a binary predictor strictly on 1 vs 0 (never a mean split)', () => {
    const days = 70;
    const obs: ObservationLite[] = [];
    for (let i = 0; i < days; i++) {
      const date = dateAt(START, i);
      const drank = i % 3 === 0; // ~1/3 of days
      obs.push({ metric_key: 'alcohol', value: drank ? 1 : 0, effective_date: date });
      obs.push({
        metric_key: 'readiness',
        value: (drank ? 2.5 : 4.0) + (i % 2 === 0 ? 0.1 : -0.1),
        effective_date: date,
      });
    }
    const today = dateAt(START, days - 1);
    const data = computePatternCandidates(obs, today);
    const r = findResult(data.results, 'alcohol_readiness');
    const expectedExposed = Array.from({ length: days }, (_, i) => i).filter(
      (i) => i % 3 === 0,
    ).length;
    expect(r.nExposed).toBe(expectedExposed);
    expect(r.nReference).toBe(days - expectedExposed);
  });
});

describe('computePatternCandidates — unformed-baseline days drop', () => {
  it('drops days before the predictor baseline has formed (continuous bins only)', () => {
    // Only 5 days of sleep history before the outcome window starts — never
    // reaches BASELINE_MIN_COUNT (7), so every sleep_duration_low_readiness
    // day should drop, but nothing crashes.
    const days = 60;
    const obs: ObservationLite[] = [];
    for (let i = 0; i < days; i++) {
      const date = dateAt(START, i);
      if (i < 5) obs.push({ metric_key: 'sleep_duration', value: 7, effective_date: date });
      obs.push({ metric_key: 'readiness', value: 3, effective_date: date });
    }
    const today = dateAt(START, days - 1);
    const data = computePatternCandidates(obs, today);
    const r = findResult(data.results, 'sleep_duration_low_readiness');
    expect(r.nExposed + r.nReference).toBe(0);
    expect(r.status).toBe('insufficient_data');
  });
});

describe('computePatternCandidates — concordance veto', () => {
  it('vetoes to no_signal when |d| and |diff| both pass but rho is inside the dead zone', () => {
    // A 6-value repeating predictor cycle [1,2,3,4,20,21] with outcomes
    // [5,1,1,1,4,4]: the below-mean bin {1,2,3,4} mixes one big outlier (5)
    // into an otherwise-low outcome, and the above-mean bin {20,21} is
    // uniformly higher (4). The two bin MEANS differ a lot (Cohen's d well
    // past the 0.6 gate, raw diff well past the pair's 0.4 gate) — but the
    // fine-grained rank relationship across the full 6-value predictor range
    // is essentially flat (confirmed |rho| < 0.1 below), so the concordance
    // check must veto this to 'no_signal' rather than a false-positive candidate.
    const predVals = [1, 2, 3, 4, 20, 21];
    const outVals = [5, 1, 1, 1, 4, 4];
    const days = 84;
    const obs: ObservationLite[] = [];
    for (let i = 0; i < days; i++) {
      const date = dateAt(START, i);
      const g = i % predVals.length;
      obs.push({
        metric_key: 'sleep_duration',
        value: predVals[g] as number,
        effective_date: date,
      });
      obs.push({ metric_key: 'readiness', value: outVals[g] as number, effective_date: date });
    }
    const today = dateAt(START, days - 1);
    const data = computePatternCandidates(obs, today);
    const r = findResult(data.results, 'sleep_duration_low_readiness');

    // Confirms this scenario actually exercises the veto (not some other gate).
    expect(r.cohensD).not.toBeNull();
    expect(Math.abs(r.cohensD as number)).toBeGreaterThanOrEqual(PATTERN_MIN_ABS_D);
    expect(r.diff).not.toBeNull();
    expect(Math.abs(r.diff as number)).toBeGreaterThanOrEqual(0.4);
    expect(r.rho).not.toBeNull();
    expect(Math.abs(r.rho as number)).toBeLessThan(0.1);

    expect(r.status).toBe('no_signal');
  });
});

describe('computePatternCandidates — sparse family-d outcomes', () => {
  it('gates a sparse outcome (3 match ratings) to insufficient_data without crashing', () => {
    const days = 84;
    const obs: ObservationLite[] = [];
    for (let i = 0; i < days; i++) {
      const date = dateAt(START, i);
      obs.push({ metric_key: 'recovery_score', value: 50 + (i % 20), effective_date: date });
      if (i === 10 || i === 40 || i === 70) {
        obs.push({ metric_key: 'match_rating', value: 6, effective_date: date });
      }
    }
    const today = dateAt(START, days - 1);
    const data = computePatternCandidates(obs, today);
    const r = findResult(data.results, 'recovery_low_match_rating');
    expect(r.status).toBe('insufficient_data');
  });
});

describe('formatCandidateEs', () => {
  const pair: PatternPair = {
    id: 'test_pair',
    predictor: 'recovery_score',
    binMode: 'below_mean',
    outcomeKey: 'running_pace',
    lagDays: 0,
    predictorPhrase: 'En los días que tu recovery score está bajo tu media',
    outcomePhrase: 'ritmo de carrera',
    outcomeUnit: 'min/km',
    lowerIsBetter: true,
    minRawDiff: 0.15,
    confounders: 'test confounder',
  };

  it('renders a stable statement and appends "más lento" when the lowerIsBetter outcome got worse', () => {
    const result: PatternResult = {
      pairId: 'test_pair',
      status: 'candidate',
      nExposed: 10,
      nReference: 20,
      exposedMean: 5.5,
      referenceMean: 5.1,
      diff: 0.4,
      cohensD: 0.8,
      rho: 0.3,
    };
    const statement = formatCandidateEs(pair, result);
    expect(statement).toBe(
      'En los días que tu recovery score está bajo tu media, tu ritmo de carrera promedia 5.5min/km vs 5.1min/km en los demás días (más lento) (n=10 vs 20).',
    );
  });

  it('appends "más rápido" when the lowerIsBetter outcome improved', () => {
    const result: PatternResult = {
      pairId: 'test_pair',
      status: 'candidate',
      nExposed: 10,
      nReference: 20,
      exposedMean: 4.8,
      referenceMean: 5.1,
      diff: -0.3,
      cohensD: -0.8,
      rho: -0.3,
    };
    const statement = formatCandidateEs(pair, result);
    expect(statement).toContain('(más rápido)');
  });

  it('is stable and idempotent (same inputs → same string)', () => {
    const result: PatternResult = {
      pairId: 'test_pair',
      status: 'candidate',
      nExposed: 10,
      nReference: 20,
      exposedMean: 5.5,
      referenceMean: 5.1,
      diff: 0.4,
      cohensD: 0.8,
      rho: 0.3,
    };
    expect(formatCandidateEs(pair, result)).toBe(formatCandidateEs(pair, result));
  });
});
