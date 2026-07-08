# Skills — command/capability playbooks for this repo (load on demand)
# Terse entries: ## <name> · goal · commands · gotchas. Harvested from journal episodes.

## seed-demo-data
Goal: (re)build the 84-day synthetic history for the disposable demo subject (ADR-020,
extended to 84d + planted pattern associations by ADR-025).
Commands: `pnpm seed -- --dry-run` (preview via the REAL computeSnapshot + computeTrends +
computePatternCandidates — validate narrative first, incl. outcomes/recovery/patterns
summaries and mechanical pattern-candidate assertions), then `pnpm seed` (needs SEED_EMAIL/
SEED_PASSWORD in env or `.env.local`). Expected since V2.3 (ADR-025): 84 checkins / 65
sessions; three narrative blocks — days 1-21 original baseline, 22-77 the V2.3 "planted
era" (~12 LOW_SLEEP + ~10 ALCOHOL days with a real effect, caffeine a genuine negative
control), 78-84 the original overreach block reused verbatim; re-run is idempotent (0 dupe
observation groups); all unlocks open incl. `patterns` (56d) + all 3 V2.0 flags fire;
`previewPatterns()` asserts the planted associations surface as candidates with the
correct sign and caffeine stays silent (exit 1 on failure).
Gotchas: demo subject is demo@athleteos.app (disposable; NEVER seed the real users — DoD
clock). Auth user was SQL-seeded → if recreating it, follow G-007 (token cols = '', identities
row). Extending the narrative per feature is the V2 methodology (roadmap §C) — when adding a
new block, keep any REUSED generator functions on their original relative day math (don't
just pass them the new global day index) or their internal day-keyed logic (bump pivots,
named-lift/match days, etc.) silently breaks. The subject accumulates history across session
days (rolling window) — manual in-app testing against it leaves stray rows with non-
deterministic ids; clean them up via SQL if they pollute a demo/screenshot (harmless to the
seed's own idempotency check, which only reasons about ITS OWN deterministic ids).

## weekly-coach-run
Goal: weekly synthesis at $0 (ADR-016). Use the /coach repo skill — it fetches spine data via
the Supabase MCP, computes the deterministic briefing (`pnpm briefing`), reasons, and inserts
labeled insights (weekly_synthesis + hypotheses) that render in the Coach tab.
Gotchas: per-subject discipline is procedural (D7 privacy wall — one subject per run, never
mix contexts). Real users need ~1wk of data before the first meaningful run; the demo subject
always works. The skill's raw-data SQL hardcodes an explicit `metric_key in (...)` allowlist
mirroring ENGINE_METRICS (src/modules/fitness/engine/service.ts) — ANY new engine metric
(e.g. V2.1 outcomes, ADR-023) must be added there too, or it silently vanishes from every
future briefing with no error. Once a subject has ~90 days of history, step 2's SQL result
can exceed the Supabase MCP tool's inline-output size limit — it still saves the full result
to a file (path given in the error), but the JSON is wrapped in the tool's own
`{"result":"...untrusted-data..."}` envelope with escaped quotes; extract the actual `raw`
payload with a small Node script (`JSON.parse` the outer file, slice `[{` … `}]` out of
`.result`, `JSON.parse` that, take `rows[0].raw`) rather than hand-editing it, then feed
that clean JSON to `pnpm briefing`.

## deploy
Goal: ship to production. Since ADR-021: push to `main` = auto prod deploy (Vercel git
integration); other branches get preview URLs. Manual `vercel deploy` (ADR-018) obsolete.
Gotchas: prod smoke after deploy = public login + PWA plumbing (manifest/sw) + Supabase+RLS +
SW active. .env.production is committed by design (publishable-only values; RLS is the boundary).

## whoop-device-arrival (ADR-024)
Goal: turn the fixture-validated Whoop connector into a real, working connection once
Marcos/Thomas's Whoop devices actually arrive.
Steps:
1. Register a WHOOP developer account + app at the Whoop developer dashboard (≤5 apps per
   account). Register BOTH redirect URIs up front: prod (`https://<domain>/api/whoop/callback`)
   and localhost (for local testing) — Whoop requires pre-registered exact redirect URIs.
2. Set `WHOOP_CLIENT_ID` / `WHOOP_CLIENT_SECRET` / `WHOOP_REDIRECT_URI` in Vercel env vars
   (prod) AND `.env.local` (never commit — same rule as every other server secret, R3).
   The moment these are set, `/fuentes` stops showing "Próximamente" for both users.
3. Connect from SAFARI, not the installed PWA, on the first connect. The installed PWA and
   Safari have separate cookie jars on iOS — the OAuth callback could arrive sessionless and
   bounce to /login if connected from inside the installed app (documented risk #2 in the
   plan). Escape hatch if this bites: exempt the callback route from the proxy auth matcher +
   re-associate via the signed `state` cookie instead of session cookies — only build this if
   the Safari workaround proves insufficient in practice.
4. First sync backfills 30 days automatically (sync.ts's first-sync window) — expect a
   `pnpm db:types`-fresh dashboard to populate Tendencias > Recuperación with real history
   within the same session.
5. Confirm the real payload shape matches `whoop/types.ts`'s tolerant Zod schemas — if Whoop's
   actual v2 response has fields this repo's types.ts didn't anticipate, extend the schema
   (loose objects mean extra fields are already tolerated; missing expected fields are not).
Gotchas: this is the FIRST real OAuth flow in the repo — the fixture tests (map.test.ts,
client.test.ts, sync.test.ts) validate the algorithm, not the actual Whoop API contract.
Budget a small fix-forward session for whatever the real API does differently than documented.
