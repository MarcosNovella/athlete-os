import { describe, expect, it } from 'vitest';
import { MONOTONY_DISPLAY_CAP } from './load';
import type { ObservationLite } from './snapshot';
import { computeSnapshot, signalSummary } from './snapshot';

function dateAt(startIso: string, offset: number): string {
  const d = new Date(`${startIso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

/** Synthetic history: daily check-ins (readiness cycling 3/4/5) + sessions. */
function history(days: number, sessionEvery: number, sessionLoad: number): ObservationLite[] {
  const start = '2026-06-01';
  const obs: ObservationLite[] = [];
  for (let i = 0; i < days; i++) {
    const date = dateAt(start, i);
    obs.push({ metric_key: 'readiness', value: 3 + (i % 3), effective_date: date });
    obs.push({ metric_key: 'sleep_duration', value: 7 + (i % 3) * 0.5, effective_date: date });
    if (i % sessionEvery === 0) {
      obs.push({ metric_key: 'session_load', value: sessionLoad, effective_date: date });
    }
  }
  return obs;
}

describe('computeSnapshot — day 1 (cold start)', () => {
  it('shows raw values, locks everything, exposes countdowns', () => {
    const today = '2026-07-01';
    const obs: ObservationLite[] = [
      { metric_key: 'readiness', value: 4, effective_date: today },
      { metric_key: 'sleep_duration', value: 8, effective_date: today },
      { metric_key: 'session_load', value: 560, effective_date: today },
    ];
    const s = computeSnapshot(obs, today);
    expect(s.historyDays).toBe(1);
    expect(s.todayLoad).toBe(560);
    expect(s.weekLoad).toBe(560);
    expect(s.acute7).toBeNull();
    expect(s.acwr).toBeNull();
    expect(s.monotony).toBeNull();
    expect(s.prevWeekLoad).toBeNull();
    expect(s.weekLoadDeltaPct).toBeNull();
    expect(s.readiness).toEqual({ value: 4, z: null, tier: null, baselineFormed: false });
    expect(s.flags).toEqual([]);
    const acwrFull = s.unlocks.find((u) => u.key === 'acwr_full');
    expect(acwrFull?.remaining).toBe(27);
  });
});

describe('computeSnapshot — 29 days of steady history', () => {
  // 29 days so "today" lands on a TRAINING day: with alternating load the
  // EWMA-based ACWR legitimately oscillates (~0.8 on rest days, ~1.1 on
  // training days) — the steady-state assertion only holds on train days.
  const days = 29;
  const obs = history(days, 2, 400); // session every 2nd day
  const today = dateAt('2026-06-01', days - 1);
  const s = computeSnapshot(obs, today);

  it('unlocks the full engine', () => {
    expect(s.historyDays).toBe(29);
    expect(s.acute7).not.toBeNull();
    expect(s.chronic28).not.toBeNull();
    expect(s.acwr).not.toBeNull();
    expect(s.acwr?.provisional).toBe(false);
    expect(s.monotony).not.toBeNull();
    expect(s.strain).not.toBeNull();
  });

  it('interprets: bands, display, week delta, yesterday ghost, strain rank', () => {
    // Alternating 400/0: low monotony, ok band, display = the rounded value.
    expect(s.monotony?.band).toBe('ok');
    expect(s.monotony?.display).toBe(String(s.monotony?.value));
    // Last-7 window has 4 sessions (1600) vs 3 (1200) the week before: +33%.
    expect(s.prevWeekLoad).toBe(1200);
    expect(s.weekLoadDeltaPct).toBe(33);
    // ACWR was already unlocked yesterday at day 29.
    expect(s.acwr?.yesterday).not.toBeNull();
    // Current window ties the -14d window (same 400/0 pattern): still rank 1 of 4.
    expect(s.strain?.rank).toBe(1);
    expect(s.strain?.of).toBe(4);
    expect(s.strain?.rangeMax).toBeGreaterThanOrEqual(s.strain?.rangeMin ?? 0);
  });

  it('keeps ACWR ~1.0 on a steady load and raises no flags', () => {
    expect(s.acwr?.value ?? 0).toBeGreaterThan(0.8);
    expect(s.acwr?.value ?? 9).toBeLessThan(1.3);
    expect(s.acwr?.band).toBe('optimal');
    expect(s.flags.filter((f) => f.kind === 'acwr')).toEqual([]);
  });

  it('forms baselines and scores today against them', () => {
    expect(s.readiness?.baselineFormed).toBe(true);
    expect(s.readiness?.z).not.toBeNull();
    expect(s.sleep?.baselineFormed).toBe(true);
  });
});

describe('computeSnapshot — interpretation edges', () => {
  it('caps the monotony DISPLAY on a near-uniform week but keeps the raw flag value', () => {
    const start = '2026-06-01';
    const obs: ObservationLite[] = [];
    for (let i = 0; i < 28; i++) {
      const date = dateAt(start, i);
      obs.push({ metric_key: 'readiness', value: 3 + (i % 3), effective_date: date });
      // Daily training, one day off by 1 AU: SD→~0.38, monotony explodes (>1000).
      obs.push({ metric_key: 'session_load', value: i === 25 ? 401 : 400, effective_date: date });
    }
    const s = computeSnapshot(obs, dateAt(start, 27));
    expect(s.monotony?.display).toBe(`>${MONOTONY_DISPLAY_CAP}`);
    expect(s.monotony?.band).toBe('high');
    expect(s.monotony?.value ?? 0).toBeGreaterThan(MONOTONY_DISPLAY_CAP);
    const flag = s.flags.find((f) => f.kind === 'monotony_high');
    expect(flag && 'value' in flag ? flag.value : 0).toBeGreaterThan(MONOTONY_DISPLAY_CAP);
  });

  it('keeps a perfectly uniform week as null monotony (SD=0), not ">cap"', () => {
    const start = '2026-06-01';
    const obs: ObservationLite[] = [];
    for (let i = 0; i < 28; i++) {
      const date = dateAt(start, i);
      obs.push({ metric_key: 'readiness', value: 3 + (i % 3), effective_date: date });
      obs.push({ metric_key: 'session_load', value: 400, effective_date: date });
    }
    const s = computeSnapshot(obs, dateAt(start, 27));
    expect(s.monotony).toBeNull();
    expect(s.strain).toBeNull();
    expect(s.flags.some((f) => f.kind === 'monotony_high')).toBe(false);
  });

  it('gates prevWeekLoad at day 14 and the yesterday ghost one day later', () => {
    const d13 = computeSnapshot(history(13, 2, 400), dateAt('2026-06-01', 12));
    expect(d13.prevWeekLoad).toBeNull();
    expect(d13.weekLoadDeltaPct).toBeNull();

    const d14 = computeSnapshot(history(14, 2, 400), dateAt('2026-06-01', 13));
    expect(d14.prevWeekLoad).not.toBeNull();
    expect(d14.acwr).not.toBeNull();
    // ACWR unlocked TODAY (day 14) — yesterday it wasn't, so no ghost yet.
    expect(d14.acwr?.yesterday).toBeNull();
  });
});

describe('signalSummary', () => {
  it('counts flags and reserves red for the high ACWR band', () => {
    expect(signalSummary([])).toEqual({ count: 0, worst: 'ok' });
    expect(signalSummary([{ kind: 'readiness_drop' }])).toEqual({ count: 1, worst: 'caution' });
    expect(signalSummary([{ kind: 'acwr', band: 'caution', value: 1.4 }])).toEqual({
      count: 1,
      worst: 'caution',
    });
    expect(
      signalSummary([
        { kind: 'monotony_high', value: 3 },
        { kind: 'acwr', band: 'high', value: 1.6 },
      ]),
    ).toEqual({ count: 2, worst: 'high' });
  });
});

describe('computeSnapshot — acute spike', () => {
  it('flags a spike over a modest chronic base', () => {
    const base = history(28, 3, 200); // light: session every 3rd day
    const today = dateAt('2026-06-01', 28);
    const spiked = [
      ...base,
      { metric_key: 'session_load', value: 900, effective_date: dateAt('2026-06-01', 26) },
      { metric_key: 'session_load', value: 900, effective_date: dateAt('2026-06-01', 27) },
      { metric_key: 'session_load', value: 900, effective_date: today },
    ];
    const s = computeSnapshot(spiked, today);
    expect(s.acwr?.value ?? 0).toBeGreaterThan(1.3);
    expect(s.flags.some((f) => f.kind === 'acwr')).toBe(true);
  });
});
