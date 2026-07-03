import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { toImportRows } from '../import';
import { fetchRecoveries, fetchSleep, refreshAccessToken, WhoopInvalidGrantError } from './client';
import { getWhoopConfig } from './config';
import { mapWhoopToObservations } from './map';

type DeviceConnection = Database['public']['Tables']['device_connections']['Row'];

const REFRESH_MARGIN_MS = 5 * 60 * 1000;
const FIRST_SYNC_WINDOW_DAYS = 30;
const OVERLAP_DAYS = 7;

export type SyncResult =
  | { ok: true; skipped: true }
  | { ok: true; skipped: false; observationCount: number }
  | { ok: false; error: string };

/**
 * Injected side effects (ADR-024 D5) — keeps the sync ALGORITHM (claim →
 * refresh-if-expiring → pull window → map → write → status) pure and
 * testable without mocking the Supabase query builder. `syncWhoop` below
 * wires this to the real client.
 */
export type SyncDeps = {
  /** Conditional UPDATE claim: only true if THIS caller won the race (D5). */
  claim: (connectionId: string, staleHours: number) => Promise<boolean>;
  /** Persists a rotated token pair in ONE update, immediately (D5). */
  persistTokens: (
    connectionId: string,
    tokens: { access_token: string; refresh_token: string; token_expires_at: string },
  ) => Promise<void>;
  setStatus: (
    connectionId: string,
    status: 'connected' | 'reauth_required',
    lastSyncStatus: string,
  ) => Promise<void>;
  importObservations: (
    subjectId: string,
    rows: ReturnType<typeof toImportRows>['rows'],
  ) => Promise<void>;
};

export async function syncWhoopCore(
  connection: DeviceConnection,
  subjectId: string,
  timezone: string,
  deps: SyncDeps,
  staleHours: number,
): Promise<SyncResult> {
  const config = getWhoopConfig();
  if (!config) return { ok: false, error: 'Whoop no está configurado.' };

  const claimed = await deps.claim(connection.id, staleHours);
  if (!claimed) return { ok: true, skipped: true };

  let accessToken = connection.access_token;
  const expiringSoon =
    new Date(connection.token_expires_at).getTime() - Date.now() < REFRESH_MARGIN_MS;
  if (expiringSoon) {
    try {
      const rotated = await refreshAccessToken(config, connection.refresh_token);
      accessToken = rotated.access_token;
      await deps.persistTokens(connection.id, {
        access_token: rotated.access_token,
        refresh_token: rotated.refresh_token,
        token_expires_at: new Date(Date.now() + rotated.expires_in * 1000).toISOString(),
      });
    } catch (err) {
      if (err instanceof WhoopInvalidGrantError) {
        await deps.setStatus(connection.id, 'reauth_required', 'invalid_grant');
        return { ok: false, error: 'Whoop requiere reconexión.' };
      }
      await deps.setStatus(connection.id, 'connected', 'error: token refresh failed');
      return { ok: false, error: 'No se pudo refrescar el token de Whoop.' };
    }
  }

  const now = new Date();
  const from = connection.last_synced_at
    ? new Date(new Date(connection.last_synced_at).getTime() - OVERLAP_DAYS * 86_400_000)
    : new Date(now.getTime() - FIRST_SYNC_WINDOW_DAYS * 86_400_000);

  try {
    const [recoveries, sleeps] = await Promise.all([
      fetchRecoveries(accessToken, from.toISOString(), now.toISOString()),
      fetchSleep(accessToken, from.toISOString(), now.toISOString()),
    ]);
    const observations = mapWhoopToObservations(recoveries, sleeps, timezone);
    const { rows } = toImportRows(observations);

    if (rows.length > 0) {
      await deps.importObservations(subjectId, rows);
    }
    await deps.setStatus(connection.id, 'connected', 'ok');
    return { ok: true, skipped: false, observationCount: rows.length };
  } catch (err) {
    await deps.setStatus(connection.id, 'connected', 'error: pull failed');
    return { ok: false, error: err instanceof Error ? err.message : 'Sync de Whoop falló.' };
  }
}

/** Real wiring: Supabase client + the import_observations RPC. */
export function supabaseSyncDeps(supabase: SupabaseClient<Database>): SyncDeps {
  return {
    claim: async (connectionId, staleHours) => {
      const cutoff = new Date(Date.now() - staleHours * 3_600_000).toISOString();
      const { data, error } = await supabase
        .from('device_connections')
        .update({ last_synced_at: new Date().toISOString() })
        .eq('id', connectionId)
        .or(`last_synced_at.is.null,last_synced_at.lt.${cutoff}`)
        .select('id');
      if (error) throw new Error(`claim failed: ${error.message}`);
      return (data?.length ?? 0) > 0;
    },
    persistTokens: async (connectionId, tokens) => {
      const { error } = await supabase
        .from('device_connections')
        .update({ ...tokens, updated_at: new Date().toISOString() })
        .eq('id', connectionId);
      if (error) throw new Error(`persistTokens failed: ${error.message}`);
    },
    setStatus: async (connectionId, status, lastSyncStatus) => {
      const { error } = await supabase
        .from('device_connections')
        .update({ status, last_sync_status: lastSyncStatus, updated_at: new Date().toISOString() })
        .eq('id', connectionId);
      if (error) throw new Error(`setStatus failed: ${error.message}`);
    },
    importObservations: async (subjectId, rows) => {
      const { error } = await supabase.rpc('import_observations', {
        batch: { subject_id: subjectId, provider: 'whoop', kind: 'api' },
        observations: rows,
      });
      if (error) throw new Error(`import_observations failed: ${error.message}`);
    },
  };
}

export async function syncWhoop(
  supabase: SupabaseClient<Database>,
  connection: DeviceConnection,
  subjectId: string,
  timezone: string,
  staleHours: number,
): Promise<SyncResult> {
  return syncWhoopCore(connection, subjectId, timezone, supabaseSyncDeps(supabase), staleHours);
}
