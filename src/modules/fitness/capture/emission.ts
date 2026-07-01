import type { CheckInInput, SessionInput } from './schemas';

/**
 * Emission mapping (ADR-011): typed capture entities project into the
 * observations spine. This module is PURE — the deterministic, testable part.
 * Atomicity lives in the save_* RPCs; linkage fields (subject/source/entity id)
 * are rewritten server-side and never leave this layer.
 */

export type EmittedObservation = {
  metric_key: string;
  value: number;
  effective_at: string; // ISO timestamptz
  effective_date: string; // YYYY-MM-DD
  backfilled: boolean;
};

/**
 * Canonical morning instant for daily metrics. Deterministic so re-emits are
 * stable under the (subject, metric, effective_at, source) dedupe key.
 * 12:00Z ≈ morning in ART; the daily semantic lives in effective_date.
 */
export function dailyEffectiveAt(date: string): string {
  return `${date}T12:00:00.000Z`;
}

export function checkInObservations(
  input: CheckInInput,
  backfilled: boolean,
): EmittedObservation[] {
  const base = {
    effective_at: dailyEffectiveAt(input.date),
    effective_date: input.date,
    backfilled,
  };
  return [
    { metric_key: 'sleep_duration', value: input.sleep_hours, ...base },
    { metric_key: 'sleep_quality', value: input.sleep_quality, ...base },
    { metric_key: 'readiness', value: input.readiness, ...base },
    { metric_key: 'soreness', value: input.soreness, ...base },
    { metric_key: 'stress', value: input.stress, ...base },
  ];
}

/** Foster session load: sRPE × duration (AU). Must equal the DB generated column. */
export function sessionLoad(durationMin: number, srpe: number): number {
  return durationMin * srpe;
}

export function sessionObservations(
  input: SessionInput,
  startedAt: string,
  backfilled: boolean,
): EmittedObservation[] {
  const base = { effective_at: startedAt, effective_date: input.date, backfilled };
  return [
    { metric_key: 'session_load', value: sessionLoad(input.duration_min, input.srpe), ...base },
    { metric_key: 'session_srpe', value: input.srpe, ...base },
    { metric_key: 'session_duration', value: input.duration_min, ...base },
  ];
}
