import { describe, expect, it } from 'vitest';
import type { ObservationLite } from './snapshot';
import { computeSnapshot } from './snapshot';

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
    expect(s.readiness).toEqual({ value: 4, z: null, baselineFormed: false });
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
