import { localDateInTz } from '@/lib/dates';
import type { DeviceMetricKey, DeviceObservation } from '../types';
import type { WhoopRecovery, WhoopSleep } from './types';

function round(n: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(n * factor) / factor;
}

/**
 * Pure mapper (ADR-024 D4/D5): Whoop recovery+sleep collections -> the five
 * device metrics, wake-date attributed via the LINKED sleep's `end` (never
 * the recovery's own timestamp). Skips naps and non-SCORED records (D4).
 * A batch may only carry one row per (metric, date) — the import RPC's
 * single INSERT can't affect the same dedupe target twice — so re-fetched
 * revisions of the same day converge by "last write wins" within this map
 * (revised recoveries in the API's response replace the earlier reading).
 */
export function mapWhoopToObservations(
  recoveries: WhoopRecovery[],
  sleeps: WhoopSleep[],
  timezone: string,
): DeviceObservation[] {
  const sleepById = new Map(sleeps.map((s) => [String(s.id), s]));
  const byKey = new Map<string, DeviceObservation>();

  const put = (metric_key: DeviceMetricKey, value: number, date: string) => {
    byKey.set(`${metric_key}|${date}`, { metric_key, value, date });
  };

  for (const r of recoveries) {
    if (r.score_state !== 'SCORED') continue;
    if (r.sleep_id === null || r.sleep_id === undefined) continue;
    const sleep = sleepById.get(String(r.sleep_id));
    if (!sleep || sleep.nap) continue;

    const date = localDateInTz(timezone, new Date(sleep.end));
    const score = r.score;
    if (score?.recovery_score !== undefined) {
      put('recovery_score', score.recovery_score, date);
    }
    if (score?.hrv_rmssd_milli !== undefined) {
      // Whoop's "_milli" HRV field is seconds×1000 fractional — ×1000 gives ms.
      put('hrv_rmssd', round(score.hrv_rmssd_milli * 1000, 1), date);
    }
    if (score?.resting_heart_rate !== undefined) {
      put('resting_hr', score.resting_heart_rate, date);
    }
  }

  for (const s of sleeps) {
    if (s.score_state !== 'SCORED' || s.nap) continue;
    const stage = s.score?.stage_summary;
    if (!stage) continue;
    const totalMilli =
      (stage.total_light_sleep_time_milli ?? 0) +
      (stage.total_slow_wave_sleep_time_milli ?? 0) +
      (stage.total_rem_sleep_time_milli ?? 0);
    if (totalMilli <= 0) continue;

    const date = localDateInTz(timezone, new Date(s.end));
    put('sleep_device', round(totalMilli / 3_600_000, 2), date);
  }

  return Array.from(byKey.values());
}
