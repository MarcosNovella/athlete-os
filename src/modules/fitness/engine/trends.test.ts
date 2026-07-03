import { describe, expect, it } from 'vitest';
import type { ObservationLite } from './snapshot';
import { computeTrends, weekStartMonday } from './trends';

function dateAt(startIso: string, offset: number): string {
  const d = new Date(`${startIso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

describe('weekStartMonday', () => {
  it('maps any weekday to its Monday', () => {
    expect(weekStartMonday('2026-07-01')).toBe('2026-06-29'); // Wed -> Mon
    expect(weekStartMonday('2026-06-29')).toBe('2026-06-29'); // Mon -> itself
    expect(weekStartMonday('2026-07-05')).toBe('2026-06-29'); // Sun -> prior Mon
  });
});

describe('computeTrends', () => {
  // 21 days: session (300 AU) every 2nd day, check-in daily except day 10.
  const start = '2026-06-11';
  const days = 21;
  const today = dateAt(start, days - 1);
  const obs: ObservationLite[] = [];
  for (let i = 0; i < days; i++) {
    const date = dateAt(start, i);
    if (i !== 10) {
      obs.push({ metric_key: 'readiness', value: 3 + (i % 3), effective_date: date });
      obs.push({ metric_key: 'sleep_duration', value: 7 + (i % 2), effective_date: date });
    }
    if (i % 2 === 0) obs.push({ metric_key: 'session_load', value: 300, effective_date: date });
  }
  const t = computeTrends(obs, today);

  it('caps daily series at 28 days and keeps it dense', () => {
    expect(t.daily.length).toBe(21);
    expect(t.acute7.length).toBe(21);
    expect(t.daily.filter((d) => d.value === 0).length).toBe(10); // rest days
  });

  it('preserves gaps in check-in series (no imputation)', () => {
    expect(t.readiness.length).toBe(20); // 21 days minus the missed one
    expect(t.readiness.some((v) => v.date === dateAt(start, 10))).toBe(false);
  });

  it('summarizes calendar weeks with load, sessions and averages', () => {
    expect(t.weeks.length).toBeGreaterThanOrEqual(3);
    expect(t.weeks.length).toBeLessThanOrEqual(4);
    const full = t.weeks.find((w) => w.totalLoad === 1200 || w.totalLoad === 900);
    expect(full).toBeDefined();
    for (const w of t.weeks) {
      expect(w.sessionCount).toBeGreaterThanOrEqual(2);
      expect(w.avgReadiness ?? 0).toBeGreaterThanOrEqual(3);
      expect(w.avgSleep ?? 0).toBeGreaterThanOrEqual(7);
    }
  });

  it('exposes personal means once the baseline is formed', () => {
    expect(t.readinessMean).not.toBeNull();
    expect(t.sleepMean).not.toBeNull();
  });

  it('weeks are sorted oldest to newest', () => {
    const sorted = [...t.weeks.map((w) => w.weekStart)].sort();
    expect(t.weeks.map((w) => w.weekStart)).toEqual(sorted);
  });

  it('starts the ACWR series exactly at the provisional unlock day', () => {
    // 21 days of history → ratios exist only from day 14 (i=13) onward.
    expect(t.acwr.length).toBe(8);
    expect(t.acwr[0]?.date).toBe(dateAt(start, 13));
    for (const p of t.acwr) expect(p.value).toBeGreaterThan(0);
  });

  it('computes week-over-week load deltas (null only where no prior week exists)', () => {
    // Weeks: 600 → 1200 → 900 → 600(partial): null, +100%, -25%, -33%.
    expect(t.weeks.map((w) => w.loadDeltaPct)).toEqual([null, 100, -25, -33]);
  });

  it('marks only the unfinished current week as partial', () => {
    expect(t.weeks.map((w) => w.isPartial)).toEqual([false, false, false, true]);
  });

  it('carries monotony band + display consistent with the value', () => {
    for (const w of t.weeks) {
      if (w.monotony === null) {
        expect(w.monotonyBand).toBeNull();
        expect(w.monotonyDisplay).toBeNull();
      } else {
        expect(w.monotonyBand).not.toBeNull();
        expect(w.monotonyDisplay).toBe(w.monotony > 5 ? '>5' : String(w.monotony));
      }
    }
  });
});
