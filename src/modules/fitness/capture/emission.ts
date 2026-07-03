import type { CheckInInput, Lift, SessionInput } from './schemas';

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

/**
 * Deterministic per-id stagger for backfilled sessions (fixes a pre-existing
 * prod bug: `dailyEffectiveAt` alone put every backfilled session on the same
 * yesterday at the identical instant, colliding on `observations_dedupe` via
 * `session_load`). Distinct ids land at distinct seconds within the day;
 * replaying the same id yields the same instant (idempotent).
 */
export function staggeredBackfillInstant(date: string, sessionId: string): string {
  let hash = 0;
  for (let i = 0; i < sessionId.length; i++) {
    hash = (hash * 31 + sessionId.charCodeAt(i)) >>> 0;
  }
  const offsetSeconds = hash % 3600;
  const base = new Date(dailyEffectiveAt(date));
  base.setUTCSeconds(base.getUTCSeconds() + offsetSeconds);
  return base.toISOString();
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
  const obs: EmittedObservation[] = [
    { metric_key: 'sleep_duration', value: input.sleep_hours, ...base },
    { metric_key: 'sleep_quality', value: input.sleep_quality, ...base },
    { metric_key: 'readiness', value: input.readiness, ...base },
    { metric_key: 'soreness', value: input.soreness, ...base },
    { metric_key: 'stress', value: input.stress, ...base },
    // Always emitted (dense series makes "días con alcohol en 7d" well-defined).
    { metric_key: 'alcohol', value: input.alcohol ? 1 : 0, ...base },
    { metric_key: 'caffeine', value: input.caffeine ? 1 : 0, ...base },
  ];
  if (input.bodyweight_kg !== undefined) {
    obs.push({ metric_key: 'bodyweight', value: input.bodyweight_kg, ...base });
  }
  if (input.nutrition_adherence !== undefined) {
    obs.push({ metric_key: 'nutrition_adherence', value: input.nutrition_adherence, ...base });
  }
  return obs;
}

/** Estimated 1RM (Epley), rounded to 0.5 kg — the smallest real plate step. */
export function e1rm(weightKg: number, reps: number): number {
  const raw = reps === 1 ? weightKg : weightKg * (1 + reps / 30);
  return Math.round(raw * 2) / 2;
}

export function paceMinPerKm(durationMin: number, distanceKm: number): number {
  return Math.round((durationMin / distanceKm) * 100) / 100;
}

/** Display-only mm:ss formatting; the stored/engine value stays decimal min/km. */
export function formatPace(pace: number): string {
  const totalSeconds = Math.round(pace * 60);
  const min = Math.floor(totalSeconds / 60);
  const sec = totalSeconds % 60;
  return `${min}:${String(sec).padStart(2, '0')}`;
}

export const E1RM_METRIC_KEY: Record<Exclude<Lift, 'other'>, string> = {
  squat: 'e1rm_squat',
  bench: 'e1rm_bench',
  deadlift: 'e1rm_deadlift',
  ohp: 'e1rm_ohp',
};

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
  const obs: EmittedObservation[] = [
    { metric_key: 'session_load', value: sessionLoad(input.duration_min, input.srpe), ...base },
    { metric_key: 'session_srpe', value: input.srpe, ...base },
    { metric_key: 'session_duration', value: input.duration_min, ...base },
  ];
  if (
    input.modality === 'gym' &&
    input.lift !== undefined &&
    input.lift !== 'other' &&
    input.top_set_weight_kg !== undefined &&
    input.top_set_reps !== undefined
  ) {
    obs.push({
      metric_key: E1RM_METRIC_KEY[input.lift],
      value: e1rm(input.top_set_weight_kg, input.top_set_reps),
      ...base,
    });
  }
  if (input.modality === 'running' && input.distance_km !== undefined) {
    obs.push({ metric_key: 'running_distance', value: input.distance_km, ...base });
    obs.push({
      metric_key: 'running_pace',
      value: paceMinPerKm(input.duration_min, input.distance_km),
      ...base,
    });
  }
  if (input.modality === 'rugby' && input.is_match && input.match_rating !== undefined) {
    obs.push({ metric_key: 'match_rating', value: input.match_rating, ...base });
  }
  return obs;
}
