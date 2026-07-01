/** Minimal runtime health signal — used by the smoke test and (later) a /health route. */
export function appHealth(): { ok: true; ts: number } {
  return { ok: true, ts: Date.now() };
}
