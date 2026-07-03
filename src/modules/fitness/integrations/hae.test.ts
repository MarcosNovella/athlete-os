import { describe, expect, it } from 'vitest';
import { parseHaeExport } from './hae';

const TODAY = new Date().toISOString().slice(0, 10);

describe('parseHaeExport', () => {
  it('parses a happy-path export (hrv, resting hr, sleep with "asleep" field)', () => {
    const raw = {
      data: {
        metrics: [
          {
            name: 'heart_rate_variability',
            units: 'ms',
            data: [{ date: `${TODAY} 08:00:00 -0300`, qty: 45.2 }],
          },
          {
            name: 'resting_heart_rate',
            units: 'bpm',
            data: [{ date: `${TODAY} 08:00:00 -0300`, qty: 51 }],
          },
          {
            name: 'sleep_analysis',
            data: [{ date: `${TODAY} 07:00:00 -0300`, asleep: 7.25 }],
          },
        ],
      },
    };
    const result = parseHaeExport(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected ok');
    expect(result.skippedCount).toBe(0);
    expect(result.observations).toEqual(
      expect.arrayContaining([
        { metric_key: 'hrv_sdnn', value: 45.2, date: TODAY },
        { metric_key: 'resting_hr', value: 51, date: TODAY },
        { metric_key: 'sleep_device', value: 7.25, date: TODAY },
      ]),
    );
  });

  it('accepts the "totalSleep" field-name variant', () => {
    const raw = {
      data: {
        metrics: [
          { name: 'sleep_analysis', data: [{ date: `${TODAY} 07:00:00 -0300`, totalSleep: 6.5 }] },
        ],
      },
    };
    const result = parseHaeExport(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected ok');
    expect(result.observations).toEqual([{ metric_key: 'sleep_device', value: 6.5, date: TODAY }]);
  });

  it('ignores unknown metrics', () => {
    const raw = {
      data: {
        metrics: [
          { name: 'step_count', data: [{ date: `${TODAY} 08:00:00 -0300`, qty: 8000 }] },
          {
            name: 'resting_heart_rate',
            data: [{ date: `${TODAY} 08:00:00 -0300`, qty: 51 }],
          },
        ],
      },
    };
    const result = parseHaeExport(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected ok');
    expect(result.observations).toEqual([{ metric_key: 'resting_hr', value: 51, date: TODAY }]);
  });

  it('skips malformed rows without failing the whole parse', () => {
    const raw = {
      data: {
        metrics: [
          {
            name: 'resting_heart_rate',
            data: [
              { date: `${TODAY} 08:00:00 -0300`, qty: 51 }, // valid
              { date: 'not-a-date', qty: 60 }, // bad date
              { date: `${TODAY} 09:00:00 -0300` }, // missing qty
            ],
          },
        ],
      },
    };
    const result = parseHaeExport(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected ok');
    expect(result.skippedCount).toBe(2);
    expect(result.observations).toEqual([{ metric_key: 'resting_hr', value: 51, date: TODAY }]);
  });

  it('averages multiple same-day readings for one metric', () => {
    const raw = {
      data: {
        metrics: [
          {
            name: 'heart_rate_variability',
            data: [
              { date: `${TODAY} 08:00:00 -0300`, qty: 40 },
              { date: `${TODAY} 20:00:00 -0300`, qty: 50 },
            ],
          },
        ],
      },
    };
    const result = parseHaeExport(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected ok');
    expect(result.observations).toEqual([{ metric_key: 'hrv_sdnn', value: 45, date: TODAY }]);
  });

  it('drops rows older than 366 days', () => {
    const raw = {
      data: {
        metrics: [
          {
            name: 'resting_heart_rate',
            data: [{ date: '2020-01-01 08:00:00 -0300', qty: 51 }],
          },
        ],
      },
    };
    const result = parseHaeExport(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected ok');
    expect(result.skippedCount).toBe(1);
    expect(result.observations).toEqual([]);
  });

  it('rejects an unrecognizable envelope', () => {
    const result = parseHaeExport({ not: 'hae' });
    expect(result.ok).toBe(false);
  });

  it('rejects an export with more than 10000 valid rows', () => {
    // Many same-day readings all within the 366d window — exercises the row
    // cap independently of the age filter (real multi-sample-per-day exports).
    const data = Array.from({ length: 10_001 }, () => ({
      date: `${TODAY} 08:00:00 -0300`,
      qty: 50,
    }));
    const raw = { data: { metrics: [{ name: 'resting_heart_rate', data }] } };
    const result = parseHaeExport(raw);
    expect(result.ok).toBe(false);
  });
});
