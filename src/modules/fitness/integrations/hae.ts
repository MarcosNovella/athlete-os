import { z } from 'zod';
import type { DeviceObservation } from './types';

/**
 * Apple Health Auto Export (HAE) JSON parser (ADR-024 D7). Tolerant by
 * design (R5): the export shape varies across app versions (field names,
 * date formats) — unknown metrics are ignored, malformed rows are skipped
 * and counted, never fatal. Only the top-level envelope shape is a hard
 * parse failure (nothing recognizable to work with).
 */

const MAX_ROWS = 10_000;
const MAX_AGE_DAYS = 366;

const haeDataPoint = z.looseObject({ date: z.string() });

const haeMetric = z.looseObject({
  name: z.string(),
  data: z.array(haeDataPoint),
});

const haeExport = z.object({
  data: z.object({
    metrics: z.array(haeMetric),
  }),
});

/** "YYYY-MM-DD HH:mm:ss ±HHmm" → "YYYY-MM-DD" (local date part, D4 wake-date attribution). */
function localDatePart(haeDate: string): string | null {
  const m = /^(\d{4}-\d{2}-\d{2})[ T]/.exec(haeDate);
  return m ? (m[1] ?? null) : null;
}

function numericField(point: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const v = point[key];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
  }
  return null;
}

export type ParseHaeResult =
  | { ok: true; observations: DeviceObservation[]; skippedCount: number }
  | { ok: false; error: string };

/**
 * Parses a HAE export into DeviceObservations. Multiple same-day readings
 * for a metric are averaged (device exports often carry several samples per
 * day) — the import RPC dedupe key is (subject, metric, date, 'import'), so
 * a batch can only carry ONE row per (metric, date) or the single INSERT
 * would try to affect the same conflict target twice.
 */
export function parseHaeExport(raw: unknown): ParseHaeResult {
  const parsed = haeExport.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: 'Formato de export no reconocido.' };
  }

  const today = new Date();
  const minDate = new Date(today);
  minDate.setUTCDate(minDate.getUTCDate() - MAX_AGE_DAYS);

  // metric_key -> date -> accumulated values (averaged per day)
  const byMetricDate = new Map<'hrv_sdnn' | 'resting_hr' | 'sleep_device', Map<string, number[]>>([
    ['hrv_sdnn', new Map()],
    ['resting_hr', new Map()],
    ['sleep_device', new Map()],
  ]);

  let skippedCount = 0;
  let acceptedCount = 0;

  for (const metric of parsed.data.data.metrics) {
    const metricKey =
      metric.name === 'heart_rate_variability'
        ? 'hrv_sdnn'
        : metric.name === 'resting_heart_rate'
          ? 'resting_hr'
          : metric.name === 'sleep_analysis'
            ? 'sleep_device'
            : null;
    if (metricKey === null) continue; // unknown metric: ignored, not a failure

    const byDate = byMetricDate.get(metricKey);
    if (!byDate) continue;

    for (const point of metric.data) {
      const date = localDatePart(point.date);
      if (date === null) {
        skippedCount++;
        continue;
      }
      const d = new Date(`${date}T00:00:00Z`);
      if (d < minDate || d > today) {
        skippedCount++;
        continue;
      }

      const value =
        metricKey === 'sleep_device'
          ? numericField(point, ['asleep', 'totalSleep'])
          : numericField(point, ['qty']);
      if (value === null) {
        skippedCount++;
        continue;
      }

      if (acceptedCount >= MAX_ROWS) {
        return {
          ok: false,
          error: `Export demasiado grande (más de ${MAX_ROWS} filas válidas).`,
        };
      }
      acceptedCount++;

      const values = byDate.get(date) ?? [];
      values.push(value);
      byDate.set(date, values);
    }
  }

  const observations: DeviceObservation[] = [];
  for (const [metricKey, byDate] of byMetricDate) {
    for (const [date, values] of byDate) {
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      observations.push({ metric_key: metricKey, value: Math.round(mean * 100) / 100, date });
    }
  }

  return { ok: true, observations, skippedCount };
}
