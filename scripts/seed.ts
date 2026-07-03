import { readFileSync } from 'node:fs';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { addDaysIso, localDateInTz } from '../src/lib/dates';
import type { Database } from '../src/lib/supabase/database.types';
import {
  checkInObservations,
  type EmittedObservation,
  sessionObservations,
} from '../src/modules/fitness/capture/emission';
import type { CheckInInput, Lift, SessionInput } from '../src/modules/fitness/capture/schemas';
import {
  computeSnapshot,
  type ObservationLite,
  signalSummary,
} from '../src/modules/fitness/engine/snapshot';
import { computeTrends } from '../src/modules/fitness/engine/trends';
import { toImportRows } from '../src/modules/fitness/integrations/import';
import type { DeviceObservation } from '../src/modules/fitness/integrations/types';

/**
 * Synthetic 28-day seed for a disposable DEMO subject (MVP validation).
 *
 * Reuses the REAL write path: the pure emission layer (checkInObservations /
 * sessionObservations) + the atomic save_* RPCs, authenticated with the anon
 * key (RLS applies as the demo user — no service-role key, Harness R3/G-000).
 *
 * The narrative is designed so TODAY's engine snapshot fires all three flags
 * (acwr, readiness_drop, monotony_high) with every unlock open:
 *   days 1–21  healthy baseline (varied moderate load, good sleep/readiness)
 *   days 22–28 overreaching block (sustained high monotonous load; sleep and
 *              readiness crash, readiness hits 2 on the last two days)
 *
 * Usage:
 *   pnpm seed -- --dry-run   generate + preview the snapshot (no DB, no auth)
 *   pnpm seed                also sign in as the demo user and write via RPC
 *
 * Env (from .env.local or the shell): NEXT_PUBLIC_SUPABASE_URL,
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY, SEED_EMAIL, SEED_PASSWORD.
 */

const TZ = 'America/Argentina/Buenos_Aires';
const DEMO_DISPLAY_NAME = 'Demo';
const MODALITIES = ['gym', 'running', 'rugby'] as const;

type PlannedSession = { input: SessionInput; startedAt: string };
type PlannedDay = { date: string; checkin: CheckInInput; sessions: PlannedSession[] };

// --- tiny deterministic helpers (stable output across runs → idempotent) -----

