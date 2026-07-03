/**
 * Whoop OAuth2 config (ADR-024 D1/D8): server-only, env-gated. Whoop devices
 * are weeks away — until `WHOOP_CLIENT_ID` etc. are set (Vercel + .env.local,
 * device-arrival ritual, M5), every caller sees `null` and the UI shows
 * "Próximamente". Never import this from a client component.
 */
export type WhoopConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

export const WHOOP_AUTHORIZE_URL = 'https://api.prod.whoop.com/oauth/oauth2/auth';
export const WHOOP_TOKEN_URL = 'https://api.prod.whoop.com/oauth/oauth2/token';
export const WHOOP_API_BASE = 'https://api.prod.whoop.com/developer/v2';
export const WHOOP_SCOPE = 'offline read:recovery read:sleep';
export const WHOOP_STATE_COOKIE = 'whoop_oauth_state';

export function getWhoopConfig(): WhoopConfig | null {
  const clientId = process.env.WHOOP_CLIENT_ID;
  const clientSecret = process.env.WHOOP_CLIENT_SECRET;
  const redirectUri = process.env.WHOOP_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) return null;
  return { clientId, clientSecret, redirectUri };
}
