# Skills — command/capability playbooks for this repo (load on demand)
# Terse entries: ## <name> · goal · commands · gotchas. Harvested from journal episodes.

## seed-demo-data
Goal: (re)build the 28-day synthetic history for the disposable demo subject (ADR-020).
Commands: `pnpm seed -- --dry-run` (preview via the REAL computeSnapshot + computeTrends —
validate narrative first, incl. an outcomes summary), then `pnpm seed` (needs SEED_EMAIL/
SEED_PASSWORD in env or `.env.local`). Expected since V2.1 (ADR-023): 28 checkins / 23
sessions / 324 observations (was 209); re-run is idempotent (same counts, 0 dupe groups);
all unlocks open + all 3 flags fire; e1RM per-lift counts squat 3 / bench 3 / deadlift 1 /
ohp 0 (exercises both the ≥2-points chart gate and its empty state).
Gotchas: demo subject is demo@athleteos.app (disposable; NEVER seed the real users — DoD
clock). Auth user was SQL-seeded → if recreating it, follow G-007 (token cols = '', identities
row). Extending the narrative per feature is the V2 methodology (roadmap §C). The subject
accumulates history across session days (rolling 28d window) — manual in-app testing against
it leaves stray rows with non-deterministic ids; clean them up via SQL if they pollute a
demo/screenshot (harmless to the seed's own idempotency check, which only reasons about ITS
OWN deterministic ids).

## weekly-coach-run
Goal: weekly synthesis at $0 (ADR-016). Use the /coach repo skill — it fetches spine data via
the Supabase MCP, computes the deterministic briefing (`pnpm briefing`), reasons, and inserts
labeled insights (weekly_synthesis + hypotheses) that render in the Coach tab.
Gotchas: per-subject discipline is procedural (D7 privacy wall — one subject per run, never
mix contexts). Real users need ~1wk of data before the first meaningful run; the demo subject
always works. The skill's raw-data SQL hardcodes an explicit `metric_key in (...)` allowlist
mirroring ENGINE_METRICS (src/modules/fitness/engine/service.ts) — ANY new engine metric
(e.g. V2.1 outcomes, ADR-023) must be added there too, or it silently vanishes from every
future briefing with no error.

## deploy
Goal: ship to production. Since ADR-021: push to `main` = auto prod deploy (Vercel git
integration); other branches get preview URLs. Manual `vercel deploy` (ADR-018) obsolete.
Gotchas: prod smoke after deploy = public login + PWA plumbing (manifest/sw) + Supabase+RLS +
SW active. .env.production is committed by design (publishable-only values; RLS is the boundary).
