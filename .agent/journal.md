# Journal — raw episode log (Episodes layer of the knowledge loop)
# Append-only. Opportunistic capture; harvested at milestones into decisions/guardrails/skills.

## Session 1 — 2026-07-01 — Zero to feature-complete MVP v1

Arc: pre-approved design (D1-D12) → scaffold → data substrate → capture slice → deterministic
engine → dashboards → $0 AI layer. Every milestone verify-GREEN + Playwright-E2E-verified.

Shipped (commits):
- 9838034 scaffold: locked stack (Next 16 App Router, TS strict, Tailwind 4, Biome, Vitest, .agent/)
- 77a0ac6 substrate: metrics registry + observations spine (3 provenance classes, dedupe key)
  + daily_checkins/training_sessions/insights, RLS-first; 3 migrations applied to cloud;
  security advisor 0 findings; typed clients + generated DB types
- 4a10de3 capture: auth (login-only) + Next 16 proxy session gate + onboarding + tap-first
  forms (<60s, Hoy/Ayer backfill flagged) + atomic save/re-emit RPCs; spine emission
  verified row-by-row in DB
- bb810b8 engine: EWMA 7/28 (Williams), ACWR bands-as-flags, Foster monotony/strain, 28d
  baselines + z, readiness-drop flag, PROGRESSIVE UNLOCK w/ countdowns; "Estado de hoy" panel
- 7cd068d dashboards: /trends server-rendered SVG (zero deps) — load+EWMA chart, sleep/readiness
  trends w/ personal mean + visual gaps, Monday weekly summary
- 0afd828 $0 AI layer (ADR-016): deterministic briefing (D1/D2 contract embedded) + Coach tab
  (insights confirm/reject + copy-briefing) + /coach repo skill (owner's Claude subscription:
  MCP fetch → `pnpm briefing` does ALL math → reason → insert insights)

Decisions locked: ADR-001..016 (decisions.md). Notable pivot: ADR-016 — AI at $0 (Marcos's
cost constraint) replaced ADR-009's paid-API mechanics; briefing = stable provider-agnostic
interface.

Errors → guardrails born (anti-fragility loop fired 4 times):
- G-001 `biome migrate` silently disabled all lints while verify stayed green (probe files!)
- G-002 with_server.py leaves a zombie node holding the port on Windows (kill before rerun)
- G-003 vitest/vite does NOT read tsconfig "paths" (mirror alias in vitest.config)
- G-004 E2E scripts must be idempotent across reruns (state-dependent button labels)
- G-000 standing owner ban: Supabase project "yogastasis" untouchable (not error-born)

Candidate patterns for GLOBAL /scaffold hardening (promotion bar ≥2 projects; seen_in:
[athlete-os] only, do NOT promote yet): G-001 probe-after-config-migration; G-003 vitest
alias mirror.

Infra facts: Supabase cloud "athlete-os" id=zidgpigxtuzpnjvinidx (sa-east-1, free tier).
Users: marcosnovella99@ + thomasnovella12@gmail.com (real, siloed per D7, SQL-seeded because
the built-in mailer rate-limits signUp) + marcosnovella99+e2e@gmail.com (test silo,
disposable). No service-role key stored anywhere, by choice. Marcos rewrote R3 → agent
manages .env; he removed guard.mjs's stale .env-deny himself (auto-mode classifier correctly
blocked me from weakening my own guard hook).

State at close: pnpm verify GREEN (49 tests, 10 files) + E2E PASS across the 3 tabs.
Open: first real /coach run needs ~1wk of data; PWA manifest/offline pending (D12 gap);
Vercel deploy declined for now; DoD gate = 4-week capture habit (both users).

## Session 2 — 2026-07-01 — PWA/offline + first production deploy
(backfilled at harvest from state.md/decisions.md/guardrails.md)

Arc: closed the last D12 gap (offline-capable PWA at zero deps, ADR-017: hand-rolled sw.js,
IndexedDB write queue, <OfflineSync/> FIFO replay, terminal server rejections), then first
Vercel production deploy (ADR-018: CLI from local, committed .env.production with
publishable-only values). LIVE at https://athlete-os-pink.vercel.app, prod smoke 4/4.
verify GREEN (53 tests) + offline E2E 8/8 on the prod build.

Errors → guardrails born:
- G-005 netstat cleanup parsed TIME_WAIT rows carrying PID 0/4 and taskkill'd system PIDs
  (denied, no harm) — filter to LISTENING rows FIRST.

