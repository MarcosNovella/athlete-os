import { describe, expect, it } from 'vitest';
import {
  checkInObservations,
  dailyEffectiveAt,
  e1rm,
  formatPace,
  paceMinPerKm,
  sessionLoad,
  sessionObservations,
  staggeredBackfillInstant,
} from './emission';
import type { CheckInInput, SessionInput } from './schemas';

const checkin: CheckInInput = {
  date: '2026-07-01',
  sleep_hours: 7.5,
  sleep_quality: 4,
  readiness: 3,
  soreness: 2,
  stress: 1,
  alcohol: false,
  caffeine: false,
};

const session: SessionInput = {
  id: '01980a00-0000-7000-8000-000000000000',
  date: '2026-07-01',
  modality: 'rugby',
  duration_min: 80,
  srpe: 7,
  is_match: false,
};

describe('checkInObservations', () => {
  it('emits the five readiness metrics plus alcohol/caffeine (baseline 7)', () => {
    const obs = checkInObservations(checkin, false);
    expect(obs).toHaveLength(7);
    const byKey = Object.fromEntries(obs.map((o) => [o.metric_key, o.value]));
    expect(byKey).toEqual({
      sleep_duration: 7.5,
      sleep_quality: 4,
      readiness: 3,
      soreness: 2,
      stress: 1,
      alcohol: 0,
      caffeine: 0,
    });
  });

  it('emits alcohol/caffeine as 1 when true, always present regardless', () => {
    const obs = checkInObservations({ ...checkin, alcohol: true, caffeine: true }, false);
    const byKey = Object.fromEntries(obs.map((o) => [o.metric_key, o.value]));
    expect(byKey.alcohol).toBe(1);
    expect(byKey.caffeine).toBe(1);
  });

  it('emits bodyweight/nutrition_adherence only when present (9 with all optionals)', () => {
    const withOptionals = checkInObservations(
      { ...checkin, bodyweight_kg: 82.4, nutrition_adherence: 4 },
      false,
    );
    expect(withOptionals).toHaveLength(9);
    const byKey = Object.fromEntries(withOptionals.map((o) => [o.metric_key, o.value]));
    expect(byKey.bodyweight).toBe(82.4);
    expect(byKey.nutrition_adherence).toBe(4);

    const withoutOptionals = checkInObservations(checkin, false);
    expect(withoutOptionals.some((o) => o.metric_key === 'bodyweight')).toBe(false);
    expect(withoutOptionals.some((o) => o.metric_key === 'nutrition_adherence')).toBe(false);
  });

  it('uses the canonical, deterministic morning instant (stable re-emits)', () => {
    const obs = checkInObservations(checkin, false);
    for (const o of obs) {
      expect(o.effective_at).toBe(dailyEffectiveAt('2026-07-01'));
      expect(o.effective_date).toBe('2026-07-01');
    }
    expect(dailyEffectiveAt('2026-07-01')).toBe('2026-07-01T12:00:00.000Z');
  });

  it('propagates the backfilled flag to every observation (ADR-013)', () => {
    expect(checkInObservations(checkin, true).every((o) => o.backfilled)).toBe(true);
    expect(checkInObservations(checkin, false).some((o) => o.backfilled)).toBe(false);
  });
});

