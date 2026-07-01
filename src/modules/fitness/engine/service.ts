import { addDaysIso, localDateInTz } from '@/lib/dates';
import { createClient } from '@/lib/supabase/server';
import { computeSnapshot, type EngineSnapshot } from './snapshot';

const ENGINE_METRICS = ['session_load', 'readiness', 'sleep_duration'];

/**
 * 90-day window: the engine needs ≤28d for baselines/chronic EWMA; 90d makes
 * the EWMA seed negligible AND keeps the row count far under PostgREST's
 * default 1000-row cap (silent truncation would corrupt the math).
 */
const WINDOW_DAYS = 90;

export async function getEngineSnapshot(subject: {
  id: string;
  timezone: string;
}): Promise<EngineSnapshot> {
  const today = localDateInTz(subject.timezone);
  const from = addDaysIso(today, -WINDOW_DAYS);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('observations')
    .select('metric_key, value, effective_date')
    .eq('subject_id', subject.id)
    .in('metric_key', ENGINE_METRICS)
    .gte('effective_date', from)
    .lte('effective_date', today)
    .order('effective_date', { ascending: true });
  if (error) throw new Error(`engine observations fetch failed: ${error.message}`);

  return computeSnapshot(data ?? [], today);
}
