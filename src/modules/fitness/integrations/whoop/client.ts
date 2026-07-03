import type { z } from 'zod';
import { WHOOP_API_BASE, WHOOP_SCOPE, WHOOP_TOKEN_URL, type WhoopConfig } from './config';
import {
  type WhoopRecovery,
  type WhoopSleep,
  whoopPaginatedResponse,
  whoopRecovery,
  whoopSleep,
  whoopTokenResponse,
} from './types';

/** Thrown when Whoop rejects a refresh token (revoked/expired) — caller sets reauth_required. */
export class WhoopInvalidGrantError extends Error {
  constructor() {
    super('Whoop refresh token invalid or expired (invalid_grant)');
    this.name = 'WhoopInvalidGrantError';
  }
}

const DEFAULT_TIMEOUT_MS = 4000;

async function tokenRequest(config: WhoopConfig, body: Record<string, string>, timeoutMs: number) {
  const res = await fetch(WHOOP_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      ...body,
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!res.ok) {
    let errorCode: unknown;
    try {
      errorCode = (await res.json())?.error;
    } catch {
      // non-JSON error body: fall through to generic failure below
    }
    if (errorCode === 'invalid_grant') throw new WhoopInvalidGrantError();
    throw new Error(`Whoop token request failed: ${res.status}`);
  }

  return whoopTokenResponse.parse(await res.json());
}

export async function exchangeCodeForToken(
  config: WhoopConfig,
  code: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
) {
  return tokenRequest(
    config,
    { grant_type: 'authorization_code', code, redirect_uri: config.redirectUri },
    timeoutMs,
  );
}

/** Scope MUST be re-sent on refresh or Whoop narrows the granted scope (offline required). */
export async function refreshAccessToken(
  config: WhoopConfig,
  refreshToken: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
) {
  return tokenRequest(
    config,
    { grant_type: 'refresh_token', refresh_token: refreshToken, scope: WHOOP_SCOPE },
    timeoutMs,
  );
}

async function drainPaginated<T>(
  path: string,
  accessToken: string,
  params: { start: string; end: string },
  schema: z.ZodType<T>,
  timeoutMs: number,
): Promise<T[]> {
  const records: T[] = [];
  let nextToken: string | null | undefined;

  do {
    const url = new URL(`${WHOOP_API_BASE}${path}`);
    url.searchParams.set('start', params.start);
    url.searchParams.set('end', params.end);
    url.searchParams.set('limit', '25');
    if (nextToken) url.searchParams.set('next_token', nextToken);

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) throw new Error(`Whoop API request failed: ${res.status} (${path})`);

    const page = whoopPaginatedResponse(schema).parse(await res.json());
    records.push(...page.records);
    nextToken = page.next_token;
  } while (nextToken);

  return records;
}

export async function fetchRecoveries(
  accessToken: string,
  start: string,
  end: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<WhoopRecovery[]> {
  return drainPaginated('/recovery', accessToken, { start, end }, whoopRecovery, timeoutMs);
}

export async function fetchSleep(
  accessToken: string,
  start: string,
  end: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<WhoopSleep[]> {
  return drainPaginated('/activity/sleep', accessToken, { start, end }, whoopSleep, timeoutMs);
}
