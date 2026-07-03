import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { getCurrentSubject } from '@/core/subjects/service';
import { createClient } from '@/lib/supabase/server';
import { exchangeCodeForToken } from '@/modules/fitness/integrations/whoop/client';
import {
  getWhoopConfig,
  WHOOP_SCOPE,
  WHOOP_STATE_COOKIE,
} from '@/modules/fitness/integrations/whoop/config';
import { syncWhoop } from '@/modules/fitness/integrations/whoop/sync';

/**
 * Whoop OAuth2 callback (ADR-024 D6/D8) — the repo's first route handler.
 * Stays behind the proxy auth gate (src/proxy.ts matcher covers /api/*): the
 * user must already be logged in when connecting, so this only ever links
 * Whoop to an ALREADY-authenticated subject.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const fuentesUrl = new URL('/fuentes', request.url);

  const config = getWhoopConfig();
  if (!config) {
    fuentesUrl.searchParams.set('whoop_error', 'not_configured');
    return NextResponse.redirect(fuentesUrl);
  }

  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');
  const cookieStore = await cookies();
  const expectedState = cookieStore.get(WHOOP_STATE_COOKIE)?.value;
  cookieStore.delete(WHOOP_STATE_COOKIE);

  if (!code || !state || !expectedState || state !== expectedState) {
    fuentesUrl.searchParams.set('whoop_error', 'invalid_state');
    return NextResponse.redirect(fuentesUrl);
  }

  const subject = await getCurrentSubject();
  if (!subject) {
    fuentesUrl.searchParams.set('whoop_error', 'no_session');
    return NextResponse.redirect(fuentesUrl);
  }

  try {
    const token = await exchangeCodeForToken(config, code);
    const supabase = await createClient();
    const { data: connection, error } = await supabase
      .from('device_connections')
      .upsert(
        {
          subject_id: subject.id,
          provider: 'whoop',
          status: 'connected',
          access_token: token.access_token,
          refresh_token: token.refresh_token,
          token_expires_at: new Date(Date.now() + token.expires_in * 1000).toISOString(),
          scope: token.scope ?? WHOOP_SCOPE,
          last_sync_status: null,
          last_synced_at: null,
        },
        { onConflict: 'subject_id,provider' },
      )
      .select('*')
      .single();
    if (error || !connection) throw new Error(error?.message ?? 'upsert failed');

    await syncWhoop(supabase, connection, subject.id, subject.timezone, 0);

    fuentesUrl.searchParams.set('connected', '1');
    return NextResponse.redirect(fuentesUrl);
  } catch {
    fuentesUrl.searchParams.set('whoop_error', 'connect_failed');
    return NextResponse.redirect(fuentesUrl);
  }
}
