import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Database } from '@/lib/supabase/database.types';
import * as client from './client';
import { WhoopInvalidGrantError } from './client';
import type { SyncDeps } from './sync';
import { syncWhoopCore } from './sync';

type DeviceConnection = Database['public']['Tables']['device_connections']['Row'];

function connection(overrides: Partial<DeviceConnection> = {}): DeviceConnection {
  return {
    id: 'conn-1',
    subject_id: 'subj-1',
    provider: 'whoop',
    status: 'connected',
    access_token: 'access-token',
    refresh_token: 'refresh-token',
    token_expires_at: new Date(Date.now() + 3_600_000).toISOString(),
    external_user_id: null,
    scope: 'offline read:recovery read:sleep',
    last_synced_at: null,
    last_sync_status: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function fakeDeps(overrides: Partial<SyncDeps> = {}): SyncDeps {
  return {
    claim: vi.fn().mockResolvedValue(true),
    persistTokens: vi.fn().mockResolvedValue(undefined),
    setStatus: vi.fn().mockResolvedValue(undefined),
    importObservations: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

beforeEach(() => {
  process.env.WHOOP_CLIENT_ID = 'id';
  process.env.WHOOP_CLIENT_SECRET = 'secret';
  process.env.WHOOP_REDIRECT_URI = 'https://app.example.com/api/whoop/callback';
  vi.spyOn(client, 'fetchRecoveries').mockResolvedValue([]);
  vi.spyOn(client, 'fetchSleep').mockResolvedValue([]);
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.WHOOP_CLIENT_ID;
  delete process.env.WHOOP_CLIENT_SECRET;
  delete process.env.WHOOP_REDIRECT_URI;
});

describe('syncWhoopCore', () => {
  it('returns not-configured when env is unset', async () => {
    delete process.env.WHOOP_CLIENT_ID;
    const deps = fakeDeps();
    const result = await syncWhoopCore(
      connection(),
      'subj-1',
      'America/Argentina/Buenos_Aires',
      deps,
      6,
    );
    expect(result).toEqual({ ok: false, error: 'Whoop no está configurado.' });
    expect(deps.claim).not.toHaveBeenCalled();
  });

  it('skips when the claim loses the race (already synced recently)', async () => {
    const deps = fakeDeps({ claim: vi.fn().mockResolvedValue(false) });
    const result = await syncWhoopCore(
      connection(),
      'subj-1',
      'America/Argentina/Buenos_Aires',
      deps,
      6,
    );
    expect(result).toEqual({ ok: true, skipped: true });
  });

  it('refreshes and persists a rotated token pair BEFORE pulling, when expiring soon', async () => {
    const refreshSpy = vi.spyOn(client, 'refreshAccessToken').mockResolvedValue({
      access_token: 'new-access',
      refresh_token: 'new-refresh',
      expires_in: 3600,
    });
    const calls: string[] = [];
    const deps = fakeDeps({
      persistTokens: vi.fn().mockImplementation(async () => {
        calls.push('persistTokens');
      }),
      importObservations: vi.fn().mockImplementation(async () => {
        calls.push('importObservations');
      }),
    });
    const expiringConn = connection({
      token_expires_at: new Date(Date.now() + 1000).toISOString(),
    });

    const result = await syncWhoopCore(
      expiringConn,
      'subj-1',
      'America/Argentina/Buenos_Aires',
      deps,
      6,
    );

    expect(refreshSpy).toHaveBeenCalledWith(expect.anything(), 'refresh-token');
    expect(deps.persistTokens).toHaveBeenCalledWith('conn-1', {
      access_token: 'new-access',
      refresh_token: 'new-refresh',
      token_expires_at: expect.any(String),
    });
    expect(calls[0]).toBe('persistTokens'); // rotation persisted before any pull-derived write
    expect(result.ok).toBe(true);
  });

  it('sets reauth_required on invalid_grant during refresh', async () => {
    vi.spyOn(client, 'refreshAccessToken').mockRejectedValue(new WhoopInvalidGrantError());
    const deps = fakeDeps();
    const expiringConn = connection({
      token_expires_at: new Date(Date.now() + 1000).toISOString(),
    });

    const result = await syncWhoopCore(
      expiringConn,
      'subj-1',
      'America/Argentina/Buenos_Aires',
      deps,
      6,
    );

    expect(result.ok).toBe(false);
    expect(deps.setStatus).toHaveBeenCalledWith('conn-1', 'reauth_required', 'invalid_grant');
    expect(deps.importObservations).not.toHaveBeenCalled();
  });

  it('writes observations via the RPC and marks status ok on a happy pull', async () => {
    vi.spyOn(client, 'fetchRecoveries').mockResolvedValue([
      { cycle_id: 1, sleep_id: 's1', score_state: 'SCORED', score: { recovery_score: 70 } },
    ]);
    vi.spyOn(client, 'fetchSleep').mockResolvedValue([
      {
        id: 's1',
        start: '2026-07-01T06:00:00.000Z',
        end: '2026-07-01T09:00:00.000Z',
        nap: false,
        score_state: 'SCORED',
        score: { stage_summary: { total_light_sleep_time_milli: 6 * 3_600_000 } },
      },
    ]);
    const deps = fakeDeps();

    const result = await syncWhoopCore(
      connection(),
      'subj-1',
      'America/Argentina/Buenos_Aires',
      deps,
      6,
    );

    expect(result).toEqual({ ok: true, skipped: false, observationCount: 2 });
    expect(deps.importObservations).toHaveBeenCalledWith('subj-1', expect.any(Array));
    expect(deps.setStatus).toHaveBeenCalledWith('conn-1', 'connected', 'ok');
  });

  it('uses a 30d first-sync window when last_synced_at is null, 7d overlap otherwise', async () => {
    const recoveriesSpy = vi.spyOn(client, 'fetchRecoveries').mockResolvedValue([]);
    const deps = fakeDeps();

    await syncWhoopCore(connection({ last_synced_at: null }), 'subj-1', 'UTC', deps, 6);
    const [, firstStart] = recoveriesSpy.mock.calls[0] as unknown as [string, string, string];
    const daysAgo = (Date.now() - new Date(firstStart).getTime()) / 86_400_000;
    expect(daysAgo).toBeGreaterThan(29);
    expect(daysAgo).toBeLessThan(31);

    recoveriesSpy.mockClear();
    const lastSynced = new Date(Date.now() - 2 * 86_400_000).toISOString();
    await syncWhoopCore(connection({ last_synced_at: lastSynced }), 'subj-1', 'UTC', deps, 6);
    const [, secondStart] = recoveriesSpy.mock.calls[0] as unknown as [string, string, string];
    const overlapDays =
      (new Date(lastSynced).getTime() - new Date(secondStart).getTime()) / 86_400_000;
    expect(overlapDays).toBeCloseTo(7, 1);
  });
});
