'use server';

import { randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getCurrentSubject } from '@/core/subjects/service';
import { createClient } from '@/lib/supabase/server';
import { getWhoopConfig, WHOOP_AUTHORIZE_URL, WHOOP_SCOPE, WHOOP_STATE_COOKIE } from './config';
import { syncWhoop } from './sync';

/** Server Action: redirects to Whoop's authorize URL with a CSRF state cookie. */
export async function connectWhoop(): Promise<void> {
  const config = getWhoopConfig();
  if (!config) throw new Error('Whoop no está configurado.');

  const subject = await getCurrentSubject();
  if (!subject) throw new Error('Sesión expirada.');

  const state = randomBytes(16).toString('hex'); // well over the 8-char minimum
  const cookieStore = await cookies();
  cookieStore.set(WHOOP_STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  });

  const url = new URL(WHOOP_AUTHORIZE_URL);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('redirect_uri', config.redirectUri);
  url.searchParams.set('scope', WHOOP_SCOPE);
  url.searchParams.set('state', state);
  redirect(url.toString());
}

export type SyncNowResult = { ok: true; observationCount: number } | { ok: false; error: string };

export async function syncWhoopNow(): Promise<SyncNowResult> {
  const subject = await getCurrentSubject();
  if (!subject) return { ok: false, error: 'Sesión expirada.' };

  const supabase = await createClient();
  const { data: connection, error } = await supabase
    .from('device_connections')
    .select('*')
    .eq('subject_id', subject.id)
    .eq('provider', 'whoop')
    .maybeSingle();
  if (error) return { ok: false, error: 'No se pudo leer la conexión.' };
  if (!connection) return { ok: false, error: 'Whoop no está conectado.' };

  // Manual button: throttled to ~1 min (staleHours ≈ 1/60) rather than the
  // 6h on-open threshold (D5) — prevents accidental double-taps, not real syncs.
  const result = await syncWhoop(supabase, connection, subject.id, subject.timezone, 1 / 60);
  revalidatePath('/fuentes');
  if (!result.ok) return { ok: false, error: result.error };
  if (result.skipped) return { ok: true, observationCount: 0 };
  return { ok: true, observationCount: result.observationCount };
}

export async function disconnectWhoop(): Promise<void> {
  const subject = await getCurrentSubject();
  if (!subject) return;

  const supabase = await createClient();
  await supabase
    .from('device_connections')
    .delete()
    .eq('subject_id', subject.id)
    .eq('provider', 'whoop');
  revalidatePath('/fuentes');
}