/** FNV-1a 32-bit hash of a string → seed for the PRNG / uuid derivation. */
function hash32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32 PRNG — deterministic [0,1) stream from a numeric seed. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic UUID (v7-shaped bits) from a seed string — stable session ids. */
function deterministicUuid(seed: string): string {
  const rnd = mulberry32(hash32(seed));
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) bytes[i] = Math.floor(rnd() * 256);
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x70; // version 7
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80; // RFC 4122 variant
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Round to the nearest 0.25 h (matches the capture form's sleep granularity). */
function quarter(h: number): number {
  return Math.round(h * 4) / 4;
}

/** Round to 1 decimal (bodyweight/distance granularity). */
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// --- V2.1 outcomes narrative (ADR-023) ---------------------------------------
// Layered onto the same 28-day story WITHOUT touching duration_min/srpe, so
// daily loads (and therefore all 3 V2.0 flags) stay byte-identical.

/** i (0-indexed day) → bodyweight point. Baseline drift, +0.6 bump in overreach. */
const BODYWEIGHT_DAYS = new Set([0, 4, 7, 11, 14, 18, 21, 25]);
function bodyweightFor(i: number): number {
  const trend = 80.6 - 0.05 * i;
  return round1(i >= 21 ? trend + 0.6 : trend);
}

function nutritionAdherenceFor(dayNum: number, i: number): number {
  if (dayNum < 22) return i % 2 === 0 ? 5 : 4;
  const step = dayNum - 22; // 0..6
  return step < 4 ? 3 : 2;
}

const ALCOHOL_DAYS = new Set([13, 24, 26]);

/** i → named-lift top set for the baseline gym days (creeping weights). */
const BASELINE_LIFT: Record<number, { lift: Lift; weightKg: number; reps: number }> = {
  0: { lift: 'squat', weightKg: 100, reps: 5 },
  6: { lift: 'bench', weightKg: 70, reps: 5 },
  9: { lift: 'squat', weightKg: 107.5, reps: 5 },
  12: { lift: 'deadlift', weightKg: 120, reps: 5 },
  18: { lift: 'bench', weightKg: 75, reps: 5 },
};

/** i → rugby match rating for baseline days (training days stay untagged). */
const BASELINE_MATCH_RATING: Record<number, number> = { 2: 4, 14: 5, 20: 4 };

/** i → target pace (min/km) for baseline running days — steady easy pace. */
const BASELINE_RUNNING_PACE: Record<number, number> = {
  1: 5.1,
  4: 5.2,
  10: 5.0,
  13: 5.3,
  16: 5.15,
};

/** i → rugby match rating for overreach days not reassigned to gym/running. */
const OVERREACH_MATCH_RATING: Record<number, number> = { 24: 2 };

type SessionOutcomeExtra = Partial<
  Pick<
    SessionInput,
    'lift' | 'top_set_weight_kg' | 'top_set_reps' | 'distance_km' | 'is_match' | 'match_rating'
  >
>;

// --- V2.2 passive-input device narrative (ADR-024) ---------------------------
// Layered onto the SAME 28-day story via the REAL import_observations RPC, two
// batches (whoop/api, apple_health/file) — exercises both provenance shapes,
// no key collision (D3: hrv split, resting_hr shared, sleep_device own key).

/** i (0-indexed day) → Whoop recovery score. d1-21: 65-85 oscillation; d22-28: 55→38. */
function recoveryScoreFor(i: number): number {
  if (i < 21) return 65 + (i % 5) * 5; // 65/70/75/80/85 repeating
  const step = i - 21; // 0..6
  return Math.round(55 - ((55 - 38) / 6) * step);
}

/** i → Whoop HRV RMSSD (ms). d1-21: ~75±8; d22-28: ramps down ~15%. */
function hrvRmssdFor(i: number): number {
  const base = 75;
  if (i < 21) {
    const wobble = i % 3 === 0 ? 8 : i % 3 === 1 ? -8 : 0;
    return round1(base + wobble);
  }
  const step = i - 21; // 0..6
  return round1(base * (1 - 0.15 * (step / 6)));
}

/** i → Apple HRV SDNN (ms). Distinct measurand from RMSSD (~1.7x, D3 HRV split). */
function hrvSdnnFor(i: number): number {
  return round1(hrvRmssdFor(i) * 1.7);
}

/** i → resting heart rate (bpm), shared key. d1-21: ~52; d22-28: +5 bpm. */
function restingHrFor(i: number): number {
  if (i < 21) return 52;
  const step = i - 21; // 0..6
  return Math.round(52 + 5 * (step / 6));
}

/** Device sleep tracks manual sleep_hours minus a small underreport offset. */
function sleepDeviceFor(manualSleepHours: number): number {
  return quarter(manualSleepHours - 0.4);
}

function buildDeviceObservations(days: PlannedDay[]): {
  whoop: DeviceObservation[];
  apple: DeviceObservation[];
} {
  const whoop: DeviceObservation[] = [];
  const apple: DeviceObservation[] = [];
  days.forEach((day, i) => {
    whoop.push(
      { metric_key: 'recovery_score', value: recoveryScoreFor(i), date: day.date },
      { metric_key: 'hrv_rmssd', value: hrvRmssdFor(i), date: day.date },
      { metric_key: 'resting_hr', value: restingHrFor(i), date: day.date },
    );
    apple.push(
      { metric_key: 'hrv_sdnn', value: hrvSdnnFor(i), date: day.date },
      {
        metric_key: 'sleep_device',
        value: sleepDeviceFor(day.checkin.sleep_hours),
        date: day.date,
      },
    );
  });
  return { whoop, apple };
}

function previewDevices(days: PlannedDay[]): void {
  const { whoop, apple } = buildDeviceObservations(days);
  const { rows: whoopRows, droppedCount: whoopDropped } = toImportRows(whoop);
  const { rows: appleRows, droppedCount: appleDropped } = toImportRows(apple);
  console.log('— Device import preview —');
  console.log(
    `  whoop/api: ${whoopRows.length} rows planned (${whoopDropped} dropped out-of-range)`,
  );
  console.log(
    `  apple_health/file: ${appleRows.length} rows planned (${appleDropped} dropped out-of-range)`,
  );
}

async function writeDeviceBatches(
  supabase: SupabaseClient<Database>,
  days: PlannedDay[],
  subjectId: string,
): Promise<void> {
  const { whoop, apple } = buildDeviceObservations(days);
  const { rows: whoopRows } = toImportRows(whoop);
  const { rows: appleRows } = toImportRows(apple);

  const whoopRes = await supabase.rpc('import_observations', {
    batch: { subject_id: subjectId, provider: 'whoop', kind: 'api' },
    observations: whoopRows,
  });
  if (whoopRes.error) throw new Error(`import_observations (whoop): ${whoopRes.error.message}`);

  const appleRes = await supabase.rpc('import_observations', {
    batch: { subject_id: subjectId, provider: 'apple_health', kind: 'file' },
    observations: appleRows,
  });
  if (appleRes.error)
    throw new Error(`import_observations (apple_health): ${appleRes.error.message}`);

  console.log(
    `Device batches written: whoop/api ${whoopRows.length} obs, apple_health/file ${appleRows.length} obs.`,
  );
}

// --- narrative generation ----------------------------------------------------

function generateDays(subjectId: string, today: string): PlannedDay[] {
  const days: PlannedDay[] = [];

  for (let i = 0; i < 28; i++) {
    const date = addDaysIso(today, -(27 - i));
    const dayNum = i + 1; // 1..28
    const overreaching = dayNum >= 22;

    const checkin = overreaching ? overreachingCheckin(date, dayNum) : baselineCheckin(date, i);
    const sessions = overreaching
      ? overreachingSessions(subjectId, date, i)
      : baselineSessions(subjectId, date, i);

    days.push({ date, checkin, sessions });
  }
  return days;
}

/** Days 1–21: rested, varied readiness (non-zero SD so baselines form). */
function baselineCheckin(date: string, i: number): CheckInInput {
  let readiness = 4;
  if (i % 5 === 0) readiness = 5;
  else if (i % 7 === 0) readiness = 3;
  return {
    date,
    sleep_hours: quarter(7.25 + (i % 3) * 0.5), // 7.25 / 7.75 / 8.25
    sleep_quality: i % 5 === 0 ? 5 : 4,
    readiness,
    soreness: 1 + (i % 2), // 1 or 2
    stress: i % 3 === 0 ? 2 : 1,
    bodyweight_kg: BODYWEIGHT_DAYS.has(i) ? bodyweightFor(i) : undefined,
    nutrition_adherence: nutritionAdherenceFor(i + 1, i),
    alcohol: ALCOHOL_DAYS.has(i),
    caffeine: i % 2 === 0,
  };
}

/** Days 1–21: one moderate session most days, ~1 rest day per 4 days. */
function baselineSessions(subjectId: string, date: string, i: number): PlannedSession[] {
  if (i % 4 === 3) return []; // rest day (real 0 load)
  const srpe = 4 + (i % 3); // 4..6
  const durationMin = 50 + (i % 4) * 10; // 50..80
  const modality = MODALITIES[i % 3] ?? 'gym';

  let extra: SessionOutcomeExtra = {};
  const namedLift = BASELINE_LIFT[i];
  if (modality === 'gym' && namedLift) {
    extra = {
      lift: namedLift.lift,
      top_set_weight_kg: namedLift.weightKg,
      top_set_reps: namedLift.reps,
    };
  } else if (modality === 'rugby' && i in BASELINE_MATCH_RATING) {
    extra = { is_match: true, match_rating: BASELINE_MATCH_RATING[i] };
  } else if (modality === 'running' && i in BASELINE_RUNNING_PACE) {
    const target = BASELINE_RUNNING_PACE[i] as number;
    extra = { distance_km: round1(durationMin / target) };
  }

  return [buildSession(subjectId, date, 0, modality, durationMin, srpe, extra)];
}

/** Days 22–28: poor sleep, readiness stepping down to 2 on the last two days. */
function overreachingCheckin(date: string, dayNum: number): CheckInInput {
  let readiness = 4;
  if (dayNum >= 27) readiness = 2;
  else if (dayNum >= 25) readiness = 3;
  const step = dayNum - 22; // 0..6
  const i = dayNum - 1;
  return {
    date,
    sleep_hours: quarter(6.5 - step * 0.15), // ~6.5 → ~5.6
    sleep_quality: 2,
    readiness,
    soreness: 4 + (step % 2), // 4 or 5
    stress: 3 + (step % 2), // 3 or 4
    bodyweight_kg: BODYWEIGHT_DAYS.has(i) ? bodyweightFor(i) : undefined,
    nutrition_adherence: nutritionAdherenceFor(dayNum, i),
    alcohol: ALCOHOL_DAYS.has(i),
    caffeine: i % 2 === 0,
  };
}

/**
 * Days 22–28: one sustained high session daily, low variance → high monotony.
 * duration/srpe are UNCHANGED from the pre-V2.1 formula (daily loads — and
 * therefore all 3 V2.0 flags — stay byte-identical); only 3 days are
 * reassigned to a different modality to exercise gym/running outcomes, which
 * doesn't affect session_load.
 */
function overreachingSessions(subjectId: string, date: string, i: number): PlannedSession[] {
  const srpe = 8;
  const durationMin = 82 + (i % 4) * 2; // 82..88 → loads ~656..704

  if (i === 22) {
    // Gym squat with fewer reps than the baseline PR — a visible e1RM stall.
    return [
      buildSession(subjectId, date, 0, 'gym', durationMin, srpe, {
        lift: 'squat',
        top_set_weight_kg: 110,
        top_set_reps: 4,
      }),
    ];
  }
  if (i === 23) {
    const distanceKm = round1(durationMin / 6.2); // pace target ~6.2 min/km, slowing
    return [
      buildSession(subjectId, date, 0, 'running', durationMin, srpe, { distance_km: distanceKm }),
    ];
  }
  if (i === 25) {
    return [
      buildSession(subjectId, date, 0, 'gym', durationMin, srpe, {
        lift: 'bench',
        top_set_weight_kg: 76,
        top_set_reps: 4,
      }),
    ];
  }

  const extra: SessionOutcomeExtra =
    i in OVERREACH_MATCH_RATING ? { is_match: true, match_rating: OVERREACH_MATCH_RATING[i] } : {};
  return [buildSession(subjectId, date, 0, 'rugby', durationMin, srpe, extra)];
}

/** Build a session with a deterministic id and a per-slot backfill instant. */
function buildSession(
  subjectId: string,
  date: string,
  slot: number,
  modality: (typeof MODALITIES)[number],
  durationMin: number,
  srpe: number,
  extra: SessionOutcomeExtra = {},
): PlannedSession {
  const id = deterministicUuid(`${subjectId}:${date}:${slot}`);
  // Distinct hour per slot so same-day sessions never collide on the
  // observations unique(subject, metric, effective_at, source) key.
  const hour = [13, 22][slot] ?? 13;
  const startedAt = `${date}T${String(hour).padStart(2, '0')}:00:00.000Z`;
  const input: SessionInput = {
    id,
    date,
    modality,
    duration_min: durationMin,
    srpe,
    is_match: false,
    ...extra,
  };
  return { input, startedAt };
}

// --- engine preview (self-check before touching the DB) ----------------------

function allObservations(days: PlannedDay[]): ObservationLite[] {
  const obs: ObservationLite[] = [];
  for (const day of days) {
    for (const o of checkInObservations(day.checkin, true)) obs.push(toLite(o));
    for (const s of day.sessions) {
      for (const o of sessionObservations(s.input, s.startedAt, true)) obs.push(toLite(o));
    }
  }
  return obs;
}

function toLite(o: EmittedObservation): ObservationLite {
  return { metric_key: o.metric_key, value: o.value, effective_date: o.effective_date };
}

function previewSnapshot(days: PlannedDay[], today: string): void {
  const snap = computeSnapshot(allObservations(days), today);
  const openUnlocks = snap.unlocks.filter((u) => u.unlocked).map((u) => u.key);
  const lockedUnlocks = snap.unlocks
    .filter((u) => !u.unlocked)
    .map((u) => `${u.key}(${u.remaining})`);

  console.log('— Engine preview (computed by the real snapshot code) —');
  console.log(
    `  today=${snap.today} historyDays=${snap.historyDays} checkins=${snap.checkinCount}`,
  );
  console.log(
    `  todayLoad=${snap.todayLoad} weekLoad=${snap.weekLoad} prevWeekLoad=${snap.prevWeekLoad} weekLoadDeltaPct=${snap.weekLoadDeltaPct}`,
  );
  console.log(
    `  acute7=${snap.acute7} chronic28=${snap.chronic28} acwr=${JSON.stringify(snap.acwr)}`,
  );
  console.log(`  monotony=${JSON.stringify(snap.monotony)} strain=${JSON.stringify(snap.strain)}`);
  console.log(`  readiness=${JSON.stringify(snap.readiness)} sleep=${JSON.stringify(snap.sleep)}`);
  console.log(`  unlocked=[${openUnlocks.join(', ')}] locked=[${lockedUnlocks.join(', ')}]`);
  console.log(
    `  flags=[${snap.flags.map((f) => f.kind).join(', ')}] signals=${JSON.stringify(signalSummary(snap.flags))}`,
  );

  const wantFlags = ['acwr', 'readiness_drop', 'monotony_high'];
  const gotFlags = new Set<string>(snap.flags.map((f) => f.kind));
  const missing = wantFlags.filter((f) => !gotFlags.has(f));
  if (missing.length > 0) {
    console.warn(`  ⚠ expected flags missing: ${missing.join(', ')}`);
  } else {
    console.log('  ✓ all three target flags fire on today');
  }
}

/** V2.1 (ADR-023): validates the outcomes path end-to-end before any DB write. */
function previewOutcomes(days: PlannedDay[], today: string): void {
  const { outcomes } = computeTrends(allObservations(days), today);
  console.log('— Outcomes preview (computed by the real trends code) —');
  console.log(
    `  bodyweight: ${outcomes.bodyweight.points.length} pts, last=${JSON.stringify(outcomes.bodyweight.last)}`,
  );
  for (const lift of ['squat', 'bench', 'deadlift', 'ohp'] as const) {
    const s = outcomes.e1rm[lift];
    console.log(`  e1rm.${lift}: ${s.points.length} pts, last=${JSON.stringify(s.last)}`);
  }
  console.log(
    `  pace: ${outcomes.pace.points.length} pts, last=${JSON.stringify(outcomes.pace.last)}, mean=${outcomes.pace.mean}`,
  );
  console.log(
    `  matchRating: ${outcomes.matchRating.points.length} pts, last=${JSON.stringify(outcomes.matchRating.last)}, mean=${outcomes.matchRating.mean}`,
  );
  console.log(`  nutrition7d: ${JSON.stringify(outcomes.nutrition7d)}`);
}

// --- DB write path (auth + RPC) ----------------------------------------------

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var ${name} (set it in .env.local or the shell)`);
  return v;
}

async function resolveDemoSubjectId(supabase: SupabaseClient<Database>): Promise<string> {
  const email = requireEnv('SEED_EMAIL');
  const password = requireEnv('SEED_PASSWORD');

  let signIn = await supabase.auth.signInWithPassword({ email, password });
  if (signIn.error) {
    // First run: try to create the demo user via anon sign-up, then sign in.
    const signUp = await supabase.auth.signUp({ email, password });
    if (signUp.error) {
      throw new Error(`Cannot sign in or sign up demo user: ${signUp.error.message}`);
    }
    if (!signUp.data.session) {
      throw new Error(
        `Demo user created but needs confirmation. In the Supabase dashboard (project ` +
          `athlete-os) → Authentication → Users, confirm ${email} (Auto Confirm), then re-run.`,
      );
    }
    signIn = await supabase.auth.signInWithPassword({ email, password });
    if (signIn.error) throw new Error(`Sign-in after sign-up failed: ${signIn.error.message}`);
  }

  const userId = signIn.data.user?.id;
  if (!userId) throw new Error('Signed in but no user id returned');

  const existing = await supabase.from('subjects').select('id').eq('user_id', userId).maybeSingle();
  if (existing.error) throw new Error(`subjects lookup failed: ${existing.error.message}`);
  if (existing.data) return existing.data.id;

  const inserted = await supabase
    .from('subjects')
    .insert({ user_id: userId, display_name: DEMO_DISPLAY_NAME, timezone: TZ })
    .select('id')
    .single();
  if (inserted.error) throw new Error(`subject creation failed: ${inserted.error.message}`);
  return inserted.data.id;
}

async function writeDays(
  supabase: SupabaseClient<Database>,
  days: PlannedDay[],
  subjectId: string,
): Promise<void> {
  let checkins = 0;
  let sessions = 0;
  for (const day of days) {
    const checkinRes = await supabase.rpc('save_daily_checkin', {
      checkin: { ...day.checkin, subject_id: subjectId, backfilled: true },
      observations: checkInObservations(day.checkin, true),
    });
    if (checkinRes.error)
      throw new Error(`save_daily_checkin ${day.date}: ${checkinRes.error.message}`);
    checkins++;

    for (const s of day.sessions) {
      const sessionRes = await supabase.rpc('save_training_session', {
        session: {
          id: s.input.id,
          subject_id: subjectId,
          modality: s.input.modality,
          started_at: s.startedAt,
          date: s.input.date,
          duration_min: s.input.duration_min,
          srpe: s.input.srpe,
          notes: null,
          backfilled: true,
          lift: s.input.lift ?? null,
          top_set_weight_kg: s.input.top_set_weight_kg ?? null,
          top_set_reps: s.input.top_set_reps ?? null,
          distance_km: s.input.distance_km ?? null,
          is_match: s.input.is_match,
          match_rating: s.input.match_rating ?? null,
        },
        observations: sessionObservations(s.input, s.startedAt, true),
      });
      if (sessionRes.error) {
        throw new Error(`save_training_session ${s.input.date}: ${sessionRes.error.message}`);
      }
      sessions++;
    }
    process.stdout.write(`\r  wrote ${checkins}/28 days, ${sessions} sessions`);
  }
  process.stdout.write('\n');
}

// --- minimal .env.local loader (no dependency) -------------------------------

function loadEnvLocal(): void {
  let text: string;
  try {
    text = readFileSync('.env.local', 'utf8');
  } catch {
    return; // rely on shell-provided env
  }
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

// --- main --------------------------------------------------------------------

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const today = localDateInTz(TZ);

  if (dryRun) {
    // subject id is irrelevant for the engine preview; a fixed placeholder keeps
    // session ids deterministic and matches what a real run would generate.
    const days = generateDays('dry-run-subject', today);
    console.log(`Generated 28 days ending ${today} (dry run — no DB writes).`);
    previewSnapshot(days, today);
    previewOutcomes(days, today);
    previewDevices(days);
    return;
  }

  loadEnvLocal();
  const url = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
  const anonKey = requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  const supabase = createClient<Database>(url, anonKey);

  const subjectId = await resolveDemoSubjectId(supabase);
  console.log(`Demo subject ${subjectId} — seeding 28 days ending ${today}.`);

  const days = generateDays(subjectId, today);
  previewSnapshot(days, today);
  previewOutcomes(days, today);
  previewDevices(days);
  await writeDays(supabase, days, subjectId);
  await writeDeviceBatches(supabase, days, subjectId);

  console.log('Done. Log in as the demo user to see unlocks + flags in-app.');
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