## Session 3 — 2026-07-02 — Visual redesign "vestuario antes del amanecer"
(backfilled at harvest)

Arc: full reskin per ADR-019 — dark-first green-cast ink + single sodium-amber accent,
Barlow (Condensed) + Geist Mono, pulse-line signature mark, tokens in @theme so reskin =
token swap; sw bumped to v2. verify GREEN (53) + offline E2E 8/8 on prod build. App
installed on BOTH phones; Thomas logged in → DoD 4-week clock running.

Errors → guardrails born:
- G-006 batch regex reskin through PowerShell 5.1 Get-Content/Set-Content mojibaked
  BOM-less UTF-8 accents across 3 files — never round-trip source through PS5.1 text
  cmdlets; Edit tool or [IO.File]::ReadAllText/WriteAllText with explicit UTF8.

## Session 4 — 2026-07-02 — Synthetic 28-day seed for a disposable demo subject
(backfilled at harvest)

Arc: ADR-020 — scripts/seed.ts + `pnpm seed` (--dry-run previews the REAL computeSnapshot)
backfills a 28-day narrative (21d baseline → 7d overreaching) for demo@athleteos.app
through the REAL write path (emission.ts + save_* RPCs, anon key, RLS — no service-role).
Loaded 28 checkins / 23 sessions / 209 observations; re-run idempotent (same counts, 0
dupes). In-app: all unlocks open, all 3 flags fire (ACWR 1.55, readiness z -2.78, monotony
38.39). Keeps the DoD clock clean (real users untouched). verify GREEN (53).

Errors → guardrails born:
- G-007 hand-crafted auth.users INSERT made GoTrue 500 on sign-in until ALL token/change
  varchar columns were set to '' (+ matching auth.identities row; identities.email is
  GENERATED).

## Session 5 — 2026-07-02 — First /coach run + git remote + push-to-deploy
(backfilled at harvest)

Arc: ran /coach against the seeded demo subject — deterministic briefing via `pnpm
briefing`, reasoned, wrote back 1 weekly_synthesis + 1 hypothesis, both render in the Coach
tab (ADR-016 loop closed end-to-end at $0). Fixed pre-existing G-006-residue mojibake in
coach/page.tsx + OnboardingForm.tsx. Merged feat/test-data-seed → main (ff); ADR-021:
created GitHub repo MarcosNovella/athlete-os, connected Vercel via dashboard OAuth (MCP
can't do it headlessly) — push to main = auto prod deploy, branches = previews.

## Session 6 — 2026-07-02 — V2 direction locked (discussion only, no code)
(backfilled at harvest)

Arc: wrote .agent/roadmap.md — §A interpretation-layer spec (bands live in the ENGINE not
the UI; ACWR gauge/ribbon, monotony/strain bands + cap, z magnitude tiers, relative %
framing, weekly-table tinting, tappable info glossary), §B V2 sequencing APPROVED (outcomes
→ passive import → pattern-candidates; nutrition ordinal-only), §C seed-first methodology
(extend the ADR-020 demo narrative per feature so time-gated unlocks never block dev).
Wearables: both users getting Whoop soon → Whoop API = primary V2.2 target.

> HARVESTED through Session 6 (2026-07-02) on 2026-07-02 → 0 ADRs (all 21 already filed), 3 playbooks (skills.md created), 8 candidates C-001..C-008 (all new, seen_in 1 — none promotable), 1 memory updated (llm-wiki-knowledge-loop)

## Session 7 — 2026-07-02 — Knowledge loop complete (harness work, no product code)

Arc: built the full 2026-06-26 design in one sitting — /harvest (milestone distillation,
inaugural run backfilled this journal S2-S6 + seeded global candidates C-001..C-008),
/query (query-file-back w/ strict cost/recurrence/stability bar), /lint-knowledge
(cross-scope: dups/contradictions/stale/orphans/conventions), and /scaffold's "Inherit
knowledge" step (candidates load into new repos' guardrails at boot; inheritance ≠
seen_in evidence). ≥2-projects promotion bar SETTLED by Marcos. Inaugural lint: clean;
its one false positive became G-008 + C-009 (bash backslash-escapes-$ in double quotes).

## Session 8 — 2026-07-02 — V2.0 interpretation layer: built, E2E'd, LIVE

