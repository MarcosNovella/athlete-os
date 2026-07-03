import { describe, expect, it } from 'vitest';
import { mapWhoopToObservations } from './map';
import type { WhoopRecovery, WhoopSleep } from './types';

const TZ = 'America/Argentina/Buenos_Aires'; // UTC-3, no DST

function sleep(overrides: Partial<WhoopSleep> = {}): WhoopSleep {
  return {
    id: 's1',
    start: '2026-07-01T06:00:00.000Z',
    end: '2026-07-01T09:30:00.000Z', // 06:30 local -> wake date 2026-07-01
    nap: false,
    score_state: 'SCORED',
    score: {
      stage_summary: {
        total_light_sleep_time_milli: 3 * 3_600_000,
        total_slow_wave_sleep_time_milli: 1.5 * 3_600_000,
        total_rem_sleep_time_milli: 1.5 * 3_600_000,
      },
    },
    ...overrides,
  };
}

function recovery(overrides: Partial<WhoopRecovery> = {}): WhoopRecovery {
  return {
    cycle_id: 'c1',
    sleep_id: 's1',
    score_state: 'SCORED',
    score: { recovery_score: 72, hrv_rmssd_milli: 0.065, resting_heart_rate: 52 },
    ...overrides,
  };
}

describe('mapWhoopToObservations', () => {
  it('maps a scored recovery + sleep pair, wake-date attributed', () => {
    const obs = mapWhoopToObservations([recovery()], [sleep()], TZ);
    expect(obs).toEqual(
      expect.arrayContaining([
        { metric_key: 'recovery_score', value: 72, date: '2026-07-01' },
        { metric_key: 'hrv_rmssd', value: 65, date: '2026-07-01' },
        { metric_key: 'resting_hr', value: 52, date: '2026-07-01' },
        { metric_key: 'sleep_device', value: 6, date: '2026-07-01' },
      ]),
    );
    expect(obs).toHaveLength(4);
  });

  it('skips naps', () => {
    const obs = mapWhoopToObservations(
      [recovery({ sleep_id: 's-nap' })],
      [sleep({ id: 's-nap', nap: true })],
      TZ,
    );
    expect(obs).toEqual([]);
  });

  it('skips non-SCORED recoveries and sleep', () => {
    const obs = mapWhoopToObservations(
      [recovery({ score_state: 'PENDING_SCORE' })],
      [sleep({ score_state: 'PENDING_SCORE' })],
      TZ,
    );
    expect(obs).toEqual([]);
  });

  it('skips recoveries with no linked sleep_id or unresolved sleep (sleep_device still emits independently)', () => {
    const obs1 = mapWhoopToObservations([recovery({ sleep_id: null })], [sleep()], TZ);
    expect(obs1.filter((o) => o.metric_key !== 'sleep_device')).toEqual([]);
    const obs2 = mapWhoopToObservations([recovery({ sleep_id: 'missing' })], [sleep()], TZ);
    expect(obs2.filter((o) => o.metric_key !== 'sleep_device')).toEqual([]);
  });

  it('converges revised recoveries for the same day (last write wins)', () => {
    const stale = recovery({
      score: { recovery_score: 60, hrv_rmssd_milli: 0.05, resting_heart_rate: 55 },
    });
    const revised = recovery({
      score: { recovery_score: 75, hrv_rmssd_milli: 0.07, resting_heart_rate: 51 },
    });
    const obs = mapWhoopToObservations([stale, revised], [sleep()], TZ);
    const recoveryScoreObs = obs.filter((o) => o.metric_key === 'recovery_score');
    expect(recoveryScoreObs).toEqual([
      { metric_key: 'recovery_score', value: 75, date: '2026-07-01' },
    ]);
  });
});
