import { readFileSync } from 'node:fs';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { addDaysIso, localDateInTz } from '../src/lib/dates';
import type { Database } from '../src/lib/supabase/database.types';
import {
  checkInObservations,
  type EmittedObservation,
  sessionObservations,
} from '../src/modules/fitness/capture/emission';
import type { CheckInInput, SessionInput } from '../src/modules/fitness/capture/schemas';
import {
  computeSnapshot,
  type ObservationLite,
  signalSummary,
} from '../src/modules/fitness/engine/snapshot';

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
  };
}

/** Days 1–21: one moderate session most days, ~1 rest day per 4 days. */
function baselineSessions(subjectId: string, date: string, i: number): PlannedSession[] {
  if (i % 4 === 3) return []; // rest day (real 0 load)
  const srpe = 4 + (i % 3); // 4..6
  const durationMin = 50 + (i % 4) * 10; // 50..80
  const modality = MODALITIES[i % 3] ?? 'gym';
  return [buildSession(subjectId, date, 0, modality, durationMin, srpe)];
}

/** Days 22–28: poor sleep, readiness stepping down to 2 on the last two days. */
function overreachingCheckin(date: string, dayNum: number): CheckInInput {
  let readiness = 4;
  if (dayNum >= 27) readiness = 2;
  else if (dayNum >= 25) readiness = 3;
  const step = dayNum - 22; // 0..6
  return {
    date,
    sleep_hours: quarter(6.5 - step * 0.15), // ~6.5 → ~5.6
    sleep_quality: 2,
    readiness,
    soreness: 4 + (step % 2), // 4 or 5
    stress: 3 + (step % 2), // 3 or 4
  };
}

/** Days 22–28: one sustained high session daily, low variance → high monotony. */
function overreachingSessions(subjectId: string, date: string, i: number): PlannedSession[] {
  const srpe = 8;
  const durationMin = 82 + (i % 4) * 2; // 82..88 → loads ~656..704
  return [buildSession(subjectId, date, 0, 'rugby', durationMin, srpe)];
}

/** Build a session with a deterministic id and a per-slot backfill instant. */
function buildSession(
  subjectId: string,
  date: string,
  slot: number,
  modality: (typeof MODALITIES)[number],
  durationMin: number,
  srpe: number,
): PlannedSession {
  const id = deterministicUuid(`${subjectId}:${date}:${slot}`);
  // Distinct hour per slot so same-day sessions never collide on the
  // observations unique(subject, metric, effective_at, source) key.
  const hour = [13, 22][slot] ?? 13;
  const startedAt = `${date}T${String(hour).padStart(2, '0')}:00:00.000Z`;
  const input: SessionInput = { id, date, modality, duration_min: durationMin, srpe };
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
  await writeDays(supabase, days, subjectId);

  console.log('Done. Log in as the demo user to see unlocks + flags in-app.');
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