Arc: roadmap §A complete (all 9 items, ADR-022) on feat/interpretation-layer, 9
milestone commits each verify-GREEN (58→85 tests). Engine owns ALL interpretation
(bands/cap '>5'/z tiers/strain rank/deltas/ghost/signalSummary); UI renders (gauge +
ribbon server-SVG, 5-tier badges, tinted weekly table, popover glossary, señales cue);
briefing tells the same story. Pre-work landed on main: PostgREST pagination fix
(uncommitted diff found at session start) + .gitattributes eol=lf. Validation per §C:
seed dry-run all-green + Playwright E2E 27/27 vs prod build (incl. 390px + popover
light-dismiss). Merged ff + pushed (Marcos: "push de todo") → prod deploy READY, smoke
4/4. V2.0 LIVE.

Errors → guardrails born:
- G-009 verify opened RED on committed-clean files: autocrlf smudged CRLF vs Biome's LF
  — .gitattributes `* text=auto eol=lf` makes checkouts byte-stable (candidate C-010).
- G-010 E2E results print died on 'Δ' under cp1252 and masked the outcome twice — run
  Python that prints non-ASCII with PYTHONIOENCODING=utf-8 on Windows (candidate C-011).
- G-002 struck twice more (zombie node holding :3000 across with_server runs) — the
  existing guardrail's kill-first ritual resolved both.

## Session 9 — 2026-07-03 — V2.1 Outcomes: planned only (Marcos: "frenate")

Arc: plan-mode session, zero code. Diagnosed the roadmap §B gap (app captures load +
state but no OUTCOMES, so "what makes me better/worse" is unanswerable and V2.3's
pattern engine has nothing to accumulate). Wrote the 7-milestone V2.1 plan (migration →
schemas/emission/backfill-stagger fix → forms+prefill → trends.outcomes 90d →
Rendimiento UI → briefing → seed+E2E+ADR+merge), folding in Marcos's 4 UX decisions
(fixed lift selector, bodyweight in check-in, rugby partido-toggle, nutrition ordinal
included now) and a pre-existing bug found while reading actions.ts (backfilled
same-day sessions collide on observations_dedupe — scoped as an M2 fix rather than a
standalone hotfix, since M2 already touches the emission/backfill code). Marcos stopped
here explicitly to review the plan before touching code.

## Session 10 — 2026-07-03 — V2.1 Outcomes: built, merged, LIVE

Arc: executed the Session 9 plan via /execute, all 7 milestones on feat/outcomes, each
verify-GREEN (85→123 tests). M1 migration (nullable columns + cross-field CHECKs + 11
metrics + RPC replace) applied via MCP. M2 Zod superRefine + pure emission (e1RM Epley
round 0.5kg/reps=1 passthrough, pace round2, staggeredBackfillInstant fixing the
dedupe-collision bug). M3 collapsed check-in fields + modality-conditional session
forms, verified in-browser against the demo subject (save → reload → prefilled →
re-save, values persist). M4 trends.outcomes over the already-fetched 90d window
(same-date dedup: e1rm max/PR semantics, pace+rating mean). M5 Rendimiento section
(4 cards, e1RM gated to ≥2 points, MetricChart connectGaps + flat-range guard). M6
briefing "Resultados (outcomes)" section. M7 extended the seed narrative to 324 obs
(was 209), hit the plan's per-lift counts EXACTLY (squat 3/bench 3/deadlift 1/ohp 0) on
the first real run; ADR-023 filed. Merged ff → main (Marcos: "hace el merge... si tenes
que usar harvest, query, lint, etc. hacelo") → prod deploy READY; smoke passed (session
persists, Tendencias/Coach render gracefully for a real fresh user with 0 outcomes,
manifest+SW active, RLS data loads).

