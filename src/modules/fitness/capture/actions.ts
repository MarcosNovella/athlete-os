'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentSubject } from '@/core/subjects/service';
import { addDaysIso, localDateInTz } from '@/lib/dates';
import { createClient } from '@/lib/supabase/server';
import { checkInObservations, dailyEffectiveAt, sessionObservations } from './emission';
import { checkInInput, sessionInput } from './schemas';

export type ActionResult = { ok: true } | { ok: false; error: string };

/** ADR-013: capture is allowed for today or yesterday only; yesterday is flagged. */
function resolveBackfill(
  date: string,
  timezone: string,
): { ok: true; backfilled: boolean } | { ok: false } {
  const today = localDateInTz(timezone);
  if (date === today) return { ok: true, backfilled: false };
  if (date === addDaysIso(today, -1)) return { ok: true, backfilled: true };
  return { ok: false };
}

export async function saveCheckIn(raw: unknown): Promise<ActionResult> {
  const parsed = checkInInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: 'Datos inválidos.' };

  const subject = await getCurrentSubject();
  if (!subject) return { ok: false, error: 'Sesión expirada. Volvé a entrar.' };

  const window = resolveBackfill(parsed.data.date, subject.timezone);
  if (!window.ok) return { ok: false, error: 'Solo se puede registrar hoy o ayer.' };

  const supabase = await createClient();
  const { error } = await supabase.rpc('save_daily_checkin', {
    checkin: { ...parsed.data, subject_id: subject.id, backfilled: window.backfilled },
    observations: checkInObservations(parsed.data, window.backfilled),
  });
  if (error) return { ok: false, error: 'No se pudo guardar. Probá de nuevo.' };

  revalidatePath('/');
  return { ok: true };
}

export async function saveSession(raw: unknown): Promise<ActionResult> {
  const parsed = sessionInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: 'Datos inválidos.' };

  const subject = await getCurrentSubject();
  if (!subject) return { ok: false, error: 'Sesión expirada. Volvé a entrar.' };

  const window = resolveBackfill(parsed.data.date, subject.timezone);
  if (!window.ok) return { ok: false, error: 'Solo se puede registrar hoy o ayer.' };

  // Today's sessions anchor at the real save moment; backfilled ones at the
  // canonical daily instant (deterministic under the dedupe key, ADR-011).
  const startedAt = window.backfilled
    ? dailyEffectiveAt(parsed.data.date)
    : new Date().toISOString();

  const supabase = await createClient();
  const { error } = await supabase.rpc('save_training_session', {
    session: {
      id: parsed.data.id,
      subject_id: subject.id,
      modality: parsed.data.modality,
      started_at: startedAt,
      date: parsed.data.date,
      duration_min: parsed.data.duration_min,
      srpe: parsed.data.srpe,
      notes: parsed.data.notes ?? null,
      backfilled: window.backfilled,
    },
    observations: sessionObservations(parsed.data, startedAt, window.backfilled),
  });
  if (error) return { ok: false, error: 'No se pudo guardar. Probá de nuevo.' };

  revalidatePath('/');
  return { ok: true };
}