describe('sessionObservations', () => {
  it('computes Foster load = duration × sRPE', () => {
    expect(sessionLoad(80, 7)).toBe(560);
    const obs = sessionObservations(session, '2026-07-01T21:30:00.000Z', false);
    const load = obs.find((o) => o.metric_key === 'session_load');
    expect(load?.value).toBe(560);
  });

  it('emits load, srpe and duration anchored at the session start', () => {
    const obs = sessionObservations(session, '2026-07-01T21:30:00.000Z', false);
    expect(obs.map((o) => o.metric_key).sort()).toEqual([
      'session_duration',
      'session_load',
      'session_srpe',
    ]);
    for (const o of obs) {
      expect(o.effective_at).toBe('2026-07-01T21:30:00.000Z');
      expect(o.effective_date).toBe('2026-07-01');
    }
  });

  it('propagates the backfilled flag', () => {
    const obs = sessionObservations(session, '2026-07-01T12:00:00.000Z', true);
    expect(obs.every((o) => o.backfilled)).toBe(true);
  });

  it('emits e1rm for a gym session with a named lift + top set', () => {
    const gym: SessionInput = {
      ...session,
      modality: 'gym',
      lift: 'squat',
      top_set_weight_kg: 140,
      top_set_reps: 8,
    };
    const obs = sessionObservations(gym, '2026-07-01T12:00:00.000Z', false);
    const e1 = obs.find((o) => o.metric_key === 'e1rm_squat');
    expect(e1?.value).toBe(177.5);
  });

  it('emits nothing extra for lift=other', () => {
    const gym: SessionInput = {
      ...session,
      modality: 'gym',
      lift: 'other',
      top_set_weight_kg: 100,
      top_set_reps: 5,
    };
    const obs = sessionObservations(gym, '2026-07-01T12:00:00.000Z', false);
    expect(obs.some((o) => o.metric_key.startsWith('e1rm'))).toBe(false);
  });

  it('emits running_distance + running_pace for a running session with distance', () => {
    const running: SessionInput = {
      ...session,
      modality: 'running',
      duration_min: 45,
      distance_km: 8.5,
    };
    const obs = sessionObservations(running, '2026-07-01T12:00:00.000Z', false);
    const byKey = Object.fromEntries(obs.map((o) => [o.metric_key, o.value]));
    expect(byKey.running_distance).toBe(8.5);
    expect(byKey.running_pace).toBe(5.29);
  });

  it('emits match_rating only for a rugby match, not a training session', () => {
    const match: SessionInput = { ...session, modality: 'rugby', is_match: true, match_rating: 4 };
    const obsMatch = sessionObservations(match, '2026-07-01T12:00:00.000Z', false);
    expect(obsMatch.find((o) => o.metric_key === 'match_rating')?.value).toBe(4);

    const training: SessionInput = { ...session, modality: 'rugby', is_match: false };
    const obsTraining = sessionObservations(training, '2026-07-01T12:00:00.000Z', false);
    expect(obsTraining.some((o) => o.metric_key === 'match_rating')).toBe(false);
  });
});

describe('e1rm', () => {
  it('returns the weight as-is at reps=1 (already a 1RM)', () => {
    expect(e1rm(100, 1)).toBe(100);
  });

  it('applies Epley and rounds to 0.5 kg otherwise', () => {
    expect(e1rm(100, 5)).toBe(116.5);
    expect(e1rm(140, 8)).toBe(177.5);
  });
});

describe('paceMinPerKm / formatPace', () => {
  it('computes decimal min/km rounded to 2 decimals', () => {
    expect(paceMinPerKm(45, 8.5)).toBe(5.29);
  });

  it('formats decimal pace as mm:ss, rounding seconds', () => {
    expect(formatPace(5.29)).toBe('5:17');
    expect(formatPace(5.999)).toBe('6:00');
  });
});

describe('staggeredBackfillInstant', () => {
  it('is deterministic for the same id (idempotent under replay)', () => {
    const a = staggeredBackfillInstant('2026-07-01', 'session-a');
    const b = staggeredBackfillInstant('2026-07-01', 'session-a');
    expect(a).toBe(b);
  });

  it('staggers distinct ids on the same day to distinct instants', () => {
    const a = staggeredBackfillInstant('2026-07-01', 'session-a');
    const b = staggeredBackfillInstant('2026-07-01', 'session-b');
    expect(a).not.toBe(b);
  });

  it('stays within the same UTC day as the canonical instant', () => {
    const instant = staggeredBackfillInstant('2026-07-01', 'session-a');
    expect(instant.startsWith('2026-07-01')).toBe(true);
  });
});
