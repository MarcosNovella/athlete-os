import { dailyEffectiveAt } from '@/modules/fitness/capture/emission';
import type { DeviceMetricKey, DeviceObservation } from './types';

/**
 * Pure boundary layer (ADR-024 D2/D4): DeviceObservation → the row shape the
 * `import_observations` RPC expects. Reuses the canonical daily instant
 * (`dailyEffectiveAt`) — all five device metrics are daily, wake-date
 * attributed (D4); no per-day stagger needed since dedupe is
 * (subject, metric, effective_at, 'import') and a provider never emits two
 * values for the same metric+day.
 */
export type ImportRow = {
  metric_key: DeviceMetricKey;
  value: number;
  effective_at: string;
  effective_date: string;
};

/** [min, max] plausibility range per metric — rows outside are dropped, not clamped. */
const METRIC_RANGES: Record<DeviceMetricKey, readonly [number, number]> = {
  recovery_score: [0, 100],
  hrv_rmssd: [1, 500],
  hrv_sdnn: [1, 500],
  resting_hr: [25, 120],
  sleep_device: [0, 24],
};

function inRange(o: DeviceObservation): boolean {
  const [min, max] = METRIC_RANGES[o.metric_key];
  return Number.isFinite(o.value) && o.value >= min && o.value <= max;
}

export type ToImportRowsResult = {
  rows: ImportRow[];
  droppedCount: number;
};

/** Drops out-of-range rows (counted, never fatal — per-provider parsers report the count upstream). */
export function toImportRows(observations: DeviceObservation[]): ToImportRowsResult {
  const rows: ImportRow[] = [];
  let droppedCount = 0;
  for (const o of observations) {
    if (!inRange(o)) {
      droppedCount++;
      continue;
    }
    rows.push({
      metric_key: o.metric_key,
      value: o.value,
      effective_at: dailyEffectiveAt(o.date),
      effective_date: o.date,
    });
  }
  return { rows, droppedCount };
}
