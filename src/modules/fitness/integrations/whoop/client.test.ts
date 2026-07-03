import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  exchangeCodeForToken,
  fetchRecoveries,
  refreshAccessToken,
  WhoopInvalidGrantError,
} from './client';
import type { WhoopConfig } from './config';

const config: WhoopConfig = {
  clientId: 'client-id',
  clientSecret: 'client-secret',
  redirectUri: 'https://app.example.com/api/whoop/callback',
};

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 400): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('exchangeCodeForToken', () => {
  it('exchanges an auth code for a token pair', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        access_token: 'at',
        refresh_token: 'rt',
        expires_in: 3600,
        scope: 'offline',
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await exchangeCodeForToken(config, 'auth-code');
    expect(result).toEqual({
      access_token: 'at',
      refresh_token: 'rt',
      expires_in: 3600,
      scope: 'offline',
    });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(String(init.body)).toContain('grant_type=authorization_code');
    expect(String(init.body)).toContain('code=auth-code');
  });
});

describe('refreshAccessToken', () => {
  it('returns a rotated token pair on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse({ access_token: 'at2', refresh_token: 'rt2', expires_in: 3600 }),
        ),
    );
    const result = await refreshAccessToken(config, 'old-refresh-token');
    expect(result.access_token).toBe('at2');
    expect(result.refresh_token).toBe('rt2');
  });

  it('throws WhoopInvalidGrantError on invalid_grant', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ error: 'invalid_grant' }, false, 400)),
    );
    await expect(refreshAccessToken(config, 'revoked-token')).rejects.toBeInstanceOf(
      WhoopInvalidGrantError,
    );
  });

  it('throws a generic error on other failures', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ error: 'server_error' }, false, 500)),
    );
    await expect(refreshAccessToken(config, 'token')).rejects.toThrow('Whoop token request failed');
  });
});

describe('fetchRecoveries', () => {
  it('drains all pages following next_token', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ records: [{ cycle_id: 1, score_state: 'SCORED' }], next_token: 'page2' }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ records: [{ cycle_id: 2, score_state: 'SCORED' }], next_token: null }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const records = await fetchRecoveries('access-token', '2026-06-01', '2026-07-01');
    expect(records).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const secondUrl = new URL(String(fetchMock.mock.calls[1]?.[0]));
    expect(secondUrl.searchParams.get('next_token')).toBe('page2');
  });
});
