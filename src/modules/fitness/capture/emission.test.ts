import { describe, expect, it } from 'vitest';
import {
  checkInObservations,
  dailyEffectiveAt,
  sessionLoad,
  sessionObservations,
} from './emission';
import type { CheckInInput, SessionInput } from './schemas';

const checkin: CheckInInput = {
  date: '2026-07-01',
  sleep_hours: 7.5,
  sleep_quality: 4,
  readiness: 3,
  soreness: 2,
  stress: 1,
};

const session: SessionInput = {
  id: '01980a00-0000-7000-8000-000000000000',
  date: '2026-07-01',
  modality: 'rugby',
  duration_min: 80,
  srpe: 7,
};

describe('checkInObservations', () => {
  it('emits the five readiness metrics with the check-in values', () => {
    const obs = checkInObservations(checkin, false);
    expect(obs).toHaveLength(5);
    const byKey = Object.fromEntries(obs.map((o) => [o.metric_key, o.value]));
    expect(byKey).toEqual({
      sleep_duration: 7.5,
      sleep_quality: 4,
      readiness: 3,
      soreness: 2,
      stress: 1,
    });
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
});