Errors → guardrails born:
- Found (not self-inflicted, but caught and fixed in-session): the /coach skill's
  raw-data SQL hardcoded the pre-V2.1 `metric_key in (...)` allowlist — every future
  weekly synthesis would have silently omitted outcomes with no error. Fixed to mirror
  ENGINE_METRICS; noted in skills.md as a sync gotcha (candidate: "hardcoded metric-key
  allowlists rot silently — reference or generate from the single source of truth
  instead of copying the literal list").
- Found (pre-existing, NOT caused by V2.1, left unfixed — out of scope for this plan):
  prod console shows a React hydration error (#418) on "/" traced to the Hero/InfoTip
  markup in TodayStatePanel.tsx (a `<p>` containing the InfoTip popover `<div>`/`<p>`) —
  last touched in the ADR-022 (V2.0) session, not this one. Flagged for a separate fix.

> HARVESTED through Session 10 (2026-07-03) on 2026-07-03 → 0 ADRs (ADR-023 already filed inline), 0 new playbooks (skills.md already updated inline in M7), 1 candidate (C-012, new, seen_in 1 — not promotable), 1 memory (feedback: run harvest/query/lint proactively at milestones)

## Session 11 — 2026-07-03 — V2.2 Passive Inputs: planned + built + hardened, all in one session

Arc: planned V2.2 (plan-only per Marcos "me la pasas y frenamos ahí", plan approved at
plans\vamos-a-planificar-la-lazy-meadow.md), then executed the full 5-milestone plan via
/execute in a follow-up session on feat/passive-inputs, each milestone verify-GREEN
(123→166 tests across the arc).

M1 substrate: migration (5 recovery metrics, device_connections + import_batches RLS-first,
import_observations atomic RPC — upsert-only, source='import' hardcoded so it can only
converge onto other import rows) applied via MCP; ENGINE_METRICS + coach SQL allowlist
extended same milestone (C-012 sync points). Seed narrative extended with two device
batches (whoop/api, apple_health/file) through the REAL RPC — validated idempotent via
MCP SQL spot-check (28 unique obs per metric after 2 runs, 0 dupes, 2 audit batches).

M2 Apple HAE file import: tolerant Zod parser (unknown metrics ignored, malformed rows
skipped+counted never fatal, both asleep/totalSleep field variants, same-day multi-sample
averaging to avoid same-batch dedupe-key collisions), Server Action upload (4MB guard),
new /fuentes 4th tab. Verified in-browser against the demo subject's seeded batch.

M3 Whoop OAuth connector: full v2 integration (token exchange, rotation-aware refresh
with invalid_grant detection, paginated recovery/sleep fetch, wake-date attribution via
the linked sleep's end, conditional-UPDATE claim so only one caller syncs), env-gated
null-config → "Próximamente" since devices are weeks away. Injected-deps design on
sync.ts kept the algorithm testable without mocking the Supabase query builder. First
route handler in the repo (/api/whoop/callback). Guardrail G-011 born here (see below).

M4 surfacing: trends.ts recovery block (28d sparse series + baseline mean, no flag/
snapshot changes), Tendencias "Recuperación" section (5 conditional charts, empty state
→ "conectá una fuente"), briefing "## Recuperación (dato de dispositivo)" section,
check-in sleep prefill (today's sleep_device, editable, only shown pre-check-in), 3
glossary entries (vfc explains the RMSSD≠SDNN split). Verified via `pnpm briefing`
against the demo subject's REAL seeded data (showed the week-4 recovery deterioration
story) and in-browser Tendencias rendering.

M5 hardening: E2E validated the /fuentes upload flow WITHOUT a committed Playwright
file — no such file existed in the repo from prior sessions (past "E2E N/N" runs were
ad-hoc browser-automation sessions, not committed tests) — instead drove the real
Server Action end-to-end via the preview browser: constructed a synthetic HAE JSON File
in-page (Blob → File → DataTransfer, no native file-picker automation needed), uploaded
twice, confirmed via MCP SQL that the second upload converged (3 obs, no dupes, 4 audit
batches). This temporarily overwrote the demo subject's crafted 2026-07-02 narrative
values — re-ran `pnpm seed` afterward to restore them (confirmed via SQL). ADR-024 filed,
roadmap.md marked V2.2 shipped, device-arrival ritual documented in skills.md.

Errors → guardrails born:
- [G-011] A `'use server'` file may ONLY export async functions — WHOOP_STATE_COOKIE
  (a plain const) co-located in actions.ts broke the Next.js build ("Only async
  functions are allowed to be exported in a 'use server' file"). Caught by in-browser
  verification, NOT by tsc/vitest (the module graph error only surfaces at bundle time)
  — reinforces why UI milestones need the browser check even when static verify is
  green. Fixed by moving the constant to config.ts.

Merge gate PENDING: branch pushed, Vercel preview not yet requested — Marcos to review
before merge (per house style, no auto-merge without explicit approval).

> HARVESTED through Session 11 (2026-07-03) on 2026-07-03 → 0 ADRs (ADR-024 already filed inline), 1 playbook (whoop-device-arrival, already added inline in M5), 1 candidate (C-013, new, seen_in 1 — not promotable), 0 memories
