import { describe, expect, it } from 'vitest';
import { toImportRows } from './import';
import type { DeviceObservation } from './types';

describe('toImportRows', () => {
  it('maps valid observations to import rows with the canonical daily instant', () => {
    const obs: DeviceObservation[] = [
      { metric_key: 'recovery_score', value: 72, date: '2026-07-01' },
      { metric_key: 'hrv_rmssd', value: 85.4, date: '2026-07-01' },
    ];
    const { rows, droppedCount } = toImportRows(obs);
    expect(droppedCount).toBe(0);
    expect(rows).toEqual([
      {
        metric_key: 'recovery_score',
        value: 72,
        effective_at: '2026-07-01T12:00:00.000Z',
        effective_date: '2026-07-01',
      },
      {
        metric_key: 'hrv_rmssd',
        value: 85.4,
        effective_at: '2026-07-01T12:00:00.000Z',
        effective_date: '2026-07-01',
      },
    ]);
  });

  it('drops and counts out-of-range rows per metric', () => {
    const obs: DeviceObservation[] = [
      { metric_key: 'recovery_score', value: 150, date: '2026-07-01' }, // > 100
      { metric_key: 'hrv_sdnn', value: 0, date: '2026-07-01' }, // < 1
      { metric_key: 'resting_hr', value: 10, date: '2026-07-01' }, // < 25
      { metric_key: 'sleep_device', value: 30, date: '2026-07-01' }, // > 24
      { metric_key: 'resting_hr', value: 52, date: '2026-07-01' }, // valid
    ];
    const { rows, droppedCount } = toImportRows(obs);
    expect(droppedCount).toBe(4);
    expect(rows).toEqual([
      {
        metric_key: 'resting_hr',
        value: 52,
        effective_at: '2026-07-01T12:00:00.000Z',
        effective_date: '2026-07-01',
      },
    ]);
  });

  it('drops non-finite values', () => {
    const obs: DeviceObservation[] = [
      { metric_key: 'sleep_device', value: Number.NaN, date: '2026-07-01' },
    ];
    const { rows, droppedCount } = toImportRows(obs);
    expect(droppedCount).toBe(1);
    expect(rows).toEqual([]);
  });

  it('accepts boundary values', () => {
    const obs: DeviceObservation[] = [
      { metric_key: 'recovery_score', value: 0, date: '2026-07-01' },
      { metric_key: 'recovery_score', value: 100, date: '2026-07-01' },
      { metric_key: 'sleep_device', value: 0, date: '2026-07-01' },
      { metric_key: 'sleep_device', value: 24, date: '2026-07-01' },
    ];
    const { droppedCount } = toImportRows(obs);
    expect(droppedCount).toBe(0);
  });
});
