import { cache } from 'react';
import { addDaysIso, localDateInTz } from '@/lib/dates';
import { createClient } from '@/lib/supabase/server';
import { computeSnapshot, type EngineSnapshot, type ObservationLite } from './snapshot';
import { computeTrends, type TrendsData } from './trends';

const ENGINE_METRICS = [
  'session_load',
  'readiness',
  'sleep_duration',
  // V2.1 outcomes (ADR-023): running_distance excluded — nothing reads it yet.
  'bodyweight',
  'e1rm_squat',
  'e1rm_bench',
  'e1rm_deadlift',
  'e1rm_ohp',
  'running_pace',
  'match_rating',
  'nutrition_adherence',
  'alcohol',
  'caffeine',
  // V2.2 passive inputs (ADR-024): device-sourced recovery metrics.
  'recovery_score',
  'hrv_rmssd',
  'hrv_sdnn',
  'resting_hr',
  'sleep_device',
];

/**
 * 90-day window: the engine needs ≤28d for baselines/chronic EWMA; 90d makes
 * the EWMA seed negligible.
 */
const WINDOW_DAYS = 90;

/**
 * PostgREST caps every response at 1000 rows (Supabase default `max_rows`) and
 * truncates SILENTLY — without pagination the engine math would corrupt with no
 * error once the window exceeds the cap. Must be ≤ the server's `max_rows`.
 */
const PAGE_SIZE = 1000;

/**
 * Drains a range-paginated query. `fetchPage` receives an inclusive `from..to`
 * row range and must return rows in a stable total order; a short page signals
 * the end.
 */
export async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => Promise<T[]>,
  pageSize: number = PAGE_SIZE,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const page = await fetchPage(from, from + pageSize - 1);
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

type EngineSubject = { id: string; timezone: string };

/**
 * Per-request memo (React cache): a page needing snapshot + trends — or the
 * header señales cue — reuses ONE observations fetch. Keyed by primitives so
 * differing subject object identities still hit the memo. Outside a React
 * request (scripts/tests) cache() degrades to a plain call.
 */
const fetchEngineObservations = cache(
  async (
    subjectId: string,
    timezone: string,
  ): Promise<{ obs: ObservationLite[]; today: string }> => {
    const today = localDateInTz(timezone);
    const from = addDaysIso(today, -WINDOW_DAYS);

    const supabase = await createClient();
    const obs = await fetchAllPages<ObservationLite>(async (fromRow, toRow) => {
      const { data, error } = await supabase
        .from('observations')
        .select('metric_key, value, effective_date')
        .eq('subject_id', subjectId)
        .in('metric_key', ENGINE_METRICS)
        .gte('effective_date', from)
        .lte('effective_date', today)
        .order('effective_date', { ascending: true })
        // Tiebreaker: rows sharing an effective_date need a stable order, or page
        // boundaries could duplicate/skip rows across requests.
        .order('id', { ascending: true })
        .range(fromRow, toRow);
      if (error) throw new Error(`engine observations fetch failed: ${error.message}`);
      return data ?? [];
    });

    return { obs, today };
  },
);

export async function getEngineSnapshot(subject: EngineSubject): Promise<EngineSnapshot> {
  const { obs, today } = await fetchEngineObservations(subject.id, subject.timezone);
  return computeSnapshot(obs, today);
}

export async function getTrends(subject: EngineSubject): Promise<TrendsData> {
  const { obs, today } = await fetchEngineObservations(subject.id, subject.timezone);
  return computeTrends(obs, today);
}
